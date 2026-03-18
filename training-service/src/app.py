import os
from datetime import datetime, timezone
import profile
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
import jwt
import openai
import json


def utcnow():
    return datetime.now(timezone.utc)


def create_app():
    app = Flask(__name__)
    CORS(app)

    # ---------- Config ----------
    jwt_secret = os.getenv("JWT_SECRET")
    if not jwt_secret:
        raise RuntimeError("[FATAL] JWT_SECRET no está definido en las variables de entorno.")
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
                return None, (jsonify({"error": "Token inválido"}), 403)
            return user, None
        except jwt.ExpiredSignatureError:
            return None, (jsonify({"error": "Token inválido o expirado"}), 403)
        except jwt.InvalidTokenError:
            return None, (jsonify({"error": "Token inválido o expirado"}), 403)

    # ---------- Helpers ----------
    def safe_int(value, default):
        """Convierte value a entero de forma segura. Si no es válido, devuelve default."""
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def serialize(doc):
        if not doc:
            return None
        doc = dict(doc)
        doc["_id"] = str(doc["_id"])
        return doc

    def generate_plan_ai(profile: dict, preferences: dict = None) -> dict:
        """Genera un plan de entrenamiento personalizado y variado usando OpenAI."""
        ai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        prefs_text = ""
        if preferences:
            prefs_text = f"""
PREFERENCIAS DEL USUARIO (recogidas en onboarding):
- Tipo de entrenamiento preferido: {", ".join(preferences.get("preferred_training", [])) or "sin preferencia"}
- Equipamiento disponible: {", ".join(preferences.get("available_equipment", [])) or "gimnasio completo"}
- Limitaciones físicas: {preferences.get("injuries", "ninguna")}
"""

        prompt = f"""
Eres un entrenador personal certificado. Crea un plan de entrenamiento semanal VARIADO y REALISTA.
Cada vez que te llamen debes generar un plan diferente al anterior, variando ejercicios y estructura.

PERFIL DEL USUARIO:
- Nivel: {profile.get('experience_level', 'beginner')}
- Objetivo: {profile.get('goal', 'mejorar condición física')}
- Días disponibles: {profile.get('days_per_week', 3)} días por semana
- Limitaciones físicas: {profile.get('injuries', 'ninguna')}
- Respeta el equipamiento disponible del usuario {prefs_text}
- Género: {profile.get('gender', 'no especificado')}
- Peso: {profile.get('weight_kg', '?')} kg
- Altura: {profile.get('height_cm', '?')} cm

REQUISITOS:
- Los ejercicios deben ser específicos y reales (no genéricos)
- Incluye series y repeticiones en el nombre del ejercicio (ej: "Sentadillas 4x10")
- Adapta la intensidad al nivel del usuario
- Si tiene limitaciones físicas, evita ejercicios que las agraven
- El objetivo debe reflejarse claramente en la selección de ejercicios
- Varía el plan cada vez que se genere

Responde ÚNICAMENTE con un JSON válido con este formato exacto, sin texto adicional:
{{
  "split": [
    {{
      "day": "Lunes",
      "focus": "...",
      "duration_min": 45,
      "exercises": [
        "Ejercicio 1 - series x reps",
        "Ejercicio 2 - series x reps"
      ]
    }}
  ],
  "notes": "Consejo personalizado y específico para este usuario según su objetivo y perfil"
}}
"""

        response = ai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1200
        )

        return json.loads(response.choices[0].message.content)

    def generate_plan(level: str):
        """Fallback: genera un plan por reglas fijas si OpenAI no está disponible."""
        level = (level or "beginner").lower()
        if level not in ["beginner", "intermediate", "advanced"]:
            level = "beginner"

        if level == "beginner":
            split = [
                {"day": "Lunes", "focus": "Full Body A", "duration_min": 45, "exercises": ["Sentadillas 3x12", "Flexiones 3x10", "Remo con mancuerna 3x12"]},
                {"day": "Miércoles", "focus": "Full Body B", "duration_min": 45, "exercises": ["Peso muerto 3x10", "Press de hombros 3x12", "Zancadas 3x10"]},
                {"day": "Viernes", "focus": "Full Body A", "duration_min": 45, "exercises": ["Sentadillas 3x12", "Flexiones 3x10", "Remo con mancuerna 3x12"]},
            ]
        elif level == "intermediate":
            split = [
                {"day": "Lunes", "focus": "Push", "duration_min": 60, "exercises": ["Press banca 4x8", "Press inclinado 3x10", "Fondos 3x12"]},
                {"day": "Martes", "focus": "Pull", "duration_min": 60, "exercises": ["Dominadas 4x8", "Remo con barra 4x10", "Curl bíceps 3x12"]},
                {"day": "Jueves", "focus": "Legs", "duration_min": 60, "exercises": ["Sentadillas 4x10", "Prensa 4x12", "Curl femoral 3x12"]},
                {"day": "Sábado", "focus": "Full Upper", "duration_min": 55, "exercises": ["Press militar 4x10", "Remo mancuerna 4x10", "Extensiones tríceps 3x12"]},
            ]
        else:
            split = [
                {"day": "Lunes", "focus": "Push (heavy)", "duration_min": 70, "exercises": ["Press banca 5x5", "Press inclinado 4x8", "Fondos lastrados 4x8"]},
                {"day": "Martes", "focus": "Pull (heavy)", "duration_min": 70, "exercises": ["Dominadas lastradas 5x5", "Remo Pendlay 4x8", "Curl martillo 4x10"]},
                {"day": "Miércoles", "focus": "Legs (heavy)", "duration_min": 70, "exercises": ["Sentadilla 5x5", "Peso muerto 4x6", "Prensa 4x10"]},
                {"day": "Viernes", "focus": "Push (volume)", "duration_min": 65, "exercises": ["Press banca 4x12", "Aperturas 4x15", "Tríceps polea 4x15"]},
                {"day": "Sábado", "focus": "Pull (volume)", "duration_min": 65, "exercises": ["Jalón al pecho 4x12", "Remo en polea 4x15", "Curl concentrado 4x15"]},
            ]

        return {
            "split": split,
            "notes": "Plan generado por reglas según tu nivel. Descansa al menos 48h entre grupos musculares.",
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

        doc = plans_col.find_one({"userId": user["id"]}, sort=[("createdAt", -1)])
        if not doc:
            return jsonify({"message": "No tienes un plan todavía"}), 404
        return jsonify({"plan": serialize(doc)})

    @app.route("/plans/me", methods=["POST"])
    def upsert_my_plan():
        user, err = require_auth()
        if err:
            return err

        body = request.get_json(silent=True) or {}
        plan = body.get("plan")
        if not isinstance(plan, dict):
            return jsonify({"error": "Formato inválido. Esperado: { plan: {...} }"}), 400

        doc = {
            "userId": user["id"],
            "plan": plan,
            "createdAt": utcnow(),
        }
        res = plans_col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return jsonify({"message": "Plan guardado", "plan": serialize(doc)}), 201

    @app.route("/recommendations/me", methods=["GET"])
    def get_recommendation():
        user, err = require_auth()
        if err:
            return err

        # Recoge parámetros del perfil desde la query string
        profile = {
            "experience_level": request.args.get("level", "beginner"),
            "goal":             request.args.get("goal", "mejorar condición física"),
            "days_per_week":    safe_int(request.args.get("days"), 3),            
            "injuries":         request.args.get("injuries", "ninguna"),
            "gender":           request.args.get("gender", ""),
            "weight_kg":        request.args.get("weight", ""),
            "height_cm":        request.args.get("height", ""),
        }

        # Recuperar preferencias del onboarding si existen
        user_prefs = prefs_col.find_one({"userId": user["id"]}, sort=[("createdAt", -1)])
        preferences = user_prefs.get("preferences") if user_prefs else None

        # Combinar preferencias con perfil
        if preferences:
            if preferences.get("experience_level"):
                profile["experience_level"] = preferences["experience_level"]
            if preferences.get("goal"):
                profile["goal"] = preferences["goal"].replace("_", " ")
            if preferences.get("days_per_week"):
                profile["days_per_week"] = safe_int(preferences["days_per_week"], profile["days_per_week"])
            if preferences.get("injuries"):
                profile["injuries"] = preferences["injuries"]

        # Genera siempre una nueva recomendación con IA, con fallback a reglas
        try:
            plan = generate_plan_ai(profile, preferences)
            source = "openai"
        except Exception as e:
            print(f"[AI ERROR] OpenAI falló, usando fallback: {e}")
            plan = generate_plan(profile["experience_level"])
            source = "rules_fallback"

        doc = {
            "userId":         user["id"],
            "level":          profile["experience_level"],
            "profile":        profile,
            "preferences":    preferences,
            "recommendation": plan,
            "source":         source,
            "createdAt":      utcnow(),
        }
        return jsonify({"recommendation": doc})

    @app.route("/recommendations/me", methods=["POST"])
    def save_recommendation():
        user, err = require_auth()
        if err:
            return err

        body = request.get_json(silent=True) or {}
        recommendation = body.get("recommendation")
        if not isinstance(recommendation, dict):
            return jsonify({"error": "Formato invalido. Esperado: { recommendation: {...} }"}), 400

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

        # Si viene un _id en el body, actualizamos el documento existente
        # en lugar de insertar un duplicado
        from bson import ObjectId
        existing_id = body.get("_id")
        if existing_id:
            try:
                oid = ObjectId(str(existing_id))
                recs_col.update_one(
                    {"_id": oid, "userId": user["id"]},
                    {"$set": {
                        "recommendation": recommendation,
                        "profile":        profile,
                        "level":          level,
                        "source":         source,
                        "savedByUser":    True,
                        "savedAt":        utcnow(),
                    }}
                )
                doc = recs_col.find_one({"_id": oid})
                if doc:
                    return jsonify({
                        "message": "Plan guardado en recommendations",
                        "recommendation": serialize(doc),
                    }), 200
            except Exception:
                pass  # Si el _id no es válido, caemos al insert normal

        # Sin _id válido: insertar nuevo documento
        doc = {
            "userId":         user["id"],
            "level":          level,
            "profile":        profile,
            "recommendation": recommendation,
            "source":         source,
            "savedByUser":    True,
            "savedAt":        utcnow(),
            "createdAt":      utcnow(),
        }
        res = recs_col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return jsonify({
            "message": "Plan guardado en recommendations",
            "recommendation": serialize(doc),
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
        page  = safe_int(request.args.get("page"), 1)
        limit = safe_int(request.args.get("limit"), 20)
        # Valores seguros: página mínima 1, límite entre 1 y 100
        page  = max(1, page)
        limit = max(1, min(limit, 100))
        skip  = (page - 1) * limit
        total = logs_col.count_documents({"userId": user["id"]})
        docs  = list(logs_col.find({"userId": user["id"]}).sort("createdAt", -1).skip(skip).limit(limit))
        return jsonify({
            "logs": [serialize(d) for d in docs],
            "pagination": {
                "page":       page,
                "limit":      limit,
                "total":      total,
                "totalPages": -(-total // limit),  # división entera hacia arriba
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
            return jsonify({"error": "Formato inválido. Esperado: { preferences: {...} }"}), 400

        doc = {
            "userId":      user["id"],
            "preferences": preferences,
            "createdAt":   utcnow(),
        }
        res = prefs_col.insert_one(doc)
        doc["_id"] = res.inserted_id
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