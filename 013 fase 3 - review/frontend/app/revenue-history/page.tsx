"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HISTORIC_REVENUE_DEFAULTS,
  HISTORIC_START_YEAR,
  loadDrivers,
  loadRevenueGoal,
  loadRevenueHistory,
  revenueByYear,
  saveDrivers,
  saveRevenueGoal,
  saveRevenueHistory,
  type DriverState,
  type RevenueGoal,
  type RevenueYear,
} from "../../lib/revenue";
import {
  EXCHANGE_RATES_FROM_EUR,
  formatCurrency,
  fxFromEur,
  loadCurrencyPref,
  saveCurrencyPref,
} from "../../lib/api";
import {
  FORECAST_METHOD_LABELS,
  multipleRegressionForecast,
  pickBestMethod,
  runForecast,
  type DriverObservation,
  type ForecastMethod,
} from "../../lib/forecasting";

const SESSION_KEY = "nauticost.auth.revenue";
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";


function LoginGate({ onPass }: { onPass: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onPass();
    } else {
      setError("Invalid credentials.");
      setPass("");
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Restricted</h1>
          <p className="text-xs text-gray-500 mt-1">
            Sign in to view and edit revenue history.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Sign in
        </button>
        <p className="text-[11px] text-gray-400 text-center">
          Demo credentials: <code className="font-mono">admin</code> /{" "}
          <code className="font-mono">admin123</code>
        </p>
      </form>
    </div>
  );
}

function RevenueHistoryContent({ onLogout }: { onLogout: () => void }) {
  const [history, setHistory] = useState<RevenueYear[]>([]);
  const [goal, setGoal] = useState<RevenueGoal>({ targetRevenue: 0, targetYear: 2030 });
  const [targetText, setTargetText] = useState("");
  const [yearText, setYearText] = useState("");
  const [forecastMethod, setForecastMethod] = useState<ForecastMethod | "auto">("auto");
  const [newYearText, setNewYearText] = useState("");
  const [newRevenueText, setNewRevenueText] = useState("");
  const [newYachtCountText, setNewYachtCountText] = useState("");
  const [drivers, setDrivers] = useState<DriverState>({ names: [], values: {} });
  const [newDriverName, setNewDriverName] = useState("");
  const [currency, setCurrency] = useState("NOK");

  useEffect(() => {
    setHistory(loadRevenueHistory());
    const g = loadRevenueGoal();
    setGoal(g);
    setTargetText(g.targetRevenue > 0 ? String(g.targetRevenue) : "");
    setYearText(String(g.targetYear));
    setDrivers(loadDrivers());
    setCurrency(loadCurrencyPref());
  }, []);

  const fx = fxFromEur(currency);
  const fmt = (eur: number) => formatCurrency(eur * fx, currency);
  function changeCurrency(c: string) {
    setCurrency(c);
    saveCurrencyPref(c);
  }

  function persistDrivers(next: DriverState) {
    saveDrivers(next);
    setDrivers(next);
  }

  function addDriverColumn() {
    const name = newDriverName.trim();
    if (!name) return;
    if (drivers.names.includes(name)) return;
    persistDrivers({ ...drivers, names: [...drivers.names, name] });
    setNewDriverName("");
  }

  function removeDriverColumn(name: string) {
    const nextValues: Record<number, Record<string, number>> = {};
    for (const [y, row] of Object.entries(drivers.values)) {
      const cleaned: Record<string, number> = {};
      for (const [k, v] of Object.entries(row)) if (k !== name) cleaned[k] = v;
      nextValues[Number(y)] = cleaned;
    }
    persistDrivers({ names: drivers.names.filter((n) => n !== name), values: nextValues });
  }

  function setDriverValue(year: number, name: string, raw: string) {
    const v = parseFloat(raw);
    const row = { ...(drivers.values[year] ?? {}) };
    if (Number.isFinite(v)) row[name] = v;
    else delete row[name];
    persistDrivers({ ...drivers, values: { ...drivers.values, [year]: row } });
  }

  function commitGoal() {
    const t = parseFloat(targetText);
    const y = parseInt(yearText, 10);
    const next: RevenueGoal = {
      targetRevenue: Number.isFinite(t) && t > 0 ? t : 0,
      targetYear: Number.isFinite(y) ? y : goal.targetYear,
    };
    saveRevenueGoal(next);
    setGoal(next);
  }

  function persistHistory(rows: RevenueYear[]) {
    const sorted = [...rows].sort((a, b) => a.year - b.year);
    saveRevenueHistory(sorted);
    setHistory(sorted);
  }

  function updateRow(year: number, revenue: number) {
    const next = history.map((r) => (r.year === year ? { ...r, revenue } : r));
    persistHistory(next);
  }

  function updateYachtCount(year: number, raw: string) {
    const v = parseInt(raw, 10);
    const next = history.map((r) => {
      if (r.year !== year) return r;
      if (raw.trim() === "" || !Number.isFinite(v) || v < 0) {
        const { yachtCount: _drop, ...rest } = r;
        void _drop;
        return rest;
      }
      return { ...r, yachtCount: v };
    });
    persistHistory(next);
  }

  function removeRow(year: number) {
    persistHistory(history.filter((r) => r.year !== year));
  }

  function addRow() {
    const y = parseInt(newYearText, 10);
    const r = parseFloat(newRevenueText);
    const c = parseInt(newYachtCountText, 10);
    if (!Number.isFinite(y)) return;
    if (history.some((row) => row.year === y)) return;
    const row: RevenueYear = { year: y, revenue: Number.isFinite(r) ? r : 0 };
    if (Number.isFinite(c) && c >= 0) row.yachtCount = c;
    persistHistory([...history, row]);
    setNewYearText("");
    setNewRevenueText("");
    setNewYachtCountText("");
  }

  function loadHistoricDefaults() {
    const merged = new Map<number, number>();
    for (const row of history) merged.set(row.year, row.revenue);
    for (const row of HISTORIC_REVENUE_DEFAULTS) merged.set(row.year, row.revenue);
    persistHistory(Array.from(merged, ([year, revenue]) => ({ year, revenue })));
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    onLogout();
  }

  const totals = useMemo(() => revenueByYear(history), [history]);

  const currentYear = new Date().getFullYear();
  const lastYear = Math.max(currentYear, goal.targetYear || currentYear);
  const years: number[] = [];
  for (let y = HISTORIC_START_YEAR; y <= lastYear; y++) years.push(y);

  const baselineRevenue = totals.get(currentYear) ?? 0;

  const seriesForFit = useMemo(() => {
    return history.map((r) => ({ year: r.year, value: r.revenue })).sort((a, b) => a.year - b.year);
  }, [history]);

  const lastHistoryYear = seriesForFit.length > 0 ? seriesForFit[seriesForFit.length - 1].year : currentYear;
  const horizonYears = years.filter((y) => y > lastHistoryYear);

  const resolvedMethod: ForecastMethod = useMemo(() => {
    if (forecastMethod === "auto") return pickBestMethod(seriesForFit);
    return forecastMethod;
  }, [forecastMethod, seriesForFit]);

  const forecastResult = useMemo(() => {
    if (resolvedMethod === "multiple_regression") {
      const observations: DriverObservation[] = history.map((r) => ({
        year: r.year,
        value: r.revenue,
        drivers: drivers.values[r.year] ?? {},
      }));
      const futureRows = horizonYears.map((y) => ({
        year: y,
        drivers: drivers.values[y] ?? {},
      }));
      return multipleRegressionForecast(observations, drivers.names, futureRows);
    }
    return runForecast(resolvedMethod, seriesForFit, horizonYears);
  }, [resolvedMethod, seriesForFit, horizonYears, history, drivers]);
  const forecastMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of forecastResult.forecast) m.set(p.year, p.value);
    return m;
  }, [forecastResult]);

  const chartData = years.map((y) => {
    const actual = totals.get(y);
    let projected: number | undefined = undefined;
    if (
      goal.targetRevenue > 0 &&
      goal.targetYear > currentYear &&
      y >= currentYear &&
      y <= goal.targetYear
    ) {
      const span = goal.targetYear - currentYear;
      const step = (goal.targetRevenue - baselineRevenue) / span;
      projected = baselineRevenue + step * (y - currentYear);
    }
    let forecast: number | undefined = undefined;
    if (y === lastHistoryYear && actual !== undefined) {
      forecast = actual;
    } else if (forecastMap.has(y)) {
      forecast = forecastMap.get(y);
    }
    return {
      year: y,
      actual: actual ?? null,
      projected: projected ?? null,
      forecast: forecast ?? null,
    };
  });

  const recognizedTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  const remainingToGoal =
    goal.targetRevenue > 0 ? Math.max(0, goal.targetRevenue - baselineRevenue) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue History</h1>
          <p className="text-sm text-gray-500 mt-1">
            Type past-year revenue numbers below in <span className="font-medium">EUR</span> —
            that&apos;s the unit of the source cockpit reports. The display currency selector
            on the right converts <em>shown</em> values; storage stays in EUR.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={currency}
            onChange={(e) => changeCurrency(e.target.value)}
            className="nice-select rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            title="Display currency (storage remains EUR)"
          >
            {Object.keys(EXCHANGE_RATES_FROM_EUR).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Yearly revenue</h2>
        <p className="text-xs text-gray-500 mb-4">
          Yachts is optional — leave blank if unknown. When set, the table shows
          revenue per yacht for that year.
        </p>
        {history.length === 0 ? (
          <p className="text-xs text-gray-500 italic mb-3">
            No years recorded yet. Add a row below to start.
          </p>
        ) : (
          <table className="w-full text-sm mb-4">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left py-2 font-medium">Year</th>
                <th className="text-right py-2 font-medium">Revenue (EUR)</th>
                <th className="text-right py-2 font-medium">Yachts</th>
                <th className="text-right py-2 font-medium">Avg / yacht</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((row) => {
                const avgPerYacht =
                  row.yachtCount && row.yachtCount > 0
                    ? row.revenue / row.yachtCount
                    : null;
                return (
                  <tr key={row.year}>
                    <td className="py-2 font-medium text-gray-900">{row.year}</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        defaultValue={row.revenue}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          updateRow(row.year, Number.isFinite(v) ? v : 0);
                        }}
                        min="0"
                        step="any"
                        className="w-40 rounded border border-gray-300 px-2 py-1 text-sm text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        defaultValue={row.yachtCount ?? ""}
                        onBlur={(e) => updateYachtCount(row.year, e.target.value)}
                        placeholder="—"
                        min="0"
                        step="1"
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </td>
                    <td className="py-2 text-right text-gray-700">
                      {avgPerYacht === null ? (
                        <span className="text-gray-400 italic">—</span>
                      ) : (
                        fmt(avgPerYacht)
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => removeRow(row.year)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Year</label>
            <input
              type="number"
              value={newYearText}
              onChange={(e) => setNewYearText(e.target.value)}
              placeholder="e.g. 2024"
              min="1900"
              step="1"
              className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Revenue (EUR)</label>
            <input
              type="number"
              value={newRevenueText}
              onChange={(e) => setNewRevenueText(e.target.value)}
              placeholder="e.g. 4500000"
              min="0"
              step="any"
              className="w-44 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Yachts (optional)</label>
            <input
              type="number"
              value={newYachtCountText}
              onChange={(e) => setNewYachtCountText(e.target.value)}
              placeholder="e.g. 12"
              min="0"
              step="1"
              className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={addRow}
            disabled={!newYearText.trim()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            + Add year
          </button>
          <button
            onClick={loadHistoricDefaults}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="Load 2020–2025 totals from cockpit_clean.csv"
          >
            Load 2020–2025 historic data
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          Explanatory drivers (multiple regression)
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Add yearly drivers (e.g. fuel price, fleet size, EUR/NOK). Used only when
          forecast method = &quot;Multiple regression&quot;. Provide values for both
          historic years (to fit) and future years (to forecast).
        </p>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">New driver name</label>
            <input
              type="text"
              value={newDriverName}
              onChange={(e) => setNewDriverName(e.target.value)}
              placeholder="e.g. fuel_price_eur"
              className="w-56 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={addDriverColumn}
            disabled={!newDriverName.trim()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            + Add driver column
          </button>
        </div>
        {drivers.names.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No drivers defined yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left py-2 font-medium">Year</th>
                  {drivers.names.map((name) => (
                    <th key={name} className="text-right py-2 font-medium">
                      <span className="inline-flex items-center gap-1">
                        {name}
                        <button
                          onClick={() => removeDriverColumn(name)}
                          title="Remove driver"
                          className="text-red-500 hover:text-red-700 text-[11px]"
                        >
                          ×
                        </button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {years.map((y) => {
                  const isFuture = y > lastHistoryYear;
                  return (
                    <tr key={y} className={isFuture ? "bg-amber-50/40" : ""}>
                      <td className="py-2 font-medium text-gray-900">
                        {y}
                        {isFuture && (
                          <span className="ml-1 text-[10px] uppercase tracking-wider text-amber-700">
                            future
                          </span>
                        )}
                      </td>
                      {drivers.names.map((name) => (
                        <td key={name} className="py-2 text-right">
                          <input
                            type="number"
                            defaultValue={drivers.values[y]?.[name] ?? ""}
                            onBlur={(e) => setDriverValue(y, name, e.target.value)}
                            step="any"
                            className="w-32 rounded border border-gray-300 px-2 py-1 text-sm text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Revenue goal</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target revenue (EUR)
            </label>
            <input
              type="number"
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
              onBlur={commitGoal}
              placeholder="e.g. 5000000"
              min="0"
              step="any"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target year
            </label>
            <input
              type="number"
              value={yearText}
              onChange={(e) => setYearText(e.target.value)}
              onBlur={commitGoal}
              placeholder="e.g. 2030"
              min={currentYear}
              step="1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Recognized to date</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(recognizedTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">Sum across all years.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Current year ({currentYear})</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(baselineRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Recorded for {currentYear}.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">
            {goal.targetRevenue > 0 ? `To ${goal.targetYear} goal` : "Goal"}
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {goal.targetRevenue > 0 ? fmt(remainingToGoal) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {goal.targetRevenue > 0
              ? `Need ${fmt(remainingToGoal)} more.`
              : "Set a target above."}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Revenue {HISTORIC_START_YEAR}–{lastYear}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Algorithm forecast extends past the last historic year using the chosen method.
              {forecastResult.mae !== null && (
                <> One-step MAE on history: {fmt(forecastResult.mae)} {currency}
                  {forecastResult.params?.alpha !== undefined &&
                    ` (α=${forecastResult.params.alpha}${
                      forecastResult.params.beta !== undefined ? `, β=${forecastResult.params.beta}` : ""
                    })`}
                  {forecastResult.params?.slope !== undefined &&
                    ` (slope=${fmt(forecastResult.params.slope)} ${currency}/yr, R²=${forecastResult.params.r2 ?? "—"})`}
                  .</>
              )}
              {forecastResult.params?.error && (
                <span className="block text-amber-700 mt-1">⚠ {forecastResult.params.error}</span>
              )}
              {forecastResult.params?.coefficients && (
                <span className="block text-gray-600 mt-1">
                  R²={forecastResult.params.r2 ?? "—"}.{" "}
                  Coefficients: {Object.entries(forecastResult.params.coefficients)
                    .map(([k, v]) => `${k}=${fmt(v)}`)
                    .join(", ")}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Method:</label>
            <select
              value={forecastMethod}
              onChange={(e) => setForecastMethod(e.target.value as ForecastMethod | "auto")}
              className="nice-select rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="auto">
                Auto (best fit) — currently {FORECAST_METHOD_LABELS[resolvedMethod]}
              </option>
              <option value="holt">{FORECAST_METHOD_LABELS.holt}</option>
              <option value="ses">{FORECAST_METHOD_LABELS.ses}</option>
              <option value="linear">{FORECAST_METHOD_LABELS.linear}</option>
              <option value="multiple_regression">{FORECAST_METHOD_LABELS.multiple_regression}</option>
              <option value="moving_average">{FORECAST_METHOD_LABELS.moving_average}</option>
              <option value="naive">{FORECAST_METHOD_LABELS.naive}</option>
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="year" fontSize={12} />
            <YAxis tickFormatter={(v) => fmt(v)} fontSize={11} width={80} />
            <Tooltip
              formatter={(v: number | null) => (v === null ? "—" : `${fmt(v)} ${currency}`)}
              contentStyle={{ fontSize: 12 }}
            />
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
            <Line
              type="monotone"
              dataKey="projected"
              name="Projected to goal"
              stroke="#9333ea"
              strokeDasharray="5 4"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
        {goal.targetRevenue <= 0 && (
          <p className="text-xs text-gray-500 mt-3">
            Set a target revenue and target year above to see the projected line.
          </p>
        )}
      </div>
    </div>
  );
}

export default function RevenueHistoryPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(SESSION_KEY) === "1");
  }, []);

  if (authed === null) return null;
  if (!authed) return <LoginGate onPass={() => setAuthed(true)} />;
  return <RevenueHistoryContent onLogout={() => setAuthed(false)} />;
}
