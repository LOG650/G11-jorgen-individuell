import type { StopResult } from "./types";

const STORAGE_KEY = "nauticost.registry.v1";

export interface RegistryItineraryStop {
  port: string;
  arrivalDate: string;
  months: string;
  weeks: string;
  days: string;
}

export interface RegistryEntry {
  id: string;
  yachtName: string;
  gt: number;
  loa: number;
  beam: number;
  draft: number;
  fuel: string;
  fuelLph: number;
  sizeCategory: string;
  loskrav: string;
  itinerary: RegistryItineraryStop[];
  stops: StopResult[];
  estimatedTotal: number;
  actualTotal: number | null;
  createdAt: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function listEntries(): RegistryEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(entries: RegistryEntry[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addEntry(entry: Omit<RegistryEntry, "id" | "createdAt">): RegistryEntry {
  const full: RegistryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const entries = listEntries();
  entries.unshift(full);
  save(entries);
  return full;
}

export function updateEntry(id: string, patch: Partial<RegistryEntry>): void {
  const entries = listEntries().map((e) => (e.id === id ? { ...e, ...patch } : e));
  save(entries);
}

export function removeEntry(id: string): void {
  save(listEntries().filter((e) => e.id !== id));
}

export function clearRegistry(): void {
  save([]);
}
