"""
Compute wMAPE for all rows in metrics.csv using the identity
    wMAPE = sum(|err|) / sum(|actual|) = MAE / mean(actual)
on the val=2024 set, then write metrics_with_wmape.csv.
"""
import pandas as pd
from pathlib import Path

BASE = Path(__file__).parent
DATA = BASE / ".." / "004 data" / "costs_merged.csv"
ART = BASE / "artifacts"

df = pd.read_csv(DATA)
df = df.dropna(subset=["final_charge"])
df = df[df["final_charge"] > 0].copy()

val = df[df["year"] == 2024]
mean_actual = val["final_charge"].mean()
n_val = len(val)
sum_actual = val["final_charge"].sum()

print(f"Val=2024: n={n_val}, mean={mean_actual:,.0f} NOK, sum={sum_actual:,.0f} NOK")
print()

m = pd.read_csv(ART / "metrics.csv")
m["wMAPE"] = (m["MAE"] / mean_actual) * 100
m = m[["model", "MAE", "RMSE", "MAPE", "wMAPE"]]
m.to_csv(ART / "metrics_with_wmape.csv", index=False)

print(m.to_string(index=False, float_format=lambda x: f"{x:,.1f}"))
print()
print(f"Output: {ART / 'metrics_with_wmape.csv'}")
