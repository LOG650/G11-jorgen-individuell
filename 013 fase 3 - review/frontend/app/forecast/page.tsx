"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listEntries, updateEntry, type RegistryEntry } from "../../lib/registry";
import { loadForecastConfig, saveForecastConfig } from "../../lib/forecast";

function formatNOK(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

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

  function refreshEntries() {
    setEntries(listEntries());
  }

  useEffect(() => {
    refreshEntries();
    const cfg = loadForecastConfig();
    setTarget(cfg.targetRevenue > 0 ? String(cfg.targetRevenue) : "");
    setStretch(String(cfg.stretchPct));
  }, []);

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
