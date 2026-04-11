"""
Load the saved LightGBM model and run predictions on the merged dataset.
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
yacht_stats = pd.read_parquet(ART / 'yacht_stats.parquet')

print(f"Model loaded: {meta['trained_on_rows']} training rows, "
      f"{meta['num_iterations']} iterations")
print(f"Features ({len(meta['features'])}): {meta['features']}")
print()

# ── Feature engineering (same as notebook) ──────────────────────
def build_features(df, yacht_stats):
    df = df.copy()
    df['quarter']     = ((df['month'] - 1) // 3 + 1).astype('int8')
    df['is_summer']   = df['month'].isin([6, 7, 8]).astype('int8')
    df['is_shoulder'] = df['month'].isin([5, 9]).astype('int8')
    df['gt_x_stay']   = df['gt'].fillna(0) * df['stay_days'].fillna(0)
    df['loa_x_stay']  = df['loa_m'].fillna(0) * df['stay_days'].fillna(0)
    df['fuel_x_stay'] = df['fuel_lph'].fillna(0) * df['stay_days'].fillna(0)
    df = df.merge(yacht_stats, on='yacht_id', how='left')
    df['yacht_mean_charge'] = df['yacht_mean_charge'].fillna(df['yacht_mean_charge'].median())
    df['yacht_visit_count'] = df['yacht_visit_count'].fillna(0)
    cmt = df['invoice_comments'].fillna('').astype(str).str.lower()
    df['cmt_len']        = cmt.str.len().astype('int16')
    df['cmt_has_urgent'] = cmt.str.contains('urgent|asap|rush', regex=True).astype('int8')
    df['cmt_has_repair'] = cmt.str.contains('repair|fix|broken', regex=True).astype('int8')
    df['cmt_has_fuel']   = cmt.str.contains('fuel|diesel|bunker', regex=True).astype('int8')
    return df

def predict_charge(raw_df):
    feats = build_features(raw_df, yacht_stats)
    for c in meta['cat_features']:
        feats[c] = feats[c].astype('category')
    X = feats[meta['features']]
    return np.expm1(model.predict(X))

# ── Load data ───────────────────────────────────────────────────
df = pd.read_csv(DATA)
df = df.dropna(subset=['final_charge'])
df = df[df['final_charge'] > 0].copy()

# ── Predict and evaluate ────────────────────────────────────────
preds = predict_charge(df)
actuals = df['final_charge'].values

mae  = np.mean(np.abs(actuals - preds))
mape = np.mean(np.abs((actuals - preds) / actuals)) * 100
rmse = np.sqrt(np.mean((actuals - preds) ** 2))
median_ae = np.median(np.abs(actuals - preds))

print("=" * 55)
print("  Overall metrics on full dataset")
print("=" * 55)
print(f"  Rows:       {len(df):,}")
print(f"  MAE:        {mae:>12,.0f} NOK")
print(f"  MedAE:      {median_ae:>12,.0f} NOK")
print(f"  RMSE:       {rmse:>12,.0f} NOK")
print(f"  MAPE:       {mape:>11.1f} %")
print()

# ── Per-year breakdown ──────────────────────────────────────────
print("-" * 55)
print(f"  {'Year':<6} {'Rows':>6} {'MAE':>12} {'MAPE':>8}")
print("-" * 55)
for year in sorted(df['year'].unique()):
    mask = df['year'] == year
    a, p = actuals[mask], preds[mask]
    y_mae  = np.mean(np.abs(a - p))
    y_mape = np.mean(np.abs((a - p) / a)) * 100
    print(f"  {year:<6} {mask.sum():>6,} {y_mae:>12,.0f} {y_mape:>7.1f}%")
print()

# ── Sample predictions ──────────────────────────────────────────
print("Sample predictions (first 10 rows):")
print(f"  {'Row':<5} {'Actual':>12} {'Predicted':>12} {'Error':>12}")
print("  " + "-" * 45)
for i in range(min(10, len(df))):
    err = preds[i] - actuals[i]
    print(f"  {i:<5} {actuals[i]:>12,.0f} {preds[i]:>12,.0f} {err:>+12,.0f}")
