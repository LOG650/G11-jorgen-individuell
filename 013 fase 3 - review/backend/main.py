"""
NautiCost API — FastAPI backend for voyage cost prediction.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model import (
    predict_voyage,
    estimate_fuel,
    get_size_category,
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
class VoyageRequest(BaseModel):
    gt: float = Field(..., gt=0, description="Gross tonnage")
    loa: float = Field(..., gt=0, description="Length overall (m)")
    beam: float = Field(..., gt=0, description="Beam width (m)")
    draft: float = Field(..., gt=0, description="Draft depth (m)")
    fuel: str = Field("medium", description='Fuel: "low", "medium", "high", or a number in L/h')
    country: str = Field(..., description="Country (Norway, Sweden, Denmark)")
    stay: float = Field(..., gt=0, description="Stay duration (days)")
    month: int = Field(..., ge=1, le=12, description="Month (1-12)")


class PortDetail(BaseModel):
    total: float
    weight: float
    p25: float | None
    p50: float | None
    p75: float | None


class WeightedRange(BaseModel):
    p25: float
    p50: float
    p75: float


class VoyageResponse(BaseModel):
    category_totals: dict[str, float]
    grand_total: float
    size_category: str
    loskrav: str
    fuel_lph: float
    port_details: dict[str, PortDetail]
    weighted_range: WeightedRange


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


@app.post("/api/predict", response_model=VoyageResponse)
def predict(req: VoyageRequest):
    if req.country not in COUNTRY_PORTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown country '{req.country}'. Valid: {', '.join(sorted(COUNTRY_PORTS))}",
        )

    if req.fuel in ("low", "medium", "high"):
        fuel_lph = estimate_fuel(req.gt, req.fuel)
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
        country=req.country,
        stay_days=req.stay,
        month=req.month,
    )
    result["fuel_lph"] = fuel_lph
    return result
