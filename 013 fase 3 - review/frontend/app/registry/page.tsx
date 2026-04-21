"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listEntries, updateEntry, removeEntry, type RegistryEntry } from "../../lib/registry";

function formatNOK(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function diffClass(actual: number | null, estimated: number): string {
  if (actual === null) return "text-gray-400";
  const pct = ((actual - estimated) / estimated) * 100;
  if (Math.abs(pct) < 10) return "text-green-600";
  if (Math.abs(pct) < 25) return "text-yellow-600";
  return "text-red-600";
}

function diffLabel(actual: number | null, estimated: number): string {
  if (actual === null) return "—";
  const diff = actual - estimated;
  const pct = (diff / estimated) * 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${formatNOK(diff)} (${sign}${pct.toFixed(1)}%)`;
}

export default function RegistryPage() {
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function refresh() {
    setEntries(listEntries());
  }

  useEffect(() => {
    refresh();
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
    refresh();
  }

  function handleRemove(id: string) {
    if (!confirm("Remove this entry from the registry?")) return;
    removeEntry(id);
    refresh();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yacht Registry</h1>
          <p className="text-sm text-gray-500 mt-1">
            Predicted and actual voyage costs per yacht call. Stored locally in your browser.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New prediction
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-center justify-center min-h-[300px] bg-white rounded-xl border border-gray-200 border-dashed">
          <div className="text-center text-gray-400 px-6">
            <p className="text-sm">No saved yachts yet.</p>
            <p className="text-xs mt-1">
              Run a prediction on the dashboard and click &quot;Save to registry&quot; to add one.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Yacht</th>
                <th className="text-left px-4 py-3 font-medium">Specs</th>
                <th className="text-left px-4 py-3 font-medium">Itinerary</th>
                <th className="text-right px-4 py-3 font-medium">Estimated (NOK)</th>
                <th className="text-right px-4 py-3 font-medium">Actual (NOK)</th>
                <th className="text-right px-4 py-3 font-medium">Diff</th>
                <th className="text-right px-4 py-3 font-medium">Saved</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{e.yachtName}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>GT {e.gt} · LOA {e.loa}m</div>
                    <div className="text-xs text-gray-400">
                      {e.sizeCategory} · Loskrav {e.loskrav} · {e.fuelLph} L/h
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {e.stops.length === 1
                      ? e.stops[0].port
                      : `${e.stops.length} stops: ${e.stops.map((s) => s.port).join(" → ")}`}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatNOK(e.estimatedTotal)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === e.id ? (
                      <div className="flex justify-end gap-1">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(ev) => setEditValue(ev.target.value)}
                          autoFocus
                          placeholder="blank = unknown"
                          min="0"
                          step="any"
                          className="w-28 rounded border border-gray-300 px-2 py-1 text-xs text-right"
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
                        className="text-gray-700 hover:text-blue-600 underline decoration-dotted underline-offset-2"
                      >
                        {e.actualTotal !== null ? formatNOK(e.actualTotal) : "—"}
                      </button>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${diffClass(e.actualTotal, e.estimatedTotal)}`}>
                    {diffLabel(e.actualTotal, e.estimatedTotal)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {formatDate(e.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(e.id)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
