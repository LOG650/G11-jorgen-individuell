import type { VoyageRequest, VoyageResponse, OptionsResponse, HealthResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchOptions(): Promise<OptionsResponse> {
  const res = await fetch(`${API_BASE}/api/options`);
  if (!res.ok) throw new Error("Failed to fetch options");
  return res.json();
}

export async function predictVoyage(req: VoyageRequest): Promise<VoyageResponse> {
  const res = await fetch(`${API_BASE}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Prediction failed" }));
    throw new Error(err.detail || "Prediction failed");
  }
  return res.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Backend unavailable");
  return res.json();
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
