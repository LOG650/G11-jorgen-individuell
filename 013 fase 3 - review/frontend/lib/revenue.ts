import { listEntries, type RegistryEntry } from "./registry";

const GOAL_KEY = "nauticost.revenuegoal.v1";
export const HISTORIC_START_YEAR = 2020;

export interface RevenueGoal {
  targetRevenue: number;
  targetYear: number;
}

const DEFAULT_GOAL: RevenueGoal = { targetRevenue: 0, targetYear: 2030 };

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadRevenueGoal(): RevenueGoal {
  if (!isBrowser()) return DEFAULT_GOAL;
  try {
    const raw = window.localStorage.getItem(GOAL_KEY);
    if (!raw) return DEFAULT_GOAL;
    const parsed = JSON.parse(raw);
    return {
      targetRevenue: Number(parsed?.targetRevenue) || 0,
      targetYear: Number(parsed?.targetYear) || DEFAULT_GOAL.targetYear,
    };
  } catch {
    return DEFAULT_GOAL;
  }
}

export function saveRevenueGoal(goal: RevenueGoal): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
}

function entryYear(entry: RegistryEntry): number | null {
  const firstStopDate = entry.itinerary?.[0]?.arrivalDate;
  if (firstStopDate) {
    const y = parseInt(firstStopDate.slice(0, 4), 10);
    if (Number.isFinite(y)) return y;
  }
  if (entry.createdAt) {
    const y = new Date(entry.createdAt).getFullYear();
    if (Number.isFinite(y)) return y;
  }
  return null;
}

export function revenueByYear(entries?: RegistryEntry[]): Map<number, number> {
  const all = entries ?? listEntries();
  const totals = new Map<number, number>();
  for (const e of all) {
    if (e.actualTotal === null || e.actualTotal === undefined) continue;
    const y = entryYear(e);
    if (y === null) continue;
    totals.set(y, (totals.get(y) ?? 0) + e.actualTotal);
  }
  return totals;
}

export function goalForYear(goal: RevenueGoal, year: number, baselineYear: number, baselineRevenue: number): number | null {
  if (goal.targetRevenue <= 0 || goal.targetYear <= baselineYear) return null;
  if (year < baselineYear) return null;
  if (year >= goal.targetYear) return goal.targetRevenue;
  const span = goal.targetYear - baselineYear;
  const step = (goal.targetRevenue - baselineRevenue) / span;
  return baselineRevenue + step * (year - baselineYear);
}
