"""
NautiCost Voyage Cost Predictor
Estimate total voyage cost by simulating typical service transactions
using the trained LightGBM per-transaction model.

Usage:
  python predict_voyage.py --gt 2407 --loa 77.4 --beam 13.6 --draft 7.2 \
      --fuel 500 --country Norway --stay 5 --month 7
"""

import argparse
import shutil
import tempfile
import numpy as np
import pandas as pd
import lightgbm as lgb
import joblib
from pathlib import Path

BASE = Path(__file__).parent
ART  = BASE / 'artifacts'

# ── Load artifacts ──────────────────────────────────────────────
# LightGBM's C library cannot open paths with non-ASCII characters (e.g. ø),
# so we copy the model file to a temp path for loading.
_tmp_model = Path(tempfile.gettempdir()) / 'lgbm_final_full.txt'
shutil.copy2(ART / 'lgbm_final_full.txt', _tmp_model)
model       = lgb.Booster(model_file=str(_tmp_model))
meta        = joblib.load(ART / 'model_meta_final.joblib')
yacht_stats = pd.read_parquet(ART / 'yacht_stats.parquet')

# Median yacht_mean_charge by size category (from training data)
SIZE_MEDIAN_CHARGE = {'Liten': 19563, 'Mellomstor': 12388, 'Stor': 34801}

# ── Feature engineering (identical to modeling notebook) ────────
def build_features(df):
    df = df.copy()
    df['quarter']     = ((df['month'] - 1) // 3 + 1).astype('int8')
    df['is_summer']   = df['month'].isin([6, 7, 8]).astype('int8')
    df['is_shoulder'] = df['month'].isin([5, 9]).astype('int8')
    df['gt_x_stay']   = df['gt'].fillna(0) * df['stay_days'].fillna(0)
    df['loa_x_stay']  = df['loa_m'].fillna(0) * df['stay_days'].fillna(0)
    df['fuel_x_stay'] = df['fuel_lph'].fillna(0) * df['stay_days'].fillna(0)
    df = df.merge(yacht_stats, on='yacht_id', how='left')
    missing = df['yacht_mean_charge'].isna()
    if missing.any():
        df.loc[missing, 'yacht_mean_charge'] = df.loc[missing, 'size_category'].map(
            SIZE_MEDIAN_CHARGE).fillna(df['yacht_mean_charge'].median())
    df['yacht_visit_count'] = df['yacht_visit_count'].fillna(0)
    cmt = df['invoice_comments'].fillna('').astype(str).str.lower()
    df['cmt_len']        = cmt.str.len().astype('int16')
    df['cmt_has_urgent'] = cmt.str.contains('urgent|asap|rush', regex=True).astype('int8')
    df['cmt_has_repair'] = cmt.str.contains('repair|fix|broken', regex=True).astype('int8')
    df['cmt_has_fuel']   = cmt.str.contains('fuel|diesel|bunker', regex=True).astype('int8')
    return df

def predict_charge(raw_df):
    feats = build_features(raw_df)
    for c in meta['cat_features']:
        feats[c] = feats[c].astype('category')
    X = feats[meta['features']]
    return np.expm1(model.predict(X))

# ── Lookup tables ───────────────────────────────────────────────
PORT_OFFICE = {
    'Bergen': 'Bergen Office',     'Esbjerg': 'Copenhagen Office',
    'Fredericia': 'Copenhagen Office', 'Göteborg': 'Stockholm OFFICE',
    'Kristiansand': 'Bergen Office', 'København': 'Copenhagen Office',
    'Malmö': 'Stockholm OFFICE',   'Stavanger': 'Bergen Office',
    'Stockholm': 'Stockholm OFFICE', 'Svolvær': 'Bergen Office',
    'Tromsø': 'Bergen Office',     'Ålesund': 'Bergen Office',
}

# Per-port transaction templates: list of (service_category, service_type, expected_txns_per_voyage)
# expected_txns = P(appears in voyage) * avg_count_when_present
PORT_TEMPLATES = {
    'Bergen': [
        ('Provisioning', 'Provisioning', 0.4),
        ('Port Marina', 'Port Dues', 0.3805),
        ('Hospitality', 'Transfer Service', 0.3561),
        ('Agency Services', 'Custom Clearance', 0.2732),
        ('Agency Services', 'Purchasing Assistance', 0.2439),
        ('Port Marina', 'Arrival Pilot Fees', 0.1707),
        ('Port Marina', 'Mooring/Unmooring Assistance', 0.1317),
        ('Hospitality', 'Guide Services', 0.1073),
        ('Agency Services', 'Courier', 0.0927),
        ('Technical Services', 'Technical Assistance', 0.0732),
        ('Agency Services', 'Medical Arrangements', 0.0732),
        ('Agency Fee', 'Agency Fees', 0.0732),
        ('Bunkering', 'Fuel - Diesel', 0.0488),
        ('Agency Services', 'Custom Formalities', 0.039),
        ('Agency Services', 'Immigration Formalities', 0.039),
        ('Port Marina', 'Pilot Fees Arrival', 0.039),
        ('Hospitality', 'Tours / Excursions', 0.039),
        ('Hospitality', 'Car Rental', 0.0341),
        ('Port Marina', 'NOx Tax', 0.0293),
        ('Agency Fee', 'Administrative Fees', 0.0293),
        ('Technical Services', 'Technician', 0.0293),
        ('Agency Services', 'Storage & Transport', 0.0293),
        ('Provisioning', 'Provisioning Assistance', 0.0244),
        ('Agency Services', 'Delivery Charge', 0.0244),
        ('Provisioning', 'Florist Services', 0.0244),
        ('Hospitality', 'Airport Transfer', 0.0195),
        ('Technical Services', 'Repair of', 0.0195),
        ('Port Marina', 'Garbage Disposal', 0.0195),
        ('Technical Services', 'Carpenter Service', 0.0195),
        ('Agency Services', 'Agency Services', 0.0146),
        ('Port Marina', 'Sludge/Oil/Water Removal', 0.0146),
        ('Technical Services', 'Hydraulic Services', 0.0146),
        ('Agency Services', 'Doctor/Medical', 0.0146),
        ('Agency Services', 'Delivery Services', 0.0098),
        ('Hospitality', 'Rental Car', 0.0098),
        ('Bunkering', 'Lube Oil Supply', 0.0098),
        ('Technical Services', 'Dry Dock/Shipyard Services', 0.0098),
        ('Technical Services', 'Diver Services', 0.0098),
    ],
    'Esbjerg': [
        ('Port Marina', 'Port Dues', 3.0),
        ('Provisioning', 'Provisioning', 3.0),
        ('Hospitality', 'Transfer Service', 3.0),
        ('Agency Services', 'Custom Clearance', 2.0),
        ('Port Marina', 'Mooring/Unmooring Assistance', 2.0),
        ('Hospitality', 'Transportation', 2.0),
        ('Agency Services', 'Storage & Transport', 2.0),
        ('Agency Services', 'International Transport', 1.0),
        ('Agency Services', 'Purchasing Assistance', 1.0),
        ('Hospitality', 'Hotel Accommodation', 1.0),
        ('Port Marina', 'Dirty Water Removal Service', 1.0),
        ('Technical Services', 'Technical Assistance', 1.0),
    ],
    'Fredericia': [
        ('Hospitality', 'Transfer Service', 5.0),
        ('Port Marina', 'Port Dues', 2.0),
        ('Provisioning', 'Provisioning', 2.0),
        ('Agency Services', 'Medical Arrangements', 1.0),
        ('Hospitality', 'Tours / Excursions', 1.0),
        ('Hospitality', 'Guide Services', 1.0),
        ('Bunkering', 'Fuel - Diesel', 1.0),
        ('Provisioning', 'Florist Services', 1.0),
    ],
    'Göteborg': [
        ('Port Marina', 'Arrival Pilot Fees', 0.7273),
        ('Bunkering', 'Fuel - Diesel', 0.4545),
        ('Agency Services', 'Purchasing Assistance', 0.4545),
        ('Hospitality', 'Transfer Service', 0.4545),
        ('Provisioning', 'Provisioning', 0.3636),
        ('Hospitality', 'Rental Car', 0.2727),
        ('Agency Services', 'Courier', 0.2727),
        ('Agency Fee', 'Agency Fees', 0.1818),
        ('Port Marina', 'Port Dues', 0.1818),
        ('Agency Services', 'Clearance in/out', 0.1818),
        ('Agency Services', 'Delivery Charge', 0.0909),
        ('Agency Services', 'Service', 0.0909),
        ('Hospitality', 'Laundry/Dry Cleaning', 0.0909),
        ('Hospitality', 'Dry Cleaning Services', 0.0909),
        ('Hospitality', 'Car Rental', 0.0909),
        ('Agency Services', 'Speciality Shipment Items', 0.0909),
        ('Agency Services', 'Medical Arrangements', 0.0909),
        ('Technical Services', 'Internet Connection', 0.0909),
        ('Technical Services', 'Technical Assistance', 0.0909),
        ('Technical Services', 'Technician', 0.0909),
    ],
    'Kristiansand': [
        ('Agency Fee', 'Agency Fees', 0.75),
        ('Port Marina', 'Port Dues', 0.75),
        ('Agency Services', 'Clearance in/out', 0.25),
        ('Bunkering', 'Fuel - Diesel', 0.25),
    ],
    'København': [
        ('Hospitality', 'Transfer Service', 0.3158),
        ('Agency Services', 'Purchasing Assistance', 0.2632),
        ('Port Marina', 'Port Dues', 0.2105),
        ('Agency Services', 'Clearance in/out', 0.1842),
        ('Technical Services', 'Technical Assistance', 0.1842),
        ('Port Marina', 'Mooring/Unmooring Assistance', 0.1579),
        ('Provisioning', 'Provisioning', 0.1579),
        ('Agency Fee', 'Agency Fees', 0.1053),
        ('Bunkering', 'Fuel - Diesel', 0.1053),
        ('Agency Services', 'Agency Services', 0.0263),
    ],
    'Malmö': [
        ('Technical Services', 'Boat Work', 2.0),
        ('Provisioning', 'Provisioning', 2.0),
        ('Agency Services', 'Agency Services', 1.0),
        ('Hospitality', 'Transfer Service', 1.0),
        ('Hospitality', 'Guide Services', 1.0),
        ('Port Marina', 'Port Dues', 1.0),
        ('Port Marina', 'Mooring/Unmooring Assistance', 1.0),
    ],
    'Stavanger': [
        ('Port Marina', 'Port Dues', 2.0),
        ('Agency Fee', 'Agency Fees', 1.0),
    ],
    'Stockholm': [
        ('Hospitality', 'Transfer Service', 0.5172),
        ('Port Marina', 'Port Dues', 0.4828),
        ('Provisioning', 'Provisioning', 0.3103),
        ('Port Marina', 'Mooring/Unmooring Assistance', 0.3103),
        ('Agency Services', 'Purchasing Assistance', 0.2759),
        ('Agency Services', 'Agency Services', 0.2069),
        ('Agency Fee', 'Agent Time & Service', 0.1724),
        ('Hospitality', 'Guide Services', 0.1034),
        ('Agency Fee', 'Agency Fees', 0.1034),
        ('Agency Services', 'Medical Arrangements', 0.1034),
        ('Hospitality', 'Rental Car', 0.1034),
        ('Agency Fee', 'Administrative Fees', 0.069),
        ('Agency Services', 'Courier', 0.069),
        ('Hospitality', 'Tourism or Guide / Tour', 0.069),
        ('Bunkering', 'Fuel - Diesel', 0.069),
        ('Agency Services', 'Parcel Transfer', 0.0345),
        ('Provisioning', 'Florist Services', 0.0345),
    ],
    'Svolvær': [
        ('Agency Services', 'Custom Clearance', 1.186),
        ('Agency Services', 'Purchasing Assistance', 1.093),
        ('Technical Services', 'Technical Assistance', 0.9535),
        ('Hospitality', 'Guide Services', 0.4419),
        ('Hospitality', 'Transfer Service', 0.186),
        ('Port Marina', 'Port Dues', 0.1628),
        ('Technical Services', 'Diver Services', 0.093),
        ('Bunkering', 'Fuel - Diesel', 0.0698),
        ('Hospitality', 'Car Rental', 0.0698),
        ('Hospitality', 'Laundry/Dry Cleaning', 0.0698),
        ('Hospitality', 'Dry Cleaning Services', 0.0465),
        ('Provisioning', 'Provisioning', 0.0465),
    ],
    'Tromsø': [
        ('Agency Services', 'Custom Clearance', 0.6949),
        ('Agency Services', 'Purchasing Assistance', 0.3305),
        ('Agency Services', 'Storage Arrangements', 0.3305),
        ('Port Marina', 'Port Dues', 0.2373),
        ('Port Marina', 'Arrival Pilot Fees', 0.2203),
        ('Agency Services', 'Storage & Transport', 0.2203),
        ('Hospitality', 'Guide Services', 0.1864),
        ('Provisioning', 'Provisioning', 0.178),
        ('Agency Services', 'Courier', 0.1441),
        ('Hospitality', 'Car Rental', 0.1186),
        ('Technical Services', 'Technical Assistance', 0.1186),
        ('Bunkering', 'Fuel - Diesel', 0.1102),
        ('Port Marina', 'Marina Water Fees', 0.0847),
        ('Agency Fee', 'Agency Fees', 0.0508),
        ('Technical Services', 'Mechanical Services', 0.0508),
        ('Hospitality', 'Transportation', 0.0508),
        ('Technical Services', 'Carpenter Service', 0.0508),
        ('Port Marina', 'NOx Tax', 0.0339),
        ('Hospitality', 'Transfer Service', 0.0254),
        ('Port Marina', 'Garbage Disposal', 0.0254),
        ('Agency Services', 'Logistic Arrangements', 0.0169),
        ('Agency Services', 'Clearance in/out', 0.0169),
    ],
    'Ålesund': [
        ('Port Marina', 'Arrival Pilot Fees', 0.4198),
        ('Port Marina', 'Port Dues', 0.3333),
        ('Agency Services', 'Purchasing Assistance', 0.1975),
        ('Agency Services', 'Storage Arrangements', 0.1728),
        ('Agency Fee', 'Administrative Fees', 0.1235),
        ('Hospitality', 'Transfer Service', 0.1111),
        ('Agency Fee', 'Agency Fees', 0.1111),
        ('Port Marina', 'NOx Tax', 0.0988),
        ('Port Marina', 'Pilot Fees Arrival', 0.0864),
        ('Port Marina', 'Mooring/Unmooring Assistance', 0.0864),
        ('Provisioning', 'Provisioning', 0.0741),
        ('Agency Services', 'Courier', 0.0741),
        ('Technical Services', 'Technician', 0.0741),
        ('Agency Services', 'Medical Arrangements', 0.0617),
        ('Agency Services', 'Clearance in/out', 0.037),
        ('Agency Services', 'Custom Clearance', 0.037),
        ('Agency Services', 'Immigration Formalities', 0.037),
        ('Technical Services', 'Carpenter Service', 0.037),
        ('Hospitality', 'Car Rental', 0.037),
        ('Hospitality', 'Guide Services', 0.0247),
        ('Technical Services', 'Technical Assistance', 0.0247),
    ],
}

# Historical voyage cost percentiles by (port, size_category): (P25, P50, P75)
# Used to provide realistic cost ranges alongside model predictions
HISTORICAL_RANGES = {
    ('Bergen', 'Mellomstor'):    (4_479, 9_683, 23_038),
    ('Bergen', 'Stor'):          (7_389, 21_819, 59_272),
    ('Göteborg', 'Stor'):        (16_463, 20_425, 22_394),
    ('Kristiansand', 'Mellomstor'): (8_302, 8_799, 14_847),
    ('København', 'Mellomstor'): (2_266, 4_297, 12_224),
    ('København', 'Stor'):       (2_221, 9_169, 57_671),
    ('Stockholm', 'Liten'):      (29_170, 53_267, 248_570),
    ('Stockholm', 'Mellomstor'): (2_382, 6_342, 47_540),
    ('Svolvær', 'Liten'):        (6_744, 20_292, 93_074),
    ('Tromsø', 'Liten'):         (11_726, 39_750, 93_541),
    ('Tromsø', 'Stor'):          (14_753, 39_416, 88_880),
    ('Ålesund', 'Mellomstor'):   (3_272, 10_893, 31_050),
    ('Ålesund', 'Stor'):         (21_733, 53_077, 95_271),
}

COUNTRY_PORTS = {
    'Norway': {
        'Bergen': 614, 'Tromsø': 389, 'Svolvær': 190, 'Ålesund': 184,
        'Kristiansand': 8, 'Stavanger': 3,
    },
    'Sweden': {
        'Stockholm': 95, 'Göteborg': 51, 'Malmö': 11,
    },
    'Denmark': {
        'København': 69, 'Esbjerg': 24, 'Fredericia': 16,
    },
}

MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun',
               'Jul','Aug','Sep','Oct','Nov','Dec']

def get_size_category(gt):
    if gt < 98:
        return 'Liten'
    elif gt <= 1000:
        return 'Mellomstor'
    return 'Stor'

def get_loskrav(loa_m):
    return 'Ja' if loa_m > 70 else 'Nei'

def estimate_fuel(gt, level='medium'):
    """Estimate fuel consumption (L/h) from size category and level."""
    size = get_size_category(gt)
    fuel_table = {
        #              low  medium  high
        'Liten':       (25,    30,    45),
        'Mellomstor':  (50,    70,   150),
        'Stor':       (250,   355,   500),
    }
    idx = {'low': 0, 'medium': 1, 'high': 2}[level]
    return fuel_table[size][idx]

# ── Single-port voyage prediction ─────────────────────────────
def predict_port(gt, loa_m, beam_m, draft_m, fuel_lph,
                 arrival_port, stay_days, month):
    office = PORT_OFFICE[arrival_port]
    size_cat = get_size_category(gt)
    loskrav = get_loskrav(loa_m)
    template = PORT_TEMPLATES[arrival_port]

    rows = []
    for svc_cat, svc_type, exp_txn in template:
        rows.append({
            'yacht_id': 'NEW_YACHT',
            'office': office,
            'arrival_port': arrival_port,
            'service_type': svc_type,
            'service_category': svc_cat,
            'size_category': size_cat,
            'loskrav': loskrav,
            'gt': gt, 'loa_m': loa_m, 'beam_m': beam_m,
            'draft_m': draft_m, 'fuel_lph': fuel_lph,
            'stay_days': stay_days, 'month': month,
            'invoice_comments': '', 'year': 2025,
        })

    df = pd.DataFrame(rows)
    preds = predict_charge(df)

    # Aggregate by service category
    cat_totals = {}
    for i, (svc_cat, svc_type, exp_txn) in enumerate(template):
        weighted = preds[i] * exp_txn
        if svc_cat not in cat_totals:
            cat_totals[svc_cat] = 0.0
        cat_totals[svc_cat] += weighted

    total = sum(cat_totals.values())
    return cat_totals, total, size_cat, loskrav

# ── Country-level voyage prediction (weighted average) ────────
def predict_voyage(gt, loa_m, beam_m, draft_m, fuel_lph,
                   country, stay_days, month):
    if country not in COUNTRY_PORTS:
        valid = ', '.join(sorted(COUNTRY_PORTS))
        raise ValueError(f"Unknown country '{country}'. Valid: {valid}")

    ports = COUNTRY_PORTS[country]
    total_traffic = sum(ports.values())

    category_totals = {}
    port_totals = {}
    size_cat = loskrav = None
    for port, traffic in ports.items():
        weight = traffic / total_traffic
        cat_totals, port_total, size_cat, loskrav = predict_port(
            gt, loa_m, beam_m, draft_m, fuel_lph, port, stay_days, month)
        port_totals[port] = (port_total, weight)
        for svc_cat, subtotal in cat_totals.items():
            if svc_cat not in category_totals:
                category_totals[svc_cat] = 0.0
            category_totals[svc_cat] += subtotal * weight

    grand_total = sum(category_totals.values())
    return category_totals, grand_total, port_totals, size_cat, loskrav

# ── CLI ─────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(description='NautiCost Voyage Cost Predictor')
    p.add_argument('--gt',      type=float, required=True, help='Gross tonnage')
    p.add_argument('--loa',     type=float, required=True, help='Length overall (m)')
    p.add_argument('--beam',    type=float, required=True, help='Beam width (m)')
    p.add_argument('--draft',   type=float, required=True, help='Draft depth (m)')
    p.add_argument('--fuel',    type=str, default='medium',
                   help='Fuel consumption: "low", "medium", "high", or a number in L/h')
    p.add_argument('--country', type=str,   required=True, help='Country (Norway, Sweden, Denmark)')
    p.add_argument('--stay',    type=float, required=True, help='Stay duration (days)')
    p.add_argument('--month',   type=int,   required=True, help='Month (1-12)')
    args = p.parse_args()

    if args.fuel in ('low', 'medium', 'high'):
        fuel = estimate_fuel(args.gt, args.fuel)
        fuel_source = f'{args.fuel} for size category'
    else:
        fuel = float(args.fuel)
        fuel_source = 'provided'

    category_totals, grand_total, port_totals, size_cat, loskrav = predict_voyage(
        args.gt, args.loa, args.beam, args.draft, fuel,
        args.country, args.stay, args.month,
    )

    month_name = MONTH_NAMES[args.month - 1]
    print()
    print(f"=== Voyage Cost Estimate: {args.country}, {month_name}, {args.stay:.0f} days ===")
    print(f"Yacht: GT={args.gt:.0f}, LOA={args.loa:.1f}m, Beam={args.beam:.1f}m, "
          f"Draft={args.draft:.1f}m, Fuel={fuel:.0f} L/h ({fuel_source})")
    print(f"Category: {size_cat}, Loskrav: {loskrav}")

    # Model-based service breakdown
    print()
    print(f"{'Service Category':<25s} {'Weighted Estimate':>18s}")
    print("-" * 45)
    for svc_cat in sorted(category_totals, key=lambda k: -category_totals[k]):
        print(f"{svc_cat:<25s} {category_totals[svc_cat]:>18,.0f}")
    print("-" * 45)
    print(f"{'MODEL ESTIMATE':<25s} {grand_total:>18,.0f} NOK")

    # Historical cost ranges per port
    print()
    print("Historical cost range per port call (P25 / P50 / P75):")
    print(f"  {'Port':<16s} {'Weight':>6s} {'Low (P25)':>12s} {'Typical (P50)':>14s} {'High (P75)':>12s}")
    print("  " + "-" * 62)
    w_low = w_mid = w_high = 0.0
    for port, (ptotal, weight) in sorted(port_totals.items(), key=lambda x: -x[1][1]):
        key = (port, size_cat)
        if key in HISTORICAL_RANGES:
            p25, p50, p75 = HISTORICAL_RANGES[key]
            print(f"  {port:<16s} {weight:>5.0%}  {p25:>12,.0f} {p50:>14,.0f} {p75:>12,.0f}")
            w_low += p25 * weight
            w_mid += p50 * weight
            w_high += p75 * weight
        else:
            print(f"  {port:<16s} {weight:>5.0%}  {'(no data)':>12s} {'(no data)':>14s} {'(no data)':>12s}")
            w_low += ptotal * weight
            w_mid += ptotal * weight
            w_high += ptotal * weight

    print("  " + "-" * 62)
    print(f"  {'WEIGHTED RANGE':<16s} {'':>6s} {w_low:>12,.0f} {w_mid:>14,.0f} {w_high:>12,.0f} NOK")
    print()
    print("Note: Historical ranges are based on actual voyage costs (2020-2025).")
    print("      Voyage costs vary widely depending on services requested.")
    print()

if __name__ == '__main__':
    main()
