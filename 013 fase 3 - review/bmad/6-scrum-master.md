# NautiCost — Scrum Master Report

**BMAD Agent 6: Scrum Master**

---

## Sprint Summary

### Sprint 1: ML Model (Complete)
Built and optimized the LightGBM+CatBoost ensemble prediction model.

| Item | Status |
|------|--------|
| Data exploration & feature engineering | Done |
| LightGBM baseline model | Done |
| CatBoost model | Done |
| Optuna hyperparameter tuning (80 trials, 5-fold CV) | Done |
| Huber loss for outlier robustness | Done |
| P99 Winsorization | Done |
| P5/P95 quantile models + CQR calibration (80% coverage) | Done |
| LightGBM+CatBoost ensemble (0.40/0.60 blend) | Done |
| Time-based features (day_of_week, week_of_year) | Done |
| Final model: MAE 16,972 NOK, 26 features, 1,626 training rows | Done |

### Sprint 2: Backend (Complete)
Python FastAPI server wrapping the ML model.

| Item | Status |
|------|--------|
| FastAPI app scaffold | Done |
| `GET /api/health` — model status | Done |
| `GET /api/options` — dropdown values | Done |
| `POST /api/predict` — voyage prediction | Done |
| Model loading (LightGBM + CatBoost + artifacts) | Done |
| CORS enabled for frontend | Done |
| All endpoints tested with curl | Done |

### Sprint 3: Frontend (Complete)
Next.js dashboard consuming the API.

| Item | Status |
|------|--------|
| Next.js 14 scaffold (TypeScript + Tailwind) | Done |
| Typed API client (`lib/api.ts`, `lib/types.ts`) | Done |
| VoyageForm component (yacht specs + voyage params) | Done |
| CostSummary component (grand total + P25-P75 range bar) | Done |
| ServiceBreakdown component (horizontal bar chart + table) | Done |
| PortDetails component (per-port table with historical ranges) | Done |
| Dashboard page (two-column layout, form + results) | Done |
| About page (model info, service categories, live stats) | Done |
| Loading state and error handling | Done |
| API proxy (Next.js rewrites → backend:8000) | Done |
| Build passes (TypeScript clean) | Done |

---

## BMAD Agent Completion

| Agent | Deliverable | File |
|-------|-------------|------|
| 1. Business Analyst | Requirements & personas | `bmad/1-business.md` |
| 2. Product Manager | PRD, user stories, wireframes | `bmad/2-product.md` |
| 2b. Domain Model | Entities, data flow, API contracts | `bmad/2b-domain-model.md` |
| 3. Architect | Tech stack, file structure, system diagram | `bmad/3-architecture.md` |
| 4. Developer | Backend + Frontend code | `backend/`, `frontend/` |
| 5. QA Engineer | 9 test cases, all passing | Verified in terminal |
| 6. Scrum Master | This report | `bmad/6-scrum-master.md` |

---

## QA Results (9/9 Passed)

| # | Test | Result |
|---|------|--------|
| 1 | Medium yacht (GT=500, Norway, 5d, Jul) | 15,091 NOK |
| 2 | Large yacht (GT=2400, Denmark, 10d, Aug) | 67,714 NOK, Loskrav: Ja |
| 3 | Small yacht (GT=50, Sweden, 3d, Mar) | 56,407 NOK |
| 4 | Options endpoint | 3 countries, 3 fuel levels, 12 months |
| 5 | Invalid country error handling | 400 with clear message |
| 6 | Service category breakdown | All 7 categories returned |
| 7 | Frontend serves | HTML with NautiCost branding |
| 8 | Frontend proxy → backend | /api/health proxied correctly |
| 9 | About page renders | NautiCost content present |

---

## Definition of Done

- [x] All Must Have features (F1-F6) implemented
- [x] All Should Have features (F7-F10) implemented
- [x] Backend: 3 endpoints, all tested
- [x] Frontend: 2 pages, all components, TypeScript clean build
- [x] QA: 9/9 test cases passing
- [x] BMAD docs: all 6 agent deliverables complete
- [x] Code committed and pushed to GitHub

---

## Backlog (Could Have — Future Sprints)

| Priority | Feature | Notes |
|----------|---------|-------|
| 1 | F14: Port-Specific Mode | Estimate for a single port instead of country-weighted |
| 2 | F11: Voyage Comparison | Side-by-side comparison of two configurations |
| 3 | F12: PDF Export | Generate downloadable PDF for yacht owners |
| 4 | F13: Saved Estimates | Persist estimates locally or with a database |

---

## How to Run

```bash
# Terminal 1: Backend
cd "013 fase 3 - review/backend"
pip install -r requirements.txt
python -m uvicorn main:app --port 8000

# Terminal 2: Frontend
cd "013 fase 3 - review/frontend"
npm install
npm run dev
```

Open `http://localhost:3000` in browser.

---

## Retrospective

**What went well:**
- BMAD structure kept the work organized across all phases
- Backend was straightforward — wrapping existing predict_voyage.py logic
- Frontend build was clean — no major blockers
- All QA tests passed on first run

**What could improve:**
- BA phase was light on stakeholder interviews (assumptions made)
- Could add end-to-end browser tests (Playwright/Cypress) for regression
- PDF export and comparison features would add significant value for real use

**Blockers resolved:**
- LightGBM non-ASCII path issue → temp file copy workaround
- Notebook cell ordering (ensemble before production model) → fixed
- Port 3000 conflict during QA → killed stale process
