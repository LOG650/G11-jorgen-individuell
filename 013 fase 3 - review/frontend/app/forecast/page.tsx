"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar as RechartsBar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { listEntries, updateEntry, type RegistryEntry } from "../../lib/registry";
import { loadForecastConfig, saveForecastConfig } from "../../lib/forecast";
import {
  HISTORIC_START_YEAR,
  goalForYear,
  loadRevenueGoal,
  loadRevenueHistory,
  revenueByYear,
  type RevenueGoal,
  type RevenueYear,
} from "../../lib/revenue";
import { FORECAST_METHOD_LABELS, pickBestMethod, runForecast } from "../../lib/forecasting";
import {
  MONTH_NAMES,
  additiveDecomposition,
  holtWintersAdditive,
  parseMonthlyInput,
  type MonthlyPoint,
} from "../../lib/seasonal";

function formatNOK(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

function formatNum(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
}

const SEASONAL_STORAGE_KEY = "nauticost.seasonal.input.v1";

const SEASONAL_SAMPLE_INPUT = [
  "# Paste rows like: 2024-03,1234   (or 2024,3,1234   or 2024-03 1234)",
  "# Need at least 24 months (2 full seasons) for decomposition.",
  "2020-01,12",
  "2020-02,15",
  "2020-03,22",
  "2020-04,30",
  "2020-05,55",
  "2020-06,90",
  "2020-07,120",
  "2020-08,115",
  "2020-09,72",
  "2020-10,38",
  "2020-11,18",
  "2020-12,14",
  "2021-01,16",
  "2021-02,18",
  "2021-03,28",
  "2021-04,40",
  "2021-05,68",
  "2021-06,108",
  "2021-07,140",
  "2021-08,135",
  "2021-09,85",
  "2021-10,46",
  "2021-11,22",
  "2021-12,17",
].join("\n");

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(999, (part / whole) * 100);
}

function diffPctLabel(actual: number | null, estimated: number): { text: string; tone: string } {
  if (actual === null || estimated <= 0) {
    return { text: "—", tone: "text-gray-400" };
  }
  const diff = actual - estimated;
  const p = (diff / estimated) * 100;
  const sign = diff >= 0 ? "+" : "";
  const tone =
    Math.abs(p) < 10 ? "text-green-600"
      : Math.abs(p) < 25 ? "text-yellow-600"
      : "text-red-600";
  return { text: `${sign}${p.toFixed(1)}%`, tone };
}

function Bar({ value, max, tone }: { value: number; max: number; tone: "blue" | "purple" }) {
  const fill = Math.min(100, pct(value, max));
  const bg = tone === "blue" ? "bg-blue-600" : "bg-purple-600";
  return (
    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 ${bg} transition-all duration-500`}
        style={{ width: `${fill}%` }}
      />
    </div>
  );
}

export default function ForecastPage() {
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [target, setTarget] = useState("");
  const [stretch, setStretch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [revenueGoal, setRevenueGoal] = useState<RevenueGoal>({ targetRevenue: 0, targetYear: 2030 });
  const [revenueHistory, setRevenueHistory] = useState<RevenueYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [seasonalInput, setSeasonalInput] = useState("");
  const [seasonalHorizon, setSeasonalHorizon] = useState(12);

  function refreshEntries() {
    setEntries(listEntries());
  }

  useEffect(() => {
    refreshEntries();
    const cfg = loadForecastConfig();
    setTarget(cfg.targetRevenue > 0 ? String(cfg.targetRevenue) : "");
    setStretch(String(cfg.stretchPct));
    setRevenueGoal(loadRevenueGoal());
    setRevenueHistory(loadRevenueHistory());
    try {
      const stored = window.localStorage.getItem(SEASONAL_STORAGE_KEY);
      setSeasonalInput(stored ?? SEASONAL_SAMPLE_INPUT);
    } catch {
      setSeasonalInput(SEASONAL_SAMPLE_INPUT);
    }
  }, []);

  function persistSeasonalInput(v: string) {
    setSeasonalInput(v);
    try {
      window.localStorage.setItem(SEASONAL_STORAGE_KEY, v);
    } catch {
      /* ignore quota errors */
    }
  }

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = HISTORIC_START_YEAR; y <= 2031; y++) years.push(y);
    return years;
  }, []);

  const yearTotals = useMemo(() => revenueByYear(revenueHistory), [revenueHistory]);
  const currentYear = new Date().getFullYear();
  const baselineRevenue = yearTotals.get(currentYear) ?? 0;
  const selectedYearRevenue = yearTotals.get(selectedYear) ?? 0;
  const selectedYearGoal = goalForYear(revenueGoal, selectedYear, currentYear, baselineRevenue);
  const selectedYearGap =
    selectedYearGoal !== null ? selectedYearRevenue - selectedYearGoal : null;

  const history = useMemo(() => {
    return Array.from(yearTotals.entries())
      .map(([year, value]) => ({ year, value }))
      .sort((a, b) => a.year - b.year);
  }, [yearTotals]);
  const lastHistoryYear = history.length > 0 ? history[history.length - 1].year : currentYear;
  const bestMethod = useMemo(() => pickBestMethod(history), [history]);
  const algoForecast = useMemo(() => {
    if (selectedYear <= lastHistoryYear) return null;
    const r = runForecast(bestMethod, history, [selectedYear]);
    return r.forecast[0]?.value ?? null;
  }, [bestMethod, history, lastHistoryYear, selectedYear]);

  // Multi-year forecast: from the year after the last historic year through
  // either the user's revenue-goal year or 2031, whichever is later.
  const forecastYears = useMemo(() => {
    const horizonEnd = Math.max(revenueGoal.targetYear || 0, 2031);
    const ys: number[] = [];
    for (let y = lastHistoryYear + 1; y <= horizonEnd; y++) ys.push(y);
    return ys;
  }, [lastHistoryYear, revenueGoal.targetYear]);

  const yearByYearForecast = useMemo(() => {
    if (history.length === 0 || forecastYears.length === 0) return [];
    const r = runForecast(bestMethod, history, forecastYears);
    const map = new Map<number, number>();
    for (const p of r.forecast) map.set(p.year, p.value);
    const lastHistValue = history[history.length - 1].value;
    let prev = lastHistValue;
    return forecastYears.map((y) => {
      const value = map.get(y) ?? prev;
      const deltaAbs = value - prev;
      const deltaPct = prev > 0 ? (deltaAbs / prev) * 100 : 0;
      const row = { year: y, value, deltaAbs, deltaPct, basisPrev: prev };
      prev = value;
      return row;
    });
  }, [bestMethod, history, forecastYears]);

  // Combined yearly chart: history + algorithm forecast (continuous line).
  const yearlyChartData = useMemo(() => {
    const allYears: number[] = [];
    if (history.length > 0) {
      const startY = history[0].year;
      const endY =
        forecastYears.length > 0
          ? forecastYears[forecastYears.length - 1]
          : history[history.length - 1].year;
      for (let y = startY; y <= endY; y++) allYears.push(y);
    }
    const histMap = new Map(history.map((r) => [r.year, r.value]));
    const fcMap = new Map(yearByYearForecast.map((r) => [r.year, r.value]));
    return allYears.map((y) => {
      const actual = histMap.get(y);
      let forecast: number | undefined = undefined;
      if (y === lastHistoryYear && actual !== undefined) {
        forecast = actual; // join the two lines visually
      } else if (fcMap.has(y)) {
        forecast = fcMap.get(y);
      }
      return {
        year: y,
        actual: actual ?? null,
        forecast: forecast ?? null,
      };
    });
  }, [history, yearByYearForecast, forecastYears, lastHistoryYear]);

  // Seasonal (monthly) analysis.
  const monthlyPoints = useMemo<MonthlyPoint[]>(
    () => parseMonthlyInput(seasonalInput),
    [seasonalInput],
  );
  const decomposition = useMemo(
    () => additiveDecomposition(monthlyPoints, 12),
    [monthlyPoints],
  );
  const hw = useMemo(
    () => holtWintersAdditive(monthlyPoints, 12, seasonalHorizon),
    [monthlyPoints, seasonalHorizon],
  );
  const seasonalTooShort = monthlyPoints.length < 24;

  const seasonalChartData = useMemo(() => {
    if (!decomposition || !hw) return [];
    const rows: {
      label: string;
      observed: number | null;
      trend: number | null;
      fitted: number | null;
      forecast: number | null;
    }[] = [];
    for (let i = 0; i < decomposition.points.length; i++) {
      const p = decomposition.points[i];
      rows.push({
        label: p.yyyymm,
        observed: p.observed,
        trend: p.trend,
        fitted: hw.fitted[i],
        forecast: null,
      });
    }
    hw.forecastLabels.forEach((label, i) => {
      rows.push({
        label,
        observed: null,
        trend: null,
        fitted: null,
        forecast: hw.forecast[i],
      });
    });
    return rows;
  }, [decomposition, hw]);

  const seasonalBars = useMemo(() => {
    if (!decomposition) return [];
    return decomposition.seasonalIndex.map((v, i) => ({
      month: MONTH_NAMES[i],
      seasonal: v,
    }));
  }, [decomposition]);

  function startEdit(entry: RegistryEntry) {
    setEditingId(entry.id);
    setEditValue(entry.actualTotal !== null ? String(entry.actualTotal) : "");
  }

  function saveEdit(id: string) {
    const parsed = editValue.trim() === "" ? null : parseFloat(editValue);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;
    updateEntry(id, { actualTotal: parsed });
    setEditingId(null);
    refreshEntries();
  }

  function commitConfig(nextTarget: string, nextStretch: string) {
    const t = parseFloat(nextTarget);
    const s = parseFloat(nextStretch);
    saveForecastConfig({
      targetRevenue: Number.isFinite(t) && t > 0 ? t : 0,
      stretchPct: Number.isFinite(s) ? s : 10,
    });
  }

  const recognized = entries.reduce(
    (sum, e) => sum + (e.actualTotal ?? 0),
    0,
  );
  const projected = entries.reduce((sum, e) => sum + e.estimatedTotal, 0);
  const actualsCount = entries.filter((e) => e.actualTotal !== null).length;
  const pendingCount = entries.length - actualsCount;

  const targetNum = parseFloat(target) || 0;
  const stretchNum = parseFloat(stretch);
  const stretchPct = Number.isFinite(stretchNum) ? stretchNum : 10;
  const stretchTarget = targetNum * (1 + stretchPct / 100);

  const gapToTarget = targetNum - recognized;
  const gapToStretch = stretchTarget - recognized;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Revenue Forecast</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compare realized revenue against NautiCost&apos;s forecasted target. Sums are
          based on entries in the{" "}
          <Link href="/registry" className="text-blue-600 hover:underline">registry</Link>.
        </p>
      </div>

      {/* Revenue progress for selected year */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Revenue progress</h2>
            <p className="text-xs text-gray-500 mt-1">
              Pick a year between {HISTORIC_START_YEAR} and 2031 to see how that year stands
              against the revenue goal.
            </p>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="nice-select rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
            <p className="text-xs text-gray-500">Revenue {selectedYear}</p>
            <p className="text-2xl font-bold text-gray-900">{formatNOK(selectedYearRevenue)}</p>
            <p className="text-xs text-gray-400 mt-1">From registry entries.</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-xs text-emerald-700">Algorithm forecast {selectedYear}</p>
            <p className="text-2xl font-bold text-emerald-800">
              {algoForecast === null ? "—" : formatNOK(algoForecast)}
            </p>
            <p className="text-xs text-emerald-700/70 mt-1">
              {algoForecast === null
                ? selectedYear <= lastHistoryYear
                  ? "Historic year — use registry value."
                  : "Add registry data to forecast."
                : `${FORECAST_METHOD_LABELS[bestMethod]} (auto-picked).`}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
            <p className="text-xs text-gray-500">Goal trajectory {selectedYear}</p>
            <p className="text-2xl font-bold text-gray-900">
              {selectedYearGoal === null ? "—" : formatNOK(selectedYearGoal)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {revenueGoal.targetRevenue > 0
                ? `On the path to ${formatNOK(revenueGoal.targetRevenue)} by ${revenueGoal.targetYear}.`
                : "No revenue goal set."}
            </p>
          </div>
          <div
            className={`rounded-lg border p-4 ${
              selectedYearGap === null
                ? "border-gray-200 bg-gray-50/60"
                : selectedYearGap >= 0
                  ? "border-green-200 bg-green-50"
                  : "border-amber-200 bg-amber-50"
            }`}
          >
            <p className="text-xs text-gray-500">Gap to goal</p>
            <p
              className={`text-2xl font-bold ${
                selectedYearGap === null
                  ? "text-gray-900"
                  : selectedYearGap >= 0
                    ? "text-green-700"
                    : "text-amber-700"
              }`}
            >
              {selectedYearGap === null
                ? "—"
                : `${selectedYearGap >= 0 ? "+" : ""}${formatNOK(selectedYearGap)}`}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {selectedYearGap === null
                ? "Set a goal to compute."
                : selectedYearGap >= 0
                  ? "Above trajectory."
                  : "Below trajectory."}
            </p>
          </div>
        </div>
      </div>

      {/* Year-by-year algorithm forecast */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Year-by-year algorithm forecast
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Predicted revenue for each upcoming year using{" "}
            <span className="font-medium">{FORECAST_METHOD_LABELS[bestMethod]}</span>{" "}
            (auto-picked). Δ shows the increase vs. the previous year.
            Last historic year ({lastHistoryYear}):{" "}
            <span className="font-medium">
              {formatNOK(history[history.length - 1]?.value ?? 0)} NOK
            </span>
            .
          </p>
        </div>
        {yearByYearForecast.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            Add revenue history to compute a multi-year forecast.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={yearlyChartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" fontSize={12} />
                <YAxis tickFormatter={(v) => formatNOK(v)} fontSize={11} width={80} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual revenue"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Algorithm forecast"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left py-2 font-medium">Year</th>
                  <th className="text-right py-2 font-medium">Forecasted revenue (NOK)</th>
                  <th className="text-right py-2 font-medium">Δ vs prev year (NOK)</th>
                  <th className="text-right py-2 font-medium">Δ %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {yearByYearForecast.map((row) => {
                  const tone =
                    row.deltaAbs > 0
                      ? "text-green-700"
                      : row.deltaAbs < 0
                        ? "text-amber-700"
                        : "text-gray-500";
                  const sign = row.deltaAbs > 0 ? "+" : "";
                  return (
                    <tr key={row.year}>
                      <td className="py-2 font-medium text-gray-900">{row.year}</td>
                      <td className="py-2 text-right text-gray-900">
                        {formatNOK(row.value)}
                      </td>
                      <td className={`py-2 text-right font-medium ${tone}`}>
                        {sign}
                        {formatNOK(row.deltaAbs)}
                      </td>
                      <td className={`py-2 text-right ${tone}`}>
                        {sign}
                        {row.deltaPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Seasonal (monthly) analysis */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Seasonal analysis (monthly)
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Additive decomposition (trend + seasonal + residual) and Holt-Winters
            additive forecast for monthly data. Useful for spotting summer/winter
            yacht-season patterns. Yearly revenue history above is too coarse for this —
            paste monthly observations below.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Monthly data</h3>
            <p className="text-xs text-gray-500 mb-3">
              One row per month. Format: <code>YYYY-MM,value</code>. Need at least
              24 months (2 full seasons).
            </p>
            <textarea
              value={seasonalInput}
              onChange={(e) => persistSeasonalInput(e.target.value)}
              spellCheck={false}
              className="w-full font-mono text-xs h-56 rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={() => persistSeasonalInput(SEASONAL_SAMPLE_INPUT)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Load sample
              </button>
              <button
                onClick={() => persistSeasonalInput("")}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
              <span className="text-xs text-gray-500 ml-auto">
                Parsed: {monthlyPoints.length} months
              </span>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Settings & diagnostics</h3>
            <div className="mb-4">
              <label className="block text-xs text-gray-600 mb-1">
                Forecast horizon (months)
              </label>
              <input
                type="number"
                value={seasonalHorizon}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setSeasonalHorizon(
                    Number.isFinite(v) && v > 0 && v <= 60 ? v : 12,
                  );
                }}
                min="1"
                max="60"
                className="w-32 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            {seasonalTooShort && (
              <p className="text-xs text-amber-700">
                ⚠ Need at least 24 months of data. Currently parsed:{" "}
                {monthlyPoints.length}.
              </p>
            )}
            {!seasonalTooShort && hw && (
              <dl className="text-xs text-gray-700 grid grid-cols-2 gap-y-1.5">
                <dt>Smoothing α (level):</dt>
                <dd className="font-mono">{hw.alpha.toFixed(2)}</dd>
                <dt>Smoothing β (trend):</dt>
                <dd className="font-mono">{hw.beta.toFixed(2)}</dd>
                <dt>Smoothing γ (seasonal):</dt>
                <dd className="font-mono">{hw.gamma.toFixed(2)}</dd>
                <dt>In-sample MAE:</dt>
                <dd className="font-mono">{hw.mae !== null ? formatNum(hw.mae) : "—"}</dd>
                <dt>Final level:</dt>
                <dd className="font-mono">{formatNum(hw.level)}</dd>
                <dt>Final trend per month:</dt>
                <dd className="font-mono">{formatNum(hw.trend)}</dd>
              </dl>
            )}
          </div>
        </div>

        {!seasonalTooShort && decomposition && hw && (
          <>
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-700 mb-2">
                Observed, trend, fitted & forecast
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={seasonalChartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="label"
                    fontSize={10}
                    interval={Math.max(0, Math.floor(seasonalChartData.length / 12))}
                  />
                  <YAxis fontSize={11} width={70} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="observed" name="Observed" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                  <Line type="monotone" dataKey="trend" name="Trend (centered MA)" stroke="#9333ea" strokeWidth={2} dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="fitted" name="Holt-Winters fit" stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2">
                Seasonal index by month
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Average deviation from trend per calendar month. Positive = peak
                season, negative = off-season.
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={seasonalBars}
                  margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} width={70} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <RechartsBar dataKey="seasonal" name="Seasonal effect" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Inputs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Targets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Forecasted total revenue (NOK)
            </label>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onBlur={() => commitConfig(target, stretch)}
              placeholder="e.g. 500000"
              min="0"
              step="any"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Your baseline forecast.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desired increase (%)
            </label>
            <input
              type="number"
              value={stretch}
              onChange={(e) => setStretch(e.target.value)}
              onBlur={() => commitConfig(target, stretch)}
              placeholder="e.g. 15"
              step="any"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Stretch target = forecast × (1 + %).
            </p>
          </div>
        </div>
      </div>

      {/* Recognized vs Forecast */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Recognized vs Forecast</h2>
            <p className="text-xs text-gray-500 mt-1">
              Recognized revenue is the sum of &quot;actual&quot; costs set in the registry.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Recognized</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatNOK(recognized)} NOK
            </p>
          </div>
        </div>

        {targetNum > 0 ? (
          <>
            <Bar value={recognized} max={targetNum} tone="blue" />
            <div className="flex justify-between text-xs mt-2">
              <span className="text-gray-500">
                {pct(recognized, targetNum).toFixed(1)}% of forecast
              </span>
              <span className={gapToTarget > 0 ? "text-gray-700" : "text-green-600 font-medium"}>
                {gapToTarget > 0
                  ? `${formatNOK(gapToTarget)} NOK to go`
                  : `Forecast beaten by ${formatNOK(-gapToTarget)} NOK`}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">
            Set a forecast target above to see progress.
          </p>
        )}
      </div>

      {/* Stretch target */}
      {targetNum > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Stretch target (+{stretchPct}%)
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {formatNOK(stretchTarget)} NOK — forecast × (1 + {stretchPct}%).
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Gap to stretch</p>
              <p className={`text-xl font-semibold ${gapToStretch > 0 ? "text-gray-900" : "text-green-600"}`}>
                {gapToStretch > 0
                  ? `${formatNOK(gapToStretch)} NOK`
                  : `Beaten by ${formatNOK(-gapToStretch)} NOK`}
              </p>
            </div>
          </div>
          <Bar value={recognized} max={stretchTarget} tone="purple" />
          <p className="text-xs text-gray-500 mt-2">
            {pct(recognized, stretchTarget).toFixed(1)}% of stretch target
          </p>
        </div>
      )}

      {/* Registry stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Entries in registry</p>
          <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            {actualsCount} with actuals · {pendingCount} pending
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Projected (all estimates)</p>
          <p className="text-2xl font-bold text-gray-900">{formatNOK(projected)}</p>
          <p className="text-xs text-gray-400 mt-1">
            What the registry would book if every quote converted.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Avg per call (estimated)</p>
          <p className="text-2xl font-bold text-gray-900">
            {entries.length > 0 ? formatNOK(projected / entries.length) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">NOK per registry entry.</p>
        </div>
      </div>

      {/* Yachts in Registry */}
      {entries.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Yachts in Registry</h2>
            <p className="text-xs text-gray-500 mt-1">
              Click an actual cost to edit it. Leave it blank to keep as{" "}
              <span className="italic">N/A</span>.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Yacht</th>
                <th className="text-right px-6 py-3 font-medium">Estimated (NOK)</th>
                <th className="text-right px-6 py-3 font-medium">Actual Cost (NOK)</th>
                <th className="text-right px-6 py-3 font-medium">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => {
                const dp = diffPctLabel(e.actualTotal, e.estimatedTotal);
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{e.yachtName}</td>
                    <td className="px-6 py-3 text-right text-gray-700">
                      {formatNOK(e.estimatedTotal)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {editingId === e.id ? (
                        <div className="flex justify-end gap-1">
                          <input
                            type="number"
                            value={editValue}
                            onChange={(ev) => setEditValue(ev.target.value)}
                            autoFocus
                            placeholder="blank = N/A"
                            min="0"
                            step="any"
                            className="w-32 rounded border border-gray-300 px-2 py-1 text-xs text-right"
                          />
                          <button
                            onClick={() => saveEdit(e.id)}
                            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(e)}
                          className={`underline decoration-dotted underline-offset-2 hover:text-blue-600 ${e.actualTotal === null ? "text-gray-400 italic" : "text-gray-900 font-medium"}`}
                        >
                          {e.actualTotal === null ? "N/A" : formatNOK(e.actualTotal)}
                        </button>
                      )}
                    </td>
                    <td className={`px-6 py-3 text-right text-xs font-medium ${dp.tone}`}>
                      {dp.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {entries.length === 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          No entries in the registry yet. Run a prediction on the{" "}
          <Link href="/" className="underline font-medium">dashboard</Link>
          {" "}and click &quot;Add to Registry&quot; so this page has something to aggregate.
        </div>
      )}
    </div>
  );
}
