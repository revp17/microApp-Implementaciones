# ADR-0002 — Modelo de datos MVP (Proyectos, Fases, Tareas)

- Estado: propuesta · Fecha: 2026-10-08

## Decisión
- Tablas `proyectos` → `fases` → `tareas` (FK en cascada), SQL en `db/001_proyectos_fases_tareas.sql`.
- Estados como `text` + `check` (simple, sin enums que cuesten migrar).
- Una tarea `bloqueada` exige `motivo_bloqueo`.
- Alertas MVP = vista `tareas_en_alerta` (bloqueadas o vencidas); el envío de email lo hará FastAPI.
- `responsable_id` referencia a `auth.users` de Nhost (sin FK por ahora; permisos/roles pendientes).

## Fuera de este ADR
Dependencias entre tareas, plantillas de fases, multi-cliente y permisos → [[Preguntas-abiertas]].
