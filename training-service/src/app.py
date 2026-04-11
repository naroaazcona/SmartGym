import os
from datetime import datetime, timezone
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
import jwt
import openai
import json
import requests as http_requests
from bson import ObjectId

def utcnow():
    return datetime.now(timezone.utc)


def create_app():
    app = Flask(__name__)
    CORS(app)

    # ---------- Config ----------
    jwt_secret = os.getenv("JWT_SECRET")
    if not jwt_secret:
        raise RuntimeError("[FATAL] JWT_SECRET no estÃ¡ definido en las variables de entorno.")
    app.config["JWT_SECRET"] = jwt_secret    
    mongo_uri = os.getenv("MONGO_URI", "mongodb://admin:password@training-db:27017/gym_training?authSource=admin")
    mongo_db_name = os.getenv("MONGO_DB_NAME", "gym_training")

    # ---------- Mongo ----------
    mongo_client = MongoClient(mongo_uri)
    db = mongo_client[mongo_db_name]

    plans_col = db["workout_plans"]
    logs_col = db["workout_logs"]
    recs_col = db["recommendations"]
    prefs_col = db["user_preferences"]
    profiles_col = db["user_profiles"]



    # ---------- Auth (JWT) ----------
    def require_auth():
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None, (jsonify({"error": "Token de acceso requerido"}), 401)

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return None, (jsonify({"error": "Token de acceso requerido"}), 401)

        try:
            payload = jwt.decode(token, app.config["JWT_SECRET"], algorithms=["HS256"])
            user = {
                "id": payload.get("userId"),
                "role": payload.get("role"),
                "email": payload.get("email"),
            }
            if not user["id"] or not user["role"]:
                return None, (jsonify({"error": "Token invÃ¡lido"}), 403)
            return user, None
        except jwt.ExpiredSignatureError:
            return None, (jsonify({"error": "Token invÃ¡lido o expirado"}), 403)
        except jwt.InvalidTokenError:
            return None, (jsonify({"error": "Token invÃ¡lido o expirado"}), 403)

    # ---------- SuscripciÃ³n ----------
    auth_url = os.getenv("AUTH_URL", "http://auth-service:3001")

    def require_subscription(user, required_plan=None):
        """
        Verifica que el usuario tenga suscripciÃ³n activa consultando al auth-service.
        - required_plan=None  â†’ cualquier suscripciÃ³n activa
        - required_plan="premium" â†’ solo plan premium
        Devuelve (subscription, None) si ok, o (None, respuesta_error) si no.
        """
        token = request.headers.get("Authorization", "")
        try:
            resp = http_requests.get(
                f"{auth_url}/subscription/me",
                headers={"Authorization": token},
                timeout=5,
            )
            if resp.status_code != 200:
                return None, (jsonify({"error": "No se pudo verificar la suscripciÃ³n"}), 503)

            subscription = resp.json().get("subscription")

            if not subscription or subscription.get("status") != "active":
                return None, (jsonify({"error": "Necesitas una suscripciÃ³n activa para acceder a esta funcionalidad"}), 403)

            if required_plan == "premium" and subscription.get("plan") != "premium":
                return None, (jsonify({"error": "Esta funcionalidad requiere el plan Premium"}), 403)

            return subscription, None

        except http_requests.exceptions.RequestException:
            return None, (jsonify({"error": "No se pudo verificar la suscripciÃ³n. IntÃ©ntalo de nuevo."}), 503)

    # ---------- Helpers ----------
    def safe_int(value, default):
        """Convierte value a entero de forma segura. Si no es vÃ¡lido, devuelve default."""
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def serialize(doc):
        if not doc:
            return None
        doc = dict(doc)
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc

    def first_non_empty(*values, default=None):
        for value in values:
            if value is None:
                continue
            if isinstance(value, str):
                value = value.strip()
                if not value:
                    continue
            return value
        return default

    def build_effective_profile(stored_profile: dict = None, preferences: dict = None) -> dict:
        stored_profile = stored_profile or {}
        preferences = preferences or {}

        level = str(first_non_empty(
            stored_profile.get("experience_level"),
            preferences.get("experience_level"),
            request.args.get("level"),
            default="beginner",
        )).strip().lower() or "beginner"

        goal = str(first_non_empty(
            stored_profile.get("goal"),
            preferences.get("goal"),
            request.args.get("goal"),
            default="mejorar condicion fisica",
        )).replace("_", " ").strip() or "mejorar condicion fisica"

        days_per_week = safe_int(first_non_empty(
            stored_profile.get("days_per_week"),
            preferences.get("days_per_week"),
            request.args.get("days"),
            default=3,
        ), 3)
        days_per_week = max(1, min(days_per_week, 7))

        injuries = str(first_non_empty(
            stored_profile.get("injuries"),
            preferences.get("injuries"),
            request.args.get("injuries"),
            default="ninguna",
        )).replace("_", " ").strip() or "ninguna"

        gender = str(first_non_empty(
            stored_profile.get("gender"),
            request.args.get("gender"),
            default="",
        )).strip()

        weight_kg = first_non_empty(
            stored_profile.get("weight_kg"),
            request.args.get("weight"),
            default=None,
        )
        height_cm = first_non_empty(
            stored_profile.get("height_cm"),
            request.args.get("height"),
            default=None,
        )

        return {
            "experience_level": level,
            "goal": goal,
            "days_per_week": days_per_week,
            "injuries": injuries,
            "gender": gender,
            "weight_kg": weight_kg,
            "height_cm": height_cm,
        }

    def normalize_recommendation_payload(recommendation: dict = None, allow_diet_tips: bool = True) -> dict:
        recommendation = recommendation if isinstance(recommendation, dict) else {}
        normalized = dict(recommendation)

        normalized.setdefault("summary", "Plan personalizado SmartGym")
        normalized.setdefault("recommended_class_types", [])
        normalized.setdefault("split", [])
        normalized.setdefault("diet_tips", [])
        normalized.setdefault("notes", "")

        if not isinstance(normalized["recommended_class_types"], list):
            normalized["recommended_class_types"] = []

        if not isinstance(normalized["split"], list):
            normalized["split"] = []

        if not isinstance(normalized["diet_tips"], list):
            normalized["diet_tips"] = []

        if not allow_diet_tips:
            normalized["diet_tips"] = []

        return normalized

    def generate_plan_ai(profile: dict, preferences: dict = None) -> dict:
        """Genera una recomendaciÃ³n completa y estructurada usando OpenAI."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY no configurada")

        ai_client = openai.OpenAI(api_key=api_key)

        preferred_training = []
        available_equipment = []
        injuries = profile.get("injuries", "ninguna")

        if preferences:
            preferred_training = preferences.get("preferred_training", []) or []
            available_equipment = preferences.get("available_equipment", []) or []
            if preferences.get("injuries"):
                injuries = preferences.get("injuries")

        preferred_training_text = ", ".join(preferred_training) if preferred_training else "sin preferencia"
        available_equipment_text = ", ".join(available_equipment) if available_equipment else "gimnasio completo"

        prompt = f"""
Eres un entrenador personal experto de SmartGym.

Tu tarea es generar una recomendaciÃ³n deportiva PERSONALIZADA para un usuario.
Debes devolver SOLO JSON vÃ¡lido.
No aÃ±adas explicaciones fuera del JSON.

DATOS DEL USUARIO:
- Nivel: {profile.get('experience_level', 'beginner')}
- Objetivo: {profile.get('goal', 'mejorar condiciÃ³n fÃ­sica')}
- DÃ­as por semana: {profile.get('days_per_week', 3)}
- Lesiones o limitaciones: {injuries}
- GÃ©nero: {profile.get('gender', 'no especificado')}
- Peso: {profile.get('weight_kg', 'no especificado')}
- Altura: {profile.get('height_cm', 'no especificado')}

PREFERENCIAS:
- Tipos favoritos: {preferred_training_text}
- Equipamiento disponible: {available_equipment_text}

REGLAS IMPORTANTES:
- Adapta el plan al nivel del usuario.
- Si es principiante, evita planteamientos demasiado avanzados.
- Si tiene lesiones o limitaciones, evita ejercicios problemÃ¡ticos.
- El plan debe ser realista.
- Usa ejercicios especÃ­ficos.
- Incluye series y repeticiones dentro del texto del ejercicio.
- El plan debe estar en espaÃ±ol.
- No des consejos mÃ©dicos.
- Recomienda entre 2 y 4 tipos de clases compatibles con el perfil del usuario.
- AÃ±ade tambiÃ©n 3 consejos bÃ¡sicos de alimentaciÃ³n alineados con el objetivo.

FORMATO JSON OBLIGATORIO:
{{
  "summary": "Resumen breve y personalizado del plan",
  "recommended_class_types": [
    "string",
    "string"
  ],
  "split": [
    {{
      "day": "Lunes",
      "focus": "Texto corto",
      "duration_min": 45,
      "exercises": [
        "Sentadillas 3x10",
        "Press banca 3x10"
      ]
    }}
  ],
  "diet_tips": [
    {{
      "title": "Consejo 1",
      "detail": "Texto breve"
    }},
    {{
      "title": "Consejo 2",
      "detail": "Texto breve"
    }}
  ],
  "notes": "Consejo final Ãºtil y personalizado"
}}
"""

        response = ai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "Responde exclusivamente con JSON vÃ¡lido y consistente."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            response_format={"type": "json_object"},
            max_tokens=1800,
            temperature=0.7,
        )

        content = response.choices[0].message.content
        data = json.loads(content)

        if not isinstance(data, dict):
            raise ValueError("La IA no devolviÃ³ un objeto JSON vÃ¡lido")

        data.setdefault("summary", "Plan personalizado generado por SmartGym.")
        data.setdefault("recommended_class_types", [])
        data.setdefault("split", [])
        data.setdefault("diet_tips", [])
        data.setdefault("notes", "Recuerda mantener constancia y descansar adecuadamente.")

        if not isinstance(data["recommended_class_types"], list):
            data["recommended_class_types"] = []

        if not isinstance(data["split"], list):
            data["split"] = []

        if not isinstance(data["diet_tips"], list):
            data["diet_tips"] = []

        return data

    def generate_plan(level: str, goal: str = "", days_per_week: int = 3):
        """Fallback por reglas si OpenAI no estÃ¡ disponible."""
        level = (level or "beginner").lower()
        goal_text = (goal or "").lower()
        days_per_week = safe_int(days_per_week, 3)

        if level not in ["beginner", "intermediate", "advanced"]:
            level = "beginner"

        if "perder" in goal_text or "grasa" in goal_text:
            recommended_class_types = ["Spinning", "HIIT", "Zumba", "Funcional"]
            diet_tips = [
                {"title": "Prioriza proteÃ­na", "detail": "Incluye proteÃ­na magra en cada comida para mejorar saciedad."},
                {"title": "Controla ultraprocesados", "detail": "Reduce snacks y bebidas azucaradas."},
                {"title": "DÃ©ficit moderado", "detail": "Busca constancia antes que restricciones extremas."},
            ]
        elif "musculo" in goal_text or "masa" in goal_text or "fuerza" in goal_text:
            recommended_class_types = ["Body Pump", "Fuerza", "Cross Training", "Funcional"]
            diet_tips = [
                {"title": "ProteÃ­na suficiente", "detail": "Reparte proteÃ­na durante el dÃ­a."},
                {"title": "Carbohidrato Ãºtil", "detail": "Incluye carbohidratos alrededor del entrenamiento."},
                {"title": "SuperÃ¡vit controlado", "detail": "Aumenta calorÃ­as de forma progresiva si buscas ganar masa."},
            ]
        else:
            recommended_class_types = ["Pilates", "Funcional", "Body Balance", "Cardio"]
            diet_tips = [
                {"title": "Comidas equilibradas", "detail": "Combina proteÃ­na, carbohidrato complejo y verduras."},
                {"title": "HidrataciÃ³n", "detail": "MantÃ©n una buena hidrataciÃ³n durante el dÃ­a."},
                {"title": "Rutina sostenible", "detail": "Elige hÃ¡bitos que puedas mantener a largo plazo."},
            ]

        if level == "beginner":
            base_split = [
                {
                    "day": "Lunes",
                    "focus": "Full body bÃ¡sico",
                    "duration_min": 45,
                    "exercises": ["Sentadillas 3x12", "Press de pecho 3x10", "Remo con mancuerna 3x12"]
                },
                {
                    "day": "MiÃ©rcoles",
                    "focus": "Cardio + core",
                    "duration_min": 40,
                    "exercises": ["Bicicleta 20 min", "Plancha 3x30s", "Puente de glÃºteo 3x15"]
                },
                {
                    "day": "Viernes",
                    "focus": "Full body ligero",
                    "duration_min": 45,
                    "exercises": ["Zancadas 3x10", "Press hombro 3x10", "JalÃ³n al pecho 3x12"]
                },
            ]
        elif level == "intermediate":
            base_split = [
                {
                    "day": "Lunes",
                    "focus": "Torso",
                    "duration_min": 60,
                    "exercises": ["Press banca 4x8", "Remo con barra 4x10", "Press militar 3x10"]
                },
                {
                    "day": "MiÃ©rcoles",
                    "focus": "Pierna",
                    "duration_min": 60,
                    "exercises": ["Sentadilla 4x8", "Prensa 4x10", "Peso muerto rumano 3x10"]
                },
                {
                    "day": "Viernes",
                    "focus": "Full body + cardio",
                    "duration_min": 55,
                    "exercises": ["Dominadas asistidas 3x8", "Fondos 3x10", "Bicicleta 15 min"]
                },
            ]
        else:
            base_split = [
                {
                    "day": "Lunes",
                    "focus": "Push",
                    "duration_min": 70,
                    "exercises": ["Press banca 5x5", "Press inclinado 4x8", "Fondos 4x10"]
                },
                {
                    "day": "Martes",
                    "focus": "Pull",
                    "duration_min": 70,
                    "exercises": ["Dominadas 5x5", "Remo Pendlay 4x8", "Curl bÃ­ceps 4x10"]
                },
                {
                    "day": "Jueves",
                    "focus": "Legs",
                    "duration_min": 70,
                    "exercises": ["Sentadilla 5x5", "Peso muerto 4x6", "Prensa 4x10"]
                },
                {
                    "day": "SÃ¡bado",
                    "focus": "Acondicionamiento",
                    "duration_min": 50,
                    "exercises": ["Rower 10 min", "Kettlebell swings 4x15", "Burpees 3x12"]
                },
            ]

        split = base_split[:max(1, min(days_per_week, len(base_split)))]

        return {
            "summary": "Plan generado por reglas de negocio cuando la IA no estÃ¡ disponible.",
            "recommended_class_types": recommended_class_types[:4],
            "split": split,
            "diet_tips": diet_tips,
            "notes": "MantÃ©n una tÃ©cnica correcta y ajusta cargas segÃºn tu nivel."
        }

    # ---------- Routes ----------
    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"message": "Training service is running!"})

    @app.route("/plans/me", methods=["GET"])
    def get_my_plan():
        user, err = require_auth()
        if err:
            return err
        _, sub_err = require_subscription(user)
        if sub_err:
            return sub_err

        doc = plans_col.find_one({"userId": user["id"]}, sort=[("createdAt", -1)])
        if not doc:
            return jsonify({"message": "No tienes un plan todavia"}), 404
        return jsonify({"plan": serialize(doc)})

    @app.route("/plans/me", methods=["POST"])
    def upsert_my_plan():
        user, err = require_auth()
        if err:
            return err
        _, sub_err = require_subscription(user)
        if sub_err:
            return sub_err

        body = request.get_json(silent=True) or {}
        plan = body.get("plan")
        if not isinstance(plan, dict):
            return jsonify({"error": "Formato invalido. Esperado: { plan: {...} }"}), 400

        doc = {
            "userId": user["id"],
            "plan": plan,
            "createdAt": utcnow(),
        }
        res = plans_col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return jsonify({"message": "Plan guardado", "plan": serialize(doc)}), 201

    @app.route("/recommendations/me/saved", methods=["GET"])
    def get_saved_recommendation():
        user, err = require_auth()
        if err:
            return err

        subscription, sub_err = require_subscription(user)
        if sub_err:
            return sub_err
        allow_diet_tips = subscription.get("plan") == "premium"

        doc = recs_col.find_one(
            {"userId": user["id"], "savedByUser": True},
            sort=[("savedAt", -1)]
        )
        if not doc:
            return jsonify({"recommendation": None}), 200

        serialized = serialize(doc)
        serialized["recommendation"] = normalize_recommendation_payload(
            serialized.get("recommendation"),
            allow_diet_tips=allow_diet_tips,
        )
        return jsonify({"recommendation": serialized})

    @app.route("/recommendations/me/generate", methods=["GET"])
    @app.route("/recommendations/me", methods=["GET"])
    def generate_recommendation_for_me():
        user, err = require_auth()
        if err:
            return err
        subscription, sub_err = require_subscription(user)
        if sub_err:
            return sub_err
        allow_diet_tips = subscription.get("plan") == "premium"

        prefs_doc = prefs_col.find_one({"userId": user["id"]}, sort=[("createdAt", -1)])
        preferences = prefs_doc.get("preferences") if prefs_doc else {}
        stored_profile = profiles_col.find_one({"userId": user["id"]})
        profile = build_effective_profile(stored_profile, preferences)

        if not stored_profile:
            profiles_col.update_one(
                {"userId": user["id"]},
                {
                    "$set": {
                        "userId": user["id"],
                        "experience_level": profile["experience_level"],
                        "goal": profile["goal"],
                        "days_per_week": profile["days_per_week"],
                        "injuries": profile["injuries"],
                        "gender": profile["gender"],
                        "weight_kg": profile["weight_kg"],
                        "height_cm": profile["height_cm"],
                        "updatedAt": utcnow(),
                    },
                    "$setOnInsert": {
                        "createdAt": utcnow(),
                    },
                },
                upsert=True,
            )

        try:
            plan = generate_plan_ai(profile, preferences)
            source = "openai"
        except Exception as e:
            print(f"[AI ERROR] OpenAI fallo, usando fallback: {e}")
            plan = generate_plan(
                profile.get("experience_level", "beginner"),
                profile.get("goal", ""),
                profile.get("days_per_week", 3),
            )
            source = "rules_fallback"

        if not isinstance(plan, dict):
            plan = {
                "summary": "No se pudo generar un plan valido.",
                "recommended_class_types": [],
                "split": [],
                "diet_tips": [],
                "notes": "Intentalo de nuevo mas tarde."
            }

        plan = normalize_recommendation_payload(plan, allow_diet_tips=allow_diet_tips)

        doc = {
            "userId": user["id"],
            "level": profile.get("experience_level", "beginner"),
            "profile": {
                "experience_level": profile.get("experience_level", "beginner"),
                "goal": profile.get("goal", ""),
                "days_per_week": profile.get("days_per_week", 3),
                "injuries": profile.get("injuries", "ninguna"),
                "gender": profile.get("gender", ""),
                "weight_kg": profile.get("weight_kg"),
                "height_cm": profile.get("height_cm"),
            },
            "recommendation": plan,
            "source": source,
            "savedByUser": False,
        }

        return jsonify({
            "message": "Recomendacion generada correctamente",
            "recommendation": doc,
        }), 200

    @app.route("/recommendations/me", methods=["POST"])
    def save_recommendation():
        user, err = require_auth()
        if err:
            return err

        subscription, sub_err = require_subscription(user)
        if sub_err:
            return sub_err
        allow_diet_tips = subscription.get("plan") == "premium"

        body = request.get_json(silent=True) or {}
        recommendation = body.get("recommendation")
        if not isinstance(recommendation, dict):
            return jsonify({"error": "Formato invalido. Esperado: { recommendation: {...} }"}), 400

        recommendation = normalize_recommendation_payload(
            recommendation,
            allow_diet_tips=allow_diet_tips,
        )

        profile = body.get("profile")
        if not isinstance(profile, dict):
            profile = {}

        source = body.get("source")
        if not isinstance(source, str) or not source.strip():
            source = "manual_save"
        else:
            source = source.strip()

        level = body.get("level")
        if not isinstance(level, str) or not level.strip():
            level = str(profile.get("experience_level") or profile.get("level") or "beginner")
        else:
            level = level.strip()

        if not profile.get("experience_level"):
            profile["experience_level"] = level

        existing_id = body.get("_id")
        if existing_id:
            try:
                oid = ObjectId(str(existing_id))
                recs_col.update_one(
                    {"_id": oid, "userId": user["id"]},
                    {"$set": {
                        "recommendation": recommendation,
                        "profile": profile,
                        "level": level,
                        "source": source,
                        "savedByUser": True,
                        "savedAt": utcnow(),
                    }}
                )
                doc = recs_col.find_one({"_id": oid})
                if doc:
                    serialized = serialize(doc)
                    serialized["recommendation"] = normalize_recommendation_payload(
                        serialized.get("recommendation"),
                        allow_diet_tips=allow_diet_tips,
                    )
                    return jsonify({
                        "message": "Plan guardado en recommendations",
                        "recommendation": serialized,
                    }), 200
            except Exception:
                pass

        doc = {
            "userId": user["id"],
            "level": level,
            "profile": profile,
            "recommendation": recommendation,
            "source": source,
            "savedByUser": True,
            "savedAt": utcnow(),
            "createdAt": utcnow(),
        }
        res = recs_col.insert_one(doc)
        doc["_id"] = res.inserted_id
        serialized = serialize(doc)
        serialized["recommendation"] = normalize_recommendation_payload(
            serialized.get("recommendation"),
            allow_diet_tips=allow_diet_tips,
        )
        return jsonify({
            "message": "Plan guardado en recommendations",
            "recommendation": serialized,
        }), 201

    @app.route("/logs", methods=["POST"])
    def create_log():
        user, err = require_auth()
        if err:
            return err

        body = request.get_json(silent=True) or {}
        title = body.get("title")
        if not title or not isinstance(title, str):
            return jsonify({"error": "title es obligatorio"}), 400

        doc = {
            "userId": user["id"],
            "date": body.get("date"),
            "title": title,
            "duration_min": body.get("duration_min"),
            "notes": body.get("notes"),
            "createdAt": utcnow(),
        }
        res = logs_col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return jsonify({"message": "Entreno registrado", "log": serialize(doc)}), 201

    @app.route("/logs/me", methods=["GET"])
    def get_my_logs():
        user, err = require_auth()
        if err:
            return err
        page = safe_int(request.args.get("page"), 1)
        limit = safe_int(request.args.get("limit"), 20)
        page = max(1, page)
        limit = max(1, min(limit, 100))
        skip = (page - 1) * limit
        total = logs_col.count_documents({"userId": user["id"]})
        docs = list(logs_col.find({"userId": user["id"]}).sort("createdAt", -1).skip(skip).limit(limit))
        return jsonify({
            "logs": [serialize(d) for d in docs],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": -(-total // limit),
            }
        })

    @app.route("/preferences/me", methods=["POST"])
    def save_preferences():
        user, err = require_auth()
        if err:
            return err

        body = request.get_json(silent=True) or {}
        preferences = body.get("preferences")
        if not isinstance(preferences, dict):
            return jsonify({"error": "Formato invalido. Esperado: { preferences: {...} }"}), 400

        doc = {
            "userId": user["id"],
            "preferences": preferences,
            "createdAt": utcnow(),
        }
        res = prefs_col.insert_one(doc)
        doc["_id"] = res.inserted_id

        profile_patch = build_effective_profile({}, preferences)
        profiles_col.update_one(
            {"userId": user["id"]},
            {
                "$set": {
                    "userId": user["id"],
                    "experience_level": profile_patch["experience_level"],
                    "goal": profile_patch["goal"],
                    "days_per_week": profile_patch["days_per_week"],
                    "injuries": profile_patch["injuries"],
                    "gender": profile_patch["gender"],
                    "weight_kg": profile_patch["weight_kg"],
                    "height_cm": profile_patch["height_cm"],
                    "updatedAt": utcnow(),
                },
                "$setOnInsert": {
                    "createdAt": utcnow(),
                },
            },
            upsert=True,
        )

        return jsonify({
            "message": "Preferencias guardadas",
            "preferences": serialize(doc),
        }), 201

    @app.route("/preferences/me", methods=["GET"])
    def get_preferences():
        user, err = require_auth()
        if err:
            return err

        doc = prefs_col.find_one({"userId": user["id"]}, sort=[("createdAt", -1)])
        if not doc:
            return jsonify({"preferences": None}), 200
        return jsonify({"preferences": serialize(doc)})

    return app

app = create_app()

if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=debug)
