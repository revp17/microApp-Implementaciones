# Base de datos (Nhost / Hasura)

Migraciones SQL numeradas, **idempotentes** (se pueden re-ejecutar). Estado actual: módulo 1 (Proyectos) y módulo 3 (Fases) aplicados; Tareas y Alertas aún no existen.

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
- `tests/test_fases_integracion.py` (las 9 pruebas de ADR-0003 §6 más 4 de la auditoría de seguridad; 17 casos con parámetros) sigue el mismo patrón con otros 5 usuarios `zz-prueba-impl-fases-*` (la suite completa hace 10 inicios de sesión). La prueba 9 re-ejecuta `db/002_fases.sql` dos veces (incluido el backfill, que no altera proyectos reales) y solo inspecciona proyectos de prueba. Solo: `pytest tests/test_fases_integracion.py -v`.
- Si el inicio de sesión de Nhost responde **429** (demasiados inicios de sesión seguidos), esperar unos minutos y repetir; la prueba de fases reintenta sola con espera.

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

## Módulo 3 · Fases (`002_fases.sql` + `aplicar.py`, ver [[ADR-0003-fases]])
Tabla `fases` (enum `estado_fase`: `pendiente|en_curso|completada`) y columna `proyectos.requiere_desarrollo` (bool, default `false`).

- **Plantilla fija** (en `crear_fases_proyecto`): orden 1 Levantamiento, 2 Diseño, 3 Configuración, 4 Desarrollo (solo si `requiere_desarrollo`), 5 Pruebas, 6 Capacitación, 7 Go-Live, 8 Cierre. Sin Desarrollo queda un hueco en 4. `clave` es el identificador estable.
- **Triggers:** al insertar un proyecto se crean sus fases (`proyectos_crear_fases`); al cambiar `requiere_desarrollo` se crea o borra Desarrollo (`proyectos_sync_desarrollo`). Desmarcar con Desarrollo con fechas o en estado distinto de Pendiente **falla y revierte todo el UPDATE** con el mensaje (Hasura, código `permission-error`): «Check constraint violation. No se puede quitar la fase Desarrollo porque ya tiene fechas o avance. Déjala en Pendiente y sin fechas e inténtalo de nuevo.» (se lanza con `errcode = check_violation` para que Hasura propague el texto). El borrado de Desarrollo es un `DELETE` condicional (Pendiente y sin fechas) en una sola sentencia, sin carrera con una edición concurrente de la fase. `fases_proteger` impide cambiar `proyecto_id`, `clave`, `nombre` u `orden`; `fases_tocar` actualiza `actualizado_en` solo si la fila cambió; `fases_evento` registra altas y bajas en `eventos` y `fases_evento_update` los cambios, solo si la fila cambió de verdad (un UPDATE sin cambios no deja evento).
- **Validaciones en BD:** `fecha_fin_plan` ≥ `fecha_inicio`; `unique (proyecto_id, orden)` y `(proyecto_id, clave)`.
- **Backfill:** al final del SQL, los proyectos existentes reciben sus 7 fases en Pendiente (re-ejecutable, no duplica, no toca fechas ni estado del proyecto). Esas altas quedan en `eventos` con `usuario_id` null.
- **Permisos del rol `user`:**
  - `fases` select: cualquier miembro (responsable, colaborador, cliente), vía `{proyecto: soy_miembro}`; todas las columnas.
  - `fases` update: **solo `responsable`** (filter y check `{proyecto: soy_responsable}`), **solo** `estado`, `fecha_inicio`, `fecha_fin_plan`. Sin permiso → `update_fases_by_pk` devuelve `null`.
  - Sin insert ni delete en `fases` (no existen `insert_fases*` ni `delete_fases*` en el esquema del rol `user`).
  - `proyectos`: `requiere_desarrollo` se añade a las columnas de insert, select y update (update sigue siendo solo del responsable).
- **Relaciones:** `fases.proyecto` (objeto) y `proyectos.fases` (array).

## Miembros (FastAPI, no Hasura)
Se gestionan desde `backend/app/miembros.py`:
- `GET /proyectos/{id}/miembros` — cualquier miembro (devuelve correos).
- `POST /proyectos/{id}/miembros` `{email, rol: colaborador|cliente}` — solo `responsable`; la persona debe estar ya registrada.
- `DELETE /proyectos/{id}/miembros/{user_id}` — solo `responsable`; no permite quitar al último responsable.

El JWT del usuario se valida reenviándolo a Nhost (no se guarda secreto JWT). El admin secret se usa solo en el servidor, para resolver correos y escribir en `proyecto_miembros`. Requiere `NHOST_*` y `CORS_ORIGINS` en el backend, y `VITE_API_URL`, `VITE_NHOST_SUBDOMAIN` y `VITE_NHOST_REGION` en el frontend.

## Fuera de la BD
El timeline de la pantalla principal (avance del plazo, filtro de estatus, tope de 3) se calcula en el navegador con los campos de `proyectos`; no hay tablas ni migraciones asociadas. Ver [[Funcionamiento-App]].
