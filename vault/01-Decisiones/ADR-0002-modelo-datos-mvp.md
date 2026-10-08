# ADR-0002 — Modelo de datos y límites de servicio del MVP

- Estado: propuesta · Fecha: 2026-10-09

## Contexto
MVP = Proyectos, Fases, Tareas y Alertas ([[Modulos]] 1, 3, 4, 12). Stack según [[ADR-0001-stack]]. Roles según [[Roles]]. Escala esperada: decenas de proyectos, cientos de tareas por proyecto, <50 usuarios. No hay requisitos de latencia ni disponibilidad que justifiquen más que un Postgres gestionado.

Supuestos (a confirmar en [[Preguntas-abiertas]]):
- Multi-proyecto y multi-cliente desde el inicio (coste marginal bajo: una tabla `clientes` y una FK).
- Fases con plantilla fija (7 fases de [[Modulos]]); sin plantillas editables todavía.
- Alertas por email con reglas fijas; configurables más adelante.

## Decisión

### 1. Límites de servicio
```
React ──GraphQL (JWT del usuario)──► Nhost Hasura ──► Postgres
                                         ▲
Render Cron ──POST /jobs/alertas──► FastAPI ──(admin secret)──┘
                                      └──► SMTP
```
- **CRUD (proyectos, fases, tareas): el frontend habla directo con Nhost GraphQL.** La seguridad la imponen los permisos de fila de Hasura, no el código. Evita escribir un CRUD duplicado en FastAPI.
- **FastAPI solo para lo que necesita secretos o proceso en servidor:** job de alertas y envío de email. Usa el admin secret solo ahí.
- El job lo dispara un Render Cron Job con un token compartido (`JOBS_TOKEN`, solo en variables de entorno).

### 2. Modelo de datos (Postgres, schema `public`)
```sql
create type rol_proyecto   as enum ('responsable','colaborador','cliente');
create type estado_proyecto as enum ('planificado','en_curso','pausado','cerrado');
create type estado_fase    as enum ('pendiente','en_curso','completada');
create type estado_tarea   as enum ('pendiente','en_curso','bloqueada','hecha');
create type tipo_alerta    as enum ('por_vencer','vencida','bloqueada');
create type estado_alerta  as enum ('pendiente','enviada','fallida');

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_en timestamptz not null default now()
);

create table proyectos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  nombre text not null,
  sistema text,                       -- ERP / sistema a implementar
  fecha_inicio date,
  fecha_fin_plan date,
  estado estado_proyecto not null default 'planificado',
  creado_por uuid not null references auth.users(id),
  creado_en timestamptz not null default now()
);

create table proyecto_miembros (
  proyecto_id uuid references proyectos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  rol rol_proyecto not null,
  primary key (proyecto_id, user_id)
);

create table fases (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  nombre text not null,
  orden int not null,
  fecha_inicio date, fecha_fin date,
  estado estado_fase not null default 'pendiente',
  unique (proyecto_id, orden)
);

create table tareas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade, -- desnormalizado: simplifica permisos
  fase_id uuid not null references fases(id) on delete cascade,
  titulo text not null,
  descripcion text,
  responsable_id uuid references auth.users(id),
  fecha_inicio date,
  fecha_vencimiento date,
  estado estado_tarea not null default 'pendiente',
  motivo_bloqueo text,
  check (estado <> 'bloqueada' or motivo_bloqueo is not null),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on tareas (proyecto_id, estado);
create index on tareas (fecha_vencimiento) where estado <> 'hecha';

create table tarea_dependencias (
  tarea_id uuid references tareas(id) on delete cascade,
  depende_de_id uuid references tareas(id) on delete cascade,
  primary key (tarea_id, depende_de_id),
  check (tarea_id <> depende_de_id)
);

create table alertas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  tarea_id uuid not null references tareas(id) on delete cascade,
  destinatario_id uuid not null references auth.users(id),
  tipo tipo_alerta not null,
  dia date not null default current_date,
  estado estado_alerta not null default 'pendiente',
  enviada_en timestamptz,
  error text,
  unique (tarea_id, destinatario_id, tipo, dia)   -- idempotencia: 1 alerta/día
);

-- Trazabilidad transversal (se llena con triggers en proyectos, fases, tareas)
create table eventos (
  id bigserial primary key,
  entidad text not null,
  entidad_id uuid not null,
  proyecto_id uuid,
  accion text not null,               -- insert | update | delete
  usuario_id uuid,                    -- de current_setting('hasura.user') o null si job
  antes jsonb, despues jsonb,
  creado_en timestamptz not null default now()
);
```
- Al insertar un proyecto, un trigger crea las 7 fases por defecto (levantamiento, diseño, configuración, pruebas, capacitación, Go-Live, cierre) y añade al creador como `responsable`.
- `actualizado_en` y `eventos` se mantienen con triggers.

### 3. Permisos (Hasura, por pertenencia a `proyecto_miembros`)
| Rol en proyecto | proyectos | fases / tareas | alertas | eventos |
|---|---|---|---|---|
| responsable | select, update | todo | select | select |
| colaborador | select | select; update solo `estado`, `motivo_bloqueo` de sus tareas | select propias | select |
| cliente | select | solo select | — | — |

Regla común de fila: `proyecto_id` ∈ proyectos donde el usuario es miembro. Crear proyecto: cualquier usuario autenticado con rol Hasura `user` (queda como responsable). Aprobaciones del cliente quedan fuera del MVP.

### 4. Alertas (job diario)
`POST /jobs/alertas` (FastAPI, header `Authorization: Bearer $JOBS_TOKEN`):
1. Selecciona tareas con `estado <> 'hecha'` y: `fecha_vencimiento < hoy` → `vencida`; `fecha_vencimiento` entre hoy y hoy+2 → `por_vencer`; `estado = 'bloqueada'` → `bloqueada`.
2. Destinatarios: `responsable_id` de la tarea + responsables del proyecto.
3. `insert … on conflict do nothing` en `alertas` (idempotente; reintentos seguros).
4. Envía los `pendiente` por SMTP; marca `enviada` o `fallida` con el error. Un fallo no detiene el resto.

## Consecuencias
- Menos código de backend y una sola fuente de verdad de permisos (Hasura). Coste: la lógica de negocio que no cabe en permisos o triggers hay que meterla en FastAPI vía Hasura Actions o endpoints; hoy no hay ninguna.
- Desnormalizar `proyecto_id` en `tareas` evita joins en cada permiso; hay que garantizar por trigger que coincida con `fases.proyecto_id`.
- Alertas por polling diario: simple y reintentable, pero con latencia de hasta 24 h. Si se necesitan avisos inmediatos, usar Hasura Event Triggers sobre `tareas`.
- `eventos` crece sin límite; aceptable al volumen previsto.

## A revisar al crecer
- Plantillas de fases/tareas editables (hoy fijas en el trigger).
- Umbrales y destinatarios de alerta configurables por proyecto.
- Aprobación del cliente y evidencias en Nhost Storage (módulo Pruebas).
- Canales WhatsApp/Telegram: añadir `canal` a `alertas`.
- Particionar o archivar `eventos`.

## Notas de implementación (módulo 1 · Proyectos, 2026-10-09)
Implementado en `db/001_proyectos.sql` + `db/aplicar.py` (ver `db/README.md`). Estado de esta ADR sigue en propuesta. Cambios respecto al diseño:
- `clientes` gana `creado_por` (not null, FK a `auth.users`): necesario para que quien crea un cliente lo vea antes de tener un proyecto con él.
- `creado_por` (clientes y proyectos) se fija con preset de Hasura (`X-Hasura-User-Id`) + trigger `fijar_creado_por` que lo sobrescribe con `hasura.user`; además tiene `default usuario_actual()`. El campo no existe en el input del rol `user`.
- Función auxiliar `usuario_actual()` (lee `hasura.user`); se reutilizará en `eventos` y en los demás triggers.
- Checks añadidos: `nombre` no vacío y `fecha_fin_plan >= fecha_inicio`.
- Insertar proyecto exige que el `cliente_id` sea visible para el usuario (evita colgar proyectos de clientes ajenos adivinando un uuid).
- `eventos` y su trigger `registrar_evento()` existen ya, enganchados solo a `proyectos`. Permiso de lectura: miembros del proyecto (en este módulo todos los roles; el ADR dice responsable/colaborador, el rol `cliente` queda sin acceso cuando se implemente su UI).
- Aún sin: trigger de 7 fases (módulo Fases), tablas de tareas/alertas, alta de miembros desde la UI, delete de proyectos.
- Nhost exige email verificado: el registro no devuelve sesión hasta confirmar el correo.

### Ajustes tras auditoría (módulo 1)
- **Gestión de miembros en FastAPI** (primer uso del servidor, cumple [[ADR-0001-stack]]): `GET/POST /proyectos/{id}/miembros` y `DELETE /proyectos/{id}/miembros/{user_id}`. El JWT no se valida localmente: se reenvía a Nhost (`/v1/user` y GraphQL con ese token) para comprobar que el usuario es miembro/`responsable`. Con el admin secret (solo en servidor) se resuelve el email y se escribe en `proyecto_miembros`; el rol `user` de Hasura sigue sin permisos de escritura sobre miembros. Solo se asignan `colaborador` y `cliente`; no se puede quitar al último `responsable` ni hay cambio de roles. Un no-miembro recibe 404 (no se revela si el proyecto existe). Quien es responsable sí puede saber si un correo está registrado (404 en el alta): coste aceptado para dar un error claro.
- Checks de longitud: `nombre` y `sistema` <= 200.
- `eventos`: lectura solo para `responsable` y `colaborador` (excluye `cliente`, §3).
- Insertar un proyecto con un cliente existente exige haber creado ese cliente o ser `responsable` de algún proyecto suyo (antes bastaba verlo).
- **Riesgo conocido: registro abierto.** Nhost permite que cualquiera se registre; un usuario registrado puede crear clientes/proyectos propios (sin ver nada ajeno) y consumir almacenamiento. Política sin cambios por ahora; mitigar más adelante (registro por invitación, límites o desactivar signup).
