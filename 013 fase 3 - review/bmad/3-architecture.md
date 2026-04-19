# NautiCost — Architecture

## System Overview

```
┌──────────────────────────────┐     ┌────────────────────────────┐
│       Frontend (Node.js)     │     │    Backend (Python)        │
│                              │     │                            │
│  Next.js / React             │────▶│  FastAPI                   │
│  - Voyage input form         │     │  - /api/health             │
│  - Cost breakdown display    │     │  - /api/options            │
│  - Port comparison chart     │     │  - /api/predict            │
│  - Historical range bars     │     │                            │
│                              │     │  Model layer (model.py)    │
│  Port: 3000                  │     │  - LightGBM + CatBoost     │
└──────────────────────────────┘     │  - Feature engineering     │
                                     │  - Port templates          │
                                     │  - Historical calibration  │
                                     │                            │
                                     │  Port: 8000                │
                                     └────────────────────────────┘
```

## Tech Stack

### Backend (complete)
- **Runtime:** Python 3.11+
- **Framework:** FastAPI + Uvicorn
- **ML:** LightGBM, CatBoost, NumPy, Pandas
- **Serialization:** Pydantic v2
- **Artifacts:** joblib, parquet files

### Frontend (to build)
- **Runtime:** Node.js 20+
- **Framework:** Next.js 14 (App Router)
- **UI:** React + Tailwind CSS
- **Charts:** Recharts (lightweight, React-native)
- **HTTP:** fetch (built-in)

### Why these choices
- **FastAPI** — async, auto-generated OpenAPI docs, Pydantic validation
- **Next.js** — SSR-capable, file-based routing, good DX, industry standard
- **Tailwind** — utility-first CSS, fast prototyping, no custom CSS files
- **Recharts** — simple bar/range charts for cost visualization

## Frontend Pages

### Page 1: Voyage Estimator (`/`)
The main (and only) page. Single-page application with:

**Input Section:**
- Yacht specs: GT, LOA, Beam, Draft (number inputs)
- Fuel consumption: dropdown (low/medium/high) or manual input
- Country: dropdown (Norway, Sweden, Denmark)
- Stay duration: number input (days)
- Month: dropdown (Jan-Dec)
- "Estimate Cost" button

**Results Section (appears after prediction):**
- **Total cost** — large headline number with P25-P75 range bar
- **Service breakdown** — horizontal bar chart by category
- **Port details** — table showing per-port estimates with weights and historical ranges
- **Yacht info** — size category, loskrav, fuel resolved

## API Communication
- Frontend calls `GET /api/options` on load to populate dropdowns
- Frontend calls `POST /api/predict` on form submit
- CORS is enabled on backend (all origins for dev)

## Directory Structure
```
013 fase 3 - review/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── model.py             # ML inference + domain logic
│   ├── requirements.txt
│   └── artifacts/           # Model files
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx         # Main voyage estimator
│   │   └── globals.css
│   └── components/
│       ├── VoyageForm.tsx
│       ├── CostBreakdown.tsx
│       ├── PortDetails.tsx
│       └── CostRangeBar.tsx
└── bmad/
    ├── 1-business.md
    ├── 2-model.md
    ├── 3-architecture.md
    └── 4-development.md
```
