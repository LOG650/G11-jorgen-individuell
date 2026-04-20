"""
NautiCost API — FastAPI backend for voyage cost prediction.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model import (
    predict_voyage,
    estimate_fuel,
    COUNTRY_PORTS,
    PORT_TEMPLATES,
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
class VoyageRequest(BaseModel):
    gt: float = Field(..., gt=0, description="Gross tonnage")
    loa: float = Field(..., gt=0, description="Length overall (m)")
    beam: float = Field(..., gt=0, description="Beam width (m)")
    draft: float = Field(..., gt=0, description="Draft depth (m)")
    fuel: str = Field("medium", description='Fuel: "low", "medium", "high", or a number in L/h')
    port: str = Field(..., description="Arrival / call port (e.g. Bergen, Tromsø, Stockholm)")
    stay: float = Field(..., gt=0, description="Stay duration (days)")
    month: int = Field(..., ge=1, le=12, description="Month (1-12)")


class HistoricalRange(BaseModel):
    p25: float
    p50: float
    p75: float


class VoyageResponse(BaseModel):
    category_totals: dict[str, float]
    grand_total: float
    size_category: str
    loskrav: str
    fuel_lph: float
    port: str
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
    port = _PORT_LOOKUP.get(req.port.strip().casefold())
    if port is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown port '{req.port}'. Valid: {', '.join(sorted(PORT_TEMPLATES))}",
        )

    fuel = req.fuel.strip().casefold()
    if fuel in ("low", "medium", "high"):
        fuel_lph = estimate_fuel(req.gt, fuel)
    else:
        try:
            fuel_lph = float(req.fuel)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid fuel value: '{req.fuel}'")

    result = predict_voyage(
        gt=req.gt,
        loa_m=req.loa,
        beam_m=req.beam,
        draft_m=req.draft,
        fuel_lph=fuel_lph,
        port=port,
        stay_days=req.stay,
        month=req.month,
    )
    result["fuel_lph"] = fuel_lph
    return result
