# NautiCost — Business Requirements

## Problem Statement
Yacht agency companies (like NautiCost/Yachting Operations) need to estimate voyage costs before a superyacht arrives at port. Currently, cost estimation relies on experience and manual lookups. There is no tool that provides data-driven cost predictions based on yacht specifications, destination, and timing.

## Target Users

### Primary Persona: Agency Coordinator
- **Role:** Plans upcoming yacht visits, communicates cost estimates to yacht captains/owners
- **Goal:** Get a quick, reliable cost estimate for an upcoming port call
- **Pain point:** Manual estimation is slow, inconsistent, and doesn't account for yacht-specific factors
- **Workflow:** Enters yacht specs (GT, LOA, beam, draft) + destination + timing, gets a cost breakdown

### Secondary Persona: Operations Manager
- **Role:** Oversees multiple port calls, budgeting, and resource allocation
- **Goal:** Compare costs across ports and seasons for planning
- **Pain point:** No visibility into how costs vary by port, season, or vessel size

## Key Business Requirements

### BR-1: Voyage Cost Prediction
Users must be able to input yacht specifications and voyage parameters to receive a total estimated cost, broken down by service category.

**Inputs:**
- Yacht: Gross tonnage (GT), Length overall (LOA), Beam, Draft
- Voyage: Country, Stay duration (days), Month of arrival
- Optional: Fuel consumption level (low/medium/high or exact L/h)

**Outputs:**
- Total estimated cost (NOK)
- Breakdown by service category (Port Marina, Agency Services, Hospitality, etc.)
- Cost range (P25/P50/P75) based on historical data
- Per-port breakdown with traffic-weighted averages

### BR-2: Port Comparison
Users should be able to see how costs differ across ports within a country.

### BR-3: Confidence Communication
The system must communicate uncertainty — show cost ranges, not just point estimates, so users understand the prediction is an estimate.

## Supported Countries & Ports
- **Norway:** Bergen, Tromsø, Svolvær, Ålesund, Kristiansand, Stavanger
- **Sweden:** Stockholm, Göteborg, Malmö
- **Denmark:** København, Esbjerg, Fredericia

## Data Foundation
- 1,633 historical transactions (2020-2025)
- LightGBM + CatBoost ensemble model (MAE: 16,972 NOK)
- 26 features including yacht specs, temporal, and aggregate statistics
- Historical voyage-level cost distributions for calibration
