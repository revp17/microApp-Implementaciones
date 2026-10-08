# Base de datos (Nhost / Hasura)

Migraciones SQL numeradas, **idempotentes** (se pueden re-ejecutar).

## Aplicar
```bash
export NHOST_SUBDOMAIN=... NHOST_REGION=... NHOST_ADMIN_SECRET=...   # solo en el entorno, nunca en el repo
python db/aplicar.py
```
Ejecuta `db/[0-9]*.sql` en orden (`/v2/query`) y registra en Hasura (`/v1/metadata`) tablas, relaciones y permisos del rol `user`. Solo usa la librería estándar de Python.

## Probar permisos (contra Hasura real)
```bash
cd backend && pytest tests/test_permisos_integracion.py -v
```
Crea 3 usuarios `zz-prueba-impl-*@example.com` (los verifica por SQL admin porque Nhost exige email verificado), ejercita permisos y **borra todo** al terminar. Se salta si faltan las variables `NHOST_*`.

## Módulo 1 · Proyectos (`001_proyectos.sql`)
- `creado_por` nunca lo envía el cliente: el permiso Hasura lo fija con `X-Hasura-User-Id` (preset) y, como defensa extra, un trigger lo sobrescribe con `hasura.user` si existe.
- Al crear un proyecto, un trigger añade al creador como `responsable`.
- Permisos: miembros ven el proyecto; solo `responsable` lo actualiza (columnas de datos generales y estado); cualquier usuario autenticado crea clientes y proyectos (el cliente debe ser visible para él); clientes visibles si los creó o es miembro de un proyecto de ese cliente.
- No hay delete para el rol `user`. Añadir/quitar miembros aún no tiene UI ni permiso (se hace por SQL admin).
- `eventos` registra insert/update/delete de `proyectos`.
- Nhost exige email verificado para iniciar sesión: tras registrarse, el usuario debe confirmar el correo.

## Miembros (FastAPI)
Los miembros se gestionan desde `backend/app/miembros.py` (`GET/POST /proyectos/{id}/miembros`, `DELETE /proyectos/{id}/miembros/{user_id}`), no desde Hasura. Requiere `NHOST_*` en el entorno del backend y `VITE_API_URL` en el frontend. Ver [[ADR-0002-modelo-datos-mvp]].
