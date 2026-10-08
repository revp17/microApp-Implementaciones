# microApp-Implementaciones

Gestión y seguimiento de proyectos de implementación de sistemas/ERP, de inicio a cierre.

## Stack
- Frontend: React + TypeScript + Vite + Tailwind (`frontend/`)
- Backend: Python + FastAPI (`backend/`)
- BD + Auth + Storage: Nhost (PostgreSQL, JWT, evidencias)
- Hosting: Render (`render.yaml`) · Notificaciones: email (luego WhatsApp/Telegram)

## Segundo cerebro (Obsidian)
El vault vive en `vault/`. Antes de decidir algo de producto o arquitectura, leer `vault/02-Specs` y `vault/01-Decisiones`.
Toda decisión nueva → ADR en `vault/01-Decisiones` (plantilla en `vault/Plantillas`). Notas con `[[wikilinks]]`, en español.
Al cerrar una sesión de trabajo, añadir entrada en `vault/03-Bitacora/AAAA-MM-DD.md`.

## Comandos
- Backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload` · tests: `pytest`
- Frontend: `cd frontend && npm install && npm run dev` · `npm run build`

## Convenciones
- Soluciones simples; sin abstracciones prematuras. Probar antes de dar por terminado.
- Secretos solo en `.env` (nunca commitear).
