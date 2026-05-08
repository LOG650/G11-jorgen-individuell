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

const CURRENCY_LOCALE: Record<string, string> = {
  NOK: "nb-NO",
  DKK: "da-DK",
  EUR: "de-DE",
};

export function formatCurrency(value: number, currency: string = "NOK"): string {
  const locale = CURRENCY_LOCALE[currency] ?? "nb-NO";
  return value.toLocaleString(locale, { maximumFractionDigits: 0 });
}

// Reference rates kept in sync with backend EXCHANGE_RATES_FROM_EUR
// (backend/main.py). DKK is pegged to EUR at ~7.46 (ERM II).
export const EXCHANGE_RATES_FROM_EUR: Record<string, number> = {
  EUR: 1.0,
  NOK: 11.5,
  DKK: 7.46,
};

const CURRENCY_PREF_KEY = "nauticost.currency.v1";

export function loadCurrencyPref(): string {
  if (typeof window === "undefined") return "NOK";
  const stored = window.localStorage.getItem(CURRENCY_PREF_KEY);
  return stored && stored in EXCHANGE_RATES_FROM_EUR ? stored : "NOK";
}

export function saveCurrencyPref(currency: string): void {
  if (typeof window === "undefined") return;
  if (!(currency in EXCHANGE_RATES_FROM_EUR)) return;
  window.localStorage.setItem(CURRENCY_PREF_KEY, currency);
}

export function fxFromEur(currency: string): number {
  return EXCHANGE_RATES_FROM_EUR[currency] ?? 1;
}
