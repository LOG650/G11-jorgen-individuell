"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
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
import {
  MONTH_NAMES,
  additiveDecomposition,
  holtWintersAdditive,
  parseMonthlyInput,
  type MonthlyPoint,
} from "../../lib/seasonal";

const STORAGE_KEY = "nauticost.seasonal.input.v1";

const SAMPLE_INPUT = [
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

function formatNum(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
}

export default function SeasonalPage() {
  const [input, setInput] = useState("");
  const [horizon, setHorizon] = useState(12);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      setInput(stored ?? SAMPLE_INPUT);
    } catch {
      setInput(SAMPLE_INPUT);
    }
  }, []);

  function persistInput(v: string) {
    setInput(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore quota errors */
    }
  }

  const points = useMemo<MonthlyPoint[]>(() => parseMonthlyInput(input), [input]);

  const decomposition = useMemo(() => additiveDecomposition(points, 12), [points]);
  const hw = useMemo(
    () => holtWintersAdditive(points, 12, horizon),
    [points, horizon],
  );

  const tooShort = points.length < 24;

  const chartData = useMemo(() => {
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Seasonal Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">
          Additive decomposition (trend + seasonal + residual) and Holt-Winters
          additive forecast for monthly time series. Useful for spotting summer/winter
          yacht-season patterns and projecting them forward.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Monthly data</h2>
          <p className="text-xs text-gray-500 mb-3">
            One row per month. Format: <code>YYYY-MM,value</code>. Empty months are
            treated as missing — supply a value for every month between your start
            and end. Need at least 24 months (2 full seasons).
          </p>
          <textarea
            value={input}
            onChange={(e) => persistInput(e.target.value)}
            spellCheck={false}
            className="w-full font-mono text-xs h-72 rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => persistInput(SAMPLE_INPUT)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Load sample
            </button>
            <button
              onClick={() => persistInput("")}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
            <span className="text-xs text-gray-500 ml-auto">
              Parsed: {points.length} months
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Settings & diagnostics</h2>
          <div className="mb-4">
            <label className="block text-xs text-gray-600 mb-1">Forecast horizon (months)</label>
            <input
              type="number"
              value={horizon}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setHorizon(Number.isFinite(v) && v > 0 && v <= 60 ? v : 12);
              }}
              min="1"
              max="60"
              className="w-32 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          {tooShort && (
            <p className="text-xs text-amber-700">
              ⚠ Need at least 24 months of data. Currently parsed: {points.length}.
            </p>
          )}
          {!tooShort && hw && (
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

      {!tooShort && decomposition && hw && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Observed, trend, fitted & forecast
            </h2>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" fontSize={10} interval={Math.floor(chartData.length / 12)} />
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

          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Seasonal index by month</h2>
            <p className="text-xs text-gray-500 mb-3">
              Average deviation from trend, per calendar month. Positive = peak season,
              negative = off-season.
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={seasonalBars} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} width={70} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="seasonal" name="Seasonal effect" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
