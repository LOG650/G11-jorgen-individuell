const GOAL_KEY = "nauticost.revenuegoal.v1";
const HISTORY_KEY = "nauticost.revenuehistory.v1";
const DRIVERS_KEY = "nauticost.revenuedrivers.v1";
export const HISTORIC_START_YEAR = 2020;

export interface RevenueGoal {
  targetRevenue: number;
  targetYear: number;
}

export interface RevenueYear {
  year: number;
  revenue: number;
  // Number of yachts active that year. Optional — historic rows pre-dating this
  // field have it undefined; treat as "unknown" rather than 0 in the UI.
  yachtCount?: number;
}

const DEFAULT_GOAL: RevenueGoal = { targetRevenue: 0, targetYear: 2030 };

// Sourced from "004 data/cockpit_clean.csv" → revenue_Total per year (EUR).
// The CSV stores totals in thousands of EUR; values below are already expanded.
export const HISTORIC_REVENUE_DEFAULTS: RevenueYear[] = [
  { year: 2020, revenue: 47309 },
  { year: 2021, revenue: 360535 },
  { year: 2022, revenue: 322101 },
  { year: 2023, revenue: 512996 },
  { year: 2024, revenue: 1181699 },
  { year: 2025, revenue: 1541399 },
];

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

export function loadRevenueHistory(): RevenueYear[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (raw === null) {
      // Seed with the historic 2020-2025 totals on first visit so the
      // forecast/algorithm has data to fit immediately.
      saveRevenueHistory(HISTORIC_REVENUE_DEFAULTS);
      return [...HISTORIC_REVENUE_DEFAULTS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => {
        const rawCount = Number(p?.yachtCount);
        return {
          year: Number(p?.year),
          revenue: Number(p?.revenue) || 0,
          yachtCount: Number.isFinite(rawCount) && rawCount >= 0 ? rawCount : undefined,
        };
      })
      .filter((p) => Number.isFinite(p.year))
      .sort((a, b) => a.year - b.year);
  } catch {
    return [];
  }
}

export function saveRevenueHistory(history: RevenueYear[]): void {
  if (!isBrowser()) return;
  const cleaned = history
    .map((p) => {
      const out: RevenueYear = {
        year: Number(p.year),
        revenue: Number(p.revenue) || 0,
      };
      if (Number.isFinite(p.yachtCount) && (p.yachtCount as number) >= 0) {
        out.yachtCount = p.yachtCount;
      }
      return out;
    })
    .filter((p) => Number.isFinite(p.year));
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(cleaned));
}

export function revenueByYear(history?: RevenueYear[]): Map<number, number> {
  const data = history ?? loadRevenueHistory();
  const totals = new Map<number, number>();
  for (const p of data) {
    totals.set(p.year, (totals.get(p.year) ?? 0) + p.revenue);
  }
  return totals;
}

export interface DriverState {
  /** Ordered list of driver column names. */
  names: string[];
  /** year → driver name → numeric value (covers both history and future years). */
  values: Record<number, Record<string, number>>;
}

const DEFAULT_DRIVERS: DriverState = { names: [], values: {} };

export function loadDrivers(): DriverState {
  if (!isBrowser()) return { names: [], values: {} };
  try {
    const raw = window.localStorage.getItem(DRIVERS_KEY);
    if (!raw) return { names: [], values: {} };
    const parsed = JSON.parse(raw);
    const names: string[] = Array.isArray(parsed?.names)
      ? parsed.names.filter((s: unknown) => typeof s === "string" && s.trim() !== "")
      : [];
    const rawValues = parsed?.values;
    const values: Record<number, Record<string, number>> = {};
    if (rawValues && typeof rawValues === "object") {
      for (const [yearKey, perDriver] of Object.entries(rawValues)) {
        const y = Number(yearKey);
        if (!Number.isFinite(y) || !perDriver || typeof perDriver !== "object") continue;
        const row: Record<string, number> = {};
        for (const [name, v] of Object.entries(perDriver as Record<string, unknown>)) {
          const num = Number(v);
          if (Number.isFinite(num)) row[name] = num;
        }
        values[y] = row;
      }
    }
    return { names, values };
  } catch {
    return { ...DEFAULT_DRIVERS };
  }
}

export function saveDrivers(state: DriverState): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(DRIVERS_KEY, JSON.stringify(state));
}

export function goalForYear(
  goal: RevenueGoal,
  year: number,
  baselineYear: number,
  baselineRevenue: number,
): number | null {
  if (goal.targetRevenue <= 0 || goal.targetYear <= baselineYear) return null;
  if (year < baselineYear) return null;
  if (year >= goal.targetYear) return goal.targetRevenue;
  const span = goal.targetYear - baselineYear;
  const step = (goal.targetRevenue - baselineRevenue) / span;
  return baselineRevenue + step * (year - baselineYear);
}
