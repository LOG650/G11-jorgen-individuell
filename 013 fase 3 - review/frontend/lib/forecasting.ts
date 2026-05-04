export type ForecastMethod = "holt" | "ses" | "moving_average" | "naive";

export const FORECAST_METHOD_LABELS: Record<ForecastMethod, string> = {
  holt: "Holt's linear (level + trend)",
  ses: "Simple exponential smoothing",
  moving_average: "Moving average (3-yr)",
  naive: "Naive (random walk)",
};

export interface YearValue {
  year: number;
  value: number;
}

export interface ForecastResult {
  method: ForecastMethod;
  forecast: YearValue[];
  mae: number | null;
  params?: { alpha?: number; beta?: number; window?: number };
}

function lastValue(history: YearValue[]): number {
  return history[history.length - 1]?.value ?? 0;
}

function naiveForecast(history: YearValue[], horizonYears: number[]): ForecastResult {
  const last = lastValue(history);
  return {
    method: "naive",
    forecast: horizonYears.map((y) => ({ year: y, value: last })),
    mae: oneStepMAE(history, (h) => lastValue(h)),
  };
}

function movingAverageForecast(
  history: YearValue[],
  horizonYears: number[],
  window = 3,
): ForecastResult {
  function predictNext(h: YearValue[]): number {
    if (h.length === 0) return 0;
    const slice = h.slice(-window);
    return slice.reduce((s, p) => s + p.value, 0) / slice.length;
  }
  const next = predictNext(history);
  return {
    method: "moving_average",
    forecast: horizonYears.map((y) => ({ year: y, value: next })),
    mae: oneStepMAE(history, predictNext),
    params: { window },
  };
}

function sesFit(history: YearValue[], alpha: number): { level: number; mae: number } {
  if (history.length === 0) return { level: 0, mae: 0 };
  let level = history[0].value;
  let absErr = 0;
  let n = 0;
  for (let i = 1; i < history.length; i++) {
    const pred = level;
    absErr += Math.abs(history[i].value - pred);
    n++;
    level = alpha * history[i].value + (1 - alpha) * level;
  }
  return { level, mae: n > 0 ? absErr / n : 0 };
}

function sesForecast(history: YearValue[], horizonYears: number[]): ForecastResult {
  if (history.length < 2) return naiveForecast(history, horizonYears);
  let bestAlpha = 0.5;
  let bestMae = Infinity;
  let bestLevel = lastValue(history);
  for (let a = 0.1; a <= 0.95; a += 0.05) {
    const { level, mae } = sesFit(history, a);
    if (mae < bestMae) {
      bestMae = mae;
      bestAlpha = a;
      bestLevel = level;
    }
  }
  return {
    method: "ses",
    forecast: horizonYears.map((y) => ({ year: y, value: bestLevel })),
    mae: bestMae === Infinity ? null : bestMae,
    params: { alpha: round2(bestAlpha) },
  };
}

interface HoltState {
  level: number;
  trend: number;
  mae: number;
}

function holtFit(history: YearValue[], alpha: number, beta: number): HoltState {
  if (history.length === 0) return { level: 0, trend: 0, mae: 0 };
  let level = history[0].value;
  let trend = history.length >= 2 ? history[1].value - history[0].value : 0;
  let absErr = 0;
  let n = 0;
  for (let i = 1; i < history.length; i++) {
    const pred = level + trend;
    absErr += Math.abs(history[i].value - pred);
    n++;
    const newLevel = alpha * history[i].value + (1 - alpha) * (level + trend);
    const newTrend = beta * (newLevel - level) + (1 - beta) * trend;
    level = newLevel;
    trend = newTrend;
  }
  return { level, trend, mae: n > 0 ? absErr / n : 0 };
}

function holtForecast(history: YearValue[], horizonYears: number[]): ForecastResult {
  if (history.length < 2) return naiveForecast(history, horizonYears);
  let best: HoltState & { alpha: number; beta: number } = {
    level: 0,
    trend: 0,
    mae: Infinity,
    alpha: 0.5,
    beta: 0.1,
  };
  for (let a = 0.1; a <= 0.95; a += 0.05) {
    for (let b = 0.05; b <= 0.95; b += 0.05) {
      const fit = holtFit(history, a, b);
      if (fit.mae < best.mae) {
        best = { ...fit, alpha: a, beta: b };
      }
    }
  }
  const lastYear = history[history.length - 1].year;
  const forecast = horizonYears.map((y) => {
    const h = y - lastYear;
    return { year: y, value: best.level + h * best.trend };
  });
  return {
    method: "holt",
    forecast,
    mae: best.mae === Infinity ? null : best.mae,
    params: { alpha: round2(best.alpha), beta: round2(best.beta) },
  };
}

function oneStepMAE(history: YearValue[], predictFromPrefix: (h: YearValue[]) => number): number | null {
  if (history.length < 2) return null;
  let absErr = 0;
  let n = 0;
  for (let i = 1; i < history.length; i++) {
    const prefix = history.slice(0, i);
    const pred = predictFromPrefix(prefix);
    absErr += Math.abs(history[i].value - pred);
    n++;
  }
  return n > 0 ? absErr / n : null;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function runForecast(
  method: ForecastMethod,
  history: YearValue[],
  horizonYears: number[],
): ForecastResult {
  const sorted = [...history].sort((a, b) => a.year - b.year);
  const horizon = [...horizonYears].sort((a, b) => a - b);
  switch (method) {
    case "naive":
      return naiveForecast(sorted, horizon);
    case "moving_average":
      return movingAverageForecast(sorted, horizon);
    case "ses":
      return sesForecast(sorted, horizon);
    case "holt":
    default:
      return holtForecast(sorted, horizon);
  }
}

export function pickBestMethod(history: YearValue[]): ForecastMethod {
  if (history.length < 2) return "naive";
  const candidates: ForecastMethod[] = ["holt", "ses", "moving_average", "naive"];
  let best: ForecastMethod = "naive";
  let bestMae = Infinity;
  for (const m of candidates) {
    const r = runForecast(m, history, []);
    if (r.mae !== null && r.mae < bestMae) {
      bestMae = r.mae;
      best = m;
    }
  }
  return best;
}
