# SmartGym

Aplicacion web de gestion de gimnasio con arquitectura de microservicios.

## Requisitos
- Docker Desktop (o Docker Engine + Docker Compose v2)

## Arranque rapido en otro ordenador
1. Clona el repositorio.
2. Desde la raiz del proyecto, ejecuta:

```powershell
docker compose up -d --build
```

3. Abre la aplicacion en:
- Frontend: http://localhost:8080
- API Gateway: http://localhost:3000/health
- Auth service: http://localhost:3001/health
- Gym service: http://localhost:3002/health
- Training service: http://localhost:5000/health
- pgAdmin: http://localhost:5050

## Variables de entorno
`docker-compose.yml` ya incluye valores por defecto de desarrollo para que arranque sin `.env`.

Si quieres personalizar credenciales o claves, copia `.env.example` a `.env` y cambia los valores:

```powershell
Copy-Item .env.example .env
```

## Cuando login/registro falla en un entorno nuevo
1. Revisa logs:

```powershell
docker logs --tail 150 smartgym-auth-db-1
docker logs --tail 150 smartgym-auth-service-1
```

2. Si cambiaste passwords/JWT, recrea volumenes para re-inicializar la DB:

```powershell
docker compose down -v --remove-orphans
docker compose up -d --build
```

## Notas practicas
- `auth-service` y `gym-service` ahora fallan de forma explicita si no pueden inicializar PostgreSQL.
- Endpoints de Stripe quedan deshabilitados automaticamente si no hay claves Stripe, pero login/registro siguen funcionando.
- Los datos se guardan en volumenes Docker (`auth_data`, `gym_data`, `training_data`).
