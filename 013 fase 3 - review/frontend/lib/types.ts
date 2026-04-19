export interface VoyageRequest {
  gt: number;
  loa: number;
  beam: number;
  draft: number;
  fuel: string;
  country: string;
  stay: number;
  month: number;
}

export interface PortDetail {
  total: number;
  weight: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

export interface WeightedRange {
  p25: number;
  p50: number;
  p75: number;
}

export interface VoyageResponse {
  category_totals: Record<string, number>;
  grand_total: number;
  size_category: string;
  loskrav: string;
  fuel_lph: number;
  port_details: Record<string, PortDetail>;
  weighted_range: WeightedRange;
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
