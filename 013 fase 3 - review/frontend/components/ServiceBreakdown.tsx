"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { VoyageResponse } from "../lib/types";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316",
];

function formatNOK(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 0 });
}

export default function ServiceBreakdown({ result }: { result: VoyageResponse }) {
  const data = Object.entries(result.category_totals).map(([name, value]) => ({
    name,
    value: Math.round(value),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost by Service Category</h3>
      <ResponsiveContainer width="100%" height={data.length * 48 + 20}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis type="number" tickFormatter={(v) => formatNOK(v)} fontSize={11} />
          <YAxis type="category" dataKey="name" width={140} fontSize={12} />
          <Tooltip
            formatter={(value) => [`${formatNOK(Number(value))} NOK`, "Estimate"]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Table below chart */}
      <div className="mt-4 border-t pt-4">
        <table className="w-full text-sm">
          <tbody>
            {data.map((d, i) => (
              <tr key={d.name} className="border-b border-gray-50 last:border-0">
                <td className="py-1.5 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  {d.name}
                </td>
                <td className="py-1.5 text-right font-medium text-gray-900">
                  {formatNOK(d.value)} NOK
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
