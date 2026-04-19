"use client";

import type { VoyageResponse } from "../lib/types";

function formatNOK(n: number | null): string {
  if (n === null) return "-";
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

export default function PortDetails({ result }: { result: VoyageResponse }) {
  const ports = Object.entries(result.port_details).sort(
    (a, b) => b[1].weight - a[1].weight
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Per-Port Breakdown</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="text-left py-2 font-medium">Port</th>
              <th className="text-right py-2 font-medium">Weight</th>
              <th className="text-right py-2 font-medium">Estimate</th>
              <th className="text-right py-2 font-medium">Low (P25)</th>
              <th className="text-right py-2 font-medium">Typical (P50)</th>
              <th className="text-right py-2 font-medium">High (P75)</th>
            </tr>
          </thead>
          <tbody>
            {ports.map(([name, detail]) => (
              <tr key={name} className="border-b border-gray-50 last:border-0">
                <td className="py-2 font-medium text-gray-900">{name}</td>
                <td className="py-2 text-right text-gray-600">
                  {(detail.weight * 100).toFixed(0)}%
                </td>
                <td className="py-2 text-right font-medium text-gray-900">
                  {formatNOK(detail.total)}
                </td>
                <td className="py-2 text-right text-gray-500">
                  {formatNOK(detail.p25)}
                </td>
                <td className="py-2 text-right text-gray-500">
                  {formatNOK(detail.p50)}
                </td>
                <td className="py-2 text-right text-gray-500">
                  {formatNOK(detail.p75)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Historical P25/P50/P75 ranges based on 2020-2025 voyage data. "-" means insufficient data for this port/size combination.
      </p>
    </div>
  );
}
