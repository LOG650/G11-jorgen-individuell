const STORAGE_KEY = "nauticost.forecast.v1";

export interface ForecastConfig {
  targetRevenue: number;
  stretchPct: number;
}

const DEFAULT_CONFIG: ForecastConfig = {
  targetRevenue: 0,
  stretchPct: 10,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadForecastConfig(): ForecastConfig {
  if (!isBrowser()) return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      targetRevenue: Number(parsed?.targetRevenue) || 0,
      stretchPct: Number.isFinite(parsed?.stretchPct) ? Number(parsed.stretchPct) : 10,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveForecastConfig(cfg: ForecastConfig): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}
