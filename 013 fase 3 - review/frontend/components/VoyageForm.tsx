"use client";

import { useState } from "react";
import type { VoyageRequest, OptionsResponse } from "../lib/types";
import { MONTH_NAMES } from "../lib/api";

interface Props {
  options: OptionsResponse;
  onSubmit: (req: VoyageRequest) => void;
  loading: boolean;
}

export default function VoyageForm({ options, onSubmit, loading }: Props) {
  const [gt, setGt] = useState("");
  const [loa, setLoa] = useState("");
  const [beam, setBeam] = useState("");
  const [draft, setDraft] = useState("");
  const [fuel, setFuel] = useState("medium");
  const [country, setCountry] = useState(options.countries[0] || "Norway");
  const [stay, setStay] = useState("5");
  const [month, setMonth] = useState("7");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      gt: parseFloat(gt),
      loa: parseFloat(loa),
      beam: parseFloat(beam),
      draft: parseFloat(draft),
      fuel,
      country,
      stay: parseFloat(stay),
      month: parseInt(month),
    });
  }

  const valid = gt && loa && beam && draft && stay && parseFloat(gt) > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Yacht Specifications</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gross Tonnage (GT)
            </label>
            <input
              type="number"
              value={gt}
              onChange={(e) => setGt(e.target.value)}
              placeholder="e.g. 500"
              min="1"
              step="any"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LOA (m)
            </label>
            <input
              type="number"
              value={loa}
              onChange={(e) => setLoa(e.target.value)}
              placeholder="e.g. 55"
              min="1"
              step="any"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beam (m)
            </label>
            <input
              type="number"
              value={beam}
              onChange={(e) => setBeam(e.target.value)}
              placeholder="e.g. 10"
              min="1"
              step="any"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Draft (m)
            </label>
            <input
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. 4"
              min="0.1"
              step="any"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Voyage Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {options.countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Month
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {options.months.map((m) => (
                <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stay (days)
            </label>
            <input
              type="number"
              value={stay}
              onChange={(e) => setStay(e.target.value)}
              placeholder="e.g. 5"
              min="1"
              step="any"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fuel Consumption
            </label>
            <select
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {options.fuel_levels.map((f) => (
                <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={!valid || loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Estimating...
          </span>
        ) : (
          "Estimate Voyage Cost"
        )}
      </button>
    </form>
  );
}
