export interface PortStop {
  port: string;
  month: number;
  stay_days: number;
  distance_nm?: number | null;
}

export type GuestExperience = "demanding" | "neutral" | "not_demanding";

export interface VoyageRequest {
  gt: number;
  loa: number;
  beam: number;
  draft: number;
  fuel: string;
  stops: PortStop[];
  currency: string;
  pilot_cost?: number | null;
  pilot_type?: "national" | "private" | null;
  cruising_speed_kn?: number | null;
  diesel_price_per_l?: number | null;
  provisioning_override?: number | null;
  guest_experience?: GuestExperience | null;
}

export interface HistoricalRange {
  p25: number;
  p50: number;
  p75: number;
}

export interface StopResult {
  port: string;
  country?: string;
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
  currency: string;
  exchange_rate_from_eur: number;
  guest_experience: GuestExperience | null;
  guest_experience_note: string | null;
}

export interface OptionsResponse {
  countries: string[];
  ports: Record<string, string[]>;
  fuel_levels: string[];
  months: number[];
  currencies: string[];
  exchange_rates_from_eur: Record<string, number>;
}

export interface HealthResponse {
  status: string;
  model_features: number;
  ensemble_weight: number;
  trained_on_rows: number;
}
