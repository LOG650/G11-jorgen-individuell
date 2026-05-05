/**
 * Additive seasonal decomposition + Holt-Winters additive forecast for
 * regularly-spaced periodic time series (e.g. monthly with period m=12).
 */

export interface MonthlyPoint {
  /** YYYY-MM e.g. "2024-03" */
  yyyymm: string;
  value: number;
}

export interface DecompositionPoint {
  yyyymm: string;
  observed: number;
  trend: number | null;
  seasonal: number | null;
  residual: number | null;
}

export interface DecompositionResult {
  points: DecompositionPoint[];
  /** Seasonal component for each period index 0..m-1 (e.g. 12 entries for monthly). */
  seasonalIndex: number[];
  period: number;
}

/**
 * Centered moving-average trend for an even period (e.g. 12).
 * trend[t] = (0.5*y[t-m/2] + y[t-m/2+1] + ... + y[t+m/2-1] + 0.5*y[t+m/2]) / m
 * Endpoints with insufficient context are returned as null.
 */
function centeredMovingAverage(values: number[], period: number): (number | null)[] {
  const n = values.length;
  const half = period / 2;
  const out: (number | null)[] = new Array(n).fill(null);
  if (period % 2 === 0) {
    for (let t = half; t < n - half; t++) {
      let s = 0;
      s += 0.5 * values[t - half];
      for (let k = -half + 1; k <= half - 1; k++) s += values[t + k];
      s += 0.5 * values[t + half];
      out[t] = s / period;
    }
  } else {
    const off = Math.floor(period / 2);
    for (let t = off; t < n - off; t++) {
      let s = 0;
      for (let k = -off; k <= off; k++) s += values[t + k];
      out[t] = s / period;
    }
  }
  return out;
}

/**
 * Additive decomposition: y = trend + seasonal + residual.
 * Requires at least 2 full periods of data.
 */
export function additiveDecomposition(
  series: MonthlyPoint[],
  period = 12,
): DecompositionResult | null {
  const n = series.length;
  if (n < 2 * period) return null;
  const values = series.map((p) => p.value);
  const trend = centeredMovingAverage(values, period);

  // Detrended values, grouped by period index (0..period-1).
  const detrendedByPos: number[][] = Array.from({ length: period }, () => []);
  for (let t = 0; t < n; t++) {
    if (trend[t] !== null) {
      detrendedByPos[t % period].push(values[t] - (trend[t] as number));
    }
  }
  const seasonalIndex: number[] = detrendedByPos.map((arr) =>
    arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length,
  );
  // Center seasonal index to sum to 0.
  const meanSeason = seasonalIndex.reduce((s, v) => s + v, 0) / period;
  for (let i = 0; i < period; i++) seasonalIndex[i] -= meanSeason;

  const points: DecompositionPoint[] = series.map((p, t) => {
    const seasonal = seasonalIndex[t % period];
    const tr = trend[t];
    const residual = tr === null ? null : p.value - tr - seasonal;
    return { yyyymm: p.yyyymm, observed: p.value, trend: tr, seasonal, residual };
  });

  return { points, seasonalIndex, period };
}

export interface HoltWintersResult {
  /** Fitted (in-sample) values. */
  fitted: (number | null)[];
  /** Future forecast values aligned with `forecastLabels`. */
  forecast: number[];
  forecastLabels: string[];
  level: number;
  trend: number;
  seasonalLast: number[];
  alpha: number;
  beta: number;
  gamma: number;
  mae: number | null;
}

/**
 * Holt-Winters additive (level + trend + seasonal). Grid-searches α, β, γ
 * over a coarse grid and picks the smoothing constants with lowest in-sample MAE.
 */
export function holtWintersAdditive(
  series: MonthlyPoint[],
  period: number,
  horizonMonths: number,
): HoltWintersResult | null {
  const n = series.length;
  if (n < 2 * period) return null;
  const values = series.map((p) => p.value);

  function fit(alpha: number, beta: number, gamma: number) {
    // Initial level = mean of first period
    let level = 0;
    for (let i = 0; i < period; i++) level += values[i];
    level /= period;
    // Initial trend = (mean of period 2 - mean of period 1) / period
    let p1 = 0;
    let p2 = 0;
    for (let i = 0; i < period; i++) p1 += values[i];
    for (let i = period; i < 2 * period; i++) p2 += values[i];
    let trend = (p2 / period - p1 / period) / period;
    // Initial seasonals: y[i] - level for i=0..period-1
    const seasonal: number[] = [];
    for (let i = 0; i < period; i++) seasonal.push(values[i] - level);

    const fitted: (number | null)[] = new Array(n).fill(null);
    let absErr = 0;
    let count = 0;
    for (let t = period; t < n; t++) {
      const sIdx = t % period;
      const pred = level + trend + seasonal[sIdx];
      fitted[t] = pred;
      absErr += Math.abs(values[t] - pred);
      count++;
      const newLevel = alpha * (values[t] - seasonal[sIdx]) + (1 - alpha) * (level + trend);
      const newTrend = beta * (newLevel - level) + (1 - beta) * trend;
      const newSeason = gamma * (values[t] - newLevel) + (1 - gamma) * seasonal[sIdx];
      level = newLevel;
      trend = newTrend;
      seasonal[sIdx] = newSeason;
    }
    return {
      fitted,
      mae: count > 0 ? absErr / count : Infinity,
      level,
      trend,
      seasonal,
    };
  }

  let best: ReturnType<typeof fit> | null = null;
  let bestParams = { alpha: 0.3, beta: 0.1, gamma: 0.3 };
  for (let a = 0.1; a <= 0.9; a += 0.2) {
    for (let b = 0.05; b <= 0.55; b += 0.1) {
      for (let g = 0.1; g <= 0.9; g += 0.2) {
        const r = fit(a, b, g);
        if (best === null || r.mae < best.mae) {
          best = r;
          bestParams = { alpha: a, beta: b, gamma: g };
        }
      }
    }
  }
  if (!best) return null;

  // Build forecast.
  const forecast: number[] = [];
  const forecastLabels: string[] = [];
  const lastLabel = series[n - 1].yyyymm;
  const [lastY, lastM] = lastLabel.split("-").map((s) => parseInt(s, 10));
  let y = lastY;
  let m = lastM;
  for (let h = 1; h <= horizonMonths; h++) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    const sIdx = (n - 1 + h) % period;
    forecast.push(best.level + h * best.trend + best.seasonal[sIdx]);
    forecastLabels.push(`${y}-${String(m).padStart(2, "0")}`);
  }

  return {
    fitted: best.fitted,
    forecast,
    forecastLabels,
    level: best.level,
    trend: best.trend,
    seasonalLast: best.seasonal,
    alpha: bestParams.alpha,
    beta: bestParams.beta,
    gamma: bestParams.gamma,
    mae: Number.isFinite(best.mae) ? best.mae : null,
  };
}

/**
 * Parse one entry per line. Accepts:
 *   "2024-03,1234.5"
 *   "2024-03 1234.5"
 *   "2024,3,1234.5"
 * Lines with bad data are skipped.
 */
export function parseMonthlyInput(text: string): MonthlyPoint[] {
  const out: MonthlyPoint[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/[\s,;\t]+/);
    if (parts.length < 2) continue;
    let yyyymm: string | null = null;
    let valStr: string | null = null;
    if (parts.length >= 3 && /^\d{4}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
      const y = parts[0];
      const m = String(parseInt(parts[1], 10)).padStart(2, "0");
      yyyymm = `${y}-${m}`;
      valStr = parts[2];
    } else if (/^\d{4}-\d{1,2}$/.test(parts[0])) {
      const [y, mRaw] = parts[0].split("-");
      yyyymm = `${y}-${String(parseInt(mRaw, 10)).padStart(2, "0")}`;
      valStr = parts[1];
    }
    if (!yyyymm || valStr === null) continue;
    const v = parseFloat(valStr.replace(/[^0-9eE+\-.]/g, ""));
    if (!Number.isFinite(v)) continue;
    out.push({ yyyymm, value: v });
  }
  return out.sort((a, b) => a.yyyymm.localeCompare(b.yyyymm));
}

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
