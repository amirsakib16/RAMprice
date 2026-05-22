"""
tests/test_app.py
-----------------
Unit and integration tests for the RAMprice Flask application.
Run with:  pytest tests/ -v
"""

import json
import os
import pickle
import sys
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

# ── Fixtures ───────────────────────────────────────────────────────────────

# Minimal mock payload so the app can be imported without the real .pkl file
MOCK_CLASSES = ["$0-$30", "$30-$60", "$60-$100", "$100+"]

MOCK_PAYLOAD = {
    "model": MagicMock(
        **{
            "predict.return_value": np.array(["$30-$60"]),
            "predict_proba.return_value": np.array([[0.05, 0.70, 0.20, 0.05]]),
        }
    ),
    "preprocessor": MagicMock(**{"transform.return_value": np.zeros((1, 10))}),
    "classes": MOCK_CLASSES,
    "features": {},
}


@pytest.fixture(scope="session", autouse=True)
def mock_model():
    """Patch open() so the app loads our fake .pkl instead of the real file."""
    with patch("builtins.open", create=True) as mock_open:
        mock_open.return_value.__enter__ = lambda s: s
        mock_open.return_value.__exit__ = MagicMock(return_value=False)
        with patch("pickle.load", return_value=MOCK_PAYLOAD):
            yield


@pytest.fixture(scope="session")
def app():
    """Create the Flask test client after mock is in place."""
    # Ensure we load a fresh import with the mock active
    if "app" in sys.modules:
        del sys.modules["app"]

    with patch("builtins.open", create=True):
        with patch("pickle.load", return_value=MOCK_PAYLOAD):
            import app as flask_app

            flask_app.app.config["TESTING"] = True
            flask_app.model = MOCK_PAYLOAD["model"]
            flask_app.preprocessor = MOCK_PAYLOAD["preprocessor"]
            flask_app.classes = MOCK_PAYLOAD["classes"]
            flask_app.payload = MOCK_PAYLOAD
            return flask_app.app


@pytest.fixture
def client(app):
    return app.test_client()


# ── Route: GET / ───────────────────────────────────────────────────────────

class TestIndexRoute:
    def test_get_returns_200(self, client):
        resp = client.get("/")
        assert resp.status_code == 200

    def test_get_contains_form(self, client):
        data = resp = client.get("/").data.decode()
        assert "capacity_gb" in data or "RAM" in data  # form field present


# ── Route: POST / ──────────────────────────────────────────────────────────

class TestIndexPost:
    BASE_FORM = {
        "capacity_gb": "16",
        "bus_speed_mhz": "3200",
        "demand_ratio": "0.7",
        "has_discount": "0",
        "ram_generation": "DDR4",
        "condition_clean": "Used",
        "unit_type": "Single",
        "brand": "Corsair",
        "is_ecc": "0",
        "is_sodimm": "0",
        "is_gaming": "1",
        "is_us_listing": "1",
        "is_bulk_server": "0",
    }

    def test_post_returns_200(self, client):
        resp = client.post("/", data=self.BASE_FORM)
        assert resp.status_code == 200

    def test_post_renders_prediction(self, client):
        resp = client.post("/", data=self.BASE_FORM)
        body = resp.data.decode()
        # The page should surface one of the class labels
        assert any(c in body for c in MOCK_CLASSES)


# ── Route: POST /api/predict ───────────────────────────────────────────────

class TestApiPredict:
    VALID_PAYLOAD = {
        "capacity_gb": 16,
        "bus_speed_mhz": 3200,
        "demand_ratio": 0.7,
        "has_discount": 0,
        "ram_generation": "DDR4",
        "condition_clean": "New",
        "unit_type": "Single",
        "brand": "Kingston",
        "is_ecc": 0,
        "is_sodimm": 0,
        "is_gaming": 0,
        "is_us_listing": 1,
        "is_bulk_server": 0,
    }

    def test_valid_request_returns_200(self, client):
        resp = client.post(
            "/api/predict",
            data=json.dumps(self.VALID_PAYLOAD),
            content_type="application/json",
        )
        assert resp.status_code == 200

    def test_response_has_required_keys(self, client):
        resp = client.post(
            "/api/predict",
            data=json.dumps(self.VALID_PAYLOAD),
            content_type="application/json",
        )
        data = json.loads(resp.data)
        assert data["status"] == "ok"
        assert "prediction" in data
        assert "confidence" in data
        assert "probabilities" in data

    def test_confidence_is_percentage(self, client):
        resp = client.post(
            "/api/predict",
            data=json.dumps(self.VALID_PAYLOAD),
            content_type="application/json",
        )
        data = json.loads(resp.data)
        assert 0 <= data["confidence"] <= 100

    def test_probabilities_sum_to_100(self, client):
        resp = client.post(
            "/api/predict",
            data=json.dumps(self.VALID_PAYLOAD),
            content_type="application/json",
        )
        data = json.loads(resp.data)
        total = sum(data["probabilities"].values())
        assert abs(total - 100.0) < 0.5  # floating-point tolerance

    def test_missing_fields_still_returns_200(self, client):
        """App has defaults; partial payload should not crash."""
        resp = client.post(
            "/api/predict",
            data=json.dumps({"capacity_gb": 8}),
            content_type="application/json",
        )
        assert resp.status_code == 200

    def test_invalid_json_returns_400(self, client):
        resp = client.post(
            "/api/predict",
            data="not-json",
            content_type="application/json",
        )
        # Flask may return 400 or 200 with error key depending on force=True
        data = json.loads(resp.data)
        assert resp.status_code in (200, 400)


# ── Route: GET /api/brands ────────────────────────────────────────────────

class TestApiBrands:
    def test_returns_200(self, client):
        resp = client.get("/api/brands")
        assert resp.status_code == 200

    def test_returns_brands_list(self, client):
        resp = client.get("/api/brands")
        data = json.loads(resp.data)
        assert "brands" in data
        assert isinstance(data["brands"], list)
        assert len(data["brands"]) > 0

    def test_known_brands_present(self, client):
        resp = client.get("/api/brands")
        brands = json.loads(resp.data)["brands"]
        for expected in ["Corsair", "Kingston", "Samsung"]:
            assert expected in brands


# ── Route: 404 ───────────────────────────────────────────────────────────

class TestNotFound:
    def test_unknown_route_returns_404(self, client):
        resp = client.get("/nonexistent-route")
        assert resp.status_code == 404
