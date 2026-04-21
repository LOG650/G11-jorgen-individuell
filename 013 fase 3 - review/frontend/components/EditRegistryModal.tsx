"use client";

import { useEffect, useState } from "react";
import type { OptionsResponse, VoyageRequest } from "../lib/types";
import { fetchOptions, predictVoyage } from "../lib/api";
import { updateEntry, type RegistryEntry } from "../lib/registry";
import VoyageForm, {
  type VoyageFormInitial,
  type VoyageFormSubmitOpts,
  type StopRow,
} from "./VoyageForm";

interface Props {
  entry: RegistryEntry;
  onClose: () => void;
  onSaved: () => void;
}

function entryToInitial(entry: RegistryEntry): VoyageFormInitial {
  const stops: StopRow[] = entry.itinerary && entry.itinerary.length > 0
    ? entry.itinerary.map((s) => ({
        port: s.port,
        arrivalDate: s.arrivalDate,
        months: s.months,
        weeks: s.weeks,
        days: s.days,
      }))
    : entry.stops.map((s) => {
        // Legacy entries without itinerary: reconstruct as date in the recorded month of this year + all days.
        const now = new Date();
        const year = now.getFullYear();
        const mm = String(s.month).padStart(2, "0");
        return {
          port: s.port,
          arrivalDate: `${year}-${mm}-01`,
          months: "",
          weeks: "",
          days: String(s.stay_days),
        };
      });

  return {
    yachtName: entry.yachtName,
    gt: String(entry.gt),
    loa: String(entry.loa),
    beam: String(entry.beam),
    draft: String(entry.draft),
    fuel: entry.fuel,
    stops,
    actualCost: entry.actualTotal === null ? "" : String(entry.actualTotal),
  };
}

export default function EditRegistryModal({ entry, onClose, onSaved }: Props) {
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchOptions()
      .then(setOptions)
      .catch(() => setLoadError("Could not connect to backend. Is the API server running on port 8000?"));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(req: VoyageRequest, opts: VoyageFormSubmitOpts) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await predictVoyage(req);
      updateEntry(entry.id, {
        yachtName: opts.yachtName || entry.yachtName,
        gt: req.gt,
        loa: req.loa,
        beam: req.beam,
        draft: req.draft,
        fuel: req.fuel,
        fuelLph: res.fuel_lph,
        sizeCategory: res.size_category,
        loskrav: res.loskrav,
        itinerary: opts.itinerary,
        stops: res.stops,
        estimatedTotal: res.grand_total,
        actualTotal: opts.actualCost,
      });
      onSaved();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit registry entry</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Changes re-run the prediction and update the saved estimate.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          {loadError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-800 text-sm">{loadError}</p>
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-800 text-sm">{saveError}</p>
            </div>
          )}

          {!options && !loadError && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-500 text-sm">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading form...
              </div>
            </div>
          )}

          {options && (
            <VoyageForm
              options={options}
              onSubmit={handleSubmit}
              loading={saving}
              initial={entryToInitial(entry)}
              mode="edit"
              primaryLabel="Save changes"
              showActualCost
              showAddToRegistry={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
