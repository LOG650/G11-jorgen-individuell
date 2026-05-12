"""
Generate report figures (7.1-7.8) as PNG files for embedding in Final report.md.

Output: 014 fase 4 - report/figures/figur_7_*.png

Run:  python generate_figures.py
"""

from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib
matplotlib.rcParams['figure.dpi'] = 110
matplotlib.rcParams['savefig.dpi'] = 150
matplotlib.rcParams['axes.spines.top'] = False
matplotlib.rcParams['axes.spines.right'] = False
matplotlib.rcParams['font.size'] = 10

from sklearn.metrics import mean_absolute_error, mean_squared_error
import lightgbm as lgb

BASE = Path(__file__).parent
DATA = BASE / ".." / "004 data" / "costs_merged.csv"
ART = BASE / "artifacts"
OUT = BASE / ".." / "014 fase 4 - report" / "figures"
OUT.mkdir(exist_ok=True, parents=True)
RNG = 42

# ── Load data ────────────────────────────────────────────────────────────
df = pd.read_csv(DATA)
df = df.dropna(subset=["final_charge"])
df = df[df["final_charge"] > 0].copy()

CAT_FEATURES = ["office", "arrival_port", "service_type", "service_category",
                "size_category", "loskrav"]
NUM_FEATURES = ["gt", "loa_m", "beam_m", "draft_m", "stay_days", "month"]
TARGET = "final_charge"

# ── Figur 7.1 — Distribusjon av final_charge (log-skala) ────────────────
fig, ax = plt.subplots(figsize=(8, 5))
ax.hist(np.log10(df[TARGET]), bins=50, color="#1f77b4", edgecolor="white", alpha=0.85)
median = df[TARGET].median()
p25 = df[TARGET].quantile(0.25)
p75 = df[TARGET].quantile(0.75)
p95 = df[TARGET].quantile(0.95)
mean = df[TARGET].mean()
for v, lab, col in [(p25, "P25", "#aaa"), (median, "Median", "#d62728"),
                     (p75, "P75", "#aaa"), (mean, "Snitt", "#2ca02c"),
                     (p95, "P95", "#aaa")]:
    ax.axvline(np.log10(v), color=col, linestyle="--", alpha=0.7, linewidth=1)
    ax.text(np.log10(v), ax.get_ylim()[1] * 0.95, f"{lab}\n{v:,.0f}",
            fontsize=8, ha="center", color=col)
ax.set_xlabel("log₁₀(final_charge) [EUR]")
ax.set_ylabel("Antall transaksjoner")
ax.set_title("Figur 7.1: Distribusjon av final_charge (log-skala)\n"
             f"Median = {median:,.0f} EUR, snitt = {mean:,.0f} EUR, P95/P50 = {p95/median:.1f}",
             fontsize=11)
plt.tight_layout()
plt.savefig(OUT / "figur_7_1_kostnadsfordeling.png", bbox_inches="tight")
plt.close()
print(f"Saved figur_7_1 — n={len(df)}, median={median:,.0f} EUR")

# ── Figur 7.2 — Antall transaksjoner per havn og år ─────────────────────
fig, ax = plt.subplots(figsize=(11, 5))
port_year = df.groupby(["arrival_port", "year"]).size().unstack(fill_value=0)
port_year = port_year.loc[port_year.sum(axis=1).sort_values(ascending=False).index]
port_year.plot(kind="bar", stacked=True, ax=ax, colormap="tab10", edgecolor="white", linewidth=0.4)
ax.set_xlabel("Havn")
ax.set_ylabel("Antall transaksjoner")
ax.set_title("Figur 7.2: Antall transaksjoner per havn og år (2020–2025)\n"
             f"Bergen ({port_year.loc['Bergen'].sum() if 'Bergen' in port_year.index else 0}), "
             f"Tromsø ({port_year.loc['Tromsø'].sum() if 'Tromsø' in port_year.index else 0}) "
             "dominerer; Stavanger/Kristiansand <10 anløp",
             fontsize=10)
ax.legend(title="År", bbox_to_anchor=(1.01, 1), loc="upper left", fontsize=8)
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.savefig(OUT / "figur_7_2_havn_per_aar.png", bbox_inches="tight")
plt.close()
print("Saved figur_7_2")

# ── Figur 7.3 — Kostnad per tjeneste-kategori × størrelse ───────────────
fig, ax = plt.subplots(figsize=(10, 5))
pivot = df.groupby(["service_category", "size_category"])[TARGET].sum().unstack(fill_value=0)
pivot_pct = pivot.div(pivot.sum(axis=0), axis=1) * 100  # % per størrelses-kategori
order = ["Liten", "Mellomstor", "Stor"]
order = [c for c in order if c in pivot_pct.columns]
pivot_pct = pivot_pct[order]
pivot_pct.plot(kind="bar", ax=ax, colormap="Set2", edgecolor="white", linewidth=0.5, width=0.75)
ax.set_xlabel("Tjeneste­kategori")
ax.set_ylabel("Andel av total­kostnad innen størrelses­klasse (%)")
ax.set_title("Figur 7.3: Andel kostnad per tjeneste­kategori, fordelt på størrelses­kategori\n"
             "Provisioning + Port Marina dominerer for Stor; Hospitality for Mellomstor",
             fontsize=10)
ax.legend(title="Størrelse", loc="upper right", fontsize=9)
plt.xticks(rotation=30, ha="right")
plt.tight_layout()
plt.savefig(OUT / "figur_7_3_tjeneste_x_storrelse.png", bbox_inches="tight")
plt.close()
print("Saved figur_7_3")

# ── Figur 7.4 — Spearman-korrelasjon mellom features og log-kostnad ─────
fig, ax = plt.subplots(figsize=(8, 5))
df_corr = df[NUM_FEATURES + ["fuel_lph"]].copy()
df_corr["log_cost"] = np.log1p(df[TARGET])
corr = df_corr.corr(method="spearman")["log_cost"].drop("log_cost").sort_values(ascending=True)
colors = ["#d62728" if v < 0 else "#1f77b4" for v in corr]
ax.barh(corr.index, corr.values, color=colors, edgecolor="white")
for i, v in enumerate(corr.values):
    ax.text(v + (0.01 if v >= 0 else -0.01), i, f"ρ={v:.2f}",
            va="center", ha="left" if v >= 0 else "right", fontsize=9)
ax.axvline(0, color="black", linewidth=0.5)
ax.set_xlabel("Spearman korrelasjon mot log(final_charge)")
ax.set_xlim(-0.1, 0.5)
ax.set_title("Figur 7.4: Spearman-korrelasjon mellom numeriske features og log-kostnad\n"
             "GT, LOA og fuel_lph er moderate positive drivere",
             fontsize=10)
plt.tight_layout()
plt.savefig(OUT / "figur_7_4_spearman.png", bbox_inches="tight")
plt.close()
print("Saved figur_7_4")

# ── Forbered feature engineering for trening (gjør i shared form) ───────
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
            size_svc_mean_charge="mean", size_svc_median_charge="median",
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

for c in CAT_FEATURES:
    df[c] = df[c].astype("category")
NEW_NUM = ["quarter", "is_summer", "is_shoulder", "day_of_week", "week_of_year",
           "gt_x_stay", "loa_x_stay", "fuel_x_stay",
           "size_svc_mean_charge", "size_svc_median_charge", "size_svc_count",
           "port_mean_charge", "port_median_charge", "cmt_len"]
NUM_FEATURES = NUM_FEATURES + NEW_NUM
FEATURES = CAT_FEATURES + NUM_FEATURES
df, _ = build_features(df)

train = df[df["year"] <= 2023]
val = df[df["year"] == 2024]
P99 = train[TARGET].quantile(0.99)

def xy(sub, cap=None):
    X = sub[FEATURES].copy()
    y_raw = sub[TARGET].values.copy()
    if cap is not None:
        y_raw = np.minimum(y_raw, cap)
    return X, np.log1p(y_raw)

X_tr, y_tr = xy(train, cap=P99)
X_va, y_va = xy(val)

# Bruk samme tunede hyperparametre som modeling-notebook brukte (model_meta.best_params)
import joblib
meta = joblib.load(ART / "model_meta.joblib")
best_params = meta["best_params"]
lgb_params = dict(
    objective="huber", metric="mae", verbose=-1, random_state=RNG,
    **best_params, bagging_freq=5,
)
dtr = lgb.Dataset(X_tr, y_tr, categorical_feature=CAT_FEATURES)
dva = lgb.Dataset(X_va, y_va, categorical_feature=CAT_FEATURES, reference=dtr)
print("Training tuned LightGBM (Optuna best_params) for figures 7.5–7.8 ...")
model = lgb.train(
    lgb_params, dtr, num_boost_round=2000, valid_sets=[dva],
    callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(0)],
)

# ── Figur 7.5 — Top-15 feature importance (gain) ─────────────────────────
imp = pd.DataFrame({
    "feature": FEATURES,
    "gain": model.feature_importance(importance_type="gain"),
}).sort_values("gain", ascending=False).head(15)
imp["gain_pct"] = imp["gain"] / imp["gain"].sum() * 100

fig, ax = plt.subplots(figsize=(9, 6))
ax.barh(imp["feature"][::-1], imp["gain_pct"][::-1], color="#1f77b4", edgecolor="white")
for i, v in enumerate(imp["gain_pct"][::-1].values):
    ax.text(v + 0.3, i, f"{v:.1f}%", va="center", fontsize=8)
ax.set_xlabel("Andel av total gain (%)")
ax.set_title("Figur 7.5: Top-15 feature importance (LightGBM gain)\n"
             "service_type dominerer, etterfulgt av aggregat-statistikkene",
             fontsize=10)
plt.tight_layout()
plt.savefig(OUT / "figur_7_5_feature_importance.png", bbox_inches="tight")
plt.close()
print("Saved figur_7_5")

# ── Figur 7.6 — SHAP summary plot (proxy: feature importance med farger for direction) ─
try:
    import shap
    print("Computing SHAP values ...")
    explainer = shap.TreeExplainer(model)
    # SHAP wants numeric features (or categorical converted). Use int-coded.
    X_va_shap = X_va.copy()
    for c in CAT_FEATURES:
        X_va_shap[c] = X_va_shap[c].cat.codes
    shap_values = explainer.shap_values(X_va_shap)

    fig = plt.figure(figsize=(9, 7))
    shap.summary_plot(shap_values, X_va_shap, feature_names=FEATURES,
                       show=False, plot_size=(9, 7), max_display=15)
    plt.title("Figur 7.6: SHAP summary plot (valideringssett, 2024)\n"
              "Effektretning og styrke per feature; service_type og aggregat-stats dominerer",
              fontsize=10)
    plt.tight_layout()
    plt.savefig(OUT / "figur_7_6_shap_summary.png", bbox_inches="tight")
    plt.close()
    print("Saved figur_7_6")
except Exception as e:
    print(f"SHAP figure failed: {e}; using fallback")
    # Fallback: visualise top features with their mean abs gain
    fig, ax = plt.subplots(figsize=(9, 6))
    ax.barh(imp["feature"][::-1], imp["gain_pct"][::-1], color="#ff7f0e", edgecolor="white")
    ax.set_xlabel("Andel av total gain (%) — fallback for SHAP")
    ax.set_title("Figur 7.6 (fallback): Feature importance som proxy for SHAP",
                 fontsize=10)
    plt.tight_layout()
    plt.savefig(OUT / "figur_7_6_shap_summary.png", bbox_inches="tight")
    plt.close()

# ── Figur 7.7 — SHAP dependence for gt (proxy: scatter) ──────────────────
fig, axes = plt.subplots(1, 3, figsize=(15, 4.5))

# (a) Predikert kostnad vs GT
pred_va_log = model.predict(X_va, num_iteration=model.best_iteration)
pred_va_lin = np.expm1(pred_va_log)
ax = axes[0]
ax.scatter(X_va["gt"], pred_va_lin, alpha=0.4, s=14, c="#1f77b4", edgecolor="none")
ax.set_xlabel("GT")
ax.set_ylabel("Predikert kostnad (EUR)")
ax.set_yscale("log")
ax.set_title("(a) Predikert kostnad vs. GT", fontsize=10)

# (b) Predikert kostnad per service_category
ax = axes[1]
val_w = val.copy()
val_w["pred"] = pred_va_lin
sc_med = val_w.groupby("service_category", observed=True)["pred"].median().sort_values()
ax.barh(sc_med.index, sc_med.values, color="#2ca02c", edgecolor="white")
ax.set_xlabel("Median predikert kostnad (EUR)")
ax.set_title("(b) Median prediksjon per service_category", fontsize=10)

# (c) Predikert kostnad per arrival_port
ax = axes[2]
ap_med = val_w.groupby("arrival_port", observed=True)["pred"].median().sort_values()
ax.barh(ap_med.index, ap_med.values, color="#d62728", edgecolor="white")
ax.set_xlabel("Median predikert kostnad (EUR)")
ax.set_title("(c) Median prediksjon per arrival_port", fontsize=10)

fig.suptitle("Figur 7.7: Predikerte kostnader fordelt på sentrale features (valideringssett)",
              fontsize=11, y=1.02)
plt.tight_layout()
plt.savefig(OUT / "figur_7_7_dependence.png", bbox_inches="tight")
plt.close()
print("Saved figur_7_7")

# ── Figur 7.8 — Residual-plott (predikert vs faktisk i log-rom) ─────────
fig, axes = plt.subplots(1, 2, figsize=(13, 5))

y_va_lin = np.expm1(y_va)
resid_log = y_va - pred_va_log

# (a) predikert vs faktisk (log-rom)
ax = axes[0]
ax.scatter(pred_va_log, y_va, alpha=0.4, s=14, c="#1f77b4", edgecolor="none")
lo = min(pred_va_log.min(), y_va.min())
hi = max(pred_va_log.max(), y_va.max())
ax.plot([lo, hi], [lo, hi], color="red", linestyle="--", linewidth=1, label="y = x")
ax.set_xlabel("Predikert log(1 + cost)")
ax.set_ylabel("Faktisk log(1 + cost)")
ax.set_title("(a) Predikert vs. faktisk (log-rom)", fontsize=10)
ax.legend()

# (b) residualer vs predikert
ax = axes[1]
ax.scatter(pred_va_log, resid_log, alpha=0.4, s=14, c="#1f77b4", edgecolor="none")
ax.axhline(0, color="red", linestyle="--", linewidth=1)
mean_resid = resid_log.mean()
ax.set_xlabel("Predikert log(1 + cost)")
ax.set_ylabel("Residual (faktisk − predikert)")
ax.set_title(f"(b) Residual vs. predikert (mean = {mean_resid:.3f})", fontsize=10)

fig.suptitle("Figur 7.8: Residualdiagnostikk på valideringssettet (n = 490, 2024)",
              fontsize=11, y=1.02)
plt.tight_layout()
plt.savefig(OUT / "figur_7_8_residuals.png", bbox_inches="tight")
plt.close()
print(f"Saved figur_7_8 — mean residual = {mean_resid:.3f} (log)")

print()
print("Alle 8 figurer lagret i:", OUT)
for f in sorted(OUT.glob("figur_7_*.png")):
    print(f"  {f.name}  ({f.stat().st_size // 1024} KB)")
