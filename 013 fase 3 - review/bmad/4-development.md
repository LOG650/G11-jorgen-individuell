# NautiCost — Development Plan

## Status

| Phase | Status |
|-------|--------|
| Business Requirements | Done |
| Domain Model | Done |
| Architecture | Done |
| Backend (Python/FastAPI) | Done |
| Frontend (Node.js/Next.js) | To Do |

## Backend (Complete)

### Endpoints
- `GET /api/health` — model metadata
- `GET /api/options` — countries, ports, fuel levels, months
- `POST /api/predict` — voyage cost prediction

### Verified
- All 3 endpoints tested with curl
- Model loads correctly (ensemble weight 0.40 LGB + 0.60 CB)
- Prediction matches CLI tool output (15,091 NOK for test case)

## Frontend Development Plan

### Step 1: Project scaffold
- `npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir`
- Clean up boilerplate

### Step 2: API client
- Create `lib/api.ts` with typed functions for `/api/options` and `/api/predict`
- Type definitions matching Pydantic response models

### Step 3: VoyageForm component
- Input fields for yacht specs (GT, LOA, Beam, Draft)
- Fuel dropdown (low/medium/high)
- Country dropdown (populated from /api/options)
- Stay days + Month inputs
- Form validation (all fields required, positive numbers)
- Submit button → calls /api/predict

### Step 4: Results display components
- `CostBreakdown` — horizontal bar chart of service categories (Recharts)
- `CostRangeBar` — visual P25/P50/P75 range with model estimate marker
- `PortDetails` — table of per-port estimates with weights and historical ranges
- Summary header with grand total, size category, fuel info

### Step 5: Layout and polish
- Responsive layout (form left, results right on desktop; stacked on mobile)
- Loading state during prediction
- Error handling (backend down, validation errors)
- NautiCost branding/header

### Step 6: Integration test
- Start backend on :8000
- Start frontend on :3000
- Test full flow: input → predict → display results
- Test edge cases: large yacht, small yacht, different countries

## Running the Application

```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --port 8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```
