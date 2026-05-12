"use client";

import { useState } from "react";
import type { VoyageRequest, OptionsResponse, GuestExperience } from "../lib/types";

export interface StopRow {
  port: string;
  arrivalDate: string;       // canonical ISO YYYY-MM-DD (or "" when unset)
  months: string;
  weeks: string;
  days: string;
  distanceNm?: string;       // sailing distance to this port (nm); summed across stops for bunker formula
}

export interface VoyageFormInitial {
  yachtName?: string;
  gt?: string;
  loa?: string;
  beam?: string;
  draft?: string;
  fuel?: string;
  currency?: string;
  pilotCost?: string;
  pilotType?: "national" | "private" | "";
  cruisingSpeedKn?: string;
  dieselPricePerL?: string;
  guestExperience?: GuestExperience | "";
  stops?: StopRow[];
  actualCost?: string;
  actualCategoryTotals?: Record<string, string>;
}

export interface VoyageFormSubmitOpts {
  save: boolean;
  yachtName: string;
  itinerary: StopRow[];
  actualCost: number | null;
  actualCategoryTotals: Record<string, number>;
  guestExperience: GuestExperience | null;
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

export default function VoyageForm({
  options,
  onSubmit,
  loading,
  initial,
  mode = "create",
  primaryLabel,
  showActualCost = false,
  showAddToRegistry = true,
  actualCostCategories,
}: Props) {
  const [yachtName, setYachtName] = useState(initial?.yachtName ?? "");
  const [gt, setGt] = useState(initial?.gt ?? "");
  const [loa, setLoa] = useState(initial?.loa ?? "");
  const [beam, setBeam] = useState(initial?.beam ?? "");
  const [draft, setDraft] = useState(initial?.draft ?? "");
  const [fuel, setFuel] = useState(initial?.fuel ?? "medium");
  const [currency, setCurrency] = useState(initial?.currency ?? (options.currencies?.[0] ?? "NOK"));
  const [pilotCost, setPilotCost] = useState(initial?.pilotCost ?? "");
  const [pilotType, setPilotType] = useState<"national" | "private" | "">(initial?.pilotType ?? "national");
  const [cruisingSpeedKn, setCruisingSpeedKn] = useState(initial?.cruisingSpeedKn ?? "");
  const [dieselPricePerL, setDieselPricePerL] = useState(initial?.dieselPricePerL ?? "");
  const [guestExperience, setGuestExperience] = useState<GuestExperience | "">(
    initial?.guestExperience ?? "",
  );
  const [actualCost, setActualCost] = useState(initial?.actualCost ?? "");
  const [actualCategoryTotals, setActualCategoryTotals] = useState<Record<string, string>>(
    initial?.actualCategoryTotals ?? {},
  );

  const firstPort = Object.values(options.ports).flat()[0] || "Bergen";
  const [stops, setStops] = useState<StopRow[]>(
    initial?.stops && initial.stops.length > 0
      ? initial.stops
      : [
          {
            port: firstPort,
            arrivalDate: todayIso(),
            months: "",
            weeks: "",
            days: "",
            distanceNm: "",
          },
        ],
  );

  function updateStop(idx: number, patch: Partial<StopRow>) {
    setStops((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addStop() {
    setStops((prev) => [
      ...prev,
      {
        port: firstPort,
        arrivalDate: todayIso(),
        months: "",
        weeks: "",
        days: "",
        distanceNm: "",
      },
    ]);
  }

  function removeStop(idx: number) {
    setStops((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit(save: boolean) {
    const parsedPilot = pilotCost.trim() === "" ? null : parseFloat(pilotCost);
    const parsedSpeed = cruisingSpeedKn.trim() === "" ? null : parseFloat(cruisingSpeedKn);
    const parsedDiesel = dieselPricePerL.trim() === "" ? null : parseFloat(dieselPricePerL);
    const req: VoyageRequest = {
      gt: parseFloat(gt),
      loa: parseFloat(loa),
      beam: parseFloat(beam),
      draft: parseFloat(draft),
      fuel,
      currency,
      stops: stops.map((s) => {
        const distNum = parseFloat(s.distanceNm ?? "");
        return {
          port: s.port,
          month: new Date(s.arrivalDate).getMonth() + 1,
          stay_days: stopToDays(s),
          distance_nm: isNaN(distNum) || distNum < 0 ? null : distNum,
        };
      }),
      pilot_cost: parsedPilot !== null && !isNaN(parsedPilot) && parsedPilot > 0 ? parsedPilot : null,
      pilot_type: parsedPilot !== null && !isNaN(parsedPilot) && parsedPilot > 0 && pilotType !== "" ? pilotType : null,
      cruising_speed_kn: parsedSpeed !== null && !isNaN(parsedSpeed) && parsedSpeed > 0 ? parsedSpeed : null,
      diesel_price_per_l: parsedDiesel !== null && !isNaN(parsedDiesel) && parsedDiesel > 0 ? parsedDiesel : null,
      guest_experience: guestExperience === "" ? null : guestExperience,
    };
    const parsedActual = actualCost.trim() === "" ? null : parseFloat(actualCost);
    const actualValid = parsedActual === null || (!isNaN(parsedActual) && parsedActual >= 0);

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
      actualCategoryTotals: parsedCategoryTotals,
      guestExperience: guestExperience === "" ? null : guestExperience,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(false);
  }

  const loaNum = parseFloat(loa);
  const pilotageMandatory = !isNaN(loaNum) && loaNum > 70;
  const pilotCostNum = parseFloat(pilotCost);
  const pilotProvided = pilotCost.trim() !== "" && !isNaN(pilotCostNum) && pilotCostNum > 0;
  const pilotValid = !pilotageMandatory || pilotProvided;

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
  const valid = specsValid && stopsFieldsValid && !hasOverlap && pilotValid;
  const hasAnySpec = Boolean(yachtName.trim() || gt || loa || beam || draft);
  const canSaveToRegistry = valid && yachtName.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Yacht Specifications</h2>
        <div className="grid grid-cols-2 gap-4 items-end">
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
              GT
            </label>
            <input
              type="number"
              value={gt}
              onChange={(e) => setGt(e.target.value)}
              placeholder="Gross tonnage, e.g. 500"
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
              placeholder="Length overall, e.g. 55"
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
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="nice-select w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {(options.currencies ?? ["NOK", "DKK", "EUR"]).map((c) => (
                <option key={c} value={c}>{c}</option>
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
                  type="date"
                  value={stop.arrivalDate}
                  onChange={(e) => updateStop(idx, { arrivalDate: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sailing distance to this port (nm)
                </label>
                <input
                  type="number"
                  value={stop.distanceNm ?? ""}
                  onChange={(e) => updateStop(idx, { distanceNm: e.target.value })}
                  placeholder={idx === 0 ? "Distance from departure" : "Distance from previous port"}
                  min="0"
                  step="any"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used (with cruising speed and diesel price below) to compute bunkering deterministically.
                </p>
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

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Bunkering</h2>
        <p className="text-xs text-gray-500 mb-3">
          Optional — when cruising speed and diesel price are both provided
          (and at least one stop has a distance), the model&apos;s probabilistic
          bunkering estimate is replaced by{" "}
          <span className="font-mono">distance / speed × fuel L/h × diesel price</span>.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cruising speed (kn)
            </label>
            <input
              type="number"
              value={cruisingSpeedKn}
              onChange={(e) => setCruisingSpeedKn(e.target.value)}
              placeholder="e.g. 12"
              min="0"
              step="any"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Diesel price ({currency}/L)
            </label>
            <input
              type="number"
              value={dieselPricePerL}
              onChange={(e) => setDieselPricePerL(e.target.value)}
              placeholder={`Price per L in ${currency}`}
              min="0"
              step="any"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Guest experience</h2>
        <p className="text-xs text-gray-500 mb-2">
          Optional label for the kind of trip the guests want — drives provisioning,
          hospitality, and crew workload in real life.
        </p>
        <p className="text-xs text-blue-700 mb-3">
          ℹ Picking an option <span className="font-medium">does not change the prediction today</span>{" "}
          — the model has no labeled data for this variable yet. We record your choice so a future
          retrain can use it.
        </p>
        <select
          value={guestExperience}
          onChange={(e) => setGuestExperience(e.target.value as GuestExperience | "")}
          className="nice-select w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        >
          <option value="">— not specified —</option>
          <option value="not_demanding">Not demanding — small group, simple meals, few/no events</option>
          <option value="neutral">Neutral — typical charter, standard provisions and service</option>
          <option value="demanding">Demanding — full guest count, premium provisions, frequent events</option>
        </select>
        <p className="text-xs text-amber-700 mt-3">
          ⚠ Rubric pending — until the agency formalises &quot;demanding vs neutral&quot;, the
          three labels above are guidance only. See report §9.5.
        </p>
      </div>

      {pilotageMandatory && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Pilotage <span className="text-red-600">*</span>
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            LOA &gt; 70 m — pilotage is mandatory. The model only assigns a low historic
            probability to pilot fees, so enter the actual cost yourself.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pilot arrangement
              </label>
              <select
                value={pilotType}
                onChange={(e) => setPilotType(e.target.value as "national" | "private")}
                className="nice-select w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="national">National pilotage association</option>
                <option value="private">Private pilot (entire voyage)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pilotage cost ({currency})
              </label>
              <input
                type="number"
                value={pilotCost}
                onChange={(e) => setPilotCost(e.target.value)}
                placeholder={`Total pilot cost in ${currency}`}
                min="0"
                step="any"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
              {!pilotProvided && (
                <p className="text-xs text-red-600 mt-1">
                  Required: enter the pilotage cost for this voyage.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showActualCost && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actual Cost</h2>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Actual voyage cost — total ({currency})
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
                      placeholder={currency}
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
