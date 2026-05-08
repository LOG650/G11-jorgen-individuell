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

# Training data (cockpit reports + costs_clean.csv) is denominated in EUR.
# Outputs are converted to the requested currency at the API boundary.
# Update these constants periodically against an authoritative source (ECB).
EXCHANGE_RATES_FROM_EUR: dict[str, float] = {
    "EUR": 1.0,
    "NOK": 11.50,   # Reference rate (May 2026); EUR/NOK floats — refresh when stale
    "DKK": 7.46,    # DKK is pegged to EUR at 7.46038 ± 2.25% (ERM II)
}

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
    currency: str = Field("NOK", description='Output currency: "NOK", "DKK", or "EUR"')


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
    currency: str
    exchange_rate_from_eur: float


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
        "currencies": list(EXCHANGE_RATES_FROM_EUR.keys()),
        "exchange_rates_from_eur": EXCHANGE_RATES_FROM_EUR,
    }


# Case-insensitive lookup: "bergen", "BERGEN", "BerGen" -> "Bergen"
_PORT_LOOKUP = {p.casefold(): p for p in PORT_TEMPLATES}


@app.post("/api/predict", response_model=VoyageResponse)
def predict(req: VoyageRequest):
    currency = req.currency.upper()
    if currency not in EXCHANGE_RATES_FROM_EUR:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported currency '{req.currency}'. Supported: {', '.join(EXCHANGE_RATES_FROM_EUR)}",
        )
    fx = EXCHANGE_RATES_FROM_EUR[currency]

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
            stop_range = {
                "p25": round(p25 * fx, 2),
                "p50": round(p50 * fx, 2),
                "p75": round(p75 * fx, 2),
            }

        stops_out.append({
            "port": port,
            "month": stop.month,
            "stay_days": stop.stay_days,
            "total": round(stop_total * fx, 2),
            "historical_range": stop_range,
        })

    voyage_range = (
        {
            "p25": round(agg_p25 * fx, 2),
            "p50": round(agg_p50 * fx, 2),
            "p75": round(agg_p75 * fx, 2),
        }
        if all_have_baseline else None
    )

    return {
        "category_totals": {
            k: round(v * fx, 2)
            for k, v in sorted(aggregated_cats.items(), key=lambda x: -x[1])
        },
        "grand_total": round(grand_total * fx, 2),
        "size_category": size_cat,
        "loskrav": loskrav,
        "fuel_lph": fuel_lph,
        "stops": stops_out,
        "historical_range": voyage_range,
        "currency": currency,
        "exchange_rate_from_eur": fx,
    }
