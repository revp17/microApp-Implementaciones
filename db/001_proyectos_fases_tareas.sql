-- Modelo MVP: Proyectos, Fases, Tareas (ver vault/01-Decisiones/ADR-0002-modelo-datos.md)
-- Compatible con Nhost (Postgres). auth.users lo provee Nhost.

create table proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cliente text not null,
  sistema text,                       -- ERP / sistema a implementar
  fecha_inicio date,
  fecha_fin_plan date,
  estado text not null default 'planificado'
    check (estado in ('planificado','en_curso','pausado','cerrado')),
  responsable_id uuid,                -- auth.users.id
  creado_en timestamptz not null default now(),
  check (fecha_fin_plan is null or fecha_inicio is null or fecha_fin_plan >= fecha_inicio)
);

create table fases (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos(id) on delete cascade,
  nombre text not null,
  orden int not null,
  fecha_inicio date,
  fecha_fin date,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','en_curso','completada')),
  unique (proyecto_id, orden)
);

create table tareas (
  id uuid primary key default gen_random_uuid(),
  fase_id uuid not null references fases(id) on delete cascade,
  titulo text not null,
  descripcion text,
  responsable_id uuid,                -- auth.users.id
  fecha_limite date,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','en_curso','bloqueada','completada')),
  motivo_bloqueo text,
  creado_en timestamptz not null default now(),
  check (estado <> 'bloqueada' or motivo_bloqueo is not null)
);

create index on fases (proyecto_id);
create index on tareas (fase_id);
create index on tareas (responsable_id);
create index on tareas (fecha_limite) where estado <> 'completada';

-- Alertas (MVP): tareas vencidas o bloqueadas
create view tareas_en_alerta as
select t.*, f.proyecto_id,
       case when t.estado = 'bloqueada' then 'bloqueada' else 'vencida' end as alerta
from tareas t join fases f on f.id = t.fase_id
where t.estado = 'bloqueada'
   or (t.estado <> 'completada' and t.fecha_limite < current_date);
