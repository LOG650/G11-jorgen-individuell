"""
Load the saved LightGBM model and evaluate on held-out data (time-split).
Usage:  python test_model.py
"""

import shutil
import tempfile
import numpy as np
import pandas as pd
import lightgbm as lgb
import joblib
from pathlib import Path

BASE = Path(__file__).parent
ART  = BASE / 'artifacts'
DATA = BASE / '..' / '004 data' / 'costs_merged.csv'

# ── Load artifacts ──────────────────────────────────────────────
_tmp_model = Path(tempfile.gettempdir()) / 'lgbm_final_full.txt'
shutil.copy2(ART / 'lgbm_final_full.txt', _tmp_model)
model = lgb.Booster(model_file=str(_tmp_model))
meta  = joblib.load(ART / 'model_meta_final.joblib')
agg_stats = (
    pd.read_parquet(ART / 'size_svc_stats.parquet'),
    pd.read_parquet(ART / 'size_stats.parquet'),
    pd.read_parquet(ART / 'port_stats.parquet'),
)

print(f"Model loaded: {meta['trained_on_rows']} training rows, "
      f"{meta['num_iterations']} iterations")
print(f"Features ({len(meta['features'])}): {meta['features']}")
print()

# ── Feature engineering (same as notebook) ──────────────────────
def build_features(df):
    df = df.copy()
    df['quarter']     = ((df['month'] - 1) // 3 + 1).astype('int8')
    df['is_summer']   = df['month'].isin([6, 7, 8]).astype('int8')
    df['is_shoulder'] = df['month'].isin([5, 9]).astype('int8')
    df['gt_x_stay']   = df['gt'].fillna(0) * df['stay_days'].fillna(0)
    df['loa_x_stay']  = df['loa_m'].fillna(0) * df['stay_days'].fillna(0)
    df['fuel_x_stay'] = df['fuel_lph'].fillna(0) * df['stay_days'].fillna(0)

    size_svc_stats, size_stats, port_stats = agg_stats
    df = df.merge(size_svc_stats, on=['size_category', 'service_category'], how='left')
    df = df.merge(size_stats, on='size_category', how='left')
    df = df.merge(port_stats, on='arrival_port', how='left')

    for col in ['size_svc_mean_charge', 'size_svc_median_charge', 'size_svc_count',
                'port_mean_charge', 'port_median_charge']:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median() if df[col].notna().any() else 0)

    cmt = df['invoice_comments'].fillna('').astype(str).str.lower()
    df['cmt_len'] = cmt.str.len().astype('int16')
    return df

def predict_charge(raw_df):
    feats = build_features(raw_df)
    for c in meta['cat_features']:
        feats[c] = feats[c].astype('category')
    X = feats[meta['features']]
    return np.expm1(model.predict(X))

def print_metrics(actuals, preds, label):
    mae  = np.mean(np.abs(actuals - preds))
    mape = np.mean(np.abs((actuals - preds) / np.maximum(actuals, 500))) * 100
    rmse = np.sqrt(np.mean((actuals - preds) ** 2))
    median_ae = np.median(np.abs(actuals - preds))
    print(f"  {label}")
    print(f"    Rows:  {len(actuals):>8,}")
    print(f"    MAE:   {mae:>12,.0f} NOK")
    print(f"    MedAE: {median_ae:>12,.0f} NOK")
    print(f"    RMSE:  {rmse:>12,.0f} NOK")
    print(f"    MAPE:  {mape:>11.1f} %")

# ── Load data ───────────────────────────────────────────────────
df = pd.read_csv(DATA)
df = df.dropna(subset=['final_charge'])
df = df[df['final_charge'] > 0].copy()

# ── Time-split evaluation ────────────────────────────────────────
train = df[df['year'] <= 2024]
val   = df[df['year'] == 2025]
test  = df[df['year'] == 2026]

trained_years = meta.get('years', [])
print("=" * 60)
print("  Model evaluation (time-split)")
print(f"  Model trained on years: {trained_years}")
print("=" * 60)
print()

for label, subset in [('Test (2026) — held-out', test)]:
    if len(subset) == 0:
        print(f"  {label}: no data\n")
        continue
    preds = predict_charge(subset)
    actuals = subset['final_charge'].values
    print_metrics(actuals, preds, label)
    print()

# 2025 was part of training data for the final model
if len(val) > 0:
    preds_val_final = predict_charge(val)
    print_metrics(val['final_charge'].values, preds_val_final,
                  "2025 (in training data — leaky, for reference)")
    print()

# ── Per-service-category breakdown (validation) ──────────────────
if len(val) > 0:
    preds_val = predict_charge(val)
    actuals_val = val['final_charge'].values
    abs_err = np.abs(actuals_val - preds_val)

    print("-" * 60)
    print("  Per service category (2025 — leaky, in training data)")
    print("-" * 60)
    print(f"  {'Category':<22s} {'n':>5s} {'MAE':>12s} {'MAPE':>8s}")
    print("  " + "-" * 49)
    for svc_cat in sorted(val['service_category'].unique()):
        mask = val['service_category'].values == svc_cat
        if mask.sum() == 0:
            continue
        a, p = actuals_val[mask], preds_val[mask]
        cat_mae = np.mean(np.abs(a - p))
        cat_mape = np.mean(np.abs((a - p) / np.maximum(a, 500))) * 100
        print(f"  {svc_cat:<22s} {mask.sum():>5,} {cat_mae:>12,.0f} {cat_mape:>7.1f}%")
    print()

    print("-" * 60)
    print("  Per size category (2025 — leaky, in training data)")
    print("-" * 60)
    print(f"  {'Size':<22s} {'n':>5s} {'MAE':>12s} {'MAPE':>8s}")
    print("  " + "-" * 49)
    for size_cat in sorted(val['size_category'].unique()):
        mask = val['size_category'].values == size_cat
        if mask.sum() == 0:
            continue
        a, p = actuals_val[mask], preds_val[mask]
        sz_mae = np.mean(np.abs(a - p))
        sz_mape = np.mean(np.abs((a - p) / np.maximum(a, 500))) * 100
        print(f"  {size_cat:<22s} {mask.sum():>5,} {sz_mae:>12,.0f} {sz_mape:>7.1f}%")
    print()

# ── Train metrics (reference only) ──────────────────────────────
print("-" * 60)
print("  Train set (leaky — for reference only)")
print("-" * 60)
preds_train = predict_charge(train)
print_metrics(train['final_charge'].values, preds_train, "Train (<=2024)")
print()

# ── Sample predictions (validation) ─────────────────────────────
if len(val) > 0:
    print("Sample predictions (first 10 validation rows):")
    print(f"  {'Row':<5} {'Actual':>12} {'Predicted':>12} {'Error':>12}")
    print("  " + "-" * 45)
    for i in range(min(10, len(val))):
        err = preds_val[i] - actuals_val[i]
        print(f"  {i:<5} {actuals_val[i]:>12,.0f} {preds_val[i]:>12,.0f} {err:>+12,.0f}")
