# NautiCost — Domain Model

## Core Domain Entities

### Yacht
Represents a vessel with physical specifications.
- `gt` (float) — Gross tonnage
- `loa_m` (float) — Length overall in meters
- `beam_m` (float) — Beam width in meters
- `draft_m` (float) — Draft depth in meters
- `fuel_lph` (float) — Fuel consumption in liters per hour
- Derived: `size_category` (Liten < 98 GT, Mellomstor 98-1000 GT, Stor > 1000 GT)
- Derived: `loskrav` (Ja if LOA > 70m, else Nei — Norwegian pilot requirement)

### Voyage
A planned visit to a country/port.
- `country` (string) — Norway, Sweden, or Denmark
- `stay_days` (float) — Duration of stay
- `month` (int, 1-12) — Month of arrival
- Derived: `quarter`, `is_summer`, `is_shoulder`, `day_of_week`, `week_of_year`

### Port
A destination with associated services and historical data.
- `name` (string) — e.g., Bergen, Tromsø
- `office` (string) — Managing office
- `traffic_weight` (float) — Share of country traffic
- `template` — List of (service_category, service_type, expected_txns) tuples
- `historical_range` — Optional (P25, P50, P75) cost percentiles per size category

### Service Category
Grouping of service types with predicted costs.
- Categories: Port Marina, Agency Services, Hospitality, Provisioning, Technical Services, Bunkering, Agency Fee

### Prediction Result
Output of the prediction pipeline.
- `category_totals` — Cost per service category
- `grand_total` — Total estimated cost
- `port_details` — Per-port breakdown with weights and historical ranges
- `weighted_range` — Traffic-weighted P25/P50/P75

## Domain Logic Flow

```
Yacht Specs + Voyage Params
        │
        ▼
┌─────────────────────┐
│  Size Classification │ → size_category, loskrav, fuel_lph
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  Per-Port Prediction │ → For each port in country:
│  (Port Templates)    │   1. Generate transaction rows from template
│                      │   2. Feature engineering (26 features)
│                      │   3. LightGBM + CatBoost ensemble
│                      │   4. Weight by expected transactions
│                      │   5. Calibrate against historical median
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  Country Aggregation │ → Traffic-weighted average across ports
└─────────────────────┘
        │
        ▼
   Prediction Result
```

## API Data Contracts

### POST /api/predict
**Request:**
```json
{
  "gt": 500, "loa": 55, "beam": 10, "draft": 4,
  "fuel": "medium", "country": "Norway", "stay": 5, "month": 7
}
```

**Response:**
```json
{
  "category_totals": {"Port Marina": 4740, "Agency Services": 2523, ...},
  "grand_total": 15091,
  "size_category": "Mellomstor",
  "loskrav": "Nei",
  "fuel_lph": 70,
  "port_details": {
    "Bergen": {"total": 9683, "weight": 0.44, "p25": 4479, "p50": 9683, "p75": 23038},
    ...
  },
  "weighted_range": {"p25": 11779, "p50": 15094, "p75": 23710}
}
```
