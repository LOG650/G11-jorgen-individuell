"""
API contract tests for /api/predict.

Covers the user-test-driven changes: currency conversion, mandatory pilotage
at LOA > 70 m, deterministic bunkering from voyage geometry, country surfaced
on each stop, and guest_experience validation.

Run from `013 fase 3 - review/backend`:
    pytest -v test_api.py
"""

import pytest
from fastapi.testclient import TestClient

from main import EXCHANGE_RATES_FROM_EUR, app

client = TestClient(app)


def _base_request(**overrides):
    req = {
        "gt": 500,
        "loa": 55,
        "beam": 10,
        "draft": 4,
        "fuel": "medium",
        "currency": "EUR",
        "stops": [{"port": "Bergen", "month": 7, "stay_days": 5}],
    }
    req.update(overrides)
    return req


# ── Currency conversion ─────────────────────────────────────────
def test_currency_eur_baseline():
    r = client.post("/api/predict", json=_base_request(currency="EUR"))
    assert r.status_code == 200
    body = r.json()
    assert body["currency"] == "EUR"
    assert body["exchange_rate_from_eur"] == 1.0


def test_currency_nok_scales_by_fx():
    eur = client.post("/api/predict", json=_base_request(currency="EUR")).json()
    nok = client.post("/api/predict", json=_base_request(currency="NOK")).json()
    assert nok["exchange_rate_from_eur"] == EXCHANGE_RATES_FROM_EUR["NOK"]
    assert nok["grand_total"] == pytest.approx(
        eur["grand_total"] * EXCHANGE_RATES_FROM_EUR["NOK"], rel=1e-3
    )


def test_currency_dkk_scales_by_fx():
    eur = client.post("/api/predict", json=_base_request(currency="EUR")).json()
    dkk = client.post("/api/predict", json=_base_request(currency="DKK")).json()
    assert dkk["exchange_rate_from_eur"] == EXCHANGE_RATES_FROM_EUR["DKK"]
    assert dkk["grand_total"] == pytest.approx(
        eur["grand_total"] * EXCHANGE_RATES_FROM_EUR["DKK"], rel=1e-3
    )


def test_currency_invalid_rejected():
    r = client.post("/api/predict", json=_base_request(currency="USD"))
    assert r.status_code == 400
    assert "Unsupported currency" in r.json()["detail"]


# ── Mandatory pilotage at LOA > 70 m ────────────────────────────
def test_pilot_required_when_loa_over_70():
    r = client.post("/api/predict", json=_base_request(loa=80, gt=3000, fuel="high"))
    assert r.status_code == 400
    assert "Pilotage is mandatory" in r.json()["detail"]


def test_pilot_cost_added_to_total_unchanged_by_fx():
    body = client.post(
        "/api/predict",
        json=_base_request(
            loa=80, gt=3000, fuel="high",
            currency="NOK", pilot_cost=50_000, pilot_type="national",
        ),
    ).json()
    assert body["loskrav"] == "Ja"
    assert body["category_totals"].get("Pilotage") == 50_000


def test_pilot_type_invalid_rejected():
    r = client.post(
        "/api/predict",
        json=_base_request(
            loa=80, gt=3000, fuel="high",
            pilot_cost=50_000, pilot_type="self-piloted",
        ),
    )
    assert r.status_code == 400
    assert "Invalid pilot_type" in r.json()["detail"]


def test_pilot_not_required_for_small_yacht():
    r = client.post("/api/predict", json=_base_request(loa=55))
    assert r.status_code == 200
    assert r.json()["loskrav"] == "Nei"


# ── Deterministic bunkering from voyage geometry ────────────────
def test_bunkering_replaced_when_geometry_provided():
    """Σdistance / speed × fuel_lph × diesel_price."""
    body = client.post(
        "/api/predict",
        json=_base_request(
            currency="EUR",
            cruising_speed_kn=12,
            diesel_price_per_l=1.8,
            stops=[
                {"port": "Bergen", "month": 7, "stay_days": 5, "distance_nm": 240},
                {"port": "Tromsø", "month": 7, "stay_days": 3, "distance_nm": 420},
            ],
        ),
    ).json()

    expected = (660 / 12) * body["fuel_lph"] * 1.8
    assert body["category_totals"]["Bunkering"] == pytest.approx(expected, rel=1e-3)


def test_bunkering_unchanged_when_geometry_missing():
    """Without all 3 inputs, model's probabilistic bunkering stays."""
    full = client.post(
        "/api/predict",
        json=_base_request(
            cruising_speed_kn=12,
            diesel_price_per_l=1.8,
            stops=[
                {"port": "Bergen", "month": 7, "stay_days": 5, "distance_nm": 240},
            ],
        ),
    ).json()
    bare = client.post("/api/predict", json=_base_request()).json()

    # Without distance OR without speed OR without price → no override.
    no_speed = client.post(
        "/api/predict",
        json=_base_request(
            diesel_price_per_l=1.8,
            stops=[
                {"port": "Bergen", "month": 7, "stay_days": 5, "distance_nm": 240},
            ],
        ),
    ).json()
    assert no_speed["category_totals"].get("Bunkering") == bare["category_totals"].get("Bunkering")
    # Sanity: with full inputs, the bunker line is generally different from probabilistic.
    assert full["category_totals"].get("Bunkering") != bare["category_totals"].get("Bunkering")


# ── guest_experience ────────────────────────────────────────────
def test_guest_experience_valid_echoed():
    body = client.post(
        "/api/predict",
        json=_base_request(guest_experience="demanding"),
    ).json()
    assert body["guest_experience"] == "demanding"
    assert body["guest_experience_note"] is not None


def test_guest_experience_invalid_rejected():
    r = client.post(
        "/api/predict",
        json=_base_request(guest_experience="super_demanding"),
    )
    assert r.status_code == 400
    assert "Invalid guest_experience" in r.json()["detail"]


def test_guest_experience_omitted_no_note():
    body = client.post("/api/predict", json=_base_request()).json()
    assert body["guest_experience"] is None
    assert body["guest_experience_note"] is None


# ── Country surfaced on each stop ───────────────────────────────
def test_country_attached_to_stop():
    body = client.post(
        "/api/predict",
        json=_base_request(stops=[
            {"port": "Bergen", "month": 7, "stay_days": 5},
            {"port": "København", "month": 7, "stay_days": 3},
            {"port": "Stockholm", "month": 7, "stay_days": 2},
        ]),
    ).json()
    countries = [s["country"] for s in body["stops"]]
    assert countries == ["Norway", "Denmark", "Sweden"]


# ── Health endpoint ─────────────────────────────────────────────
def test_health_ok():
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["model_features"] > 0
    assert 0 < body["ensemble_weight"] < 1
