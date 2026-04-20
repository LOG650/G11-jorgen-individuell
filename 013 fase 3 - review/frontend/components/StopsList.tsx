"use client";

import type { StopResult } from "../lib/types";
import { MONTH_NAMES } from "../lib/api";

function formatNOK(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

function formatDays(d: number): string {
  const rounded = Math.round(d * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export default function StopsList({ stops }: { stops: StopResult[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Per-Stop Breakdown</h3>
      <div className="divide-y divide-gray-100">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 pb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          <span>Port</span>
          <span>Month</span>
          <span className="text-right">Days</span>
          <span className="text-right">Total (NOK)</span>
        </div>
        {stops.map((s, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto_auto_auto] gap-4 py-2 text-sm text-gray-800"
          >
            <span className="font-medium">{s.port}</span>
            <span className="text-gray-600">{MONTH_NAMES[s.month - 1]}</span>
            <span className="text-right text-gray-600">{formatDays(s.stay_days)}</span>
            <span className="text-right font-medium">{formatNOK(s.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
