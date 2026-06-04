"""
Tests del training-service (Flask).
Se mockean: MongoClient, OpenAI, requests HTTP al auth-service.
"""

import os
import sys
import json
import importlib
from unittest.mock import MagicMock, patch, call
from datetime import datetime, timezone

import pytest
import jwt as pyjwt

# ─── Setup ──────────────────────────────────────────────────────────────────

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("MONGO_URI", "mongodb://fake:27017/test")
os.environ.setdefault("MONGO_DB_NAME", "test_gym")
os.environ.setdefault("AUTH_URL", "http://fake-auth:3001")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

JWT_SECRET = "test-secret"


def make_token(user_id="1", role="member", email="user@test.com"):
    return pyjwt.encode(
        {"userId": user_id, "role": role, "email": email},
        JWT_SECRET,
        algorithm="HS256",
    )


def auth_header(user_id="1", role="member"):
    return {"Authorization": f"Bearer {make_token(user_id, role)}"}


# ─── Fixture ────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def app_and_mocks():
    """Crea la app Flask con MongoDB completamente mockeado."""
    plans_col = MagicMock()
    logs_col = MagicMock()
    recs_col = MagicMock()
    prefs_col = MagicMock()
    profiles_col = MagicMock()

    col_map = {
        "workout_plans": plans_col,
        "workout_logs": logs_col,
        "recommendations": recs_col,
        "user_preferences": prefs_col,
        "user_profiles": profiles_col,
    }

    mock_db = MagicMock()
    mock_db.__getitem__ = MagicMock(side_effect=lambda name: col_map[name])

    mock_client = MagicMock()
    mock_client.__getitem__ = MagicMock(return_value=mock_db)

    with patch("pymongo.MongoClient", return_value=mock_client):
        import app as app_module

        flask_app = app_module.create_app()
        flask_app.config["TESTING"] = True

    mocks = {
        "plans": plans_col,
        "logs": logs_col,
        "recs": recs_col,
        "prefs": prefs_col,
        "profiles": profiles_col,
    }
    return flask_app, mocks


@pytest.fixture
def client(app_and_mocks):
    flask_app, mocks = app_and_mocks
    for m in mocks.values():
        m.reset_mock()
    with flask_app.test_client() as c:
        yield c, mocks


# ─── Helper: subscription mock ───────────────────────────────────────────────


def mock_active_subscription(plan="basic"):
    """Devuelve un mock de requests.get que simula suscripción activa."""
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"subscription": {"status": "active", "plan": plan}}
    return resp


def mock_no_subscription():
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"subscription": {"status": "inactive", "plan": None}}
    return resp


# ─── /health ────────────────────────────────────────────────────────────────


class TestHealth:
    def test_health_ok(self, client):
        c, _ = client
        r = c.get("/health")
        assert r.status_code == 200
        assert b"running" in r.data


# ─── Auth middleware ──────────────────────────────────────────────────────────


class TestAuthMiddleware:
    def test_missing_token_returns_401(self, client):
        c, _ = client
        r = c.get("/plans/me")
        assert r.status_code == 401

    def test_invalid_token_returns_403(self, client):
        c, _ = client
        r = c.get("/plans/me", headers={"Authorization": "Bearer not.a.jwt"})
        assert r.status_code == 403

    def test_bearer_prefix_required(self, client):
        c, _ = client
        r = c.get("/plans/me", headers={"Authorization": make_token()})
        assert r.status_code == 401


# ─── /plans/me ───────────────────────────────────────────────────────────────


class TestPlansMe:
    def test_get_plan_no_subscription_returns_403(self, client):
        c, mocks = client
        with patch("requests.get", return_value=mock_no_subscription()):
            r = c.get("/plans/me", headers=auth_header())
        assert r.status_code == 403

    def test_get_plan_not_found_returns_404(self, client):
        c, mocks = client
        mocks["plans"].find_one.return_value = None
        with patch("requests.get", return_value=mock_active_subscription()):
            r = c.get("/plans/me", headers=auth_header())
        assert r.status_code == 404

    def test_get_plan_returns_plan(self, client):
        c, mocks = client
        mocks["plans"].find_one.return_value = {
            "_id": "abc",
            "userId": "1",
            "plan": {"summary": "Mi plan"},
        }
        with patch("requests.get", return_value=mock_active_subscription()):
            r = c.get("/plans/me", headers=auth_header())
        assert r.status_code == 200
        data = r.get_json()
        assert "plan" in data

    def test_post_plan_missing_body_returns_400(self, client):
        c, mocks = client
        with patch("requests.get", return_value=mock_active_subscription()):
            r = c.post(
                "/plans/me",
                json={"plan": "not_a_dict"},
                headers=auth_header(),
            )
        assert r.status_code == 400

    def test_post_plan_saves_correctly(self, client):
        c, mocks = client
        inserted_id = MagicMock()
        inserted_id.__str__ = lambda self: "inserted_id_str"
        mocks["plans"].insert_one.return_value = MagicMock(inserted_id=inserted_id)
        with patch("requests.get", return_value=mock_active_subscription()):
            r = c.post(
                "/plans/me",
                json={"plan": {"summary": "Plan nuevo"}},
                headers=auth_header(),
            )
        assert r.status_code == 201
        assert "plan" in r.get_json()


# ─── /logs ───────────────────────────────────────────────────────────────────


class TestLogs:
    def test_create_log_without_title_returns_400(self, client):
        c, _ = client
        r = c.post("/logs", json={"duration_min": 30}, headers=auth_header())
        assert r.status_code == 400

    def test_create_log_saves_correctly(self, client):
        c, mocks = client
        inserted_id = MagicMock()
        inserted_id.__str__ = lambda self: "log_id"
        mocks["logs"].insert_one.return_value = MagicMock(inserted_id=inserted_id)
        r = c.post(
            "/logs",
            json={"title": "Sesión matutina", "duration_min": 45},
            headers=auth_header(),
        )
        assert r.status_code == 201
        data = r.get_json()
        assert data["log"]["title"] == "Sesión matutina"

    def test_get_logs_returns_paginated(self, client):
        c, mocks = client
        mocks["logs"].count_documents.return_value = 2
        mocks["logs"].find.return_value.sort.return_value.skip.return_value.limit.return_value = [
            {"_id": "a", "title": "Log 1"},
            {"_id": "b", "title": "Log 2"},
        ]
        r = c.get("/logs/me", headers=auth_header())
        assert r.status_code == 200
        data = r.get_json()
        assert "logs" in data
        assert "pagination" in data
        assert data["pagination"]["total"] == 2

    def test_get_logs_respects_page_and_limit(self, client):
        c, mocks = client
        mocks["logs"].count_documents.return_value = 10
        chain = MagicMock()
        chain.sort.return_value.skip.return_value.limit.return_value = []
        mocks["logs"].find.return_value = chain
        r = c.get("/logs/me?page=2&limit=5", headers=auth_header())
        assert r.status_code == 200


# ─── /preferences/me ─────────────────────────────────────────────────────────


class TestPreferences:
    def test_get_preferences_none_returns_null(self, client):
        c, mocks = client
        mocks["prefs"].find_one.return_value = None
        r = c.get("/preferences/me", headers=auth_header())
        assert r.status_code == 200
        assert r.get_json()["preferences"] is None

    def test_get_preferences_returns_doc(self, client):
        c, mocks = client
        mocks["prefs"].find_one.return_value = {
            "_id": "pref1",
            "userId": "1",
            "preferences": {"goal": "perder peso"},
        }
        r = c.get("/preferences/me", headers=auth_header())
        assert r.status_code == 200
        assert "preferences" in r.get_json()

    def test_post_preferences_invalid_format_returns_400(self, client):
        c, _ = client
        r = c.post(
            "/preferences/me",
            json={"preferences": "not_a_dict"},
            headers=auth_header(),
        )
        assert r.status_code == 400

    def test_post_preferences_creates_new(self, client):
        c, mocks = client
        mocks["prefs"].find_one.return_value = None
        inserted_id = MagicMock()
        inserted_id.__str__ = lambda self: "pref_id"
        mocks["prefs"].insert_one.return_value = MagicMock(inserted_id=inserted_id)
        mocks["profiles"].update_one.return_value = MagicMock()
        r = c.post(
            "/preferences/me",
            json={"preferences": {"goal": "ganar musculo", "days_per_week": 4}},
            headers=auth_header(),
        )
        assert r.status_code == 201

    def test_post_preferences_updates_existing(self, client):
        c, mocks = client
        existing = {"_id": "existing_id", "userId": "1", "preferences": {"goal": "cardio"}}
        mocks["prefs"].find_one.return_value = existing
        mocks["prefs"].update_one.return_value = MagicMock()
        mocks["profiles"].update_one.return_value = MagicMock()
        r = c.post(
            "/preferences/me",
            json={"preferences": {"goal": "fuerza"}},
            headers=auth_header(),
        )
        assert r.status_code == 200
        mocks["prefs"].update_one.assert_called_once()


# ─── /recommendations/me/saved ────────────────────────────────────────────────


class TestRecommendationsSaved:
    def test_returns_null_when_none_saved(self, client):
        c, mocks = client
        mocks["recs"].find_one.return_value = None
        with patch("requests.get", return_value=mock_active_subscription()):
            r = c.get("/recommendations/me/saved", headers=auth_header())
        assert r.status_code == 200
        assert r.get_json()["recommendation"] is None

    def test_returns_saved_recommendation(self, client):
        c, mocks = client
        mocks["recs"].find_one.return_value = {
            "_id": "rec1",
            "userId": "1",
            "savedByUser": True,
            "recommendation": {"summary": "Plan", "split": [], "diet_tips": [], "notes": "", "recommended_class_types": []},
        }
        with patch("requests.get", return_value=mock_active_subscription("premium")):
            r = c.get("/recommendations/me/saved", headers=auth_header())
        assert r.status_code == 200
        assert r.get_json()["recommendation"] is not None

    def test_diet_tips_hidden_for_basic_plan(self, client):
        c, mocks = client
        mocks["recs"].find_one.return_value = {
            "_id": "rec2",
            "userId": "1",
            "savedByUser": True,
            "recommendation": {
                "summary": "X",
                "split": [],
                "diet_tips": [{"title": "Tip", "detail": "Detalle"}],
                "notes": "",
                "recommended_class_types": [],
            },
        }
        with patch("requests.get", return_value=mock_active_subscription("basic")):
            r = c.get("/recommendations/me/saved", headers=auth_header())
        data = r.get_json()
        assert data["recommendation"]["recommendation"]["diet_tips"] == []


# ─── /recommendations/me/generate ────────────────────────────────────────────


class TestRecommendationsGenerate:
    def _setup_generate_mocks(self, mocks):
        mocks["prefs"].find_one.return_value = None
        mocks["profiles"].find_one.return_value = None
        mocks["logs"].find.return_value.sort.return_value.limit.return_value = []
        mocks["profiles"].update_one.return_value = MagicMock()
        mocks["recs"].insert_one = MagicMock()

    def test_requires_subscription(self, client):
        c, _ = client
        with patch("requests.get", return_value=mock_no_subscription()):
            r = c.get("/recommendations/me/generate", headers=auth_header())
        assert r.status_code == 403

    def test_uses_rules_fallback_when_openai_fails(self, client):
        c, mocks = client
        self._setup_generate_mocks(mocks)
        with patch("requests.get", return_value=mock_active_subscription()):
            with patch("openai.OpenAI", side_effect=Exception("OpenAI unavailable")):
                r = c.get(
                    "/recommendations/me/generate?level=beginner&goal=perder+peso&days=3",
                    headers=auth_header(),
                )
        assert r.status_code == 200
        data = r.get_json()
        assert "recommendation" in data
        rec = data["recommendation"]["recommendation"]
        assert "split" in rec
        assert len(rec["split"]) > 0

    def test_rules_fallback_for_muscle_goal(self, client):
        c, mocks = client
        self._setup_generate_mocks(mocks)
        with patch("requests.get", return_value=mock_active_subscription("premium")):
            with patch("openai.OpenAI", side_effect=Exception("unavailable")):
                r = c.get(
                    "/recommendations/me/generate?level=intermediate&goal=ganar+musculo&days=3",
                    headers=auth_header(),
                )
        assert r.status_code == 200
        rec = r.get_json()["recommendation"]["recommendation"]
        assert any("Pump" in ct or "Fuerza" in ct for ct in rec["recommended_class_types"])

    def test_diet_tips_empty_for_basic_plan(self, client):
        c, mocks = client
        self._setup_generate_mocks(mocks)
        with patch("requests.get", return_value=mock_active_subscription("basic")):
            with patch("openai.OpenAI", side_effect=Exception("unavailable")):
                r = c.get("/recommendations/me/generate", headers=auth_header())
        rec = r.get_json()["recommendation"]["recommendation"]
        assert rec["diet_tips"] == []

    def test_also_accessible_via_recommendations_me_get(self, client):
        c, mocks = client
        self._setup_generate_mocks(mocks)
        with patch("requests.get", return_value=mock_active_subscription()):
            with patch("openai.OpenAI", side_effect=Exception("unavailable")):
                r = c.get("/recommendations/me", headers=auth_header())
        assert r.status_code == 200


# ─── /recommendations/me (POST) ───────────────────────────────────────────────


class TestRecommendationsSave:
    def test_save_invalid_format_returns_400(self, client):
        c, _ = client
        with patch("requests.get", return_value=mock_active_subscription()):
            r = c.post(
                "/recommendations/me",
                json={"recommendation": "not_a_dict"},
                headers=auth_header(),
            )
        assert r.status_code == 400

    def test_save_new_recommendation(self, client):
        c, mocks = client
        inserted_id = MagicMock()
        inserted_id.__str__ = lambda self: "rec_id"
        mocks["recs"].insert_one.return_value = MagicMock(inserted_id=inserted_id)
        with patch("requests.get", return_value=mock_active_subscription()):
            r = c.post(
                "/recommendations/me",
                json={
                    "recommendation": {"summary": "Plan guardado", "split": [], "notes": ""},
                    "level": "beginner",
                },
                headers=auth_header(),
            )
        assert r.status_code == 201

    def test_update_existing_recommendation(self, client):
        c, mocks = client
        from bson import ObjectId
        oid = ObjectId()
        mocks["recs"].update_one.return_value = MagicMock()
        mocks["recs"].find_one.return_value = {
            "_id": oid,
            "userId": "1",
            "recommendation": {"summary": "Actualizado", "split": [], "diet_tips": [], "notes": "", "recommended_class_types": []},
            "savedByUser": True,
        }
        with patch("requests.get", return_value=mock_active_subscription()):
            r = c.post(
                "/recommendations/me",
                json={
                    "_id": str(oid),
                    "recommendation": {"summary": "Actualizado", "split": []},
                },
                headers=auth_header(),
            )
        assert r.status_code == 200
        mocks["recs"].update_one.assert_called_once()


# ─── /coach/members-overview ──────────────────────────────────────────────────


class TestCoachMembersOverview:
    def test_member_role_returns_403(self, client):
        c, _ = client
        r = c.get("/coach/members-overview", headers=auth_header(role="member"))
        assert r.status_code == 403

    def test_trainer_with_no_members(self, client):
        c, mocks = client
        auth_resp = MagicMock()
        auth_resp.status_code = 200
        auth_resp.json.return_value = {"users": []}

        mocks["prefs"].find.return_value.sort.return_value = []
        mocks["logs"].find.return_value.sort.return_value = []

        with patch("requests.get", return_value=auth_resp):
            r = c.get("/coach/members-overview", headers=auth_header(role="trainer"))
        assert r.status_code == 200
        data = r.get_json()
        assert data["members"] == []

    def test_trainer_with_members(self, client):
        c, mocks = client
        auth_resp = MagicMock()
        auth_resp.status_code = 200
        auth_resp.json.return_value = {
            "users": [
                {"id": "10", "email": "u@test.com", "name": "U", "role": "member"},
            ]
        }

        mocks["prefs"].find.return_value.sort.return_value = []
        mocks["logs"].find.return_value.sort.return_value = []

        with patch("requests.get", return_value=auth_resp):
            r = c.get("/coach/members-overview", headers=auth_header(role="trainer"))
        assert r.status_code == 200
        data = r.get_json()
        assert len(data["members"]) == 1
        assert data["members"][0]["user"]["email"] == "u@test.com"

    def test_auth_service_error_returns_503(self, client):
        c, _ = client
        import requests as real_requests
        with patch("requests.get", side_effect=real_requests.exceptions.ConnectionError()):
            r = c.get("/coach/members-overview", headers=auth_header(role="trainer"))
        assert r.status_code == 503
