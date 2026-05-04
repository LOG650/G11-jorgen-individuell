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
import { listEntries, type RegistryEntry } from "../../lib/registry";
import {
  HISTORIC_START_YEAR,
  loadRevenueGoal,
  revenueByYear,
  saveRevenueGoal,
  type RevenueGoal,
} from "../../lib/revenue";
import {
  FORECAST_METHOD_LABELS,
  pickBestMethod,
  runForecast,
  type ForecastMethod,
} from "../../lib/forecasting";

const SESSION_KEY = "nauticost.auth.revenue";
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123";

function formatNOK(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

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
      </form>
    </div>
  );
}

function RevenueHistoryContent({ onLogout }: { onLogout: () => void }) {
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [goal, setGoal] = useState<RevenueGoal>({ targetRevenue: 0, targetYear: 2030 });
  const [targetText, setTargetText] = useState("");
  const [yearText, setYearText] = useState("");
  const [forecastMethod, setForecastMethod] = useState<ForecastMethod | "auto">("auto");

  useEffect(() => {
    setEntries(listEntries());
    const g = loadRevenueGoal();
    setGoal(g);
    setTargetText(g.targetRevenue > 0 ? String(g.targetRevenue) : "");
    setYearText(String(g.targetYear));
  }, []);

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

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    onLogout();
  }

  const totals = useMemo(() => revenueByYear(entries), [entries]);

  const currentYear = new Date().getFullYear();
  const lastYear = Math.max(currentYear, goal.targetYear || currentYear);
  const years: number[] = [];
  for (let y = HISTORIC_START_YEAR; y <= lastYear; y++) years.push(y);

  const baselineRevenue = totals.get(currentYear) ?? 0;

  const history = useMemo(() => {
    return Array.from(totals.entries())
      .map(([year, value]) => ({ year, value }))
      .sort((a, b) => a.year - b.year);
  }, [totals]);

  const lastHistoryYear = history.length > 0 ? history[history.length - 1].year : currentYear;
  const horizonYears = years.filter((y) => y > lastHistoryYear);

  const resolvedMethod: ForecastMethod = useMemo(() => {
    if (forecastMethod === "auto") return pickBestMethod(history);
    return forecastMethod;
  }, [forecastMethod, history]);

  const forecastResult = useMemo(
    () => runForecast(resolvedMethod, history, horizonYears),
    [resolvedMethod, history, horizonYears],
  );
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
            Past revenue is summed from registry entries by voyage year. Set a goal to
            project the trajectory forward.
          </p>
        </div>
        <button
          onClick={logout}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Sign out
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Revenue goal</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target revenue (NOK)
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
          <p className="text-2xl font-bold text-gray-900">{formatNOK(recognizedTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">Sum across all years.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Current year ({currentYear})</p>
          <p className="text-2xl font-bold text-gray-900">{formatNOK(baselineRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Registry total for {currentYear}.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">
            {goal.targetRevenue > 0 ? `To ${goal.targetYear} goal` : "Goal"}
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {goal.targetRevenue > 0 ? formatNOK(remainingToGoal) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {goal.targetRevenue > 0
              ? `Need ${formatNOK(remainingToGoal)} more.`
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
                <> One-step MAE on history: {formatNOK(forecastResult.mae)} NOK
                  {forecastResult.params?.alpha !== undefined &&
                    ` (α=${forecastResult.params.alpha}${
                      forecastResult.params.beta !== undefined ? `, β=${forecastResult.params.beta}` : ""
                    })`}
                  .</>
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
              <option value="moving_average">{FORECAST_METHOD_LABELS.moving_average}</option>
              <option value="naive">{FORECAST_METHOD_LABELS.naive}</option>
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="year" fontSize={12} />
            <YAxis tickFormatter={(v) => formatNOK(v)} fontSize={11} width={80} />
            <Tooltip
              formatter={(v: number | null) => (v === null ? "—" : `${formatNOK(v)} NOK`)}
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
