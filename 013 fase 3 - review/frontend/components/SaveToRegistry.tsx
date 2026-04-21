"use client";

import { useState } from "react";
import type { VoyageRequest, VoyageResponse } from "../lib/types";
import { addEntry } from "../lib/registry";

interface Props {
  request: VoyageRequest;
  response: VoyageResponse;
}

export default function SaveToRegistry({ request, response }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addEntry({
      yachtName: name.trim(),
      gt: request.gt,
      loa: request.loa,
      beam: request.beam,
      draft: request.draft,
      fuel: request.fuel,
      fuelLph: response.fuel_lph,
      sizeCategory: response.size_category,
      loskrav: response.loskrav,
      stops: response.stops,
      estimatedTotal: response.grand_total,
      actualTotal: null,
    });
    setSaved(true);
    setName("");
    setTimeout(() => {
      setOpen(false);
      setSaved(false);
    }, 1200);
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          Save to registry
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="flex flex-col gap-2 bg-white rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Yacht name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. M/Y Serenity"
          required
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setName("");
          }}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || saved}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </form>
  );
}
