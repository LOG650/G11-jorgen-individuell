"use client";

import { useState } from "react";
import type { VoyageRequest, OptionsResponse } from "../lib/types";

interface Props {
  options: OptionsResponse;
  onSubmit: (req: VoyageRequest) => void;
  loading: boolean;
}

type StayUnit = "days" | "weeks" | "months";

interface StopRow {
  port: string;
  arrivalDate: string;
  stay: string;
  stayUnit: StayUnit;
}

const UNIT_TO_DAYS: Record<StayUnit, number> = {
  days: 1,
  weeks: 7,
  months: 30.4375,
};

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function VoyageForm({ options, onSubmit, loading }: Props) {
  const [gt, setGt] = useState("");
  const [loa, setLoa] = useState("");
  const [beam, setBeam] = useState("");
  const [draft, setDraft] = useState("");
  const [fuel, setFuel] = useState("medium");

  const firstPort = Object.values(options.ports).flat()[0] || "Bergen";
  const [stops, setStops] = useState<StopRow[]>([
    { port: firstPort, arrivalDate: todayIso(), stay: "5", stayUnit: "days" },
  ]);

  function updateStop(idx: number, patch: Partial<StopRow>) {
    setStops((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addStop() {
    setStops((prev) => [
      ...prev,
      { port: firstPort, arrivalDate: todayIso(), stay: "5", stayUnit: "days" },
    ]);
  }

  function removeStop(idx: number) {
    setStops((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      gt: parseFloat(gt),
      loa: parseFloat(loa),
      beam: parseFloat(beam),
      draft: parseFloat(draft),
      fuel,
      stops: stops.map((s) => ({
        port: s.port,
        month: new Date(s.arrivalDate).getMonth() + 1,
        stay_days: parseFloat(s.stay) * UNIT_TO_DAYS[s.stayUnit],
      })),
    });
  }

  const specsValid =
    gt && loa && beam && draft && parseFloat(gt) > 0 &&
    parseFloat(loa) > 0 && parseFloat(beam) > 0 && parseFloat(draft) > 0;
  const stopsValid = stops.every(
    (s) => s.port && s.arrivalDate && s.stay && parseFloat(s.stay) > 0,
  );
  const valid = specsValid && stopsValid;

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
          <div className="col-span-2">
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

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Itinerary</h2>
        <div className="space-y-4">
          {stops.map((stop, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Stop {idx + 1}
                </span>
                {stops.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStop(idx)}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                <select
                  value={stop.port}
                  onChange={(e) => updateStop(idx, { port: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  {Object.entries(options.ports).map(([countryName, countryPorts]) => (
                    <optgroup key={countryName} label={countryName}>
                      {countryPorts.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Arrival date
                </label>
                <input
                  type="date"
                  value={stop.arrivalDate}
                  onChange={(e) => updateStop(idx, { arrivalDate: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={stop.stay}
                    onChange={(e) => updateStop(idx, { stay: e.target.value })}
                    placeholder="e.g. 5"
                    min="0.1"
                    step="any"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <select
                    value={stop.stayUnit}
                    onChange={(e) =>
                      updateStop(idx, { stayUnit: e.target.value as StayUnit })
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addStop}
            className="w-full rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + Add another port
          </button>
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
