# ADR-0001 — Stack

- Estado: aceptada · Fecha: 2026-10-08

## Decisión
- Frontend: React + TypeScript + Vite + Tailwind CSS (`frontend/`)
- Backend: Python + FastAPI (`backend/`)
- BD + Auth + Storage (evidencias): Nhost (PostgreSQL + JWT)
- Hosting: Render (`render.yaml`) · Código: GitHub
- Notificaciones: email inicialmente; WhatsApp/Telegram después

## Consecuencias
- Nhost emite los JWT; FastAPI los valida con `NHOST_JWT_SECRET` y accede a datos con el admin secret solo en servidor.
- Proyecto independiente de TcketsOne (Supabase): sin dependencias cruzadas.
- Pendiente: decidir si el frontend consulta Nhost (GraphQL) directo o todo pasa por FastAPI → [[Preguntas-abiertas]].
