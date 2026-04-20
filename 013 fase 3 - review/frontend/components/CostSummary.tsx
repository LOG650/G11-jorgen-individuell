"use client";

import type { VoyageResponse } from "../lib/types";

function formatNOK(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

export default function CostSummary({ result }: { result: VoyageResponse }) {
  const { grand_total, historical_range, size_category, loskrav, fuel_lph, port } = result;

  const markerPct = historical_range
    ? (() => {
        const rangeWidth = historical_range.p75 - historical_range.p25;
        return rangeWidth > 0
          ? Math.min(100, Math.max(0, ((grand_total - historical_range.p25) / rangeWidth) * 100))
          : 50;
      })()
    : 50;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="text-center mb-6">
        <p className="text-sm text-gray-500 mb-1">Estimated Voyage Cost — {port}</p>
        <p className="text-4xl font-bold text-gray-900">{formatNOK(grand_total)} NOK</p>
      </div>

      {historical_range ? (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Low (P25)</span>
            <span>High (P75)</span>
          </div>
          <div className="relative h-3 bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 rounded-full">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-md"
              style={{ left: `calc(${markerPct}% - 8px)` }}
            />
          </div>
          <div className="flex justify-between text-xs font-medium text-gray-700 mt-1">
            <span>{formatNOK(historical_range.p25)} NOK</span>
            <span>{formatNOK(historical_range.p75)} NOK</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center mb-6">
          No historical baseline for {port} / {size_category}. Showing raw model estimate.
        </p>
      )}

      <div className="flex gap-3 justify-center flex-wrap">
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          {size_category}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          Loskrav: {loskrav}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          Fuel: {fuel_lph} L/h
        </span>
      </div>
    </div>
  );
}
