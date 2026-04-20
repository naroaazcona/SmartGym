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
import unicodedata

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

    def to_user_key(value):
        if value is None:
            return ""
        return str(value).strip()

    def parse_datetime(value):
        if not value:
            return None
        if isinstance(value, datetime):
            dt = value
        elif isinstance(value, str):
            text = value.strip()
            if not text:
                return None
            if text.endswith("Z"):
                text = text[:-1] + "+00:00"
            try:
                dt = datetime.fromisoformat(text)
            except ValueError:
                return None
        else:
            return None

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def to_iso_datetime(value):
        dt = parse_datetime(value)
        return dt.isoformat() if dt else None

    def build_user_match_filter(user_keys):
        keys = [to_user_key(item) for item in (user_keys or []) if to_user_key(item)]
        string_ids = []
        numeric_ids = []

        for key in keys:
            if key not in string_ids:
                string_ids.append(key)
            try:
                as_number = int(key)
                if as_number not in numeric_ids:
                    numeric_ids.append(as_number)
            except ValueError:
                continue

        clauses = []
        if string_ids:
            clauses.append({"userId": {"$in": string_ids}})
        if numeric_ids:
            clauses.append({"userId": {"$in": numeric_ids}})

        if not clauses:
            return {"userId": {"$in": []}}
        if len(clauses) == 1:
            return clauses[0]
        return {"$or": clauses}

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

    def parse_list_values(value):
        if value is None:
            return []

        if isinstance(value, list):
            raw_items = value
        elif isinstance(value, str):
            raw_items = value.split(",")
        else:
            raw_items = [value]

        parsed = []
        seen = set()
        for item in raw_items:
            text = str(item).strip()
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            parsed.append(text)
        return parsed

    def normalize_token(value):
        text = str(value or "").strip().lower()
        if not text:
            return ""
        text = unicodedata.normalize("NFD", text)
        text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
        return text.replace("-", "_").replace(" ", "_")

    def split_csv_tokens(value):
        if value is None:
            return []
        if isinstance(value, list):
            parts = value
        else:
            parts = str(value).split(",")

        tokens = []
        seen = set()
        for item in parts:
            token = normalize_token(item)
            if not token or token in seen:
                continue
            seen.add(token)
            tokens.append(token)
        return tokens

    def unique_in_order(values, limit=None):
        result = []
        seen = set()
        for value in values:
            text = str(value or "").strip()
            if not text:
                continue
            key = normalize_token(text)
            if key in seen:
                continue
            seen.add(key)
            result.append(text)
            if limit and len(result) >= limit:
                break
        return result

    def build_safe_wrist_exercises():
        return [
            "Bicicleta estatica 20 min",
            "Sentadillas 3x12",
            "Prensa de piernas 3x12",
            "Peso muerto rumano 3x10",
            "Puente de gluteo 3x15",
            "Zancadas 3x10 por pierna",
            "Curl femoral en maquina 3x12",
            "Caminata inclinada 15 min",
            "Abdominales en maquina 3x15",
            "Movilidad de cadera y tobillo 10 min",
        ]

    def adapt_plan_to_preferences(plan: dict, profile: dict = None, preferences: dict = None) -> dict:
        if not isinstance(plan, dict):
            return plan

        profile = profile or {}
        preferences = preferences or {}
        adapted = dict(plan)

        preferred_training = split_csv_tokens(preferences.get("preferred_training", []))
        injuries = split_csv_tokens(first_non_empty(preferences.get("injuries"), profile.get("injuries"), default="ninguna"))

        pref_class_map = {
            "fuerza": ["Fuerza", "Body Pump"],
            "cardio": ["Spinning", "Cardio"],
            "hiit": ["HIIT", "Cross Training"],
            "yoga_pilates": ["Yoga", "Pilates"],
            "funcional": ["Funcional"],
            "crossfit": ["Cross Training", "HIIT"],
        }

        preferred_class_types = []
        for pref in preferred_training:
            preferred_class_types.extend(pref_class_map.get(pref, []))

        raw_classes = adapted.get("recommended_class_types", [])
        if not isinstance(raw_classes, list):
            raw_classes = []
        adapted["recommended_class_types"] = unique_in_order(preferred_class_types + raw_classes, limit=4)

        split = adapted.get("split", [])
        if not isinstance(split, list):
            split = []
        split = [dict(item) for item in split if isinstance(item, dict)]

        notes_parts = [str(adapted.get("notes") or "").strip()]

        prefers_yoga = "yoga_pilates" in preferred_training
        if prefers_yoga:
            yoga_focus_tokens = ("yoga", "pilates", "movilidad", "flexibilidad", "estiramiento")
            has_yoga_block = False
            for item in split:
                focus_text = normalize_token(item.get("focus", ""))
                if any(token in focus_text for token in yoga_focus_tokens):
                    has_yoga_block = True
                    break
            if not has_yoga_block:
                yoga_session = {
                    "day": "Dia de movilidad",
                    "focus": "Yoga/Pilates y movilidad",
                    "duration_min": 40,
                    "exercises": [
                        "Movilidad de columna 10 min",
                        "Secuencia de Yoga suave 20 min",
                        "Respiracion diafragmatica 5 min",
                    ],
                }
                if split:
                    split[-1] = yoga_session
                else:
                    split.append(yoga_session)
            notes_parts.append("Se prioriza bloque de yoga/pilates segun preferencia.")

        has_wrist_injury = any(token in ("muneca", "codo", "muneca_codo") for token in injuries)
        if has_wrist_injury:
            banned_tokens = (
                "press",
                "flexion",
                "fondo",
                "burpee",
                "plancha",
                "dominada",
                "curl",
                "push",
            )
            safe_pool = build_safe_wrist_exercises()
            safe_index = 0

            for item in split:
                exercises = item.get("exercises", [])
                if not isinstance(exercises, list):
                    exercises = parse_list_values(exercises)

                filtered = []
                for ex in exercises:
                    ex_text = str(ex or "").strip()
                    if not ex_text:
                        continue
                    normalized_ex = normalize_token(ex_text)
                    if any(token in normalized_ex for token in banned_tokens):
                        continue
                    filtered.append(ex_text)

                while len(filtered) < 3 and safe_index < len(safe_pool):
                    filtered.append(safe_pool[safe_index])
                    safe_index += 1

                item["exercises"] = unique_in_order(filtered[:4])

            notes_parts.append("Plan adaptado para lesion de muneca evitando carga directa en manos.")

        adapted["split"] = split
        adapted["notes"] = " ".join(part for part in notes_parts if part).strip()
        return adapted

    def build_effective_profile(stored_profile: dict = None, preferences: dict = None) -> dict:
        stored_profile = stored_profile or {}
        preferences = preferences or {}

        level = str(first_non_empty(
            request.args.get("level"),
            stored_profile.get("experience_level"),
            preferences.get("experience_level"),
            default="beginner",
        )).strip().lower() or "beginner"

        goal = str(first_non_empty(
            request.args.get("goal"),
            stored_profile.get("goal"),
            preferences.get("goal"),
            default="mejorar condicion fisica",
        )).replace("_", " ").strip() or "mejorar condicion fisica"

        days_per_week = safe_int(first_non_empty(
            request.args.get("days"),
            stored_profile.get("days_per_week"),
            preferences.get("days_per_week"),
            default=3,
        ), 3)
        days_per_week = max(1, min(days_per_week, 7))

        injuries = str(first_non_empty(
            request.args.get("injuries"),
            stored_profile.get("injuries"),
            preferences.get("injuries"),
            default="ninguna",
        )).replace("_", " ").strip() or "ninguna"

        gender = str(first_non_empty(
            request.args.get("gender"),
            stored_profile.get("gender"),
            default="",
        )).strip()

        weight_kg = first_non_empty(
            request.args.get("weight"),
            stored_profile.get("weight_kg"),
            default=None,
        )
        height_cm = first_non_empty(
            request.args.get("height"),
            stored_profile.get("height_cm"),
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

    def build_effective_preferences(stored_preferences: dict = None) -> dict:
        stored_preferences = stored_preferences if isinstance(stored_preferences, dict) else {}
        preferred_training_raw = first_non_empty(
            request.args.get("preferred_training"),
            stored_preferences.get("preferred_training"),
            default=[],
        )
        available_equipment_raw = first_non_empty(
            request.args.get("available_equipment"),
            stored_preferences.get("available_equipment"),
            default=[],
        )
        injuries_raw = first_non_empty(
            request.args.get("injuries"),
            stored_preferences.get("injuries"),
            default="ninguna",
        )

        preferences = dict(stored_preferences)
        preferences["preferred_training"] = parse_list_values(preferred_training_raw)
        preferences["available_equipment"] = parse_list_values(available_equipment_raw)
        injuries = str(injuries_raw).replace("_", " ").strip() if injuries_raw is not None else "ninguna"
        preferences["injuries"] = injuries or "ninguna"
        return preferences

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

    def build_recent_logs_context(logs: list = None) -> str:
        logs = logs or []
        if not logs:
            return "Sin sesiones recientes registradas."

        lines = []
        for index, log in enumerate(logs[:5], start=1):
            title = str(log.get("title") or "Sesion").strip()
            duration_min = safe_int(log.get("duration_min"), 0)
            note = str(log.get("notes") or "").strip()
            date_text = str(first_non_empty(log.get("date"), log.get("createdAt"), default="")).strip()

            parts = [f"{index}. {title}"]
            if duration_min > 0:
                parts.append(f"{duration_min} min")
            if date_text:
                parts.append(f"fecha {date_text}")
            if note:
                parts.append(f"notas: {note[:120]}")
            lines.append(" | ".join(parts))

        return "\n".join(lines)

    def generate_plan_ai(profile: dict, preferences: dict = None, recent_logs: list = None) -> dict:
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
        recent_logs_text = build_recent_logs_context(recent_logs)

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

HISTORIAL RECIENTE:
{recent_logs_text}

REGLAS IMPORTANTES:
- Adapta el plan al nivel del usuario.
- Si es principiante, evita planteamientos demasiado avanzados.
- Si tiene lesiones o limitaciones, evita ejercicios problemÃ¡ticos.
- Ten en cuenta el historial reciente para ajustar volumen y variedad.
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
        stored_preferences = prefs_doc.get("preferences") if prefs_doc else {}
        preferences = build_effective_preferences(stored_preferences)
        stored_profile = profiles_col.find_one({"userId": user["id"]})
        profile = build_effective_profile(stored_profile, preferences)
        recent_logs = list(logs_col.find({"userId": user["id"]}).sort("createdAt", -1).limit(6))

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
            plan = generate_plan_ai(profile, preferences, recent_logs=recent_logs)
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

        plan = adapt_plan_to_preferences(plan, profile=profile, preferences=preferences)
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

    @app.route("/coach/members-overview", methods=["GET"])
    def coach_members_overview():
        user, err = require_auth()
        if err:
            return err

        if user.get("role") not in ("trainer", "admin"):
            return jsonify({"error": "No tienes permisos para esta funcionalidad"}), 403

        token = request.headers.get("Authorization", "")
        logs_limit = safe_int(request.args.get("logs_limit"), 6)
        logs_limit = max(1, min(logs_limit, 20))

        try:
            resp = http_requests.get(
                f"{auth_url}/users/registered-basic",
                headers={"Authorization": token},
                timeout=8,
            )
            if resp.status_code != 200:
                return jsonify({"error": "No se pudo cargar el listado de usuarios"}), 503
            users = resp.json().get("users")
            if not isinstance(users, list):
                users = []
            users = [
                item for item in users
                if isinstance(item, dict) and str(item.get("role", "")).strip().lower() == "member"
            ]
        except http_requests.exceptions.RequestException:
            return jsonify({"error": "No se pudo cargar el listado de usuarios"}), 503

        user_keys = [to_user_key(item.get("id")) for item in users if to_user_key(item.get("id"))]
        if not user_keys:
            return jsonify({"members": [], "generatedAt": utcnow().isoformat()})

        user_filter = build_user_match_filter(user_keys)

        prefs_docs = list(prefs_col.find(user_filter).sort("createdAt", -1))
        latest_prefs_by_user = {}
        for doc in prefs_docs:
            key = to_user_key(doc.get("userId"))
            if key and key not in latest_prefs_by_user:
                latest_prefs_by_user[key] = doc

        logs_docs = list(logs_col.find(user_filter).sort("createdAt", -1))
        logs_by_user = {}
        log_counts = {}
        latest_log_timestamp = {}
        for doc in logs_docs:
            key = to_user_key(doc.get("userId"))
            if not key:
                continue
            log_counts[key] = log_counts.get(key, 0) + 1
            if key not in latest_log_timestamp:
                latest_log_timestamp[key] = doc.get("createdAt") or doc.get("date")

            bucket = logs_by_user.setdefault(key, [])
            if len(bucket) < logs_limit:
                bucket.append(doc)

        members = []
        for item in users:
            key = to_user_key(item.get("id"))
            pref_doc = latest_prefs_by_user.get(key)
            preferences = pref_doc.get("preferences") if isinstance(pref_doc, dict) and isinstance(pref_doc.get("preferences"), dict) else {}
            preferences_updated_at = to_iso_datetime(pref_doc.get("createdAt")) if isinstance(pref_doc, dict) else None

            preview_logs = []
            for raw_log in logs_by_user.get(key, []):
                log = serialize(raw_log) or {}
                preview_logs.append({
                    "_id": log.get("_id"),
                    "title": log.get("title"),
                    "date": log.get("date"),
                    "duration_min": log.get("duration_min"),
                    "notes": log.get("notes"),
                    "createdAt": log.get("createdAt"),
                })

            date_candidates = [
                parse_datetime(preferences_updated_at),
                parse_datetime(latest_log_timestamp.get(key)),
            ]
            date_candidates = [dt for dt in date_candidates if dt]
            last_activity_at = max(date_candidates).isoformat() if date_candidates else None

            members.append({
                "user": {
                    "id": item.get("id"),
                    "email": item.get("email"),
                    "name": item.get("name"),
                    "role": item.get("role"),
                    "first_name": item.get("first_name"),
                    "last_name": item.get("last_name"),
                    "created_at": to_iso_datetime(item.get("created_at")),
                },
                "preferences": preferences,
                "preferences_updated_at": preferences_updated_at,
                "logs": preview_logs,
                "logs_total": log_counts.get(key, 0),
                "last_activity_at": last_activity_at,
            })

        def member_sort_key(member):
            last_activity = parse_datetime(member.get("last_activity_at"))
            created_at = parse_datetime(member.get("user", {}).get("created_at"))
            return (
                last_activity or created_at or datetime.fromtimestamp(0, tz=timezone.utc),
                to_user_key(member.get("user", {}).get("id")),
            )

        members.sort(key=member_sort_key, reverse=True)

        return jsonify({
            "members": members,
            "generatedAt": utcnow().isoformat(),
        }), 200

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

        now = utcnow()
        existing_doc = prefs_col.find_one({"userId": user["id"]}, sort=[("createdAt", -1)])

        if existing_doc:
            prefs_col.update_one(
                {"_id": existing_doc["_id"]},
                {
                    "$set": {
                        "userId": user["id"],
                        "preferences": preferences,
                        "updatedAt": now,
                    },
                },
            )
            doc = dict(existing_doc)
            doc["preferences"] = preferences
            doc["updatedAt"] = now
            message = "Preferencias actualizadas"
            status_code = 200
        else:
            doc = {
                "userId": user["id"],
                "preferences": preferences,
                "createdAt": now,
                "updatedAt": now,
            }
            res = prefs_col.insert_one(doc)
            doc["_id"] = res.inserted_id
            message = "Preferencias guardadas"
            status_code = 201

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
            "message": message,
            "preferences": serialize(doc),
        }), status_code

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
