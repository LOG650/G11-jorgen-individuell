"""
Standalone evaluation script for the 2025 test set.

Reproduces the prefit-model pipeline from modeling_nauticost.ipynb:
- train: year <= 2023
- val:   year == 2024 (model selection)
- test:  year == 2025 (final, unbiased generalisation estimate — never used in selection)

Trains LightGBM (base), Ridge, CatBoost, LightGBM (tuned with reported best_params),
Ensemble (LightGBM tuned + CatBoost, w=0.30) and a Median baseline, all on year <= 2023,
selects via val=2024 (early-stopping), and reports MAE/RMSE/MAPE/wMAPE on test=2025.

Outputs:
  artifacts/metrics_test_2025.csv
"""

from pathlib import Path
import numpy as np
import pandas as pd

from sklearn.linear_model import Ridge
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error

import lightgbm as lgb
from catboost import CatBoostRegressor

BASE = Path(__file__).parent
DATA = BASE / ".." / "004 data" / "costs_merged.csv"
ART = BASE / "artifacts"
RNG = 42

# ── Load & filter ────────────────────────────────────────────────────────
df = pd.read_csv(DATA)
df = df.dropna(subset=["final_charge"])
df = df[df["final_charge"] > 0].copy()

CAT_FEATURES = ["office", "arrival_port", "service_type", "service_category",
                "size_category", "loskrav"]
NUM_FEATURES = ["gt", "loa_m", "beam_m", "draft_m", "stay_days", "month"]
TARGET = "final_charge"

for c in CAT_FEATURES:
    df[c] = df[c].astype("category")

# ── Feature engineering (matches notebook cell 8) ────────────────────────
def build_features(df_in, agg_stats=None):
    out = df_in.copy()
    out["quarter"] = ((out["month"] - 1) // 3 + 1).astype("int8")
    out["is_summer"] = out["month"].isin([6, 7, 8]).astype("int8")
    out["is_shoulder"] = out["month"].isin([5, 9]).astype("int8")

    arr = pd.to_datetime(out["arrival_date"], errors="coerce")
    out["day_of_week"] = arr.dt.dayofweek.fillna(2).astype("int8")
    out["week_of_year"] = arr.dt.isocalendar().week.astype("int8")

    out["gt_x_stay"] = out["gt"].fillna(0) * out["stay_days"].fillna(0)
    out["loa_x_stay"] = out["loa_m"].fillna(0) * out["stay_days"].fillna(0)
    out["fuel_x_stay"] = out["fuel_lph"].fillna(0) * out["stay_days"].fillna(0)

    if agg_stats is None:
        hist = out[out["year"] <= 2023]
        size_svc_stats = hist.groupby(["size_category", "service_category"])[TARGET].agg(
            size_svc_mean_charge="mean",
            size_svc_median_charge="median",
            size_svc_count="count",
        ).reset_index()
        port_stats = hist.groupby("arrival_port")[TARGET].agg(
            port_mean_charge="mean", port_median_charge="median",
        ).reset_index()
        agg_stats = (size_svc_stats, port_stats)

    size_svc_stats, port_stats = agg_stats
    out = out.merge(size_svc_stats, on=["size_category", "service_category"], how="left")
    out = out.merge(port_stats, on="arrival_port", how="left")

    for col in ["size_svc_mean_charge", "size_svc_median_charge", "size_svc_count",
                "port_mean_charge", "port_median_charge"]:
        if col in out.columns:
            out[col] = out[col].fillna(out[col].median() if out[col].notna().any() else 0)

    cmt = out["invoice_comments"].fillna("").astype(str).str.lower()
    out["cmt_len"] = cmt.str.len().astype("int16")
    return out, agg_stats

NEW_NUM = ["quarter", "is_summer", "is_shoulder", "day_of_week", "week_of_year",
           "gt_x_stay", "loa_x_stay", "fuel_x_stay",
           "size_svc_mean_charge", "size_svc_median_charge", "size_svc_count",
           "port_mean_charge", "port_median_charge",
           "cmt_len"]
NUM_FEATURES = NUM_FEATURES + NEW_NUM
FEATURES = CAT_FEATURES + NUM_FEATURES

df, agg_stats = build_features(df)

# ── Split ─────────────────────────────────────────────────────────────────
train = df[df["year"] <= 2023]
val = df[df["year"] == 2024]
test = df[df["year"] == 2025]
print(f"train {train.shape}  val {val.shape}  test {test.shape}")

P99 = train[TARGET].quantile(0.99)
print(f"Training target P99 cap: {P99:,.0f}  (affects {(train[TARGET] > P99).sum()} rows)")

def xy(sub, cap=None):
    X = sub[FEATURES].copy()
    y_raw = sub[TARGET].values.copy()
    if cap is not None:
        y_raw = np.minimum(y_raw, cap)
    y = np.log1p(y_raw)
    return X, y

X_tr, y_tr = xy(train, cap=P99)
X_va, y_va = xy(val)
X_te, y_te = xy(test)
y_te_lin = np.expm1(y_te)
mean_actual_test = y_te_lin.mean()
print(f"Test set: n={len(y_te)}  mean(actual)={mean_actual_test:,.0f} EUR")
print()

def eval_pred(y_true_log, y_pred_log, label):
    y_true = np.expm1(y_true_log)
    y_pred = np.expm1(y_pred_log)
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / np.maximum(y_true, 500))) * 100
    wmape = mae / y_true.mean() * 100
    print(f"{label:25s} MAE={mae:10.0f}  RMSE={rmse:10.0f}  MAPE={mape:6.1f}%  wMAPE={wmape:5.1f}%")
    return dict(model=label, MAE=mae, RMSE=rmse, MAPE=mape, wMAPE=wmape)

results = []

# ── Median baseline ───────────────────────────────────────────────────────
med = np.median(y_tr)
results.append(eval_pred(y_te, np.full_like(y_te, med), "Median baseline"))

# ── Ridge ─────────────────────────────────────────────────────────────────
pre = ColumnTransformer([
    ("cat", OneHotEncoder(handle_unknown="ignore"), CAT_FEATURES),
    ("num", StandardScaler(), NUM_FEATURES),
])
ridge = Pipeline([("pre", pre), ("reg", Ridge(alpha=1.0, random_state=RNG))])
ridge.fit(X_tr.fillna(-1), y_tr)
results.append(eval_pred(y_te, ridge.predict(X_te.fillna(-1)), "Ridge"))

# ── LightGBM base ─────────────────────────────────────────────────────────
lgb_base_params = dict(
    objective="huber", alpha=1.0, metric="mae",
    learning_rate=0.05, num_leaves=40, min_data_in_leaf=30,
    max_depth=6, feature_fraction=0.9, bagging_fraction=0.9,
    bagging_freq=5, random_state=RNG, verbose=-1,
)
dtr = lgb.Dataset(X_tr, y_tr, categorical_feature=CAT_FEATURES)
dva = lgb.Dataset(X_va, y_va, categorical_feature=CAT_FEATURES, reference=dtr)
lgb_base = lgb.train(
    lgb_base_params, dtr, num_boost_round=2000,
    valid_sets=[dva], callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(0)],
)
print(f"  LightGBM (base) best_iteration: {lgb_base.best_iteration}")
results.append(eval_pred(
    y_te, lgb_base.predict(X_te, num_iteration=lgb_base.best_iteration),
    "LightGBM (base)",
))

# ── CatBoost ──────────────────────────────────────────────────────────────
X_tr_cb = X_tr.copy()
X_va_cb = X_va.copy()
X_te_cb = X_te.copy()
for c in CAT_FEATURES:
    X_tr_cb[c] = X_tr_cb[c].astype(str).fillna("NA")
    X_va_cb[c] = X_va_cb[c].astype(str).fillna("NA")
    X_te_cb[c] = X_te_cb[c].astype(str).fillna("NA")

cb = CatBoostRegressor(
    iterations=2000, learning_rate=0.05, depth=6,
    loss_function="MAE", cat_features=CAT_FEATURES,
    early_stopping_rounds=50, random_seed=RNG, verbose=0,
)
cb.fit(X_tr_cb, y_tr, eval_set=(X_va_cb, y_va))
print(f"  CatBoost best_iteration: {cb.get_best_iteration()}")
results.append(eval_pred(y_te, cb.predict(X_te_cb), "CatBoost"))

# ── LightGBM tuned (best_params from model_meta.joblib) ──────────────────
import joblib
meta = joblib.load(ART / "model_meta.joblib")
best_params = meta["best_params"]
lgb_tuned_params = dict(
    objective="huber", metric="mae", verbose=-1, random_state=RNG,
    **best_params, bagging_freq=5,
)
lgb_tuned = lgb.train(
    lgb_tuned_params, dtr, num_boost_round=2000,
    valid_sets=[dva], callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(0)],
)
print(f"  LightGBM (tuned) best_iteration: {lgb_tuned.best_iteration}")
results.append(eval_pred(
    y_te, lgb_tuned.predict(X_te, num_iteration=lgb_tuned.best_iteration),
    "LightGBM (tuned)",
))

# ── Ensemble (w=0.30 LGB tuned + 0.70 CatBoost — from model_meta_final.joblib) ──
ens_w = 0.30
lgb_pred_te = lgb_tuned.predict(X_te, num_iteration=lgb_tuned.best_iteration)
cb_pred_te = cb.predict(X_te_cb)
ens_pred_te = ens_w * lgb_pred_te + (1 - ens_w) * cb_pred_te
results.append(eval_pred(y_te, ens_pred_te, "Ensemble (LGB+CB)"))

# ── Save ──────────────────────────────────────────────────────────────────
out = pd.DataFrame(results)
out.to_csv(ART / "metrics_test_2025.csv", index=False)
print()
print("Test=2025 metrics:")
print(out.to_string(index=False, float_format=lambda x: f"{x:,.1f}"))
print()
print(f"Written: {ART / 'metrics_test_2025.csv'}")
