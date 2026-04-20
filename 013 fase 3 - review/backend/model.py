"""
Model loading and prediction logic for NautiCost.
Wraps the LightGBM+CatBoost ensemble and all lookup tables.
"""

import shutil
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import lightgbm as lgb
from catboost import CatBoostRegressor
import joblib

ART = Path(__file__).parent / "artifacts"

# ── Load artifacts ──────────────────────────────────────────────
_tmp_model = Path(tempfile.gettempdir()) / "lgbm_final_full.txt"
shutil.copy2(ART / "lgbm_final_full.txt", _tmp_model)
lgb_model = lgb.Booster(model_file=str(_tmp_model))

cb_model = CatBoostRegressor()
cb_model.load_model(str(ART / "catboost_final.cbm"))

meta = joblib.load(ART / "model_meta_final.joblib")
ensemble_w = meta.get("ensemble_weight", 0.5)

agg_stats = (
    pd.read_parquet(ART / "size_svc_stats.parquet"),
    pd.read_parquet(ART / "size_stats.parquet"),
    pd.read_parquet(ART / "port_stats.parquet"),
)
baseline_predictions = joblib.load(ART / "baseline_predictions.joblib")


# ── Feature engineering ─────────────────────────────────────────
def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["quarter"] = ((df["month"] - 1) // 3 + 1).astype("int8")
    df["is_summer"] = df["month"].isin([6, 7, 8]).astype("int8")
    df["is_shoulder"] = df["month"].isin([5, 9]).astype("int8")

    if "arrival_date" in df.columns:
        arr = pd.to_datetime(df["arrival_date"], errors="coerce")
        df["day_of_week"] = arr.dt.dayofweek.fillna(2).astype("int8")
        df["week_of_year"] = arr.dt.isocalendar().week.astype("int8")
    else:
        df["day_of_week"] = np.int8(2)
        df["week_of_year"] = ((df["month"] - 1) * 4 + 2).clip(1, 52).astype("int8")

    df["gt_x_stay"] = df["gt"].fillna(0) * df["stay_days"].fillna(0)
    df["loa_x_stay"] = df["loa_m"].fillna(0) * df["stay_days"].fillna(0)
    df["fuel_x_stay"] = df["fuel_lph"].fillna(0) * df["stay_days"].fillna(0)

    size_svc_stats, size_stats, port_stats = agg_stats
    df = df.merge(size_svc_stats, on=["size_category", "service_category"], how="left")
    df = df.merge(size_stats, on="size_category", how="left")
    df = df.merge(port_stats, on="arrival_port", how="left")

    for col in [
        "size_svc_mean_charge", "size_svc_median_charge", "size_svc_count",
        "port_mean_charge", "port_median_charge",
    ]:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median() if df[col].notna().any() else 0)

    cmt = df["invoice_comments"].fillna("").astype(str).str.lower()
    df["cmt_len"] = cmt.str.len().astype("int16")
    return df


def predict_charge(raw_df: pd.DataFrame) -> np.ndarray:
    feats = build_features(raw_df)
    for c in meta["cat_features"]:
        feats[c] = feats[c].astype("category")
    X = feats[meta["features"]]
    lgb_pred = lgb_model.predict(X)
    X_cb = X.copy()
    for c in meta["cat_features"]:
        X_cb[c] = X_cb[c].astype(str).fillna("NA")
    cb_pred = cb_model.predict(X_cb)
    return np.expm1(ensemble_w * lgb_pred + (1 - ensemble_w) * cb_pred)


# ── Lookup tables ───────────────────────────────────────────────
PORT_OFFICE = {
    "Bergen": "Bergen Office", "Esbjerg": "Copenhagen Office",
    "Fredericia": "Copenhagen Office", "Göteborg": "Stockholm OFFICE",
    "Kristiansand": "Bergen Office", "København": "Copenhagen Office",
    "Malmö": "Stockholm OFFICE", "Stavanger": "Bergen Office",
    "Stockholm": "Stockholm OFFICE", "Svolvær": "Bergen Office",
    "Tromsø": "Bergen Office", "Ålesund": "Bergen Office",
}

PORT_TEMPLATES = {
    "Bergen": [
        ("Provisioning", "Provisioning", 0.4),
        ("Port Marina", "Port Dues", 0.3805),
        ("Hospitality", "Transfer Service", 0.3561),
        ("Agency Services", "Custom Clearance", 0.2732),
        ("Agency Services", "Purchasing Assistance", 0.2439),
        ("Port Marina", "Arrival Pilot Fees", 0.1707),
        ("Port Marina", "Mooring/Unmooring Assistance", 0.1317),
        ("Hospitality", "Guide Services", 0.1073),
        ("Agency Services", "Courier", 0.0927),
        ("Technical Services", "Technical Assistance", 0.0732),
        ("Agency Services", "Medical Arrangements", 0.0732),
        ("Agency Fee", "Agency Fees", 0.0732),
        ("Bunkering", "Fuel - Diesel", 0.0488),
        ("Agency Services", "Custom Formalities", 0.039),
        ("Agency Services", "Immigration Formalities", 0.039),
        ("Port Marina", "Pilot Fees Arrival", 0.039),
        ("Hospitality", "Tours / Excursions", 0.039),
        ("Hospitality", "Car Rental", 0.0341),
        ("Port Marina", "NOx Tax", 0.0293),
        ("Agency Fee", "Administrative Fees", 0.0293),
        ("Technical Services", "Technician", 0.0293),
        ("Agency Services", "Storage & Transport", 0.0293),
        ("Provisioning", "Provisioning Assistance", 0.0244),
        ("Agency Services", "Delivery Charge", 0.0244),
        ("Provisioning", "Florist Services", 0.0244),
        ("Hospitality", "Airport Transfer", 0.0195),
        ("Technical Services", "Repair of", 0.0195),
        ("Port Marina", "Garbage Disposal", 0.0195),
        ("Technical Services", "Carpenter Service", 0.0195),
        ("Agency Services", "Agency Services", 0.0146),
        ("Port Marina", "Sludge/Oil/Water Removal", 0.0146),
        ("Technical Services", "Hydraulic Services", 0.0146),
        ("Agency Services", "Doctor/Medical", 0.0146),
        ("Agency Services", "Delivery Services", 0.0098),
        ("Hospitality", "Rental Car", 0.0098),
        ("Bunkering", "Lube Oil Supply", 0.0098),
        ("Technical Services", "Dry Dock/Shipyard Services", 0.0098),
        ("Technical Services", "Diver Services", 0.0098),
    ],
    "Esbjerg": [
        ("Port Marina", "Port Dues", 3.0),
        ("Provisioning", "Provisioning", 3.0),
        ("Hospitality", "Transfer Service", 3.0),
        ("Agency Services", "Custom Clearance", 2.0),
        ("Port Marina", "Mooring/Unmooring Assistance", 2.0),
        ("Hospitality", "Transportation", 2.0),
        ("Agency Services", "Storage & Transport", 2.0),
        ("Agency Services", "International Transport", 1.0),
        ("Agency Services", "Purchasing Assistance", 1.0),
        ("Hospitality", "Hotel Accommodation", 1.0),
        ("Port Marina", "Dirty Water Removal Service", 1.0),
        ("Technical Services", "Technical Assistance", 1.0),
    ],
    "Fredericia": [
        ("Hospitality", "Transfer Service", 5.0),
        ("Port Marina", "Port Dues", 2.0),
        ("Provisioning", "Provisioning", 2.0),
        ("Agency Services", "Medical Arrangements", 1.0),
        ("Hospitality", "Tours / Excursions", 1.0),
        ("Hospitality", "Guide Services", 1.0),
        ("Bunkering", "Fuel - Diesel", 1.0),
        ("Provisioning", "Florist Services", 1.0),
    ],
    "Göteborg": [
        ("Port Marina", "Arrival Pilot Fees", 0.7273),
        ("Bunkering", "Fuel - Diesel", 0.4545),
        ("Agency Services", "Purchasing Assistance", 0.4545),
        ("Hospitality", "Transfer Service", 0.4545),
        ("Provisioning", "Provisioning", 0.3636),
        ("Hospitality", "Rental Car", 0.2727),
        ("Agency Services", "Courier", 0.2727),
        ("Agency Fee", "Agency Fees", 0.1818),
        ("Port Marina", "Port Dues", 0.1818),
        ("Agency Services", "Clearance in/out", 0.1818),
        ("Agency Services", "Delivery Charge", 0.0909),
        ("Agency Services", "Service", 0.0909),
        ("Hospitality", "Laundry/Dry Cleaning", 0.0909),
        ("Hospitality", "Dry Cleaning Services", 0.0909),
        ("Hospitality", "Car Rental", 0.0909),
        ("Agency Services", "Speciality Shipment Items", 0.0909),
        ("Agency Services", "Medical Arrangements", 0.0909),
        ("Technical Services", "Internet Connection", 0.0909),
        ("Technical Services", "Technical Assistance", 0.0909),
        ("Technical Services", "Technician", 0.0909),
    ],
    "Kristiansand": [
        ("Agency Fee", "Agency Fees", 0.75),
        ("Port Marina", "Port Dues", 0.75),
        ("Agency Services", "Clearance in/out", 0.25),
        ("Bunkering", "Fuel - Diesel", 0.25),
    ],
    "København": [
        ("Hospitality", "Transfer Service", 0.3158),
        ("Agency Services", "Purchasing Assistance", 0.2632),
        ("Port Marina", "Port Dues", 0.2105),
        ("Agency Services", "Clearance in/out", 0.1842),
        ("Technical Services", "Technical Assistance", 0.1842),
        ("Port Marina", "Mooring/Unmooring Assistance", 0.1579),
        ("Provisioning", "Provisioning", 0.1579),
        ("Agency Fee", "Agency Fees", 0.1053),
        ("Bunkering", "Fuel - Diesel", 0.1053),
        ("Agency Services", "Agency Services", 0.0263),
    ],
    "Malmö": [
        ("Technical Services", "Boat Work", 2.0),
        ("Provisioning", "Provisioning", 2.0),
        ("Agency Services", "Agency Services", 1.0),
        ("Hospitality", "Transfer Service", 1.0),
        ("Hospitality", "Guide Services", 1.0),
        ("Port Marina", "Port Dues", 1.0),
        ("Port Marina", "Mooring/Unmooring Assistance", 1.0),
    ],
    "Stavanger": [
        ("Port Marina", "Port Dues", 2.0),
        ("Agency Fee", "Agency Fees", 1.0),
    ],
    "Stockholm": [
        ("Hospitality", "Transfer Service", 0.5172),
        ("Port Marina", "Port Dues", 0.4828),
        ("Provisioning", "Provisioning", 0.3103),
        ("Port Marina", "Mooring/Unmooring Assistance", 0.3103),
        ("Agency Services", "Purchasing Assistance", 0.2759),
        ("Agency Services", "Agency Services", 0.2069),
        ("Agency Fee", "Agent Time & Service", 0.1724),
        ("Hospitality", "Guide Services", 0.1034),
        ("Agency Fee", "Agency Fees", 0.1034),
        ("Agency Services", "Medical Arrangements", 0.1034),
        ("Hospitality", "Rental Car", 0.1034),
        ("Agency Fee", "Administrative Fees", 0.069),
        ("Agency Services", "Courier", 0.069),
        ("Hospitality", "Tourism or Guide / Tour", 0.069),
        ("Bunkering", "Fuel - Diesel", 0.069),
        ("Agency Services", "Parcel Transfer", 0.0345),
        ("Provisioning", "Florist Services", 0.0345),
    ],
    "Svolvær": [
        ("Agency Services", "Custom Clearance", 1.186),
        ("Agency Services", "Purchasing Assistance", 1.093),
        ("Technical Services", "Technical Assistance", 0.9535),
        ("Hospitality", "Guide Services", 0.4419),
        ("Hospitality", "Transfer Service", 0.186),
        ("Port Marina", "Port Dues", 0.1628),
        ("Technical Services", "Diver Services", 0.093),
        ("Bunkering", "Fuel - Diesel", 0.0698),
        ("Hospitality", "Car Rental", 0.0698),
        ("Hospitality", "Laundry/Dry Cleaning", 0.0698),
        ("Hospitality", "Dry Cleaning Services", 0.0465),
        ("Provisioning", "Provisioning", 0.0465),
    ],
    "Tromsø": [
        ("Agency Services", "Custom Clearance", 0.6949),
        ("Agency Services", "Purchasing Assistance", 0.3305),
        ("Agency Services", "Storage Arrangements", 0.3305),
        ("Port Marina", "Port Dues", 0.2373),
        ("Port Marina", "Arrival Pilot Fees", 0.2203),
        ("Agency Services", "Storage & Transport", 0.2203),
        ("Hospitality", "Guide Services", 0.1864),
        ("Provisioning", "Provisioning", 0.178),
        ("Agency Services", "Courier", 0.1441),
        ("Hospitality", "Car Rental", 0.1186),
        ("Technical Services", "Technical Assistance", 0.1186),
        ("Bunkering", "Fuel - Diesel", 0.1102),
        ("Port Marina", "Marina Water Fees", 0.0847),
        ("Agency Fee", "Agency Fees", 0.0508),
        ("Technical Services", "Mechanical Services", 0.0508),
        ("Hospitality", "Transportation", 0.0508),
        ("Technical Services", "Carpenter Service", 0.0508),
        ("Port Marina", "NOx Tax", 0.0339),
        ("Hospitality", "Transfer Service", 0.0254),
        ("Port Marina", "Garbage Disposal", 0.0254),
        ("Agency Services", "Logistic Arrangements", 0.0169),
        ("Agency Services", "Clearance in/out", 0.0169),
    ],
    "Ålesund": [
        ("Port Marina", "Arrival Pilot Fees", 0.4198),
        ("Port Marina", "Port Dues", 0.3333),
        ("Agency Services", "Purchasing Assistance", 0.1975),
        ("Agency Services", "Storage Arrangements", 0.1728),
        ("Agency Fee", "Administrative Fees", 0.1235),
        ("Hospitality", "Transfer Service", 0.1111),
        ("Agency Fee", "Agency Fees", 0.1111),
        ("Port Marina", "NOx Tax", 0.0988),
        ("Port Marina", "Pilot Fees Arrival", 0.0864),
        ("Port Marina", "Mooring/Unmooring Assistance", 0.0864),
        ("Provisioning", "Provisioning", 0.0741),
        ("Agency Services", "Courier", 0.0741),
        ("Technical Services", "Technician", 0.0741),
        ("Agency Services", "Medical Arrangements", 0.0617),
        ("Agency Services", "Clearance in/out", 0.037),
        ("Agency Services", "Custom Clearance", 0.037),
        ("Agency Services", "Immigration Formalities", 0.037),
        ("Technical Services", "Carpenter Service", 0.037),
        ("Hospitality", "Car Rental", 0.037),
        ("Hospitality", "Guide Services", 0.0247),
        ("Technical Services", "Technical Assistance", 0.0247),
    ],
}

HISTORICAL_RANGES = {
    ("Bergen", "Mellomstor"):    (4_479, 9_683, 23_038),
    ("Bergen", "Stor"):          (7_389, 21_819, 59_272),
    ("Göteborg", "Stor"):        (16_463, 20_425, 22_394),
    ("Kristiansand", "Mellomstor"): (8_302, 8_799, 14_847),
    ("København", "Mellomstor"): (2_266, 4_297, 12_224),
    ("København", "Stor"):       (2_221, 9_169, 57_671),
    ("Stockholm", "Liten"):      (29_170, 53_267, 248_570),
    ("Stockholm", "Mellomstor"): (2_382, 6_342, 47_540),
    ("Svolvær", "Liten"):        (6_744, 20_292, 93_074),
    ("Tromsø", "Liten"):         (11_726, 39_750, 93_541),
    ("Tromsø", "Stor"):          (14_753, 39_416, 88_880),
    ("Ålesund", "Mellomstor"):   (3_272, 10_893, 31_050),
    ("Ålesund", "Stor"):         (21_733, 53_077, 95_271),
}

COUNTRY_PORTS = {
    "Norway": {
        "Bergen": 614, "Tromsø": 389, "Svolvær": 190, "Ålesund": 184,
        "Kristiansand": 8, "Stavanger": 3,
    },
    "Sweden": {
        "Stockholm": 95, "Göteborg": 51, "Malmö": 11,
    },
    "Denmark": {
        "København": 69, "Esbjerg": 24, "Fredericia": 16,
    },
}


# ── Helpers ─────────────────────────────────────────────────────
def get_size_category(gt: float) -> str:
    if gt < 98:
        return "Liten"
    elif gt <= 1000:
        return "Mellomstor"
    return "Stor"


def get_loskrav(loa_m: float) -> str:
    return "Ja" if loa_m > 70 else "Nei"


def estimate_fuel(gt: float, level: str = "medium") -> float:
    size = get_size_category(gt)
    fuel_table = {
        "Liten":       (25, 30, 45),
        "Mellomstor":  (50, 70, 150),
        "Stor":       (250, 355, 500),
    }
    idx = {"low": 0, "medium": 1, "high": 2}[level]
    return fuel_table[size][idx]


# ── Single-port prediction ──────────────────────────────────────
def predict_port(gt, loa_m, beam_m, draft_m, fuel_lph,
                 arrival_port, stay_days, month):
    office = PORT_OFFICE[arrival_port]
    size_cat = get_size_category(gt)
    loskrav = get_loskrav(loa_m)
    template = PORT_TEMPLATES[arrival_port]

    rows = []
    for svc_cat, svc_type, exp_txn in template:
        rows.append({
            "yacht_id": "NEW_YACHT",
            "office": office,
            "arrival_port": arrival_port,
            "service_type": svc_type,
            "service_category": svc_cat,
            "size_category": size_cat,
            "loskrav": loskrav,
            "gt": gt, "loa_m": loa_m, "beam_m": beam_m,
            "draft_m": draft_m, "fuel_lph": fuel_lph,
            "stay_days": stay_days, "month": month,
            "invoice_comments": "", "year": 2025,
        })

    df = pd.DataFrame(rows)
    preds = predict_charge(df)

    cat_totals: dict[str, float] = {}
    for i, (svc_cat, _, exp_txn) in enumerate(template):
        weighted = preds[i] * exp_txn
        cat_totals[svc_cat] = cat_totals.get(svc_cat, 0.0) + weighted

    model_total = sum(cat_totals.values())

    key = (arrival_port, size_cat)
    baseline = baseline_predictions.get(key, 0)

    if key in HISTORICAL_RANGES and baseline > 0:
        _, hist_p50, _ = HISTORICAL_RANGES[key]
        ratio = model_total / baseline
        calibrated_total = hist_p50 * ratio
        scale = calibrated_total / model_total if model_total > 0 else 1.0
        cat_totals = {k: v * scale for k, v in cat_totals.items()}
        total = calibrated_total
    else:
        total = model_total

    return cat_totals, total, size_cat, loskrav


# ── Single-port voyage prediction ───────────────────────────────
def predict_voyage(gt, loa_m, beam_m, draft_m, fuel_lph,
                   port, stay_days, month):
    if port not in PORT_TEMPLATES:
        valid = ", ".join(sorted(PORT_TEMPLATES))
        raise ValueError(f"Unknown port '{port}'. Valid: {valid}")

    cat_totals, port_total, size_cat, loskrav = predict_port(
        gt, loa_m, beam_m, draft_m, fuel_lph, port, stay_days, month)

    hist = HISTORICAL_RANGES.get((port, size_cat))

    return {
        "category_totals": {k: round(v, 2) for k, v in
                            sorted(cat_totals.items(), key=lambda x: -x[1])},
        "grand_total": round(port_total, 2),
        "size_category": size_cat,
        "loskrav": loskrav,
        "port": port,
        "historical_range": (
            {"p25": float(hist[0]), "p50": float(hist[1]), "p75": float(hist[2])}
            if hist else None
        ),
    }
