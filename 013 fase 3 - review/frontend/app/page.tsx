"use client";

import { useEffect, useState } from "react";
import type { VoyageRequest, VoyageResponse, OptionsResponse } from "../lib/types";
import { fetchOptions, predictVoyage } from "../lib/api";
import { addEntry } from "../lib/registry";
import VoyageForm from "../components/VoyageForm";
import ResultsPanel from "../components/ResultsPanel";

export default function Dashboard() {
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [result, setResult] = useState<VoyageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchOptions()
      .then(setOptions)
      .catch(() => setError("Could not connect to backend. Is the API server running on port 8000?"));
  }, []);

  async function handleSubmit(req: VoyageRequest, opts: { save: boolean; yachtName: string }) {
    setLoading(true);
    setError(null);
    setSavedNotice(null);
    try {
      const res = await predictVoyage(req);
      setResult(res);
      if (opts.save && opts.yachtName) {
        addEntry({
          yachtName: opts.yachtName,
          gt: req.gt,
          loa: req.loa,
          beam: req.beam,
          draft: req.draft,
          fuel: req.fuel,
          fuelLph: res.fuel_lph,
          sizeCategory: res.size_category,
          loskrav: res.loskrav,
          stops: res.stops,
          estimatedTotal: res.grand_total,
          actualTotal: null,
        });
        setSavedNotice(`Saved ${opts.yachtName} to the registry.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  if (error && !options) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-800 font-medium">Backend Unavailable</p>
          <p className="text-red-600 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!options) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Voyage Cost Estimator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter yacht specifications and voyage details to get an estimated cost breakdown.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Form */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-8">
            <VoyageForm options={options} onSubmit={handleSubmit} loading={loading} />
          </div>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {savedNotice && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <p className="text-green-800 text-sm">{savedNotice}</p>
            </div>
          )}

          {result ? (
            <ResultsPanel result={result} />
          ) : (
            <div className="flex items-center justify-center min-h-[400px] bg-white rounded-xl border border-gray-200 border-dashed">
              <div className="text-center text-gray-400">
                <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
                </svg>
                <p className="text-sm">Fill in the form and click &quot;Estimate&quot; to see results</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
