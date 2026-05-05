export type ForecastMethod =
  | "holt"
  | "ses"
  | "moving_average"
  | "naive"
  | "linear"
  | "multiple_regression";

export const FORECAST_METHOD_LABELS: Record<ForecastMethod, string> = {
  holt: "Holt's linear (level + trend)",
  ses: "Simple exponential smoothing",
  moving_average: "Moving average (3-yr)",
  naive: "Naive (random walk)",
  linear: "Linear regression (OLS on year)",
  multiple_regression: "Multiple regression (drivers)",
};

export interface YearValue {
  year: number;
  value: number;
}

export interface ForecastResult {
  method: ForecastMethod;
  forecast: YearValue[];
  mae: number | null;
  params?: {
    alpha?: number;
    beta?: number;
    window?: number;
    slope?: number;
    intercept?: number;
    r2?: number;
    /** Driver name → coefficient, plus an "(intercept)" key, for multiple regression. */
    coefficients?: Record<string, number>;
    /** Reason the regression failed (e.g. not enough rows). */
    error?: string;
  };
}

export interface DriverObservation {
  year: number;
  /** Response variable (e.g. revenue). */
  value: number;
  /** Driver name → numeric value for that year. */
  drivers: Record<string, number>;
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

interface OLSFit {
  slope: number;
  intercept: number;
  r2: number;
}

function olsFit(history: YearValue[]): OLSFit {
  const n = history.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  if (n === 1) return { slope: 0, intercept: history[0].value, r2: 0 };
  let sumX = 0;
  let sumY = 0;
  for (const p of history) {
    sumX += p.year;
    sumY += p.value;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of history) {
    const dx = p.year - meanX;
    const dy = p.value - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slope * meanX;
  let ssRes = 0;
  for (const p of history) {
    const pred = intercept + slope * p.year;
    const err = p.value - pred;
    ssRes += err * err;
  }
  const r2 = syy === 0 ? 1 : 1 - ssRes / syy;
  return { slope, intercept, r2 };
}

function linearForecast(history: YearValue[], horizonYears: number[]): ForecastResult {
  if (history.length < 2) return naiveForecast(history, horizonYears);
  const fit = olsFit(history);
  const forecast = horizonYears.map((y) => ({
    year: y,
    value: fit.intercept + fit.slope * y,
  }));
  // One-step MAE: re-fit OLS on each prefix and predict the next year.
  const mae = oneStepMAE(history, (h) => {
    if (h.length < 2) return h[h.length - 1]?.value ?? 0;
    const f = olsFit(h);
    const nextYear = h[h.length - 1].year + 1;
    return f.intercept + f.slope * nextYear;
  });
  return {
    method: "linear",
    forecast,
    mae,
    params: {
      slope: round2(fit.slope),
      intercept: round2(fit.intercept),
      r2: Math.round(fit.r2 * 1000) / 1000,
    },
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

/**
 * Solves Ax = b for x where A is a square n×n matrix using Gauss-Jordan
 * elimination with partial pivoting. Returns null if A is singular.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  if (n === 0) return [];
  // Build augmented matrix [A | b]
  const M: number[][] = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let pivotRow = i;
    let pivotMag = Math.abs(M[i][i]);
    for (let r = i + 1; r < n; r++) {
      const m = Math.abs(M[r][i]);
      if (m > pivotMag) {
        pivotMag = m;
        pivotRow = r;
      }
    }
    if (pivotMag < 1e-12) return null;
    if (pivotRow !== i) [M[i], M[pivotRow]] = [M[pivotRow], M[i]];
    const pivot = M[i][i];
    for (let c = i; c <= n; c++) M[i][c] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = M[r][i];
      if (factor === 0) continue;
      for (let c = i; c <= n; c++) M[r][c] -= factor * M[i][c];
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Fits a multiple linear regression value ~ intercept + Σ βⱼ·driverⱼ
 * using the normal equations XᵀX·β = Xᵀy. Returns coefficients keyed by
 * driver name plus an "(intercept)" entry, the predicted values for each
 * input row, the R², and the one-step (re-fit) MAE.
 */
function multipleRegressionFit(
  observations: DriverObservation[],
  driverNames: string[],
): {
  coefficients: Record<string, number>;
  predictions: number[];
  r2: number;
} | null {
  const n = observations.length;
  const k = driverNames.length + 1; // + intercept
  if (n < k) return null;
  // Design matrix X (n × k) with leading 1s for intercept, response y
  const X: number[][] = observations.map((o) => [
    1,
    ...driverNames.map((d) => Number(o.drivers[d] ?? 0)),
  ]);
  const y: number[] = observations.map((o) => o.value);
  // XᵀX (k × k) and Xᵀy (k)
  const XtX: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  const Xty: number[] = Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) {
        XtX[a][b] += X[i][a] * X[i][b];
      }
    }
  }
  const beta = solveLinearSystem(XtX, Xty);
  if (!beta) return null;
  const coefficients: Record<string, number> = { "(intercept)": beta[0] };
  driverNames.forEach((d, i) => {
    coefficients[d] = beta[i + 1];
  });
  const predictions = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (y[i] - meanY) ** 2;
    ssRes += (y[i] - predictions[i]) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { coefficients, predictions, r2 };
}

export function multipleRegressionForecast(
  observations: DriverObservation[],
  driverNames: string[],
  futureDrivers: { year: number; drivers: Record<string, number> }[],
): ForecastResult {
  const sorted = [...observations].sort((a, b) => a.year - b.year);
  const horizon = [...futureDrivers].sort((a, b) => a.year - b.year);
  const n = sorted.length;
  const k = driverNames.length + 1;

  if (driverNames.length === 0) {
    return {
      method: "multiple_regression",
      forecast: [],
      mae: null,
      params: { error: "Add at least one driver column to fit a regression." },
    };
  }
  if (n < k) {
    return {
      method: "multiple_regression",
      forecast: [],
      mae: null,
      params: {
        error: `Need at least ${k} years of history for ${driverNames.length} drivers (have ${n}).`,
      },
    };
  }

  const fit = multipleRegressionFit(sorted, driverNames);
  if (!fit) {
    return {
      method: "multiple_regression",
      forecast: [],
      mae: null,
      params: { error: "Regression failed (singular matrix — drivers may be collinear)." },
    };
  }

  const forecast: YearValue[] = horizon.map((row) => {
    let v = fit.coefficients["(intercept)"];
    for (const d of driverNames) {
      v += fit.coefficients[d] * Number(row.drivers[d] ?? 0);
    }
    return { year: row.year, value: v };
  });

  // One-step MAE: re-fit on growing prefixes and predict next.
  let absErr = 0;
  let count = 0;
  for (let i = k; i < n; i++) {
    const prefix = sorted.slice(0, i);
    const sub = multipleRegressionFit(prefix, driverNames);
    if (!sub) continue;
    let pred = sub.coefficients["(intercept)"];
    for (const d of driverNames) {
      pred += sub.coefficients[d] * Number(sorted[i].drivers[d] ?? 0);
    }
    absErr += Math.abs(sorted[i].value - pred);
    count++;
  }
  const mae = count > 0 ? absErr / count : null;

  const roundedCoefs: Record<string, number> = {};
  for (const [k2, v] of Object.entries(fit.coefficients)) {
    roundedCoefs[k2] = round2(v);
  }

  return {
    method: "multiple_regression",
    forecast,
    mae,
    params: {
      coefficients: roundedCoefs,
      r2: Math.round(fit.r2 * 1000) / 1000,
    },
  };
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
    case "linear":
      return linearForecast(sorted, horizon);
    case "multiple_regression":
      // Multiple regression needs driver inputs that runForecast does not
      // receive; callers should invoke multipleRegressionForecast directly.
      return {
        method: "multiple_regression",
        forecast: [],
        mae: null,
        params: { error: "Multiple regression requires driver inputs." },
      };
    case "holt":
    default:
      return holtForecast(sorted, horizon);
  }
}

export function pickBestMethod(history: YearValue[]): ForecastMethod {
  if (history.length < 2) return "naive";
  const candidates: ForecastMethod[] = ["holt", "ses", "linear", "moving_average", "naive"];
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
