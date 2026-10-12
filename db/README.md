# Base de datos (Nhost / Hasura)

Migraciones SQL numeradas, **idempotentes** (se pueden re-ejecutar). Estado actual: módulo 1 (Proyectos) aplicado; Fases, Tareas y Alertas aún no existen.

## Aplicar
```bash
export NHOST_SUBDOMAIN=... NHOST_REGION=... NHOST_ADMIN_SECRET=...   # solo en el entorno, nunca en el repo
python db/aplicar.py
```
Ejecuta `db/[0-9]*.sql` en orden (`/v2/query`) y registra en Hasura (`/v1/metadata`) tablas, relaciones y permisos del rol `user`. Solo usa la librería estándar de Python. Si Hasura devuelve un error distinto de "ya existe / ya registrado", el script aborta.

## Probar (contra Nhost real)
```bash
cd backend && pip install -r requirements.txt && pytest -v
```
- `tests/test_health.py` y `tests/test_miembros_sin_red.py` (3 pruebas) no usan red.
- `tests/test_permisos_integracion.py` (7 pruebas) crea 5 usuarios `zz-prueba-impl-*@example.com` directamente por SQL admin (el signup de Nhost tiene límite de peticiones), ejercita permisos de Hasura y el endpoint de miembros, y **borra todo** al terminar. Se salta si faltan las variables `NHOST_*`.

## Módulo 1 · Proyectos (`001_proyectos.sql` + `aplicar.py`)
Tablas: `clientes`, `proyectos`, `proyecto_miembros`, `eventos`. Los permisos de Hasura viven en `aplicar.py`, no en el SQL.

- **`creado_por`** nunca lo envía el cliente: el permiso Hasura lo fija con `X-Hasura-User-Id` (preset) y, como defensa extra, un trigger lo sobrescribe con `hasura.user` si existe.
- **Al crear un proyecto**, un trigger añade al creador como `responsable`.
- **Validaciones en BD:** nombre no vacío, `nombre` y `sistema` ≤ 200 caracteres, `fecha_fin_plan` ≥ `fecha_inicio`.
- **Permisos del rol `user`:**
  - `clientes`: cualquier usuario autenticado crea; ve los que creó o los de proyectos donde es miembro. No hay update ni delete.
  - `proyectos`: cualquier usuario autenticado crea, pero solo sobre un cliente que **creó él** o donde es **responsable** de algún proyecto de ese cliente; ven todos los miembros; **solo el `responsable` actualiza** (datos generales y estado, no el cliente). No hay delete.
  - `proyecto_miembros`: solo lectura para miembros del proyecto. Insertar y borrar miembros **no** se hace por Hasura (ver abajo).
  - `eventos` (historial de insert/update/delete de `proyectos`): lo leen `responsable` y `colaborador`; el rol `cliente` no.
- **Nhost exige email verificado** para iniciar sesión: tras registrarse, la persona debe confirmar el correo.
- **Registro abierto:** cualquiera puede crear cuenta, clientes y proyectos propios (riesgo aceptado por ahora; ver [[ADR-0002-modelo-datos-mvp]]).

## Miembros (FastAPI, no Hasura)
Se gestionan desde `backend/app/miembros.py`:
- `GET /proyectos/{id}/miembros` — cualquier miembro (devuelve correos).
- `POST /proyectos/{id}/miembros` `{email, rol: colaborador|cliente}` — solo `responsable`; la persona debe estar ya registrada.
- `DELETE /proyectos/{id}/miembros/{user_id}` — solo `responsable`; no permite quitar al último responsable.

El JWT del usuario se valida reenviándolo a Nhost (no se guarda secreto JWT). El admin secret se usa solo en el servidor, para resolver correos y escribir en `proyecto_miembros`. Requiere `NHOST_*` y `CORS_ORIGINS` en el backend, y `VITE_API_URL`, `VITE_NHOST_SUBDOMAIN` y `VITE_NHOST_REGION` en el frontend.

## Fuera de la BD
El timeline de la pantalla principal (avance del plazo, filtro de estatus, tope de 3) se calcula en el navegador con los campos de `proyectos`; no hay tablas ni migraciones asociadas. Ver [[Funcionamiento-App]].
