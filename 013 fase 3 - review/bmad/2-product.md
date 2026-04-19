# NautiCost — Product Requirements Document (PRD)

**BMAD Agent 2: Product Manager**

## Product Vision
A web application that lets yacht agency staff instantly estimate the total cost of a superyacht port call, broken down by service category, with historical cost ranges for confidence.

## Target Release
MVP — single deployment for internal use by Yachting Operations staff.

---

## Feature Map (MoSCoW)

### Must Have (MVP)
| ID | Feature | Description |
|----|---------|-------------|
| F1 | Voyage Input Form | User enters yacht specs (GT, LOA, Beam, Draft) + voyage params (country, stay days, month, fuel level) |
| F2 | Total Cost Estimate | Display grand total in NOK prominently |
| F3 | Cost Range Bar | Visual P25–P75 range bar showing where the estimate falls |
| F4 | Service Category Breakdown | Bar chart + table showing estimated cost per category (Port Marina, Agency Services, Hospitality, Provisioning, Technical Services, Bunkering, Agency Fee) |
| F5 | Per-Port Breakdown | Table showing each port in the selected country with traffic weight, estimated cost, and historical P25/P50/P75 |
| F6 | Yacht Classification | Display derived size category (Liten/Mellomstor/Stor), Loskrav status, resolved fuel consumption |

### Should Have
| ID | Feature | Description |
|----|---------|-------------|
| F7 | About / Model Info Page | Explains how the model works, shows live model stats (training rows, features, ensemble weight) |
| F8 | Responsive Layout | Works on desktop (two-column) and tablet (stacked) |
| F9 | Loading State | Spinner during prediction, disabled button |
| F10 | Error Handling | Clear message when backend is offline or input is invalid |

### Could Have (Post-MVP)
| ID | Feature | Description |
|----|---------|-------------|
| F11 | Voyage Comparison | Compare two different voyage configurations side-by-side |
| F12 | PDF Export | Export the cost estimate as a PDF to send to yacht owners |
| F13 | Saved Estimates | Save and revisit previous estimates |
| F14 | Port-Specific Mode | Estimate cost for a single specific port instead of country-weighted |

### Won't Have (Out of scope)
| ID | Feature | Description |
|----|---------|-------------|
| F15 | User Authentication | Internal tool — no login needed |
| F16 | Multi-language | English only |
| F17 | Real-time Pricing | Model uses historical data, not live pricing |

---

## User Stories

### US-1: Estimate a voyage cost
**As** an agency coordinator  
**I want to** enter yacht specs and voyage details  
**So that** I can get a quick cost estimate for planning  

**Acceptance Criteria:**
- Form has fields for GT, LOA, Beam, Draft, Country, Stay (days), Month, Fuel level
- All fields are required (except fuel defaults to "medium")
- Clicking "Estimate Voyage Cost" shows the total estimated cost in NOK
- Response appears within 2 seconds

### US-2: Understand cost breakdown
**As** an agency coordinator  
**I want to** see costs broken down by service category  
**So that** I know which services drive the total cost  

**Acceptance Criteria:**
- Horizontal bar chart shows all 7 service categories
- Each bar is labeled with the category name and NOK amount
- Categories are sorted by cost (highest first)
- A table below the chart lists exact amounts

### US-3: Communicate cost uncertainty
**As** an agency coordinator  
**I want to** see a cost range (low/typical/high)  
**So that** I can give the yacht owner a realistic range, not just a point estimate  

**Acceptance Criteria:**
- Range bar shows P25 (low) to P75 (high) with a marker for the model estimate
- P25 and P75 values are labeled in NOK
- Color gradient from green (low) to red (high)

### US-4: Compare ports
**As** an agency coordinator  
**I want to** see how costs differ across ports  
**So that** I can advise on which port is most cost-effective  

**Acceptance Criteria:**
- Table shows each port with: name, traffic weight %, estimated cost, historical P25/P50/P75
- Ports sorted by traffic weight (most common first)
- Ports without historical data show "-" for P25/P50/P75

### US-5: Understand yacht classification
**As** an agency coordinator  
**I want to** see how the system classified the yacht  
**So that** I can verify the estimate makes sense for this vessel  

**Acceptance Criteria:**
- Badges show: size category (Liten/Mellomstor/Stor), Loskrav (Ja/Nei), fuel consumption (L/h)

---

## Page Layout

### Dashboard (`/`)
```
┌─────────────────────────────────────────────────────────┐
│  NautiCost                        Dashboard  |  About   │
├─────────────────────────────────────────────────────────┤
│  Voyage Cost Estimator                                  │
│  Enter yacht specifications and voyage details...       │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  YACHT SPECS │  ┌──────────────────────────────────┐    │
│  GT [ 500  ] │  │  Estimated Voyage Cost           │    │
│  LOA [ 55  ] │  │  15,091 NOK                      │    │
│  Beam [ 10 ] │  │  ════════●═══════════            │    │
│  Draft [ 4 ] │  │  11,779      ▲        23,710     │    │
│              │  │  (P25)    estimate     (P75)      │    │
│  VOYAGE      │  │  Size: Mellomstor | Fuel: 70 L/h │    │
│  Country [▼] │  └──────────────────────────────────┘    │
│  Month   [▼] │                                          │
│  Stay  [ 5 ] │  ┌──────────────────────────────────┐    │
│  Fuel    [▼] │  │  Cost by Service Category        │    │
│              │  │  Port Marina      ████████ 4,740  │    │
│ [Estimate]   │  │  Agency Services  █████   2,523   │    │
│              │  │  Bunkering        ████    2,202   │    │
│              │  │  Hospitality      ████    1,976   │    │
│              │  │  Technical Svc    ███     1,826   │    │
│              │  │  Provisioning     ██      1,204   │    │
│              │  │  Agency Fee       █         620   │    │
│              │  └──────────────────────────────────┘    │
│              │                                          │
│              │  ┌──────────────────────────────────┐    │
│              │  │  Per-Port Breakdown               │    │
│              │  │  Port     Weight  Est.  P25  P75  │    │
│              │  │  Bergen    44%   9,683  4k   23k  │    │
│              │  │  Tromsø    28%  23,903   -    -   │    │
│              │  │  ...                              │    │
│              │  └──────────────────────────────────┘    │
├──────────────┴──────────────────────────────────────────┤
│  NautiCost — Voyage Cost Prediction — LOG650            │
└─────────────────────────────────────────────────────────┘
```

### About (`/about`)
- Static content: what NautiCost is, how the model works, service category descriptions
- Live model stats pulled from `/api/health`

---

## Data Dependencies
- Backend API must be running on port 8000
- Frontend fetches `/api/options` on page load for dropdown values
- Frontend POSTs to `/api/predict` on form submit
- All data is live from the ML model — no database needed
