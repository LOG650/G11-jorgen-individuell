"""
NautiCost API — FastAPI backend for voyage cost prediction.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model import (
    predict_port,
    estimate_fuel,
    get_size_category,
    get_loskrav,
    COUNTRY_PORTS,
    PORT_TEMPLATES,
    HISTORICAL_RANGES,
    meta,
    ensemble_w,
)

app = FastAPI(
    title="NautiCost API",
    description="Voyage cost prediction for superyacht agency services",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ──────────────────────────────────
class PortStop(BaseModel):
    port: str = Field(..., description="Port name (e.g. Bergen, Tromsø, Stockholm)")
    month: int = Field(..., ge=1, le=12, description="Month of arrival (1-12)")
    stay_days: float = Field(..., gt=0, description="Stay duration in days")


class VoyageRequest(BaseModel):
    gt: float = Field(..., gt=0, description="Gross tonnage")
    loa: float = Field(..., gt=0, description="Length overall (m)")
    beam: float = Field(..., gt=0, description="Beam width (m)")
    draft: float = Field(..., gt=0, description="Draft depth (m)")
    fuel: str = Field("medium", description='Fuel: "low", "medium", "high", or a number in L/h')
    stops: list[PortStop] = Field(..., min_length=1, description="Itinerary stops")


class HistoricalRange(BaseModel):
    p25: float
    p50: float
    p75: float


class StopResult(BaseModel):
    port: str
    month: int
    stay_days: float
    total: float
    historical_range: HistoricalRange | None


class VoyageResponse(BaseModel):
    category_totals: dict[str, float]
    grand_total: float
    size_category: str
    loskrav: str
    fuel_lph: float
    stops: list[StopResult]
    historical_range: HistoricalRange | None


# ── Endpoints ───────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model_features": len(meta["features"]),
        "ensemble_weight": ensemble_w,
        "trained_on_rows": meta["trained_on_rows"],
    }


@app.get("/api/options")
def options():
    """Return available countries, ports, and size categories for the frontend."""
    return {
        "countries": list(COUNTRY_PORTS.keys()),
        "ports": {
            country: list(ports.keys())
            for country, ports in COUNTRY_PORTS.items()
        },
        "fuel_levels": ["low", "medium", "high"],
        "months": list(range(1, 13)),
    }


# Case-insensitive lookup: "bergen", "BERGEN", "BerGen" -> "Bergen"
_PORT_LOOKUP = {p.casefold(): p for p in PORT_TEMPLATES}


@app.post("/api/predict", response_model=VoyageResponse)
def predict(req: VoyageRequest):
    fuel = req.fuel.strip().casefold()
    if fuel in ("low", "medium", "high"):
        fuel_lph = estimate_fuel(req.gt, fuel)
    else:
        try:
            fuel_lph = float(req.fuel)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid fuel value: '{req.fuel}'")

    size_cat = get_size_category(req.gt)
    loskrav = get_loskrav(req.loa)

    aggregated_cats: dict[str, float] = {}
    stops_out: list[dict] = []
    grand_total = 0.0
    all_have_baseline = True
    agg_p25 = agg_p50 = agg_p75 = 0.0

    for idx, stop in enumerate(req.stops):
        port = _PORT_LOOKUP.get(stop.port.strip().casefold())
        if port is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Stop {idx + 1}: unknown port '{stop.port}'. "
                    f"Valid: {', '.join(sorted(PORT_TEMPLATES))}"
                ),
            )

        cat_totals, stop_total, _, _ = predict_port(
            gt=req.gt, loa_m=req.loa, beam_m=req.beam, draft_m=req.draft,
            fuel_lph=fuel_lph, arrival_port=port,
            stay_days=stop.stay_days, month=stop.month,
        )

        for k, v in cat_totals.items():
            aggregated_cats[k] = aggregated_cats.get(k, 0.0) + v

        grand_total += stop_total

        hist = HISTORICAL_RANGES.get((port, size_cat))
        if hist is None:
            all_have_baseline = False
            stop_range = None
        else:
            p25, p50, p75 = hist
            agg_p25 += p25
            agg_p50 += p50
            agg_p75 += p75
            stop_range = {"p25": float(p25), "p50": float(p50), "p75": float(p75)}

        stops_out.append({
            "port": port,
            "month": stop.month,
            "stay_days": stop.stay_days,
            "total": round(stop_total, 2),
            "historical_range": stop_range,
        })

    voyage_range = (
        {"p25": agg_p25, "p50": agg_p50, "p75": agg_p75} if all_have_baseline else None
    )

    return {
        "category_totals": {
            k: round(v, 2)
            for k, v in sorted(aggregated_cats.items(), key=lambda x: -x[1])
        },
        "grand_total": round(grand_total, 2),
        "size_category": size_cat,
        "loskrav": loskrav,
        "fuel_lph": fuel_lph,
        "stops": stops_out,
        "historical_range": voyage_range,
    }
