"use client";

import { useState } from "react";
import type { VoyageRequest, OptionsResponse } from "../lib/types";

export interface StopRow {
  port: string;
  arrivalDate: string;       // canonical ISO YYYY-MM-DD (or "" when unset/unparseable)
  arrivalDateText: string;   // raw dd.mm.yyyy text the user typed; may be partial during typing
  months: string;
  weeks: string;
  days: string;
}

export interface AgentExpectedItem {
  category: string;
  value: string;
  confirmed: boolean;
}

export const AGENT_EXPECTED_CATEGORIES = [
  "Voyage total",
  "Port Marina",
  "Provisioning",
  "Hospitality",
  "Agency Services",
  "Agency Fee",
  "Bunkering",
  "Technical Services",
] as const;

export interface VoyageFormInitial {
  yachtName?: string;
  gt?: string;
  loa?: string;
  beam?: string;
  draft?: string;
  fuel?: string;
  stops?: StopRow[];
  actualCost?: string;
  agentExpectedItems?: AgentExpectedItem[];
  actualCategoryTotals?: Record<string, string>;
}

export interface ParsedAgentExpected {
  category: string;
  value: number;
  confirmed: boolean;
}

export interface VoyageFormSubmitOpts {
  save: boolean;
  yachtName: string;
  itinerary: StopRow[];
  actualCost: number | null;
  agentExpectedItems: ParsedAgentExpected[];
  actualCategoryTotals: Record<string, number>;
}

interface Props {
  options: OptionsResponse;
  onSubmit: (req: VoyageRequest, opts: VoyageFormSubmitOpts) => void;
  loading: boolean;
  initial?: VoyageFormInitial;
  mode?: "create" | "edit";
  primaryLabel?: string;
  showActualCost?: boolean;
  showAddToRegistry?: boolean;
  showAgentExpected?: boolean;
  actualCostCategories?: string[];
}

const DAYS_PER_MONTH = 30.4375;

function stopToDays(s: StopRow): number {
  return (
    (parseFloat(s.months) || 0) * DAYS_PER_MONTH +
    (parseFloat(s.weeks) || 0) * 7 +
    (parseFloat(s.days) || 0)
  );
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDaysToIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isoToDmy(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function dmyToIso(dmy: string): string | null {
  const trimmed = dmy.trim();
  const m = trimmed.match(/^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{4})$/);
  if (!m) return null;
  const dnum = parseInt(m[1], 10);
  const mnum = parseInt(m[2], 10);
  const ynum = parseInt(m[3], 10);
  if (mnum < 1 || mnum > 12 || dnum < 1 || dnum > 31 || ynum < 1900 || ynum > 2100) {
    return null;
  }
  // Reject impossible day-of-month combinations (e.g. 31 February).
  const probe = new Date(Date.UTC(ynum, mnum - 1, dnum));
  if (
    probe.getUTCFullYear() !== ynum ||
    probe.getUTCMonth() !== mnum - 1 ||
    probe.getUTCDate() !== dnum
  ) {
    return null;
  }
  return `${ynum}-${String(mnum).padStart(2, "0")}-${String(dnum).padStart(2, "0")}`;
}

export default function VoyageForm({
  options,
  onSubmit,
  loading,
  initial,
  mode = "create",
  primaryLabel,
  showActualCost = false,
  showAddToRegistry = true,
  showAgentExpected = true,
  actualCostCategories,
}: Props) {
  const [yachtName, setYachtName] = useState(initial?.yachtName ?? "");
  const [gt, setGt] = useState(initial?.gt ?? "");
  const [loa, setLoa] = useState(initial?.loa ?? "");
  const [beam, setBeam] = useState(initial?.beam ?? "");
  const [draft, setDraft] = useState(initial?.draft ?? "");
  const [fuel, setFuel] = useState(initial?.fuel ?? "medium");
  const [actualCost, setActualCost] = useState(initial?.actualCost ?? "");
  const [agentExpectedItems, setAgentExpectedItems] = useState<AgentExpectedItem[]>(
    initial?.agentExpectedItems ?? [],
  );
  const [actualCategoryTotals, setActualCategoryTotals] = useState<Record<string, string>>(
    initial?.actualCategoryTotals ?? {},
  );

  const firstPort = Object.values(options.ports).flat()[0] || "Bergen";
  const todayInitial = todayIso();
  const [stops, setStops] = useState<StopRow[]>(
    initial?.stops && initial.stops.length > 0
      ? initial.stops
      : [
          {
            port: firstPort,
            arrivalDate: todayInitial,
            arrivalDateText: isoToDmy(todayInitial),
            months: "",
            weeks: "",
            days: "",
          },
        ],
  );

  function updateStop(idx: number, patch: Partial<StopRow>) {
    setStops((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addStop() {
    const today = todayIso();
    setStops((prev) => [
      ...prev,
      {
        port: firstPort,
        arrivalDate: today,
        arrivalDateText: isoToDmy(today),
        months: "",
        weeks: "",
        days: "",
      },
    ]);
  }

  function removeStop(idx: number) {
    setStops((prev) => prev.filter((_, i) => i !== idx));
  }

  function setArrivalDateText(idx: number, text: string) {
    const iso = dmyToIso(text);
    setStops((prev) =>
      prev.map((s, i) =>
        i === idx
          ? { ...s, arrivalDateText: text, arrivalDate: iso ?? "" }
          : s,
      ),
    );
  }

  function addAgentExpectedRow() {
    setAgentExpectedItems((prev) => [
      ...prev,
      { category: AGENT_EXPECTED_CATEGORIES[0], value: "", confirmed: false },
    ]);
  }

  function updateAgentExpectedRow(idx: number, patch: Partial<AgentExpectedItem>) {
    setAgentExpectedItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  function removeAgentExpectedRow(idx: number) {
    setAgentExpectedItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit(save: boolean) {
    const req: VoyageRequest = {
      gt: parseFloat(gt),
      loa: parseFloat(loa),
      beam: parseFloat(beam),
      draft: parseFloat(draft),
      fuel,
      stops: stops.map((s) => ({
        port: s.port,
        month: new Date(s.arrivalDate).getMonth() + 1,
        stay_days: stopToDays(s),
      })),
    };
    const parsedActual = actualCost.trim() === "" ? null : parseFloat(actualCost);
    const actualValid = parsedActual === null || (!isNaN(parsedActual) && parsedActual >= 0);

    const parsedAgent: ParsedAgentExpected[] = [];
    for (const it of agentExpectedItems) {
      const trimmed = it.value.trim();
      if (trimmed === "") continue;
      const n = parseFloat(trimmed);
      if (isNaN(n) || n < 0) continue;
      parsedAgent.push({ category: it.category, value: n, confirmed: it.confirmed });
    }

    const parsedCategoryTotals: Record<string, number> = {};
    for (const [cat, val] of Object.entries(actualCategoryTotals)) {
      const trimmed = val.trim();
      if (trimmed === "") continue;
      const n = parseFloat(trimmed);
      if (!isNaN(n) && n >= 0) parsedCategoryTotals[cat] = n;
    }
    onSubmit(req, {
      save,
      yachtName: yachtName.trim(),
      itinerary: stops,
      actualCost: actualValid ? parsedActual : null,
      agentExpectedItems: parsedAgent,
      actualCategoryTotals: parsedCategoryTotals,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(false);
  }

  const specsValid =
    gt && loa && beam && draft && parseFloat(gt) > 0 &&
    parseFloat(loa) > 0 && parseFloat(beam) > 0 && parseFloat(draft) > 0;
  const stopsFieldsValid = stops.every(
    (s) => s.port && s.arrivalDate && stopToDays(s) > 0,
  );

  // Per-stop overlap error: a stop's arrival must be on/after the previous stop's end date.
  // Uses ISO date-string comparison (YYYY-MM-DD sorts chronologically) to avoid timezone drift.
  const stopErrors: (string | null)[] = stops.map((stop, idx) => {
    if (idx === 0) return null;
    if (!stop.arrivalDate) return null;
    const prev = stops[idx - 1];
    if (!prev.arrivalDate) return null;
    const prevStayDays = stopToDays(prev);
    if (prevStayDays <= 0) return null;
    const earliest = addDaysToIso(prev.arrivalDate, Math.ceil(prevStayDays));
    if (stop.arrivalDate < earliest) {
      return `Arrival overlaps with previous stop at ${prev.port}. Earliest possible arrival is ${earliest}.`;
    }
    return null;
  });
  const hasOverlap = stopErrors.some((e) => e !== null);
  const valid = specsValid && stopsFieldsValid && !hasOverlap;
  const hasAnySpec = Boolean(yachtName.trim() || gt || loa || beam || draft);
  const canSaveToRegistry = valid && yachtName.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Yacht Specifications</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yacht Name
            </label>
            <input
              type="text"
              value={yachtName}
              onChange={(e) => setYachtName(e.target.value)}
              placeholder="e.g. Serenity"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
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
              className="nice-select w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
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
              className="rounded-lg border border-gray-200 bg-gray-50/70 p-4 space-y-3"
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
                  className="nice-select w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
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
                  type="text"
                  inputMode="numeric"
                  value={stop.arrivalDateText}
                  onChange={(e) => setArrivalDateText(idx, e.target.value)}
                  placeholder="dd.mm.yyyy"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                {stop.arrivalDateText.trim() !== "" && !stop.arrivalDate && (
                  <p className="text-xs text-red-600 mt-1">
                    Use format <code>dd.mm.yyyy</code> (e.g. 15.07.2026).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <input
                      type="number"
                      value={stop.months}
                      onChange={(e) => updateStop(idx, { months: e.target.value })}
                      placeholder="0"
                      min="0"
                      step="any"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <span className="block text-center text-xs text-gray-500 mt-1">Months</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      value={stop.weeks}
                      onChange={(e) => updateStop(idx, { weeks: e.target.value })}
                      placeholder="0"
                      min="0"
                      step="any"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <span className="block text-center text-xs text-gray-500 mt-1">Weeks</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      value={stop.days}
                      onChange={(e) => updateStop(idx, { days: e.target.value })}
                      placeholder="0"
                      min="0"
                      step="any"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <span className="block text-center text-xs text-gray-500 mt-1">Days</span>
                  </div>
                </div>
                {stopToDays(stop) > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Total: {stopToDays(stop).toFixed(1)} days
                  </p>
                )}
              </div>

              {stopErrors[idx] && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-xs text-red-700">{stopErrors[idx]}</p>
                </div>
              )}
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

      {showAgentExpected && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent&apos;s Expected Costs</h2>
          <p className="text-xs text-gray-500 mb-3">
            Add one row per cost category you have an expectation for — pick the category, enter NOK, and tick &quot;Confirmed&quot; if it&apos;s a known invoice value (not just your guess).
          </p>
          {agentExpectedItems.length === 0 && (
            <p className="text-xs text-gray-400 mb-3 italic">
              No expectations added yet.
            </p>
          )}
          <div className="space-y-2">
            {agentExpectedItems.map((it, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 items-center"
              >
                <select
                  value={it.category}
                  onChange={(e) => updateAgentExpectedRow(i, { category: e.target.value })}
                  className="nice-select col-span-5 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  {AGENT_EXPECTED_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={it.value}
                  onChange={(e) => updateAgentExpectedRow(i, { value: e.target.value })}
                  placeholder="NOK"
                  min="0"
                  step="any"
                  className="col-span-3 rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <label className="col-span-3 flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={it.confirmed}
                    onChange={(e) => updateAgentExpectedRow(i, { confirmed: e.target.checked })}
                    disabled={it.value.trim() === ""}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                  />
                  Confirmed
                </label>
                <button
                  type="button"
                  onClick={() => removeAgentExpectedRow(i)}
                  aria-label="Remove"
                  className="col-span-1 text-gray-400 hover:text-red-600 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addAgentExpectedRow}
            className="mt-3 w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + Add expected cost
          </button>
        </div>
      )}

      {showActualCost && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actual Cost</h2>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Actual voyage cost — total (NOK)
          </label>
          <input
            type="number"
            value={actualCost}
            onChange={(e) => setActualCost(e.target.value)}
            placeholder="Leave blank for N/A"
            min="0"
            step="any"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave blank if the actual total is not yet known. Per-category actuals can be entered below.
          </p>

          {actualCostCategories && actualCostCategories.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Per-category actuals (optional)
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Fill in only the categories you have invoices for. Blank means unknown.
              </p>
              <div className="space-y-2">
                {actualCostCategories.map((cat) => (
                  <div key={cat} className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-sm text-gray-700 col-span-1">{cat}</label>
                    <input
                      type="number"
                      value={actualCategoryTotals[cat] ?? ""}
                      onChange={(e) =>
                        setActualCategoryTotals((prev) => ({
                          ...prev,
                          [cat]: e.target.value,
                        }))
                      }
                      placeholder="NOK"
                      min="0"
                      step="any"
                      className="col-span-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
            {mode === "edit" ? "Saving..." : "Estimating..."}
          </span>
        ) : (
          primaryLabel ?? "Estimate Voyage Cost"
        )}
      </button>

      {showAddToRegistry && hasAnySpec && (
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={!canSaveToRegistry || loading}
          className="w-full rounded-lg border border-blue-600 bg-white px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          title={!yachtName.trim() ? "Enter a yacht name first" : !valid ? "Fill in all specs and at least one stop" : ""}
        >
          + Add to Registry
        </button>
      )}
    </form>
  );
}
