export interface PortStop {
  port: string;
  month: number;
  stay_days: number;
}

export interface VoyageRequest {
  gt: number;
  loa: number;
  beam: number;
  draft: number;
  fuel: string;
  stops: PortStop[];
}

export interface HistoricalRange {
  p25: number;
  p50: number;
  p75: number;
}

export interface StopResult {
  port: string;
  month: number;
  stay_days: number;
  total: number;
  historical_range: HistoricalRange | null;
}

export interface VoyageResponse {
  category_totals: Record<string, number>;
  grand_total: number;
  size_category: string;
  loskrav: string;
  fuel_lph: number;
  stops: StopResult[];
  historical_range: HistoricalRange | null;
}

export interface OptionsResponse {
  countries: string[];
  ports: Record<string, string[]>;
  fuel_levels: string[];
  months: number[];
}

export interface HealthResponse {
  status: string;
  model_features: number;
  ensemble_weight: number;
  trained_on_rows: number;
}
