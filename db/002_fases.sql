-- Módulo 3 · Fases (ADR-0003). Idempotente: se puede re-ejecutar.
-- Aplicar con: python db/aplicar.py   (ver db/README.md)

do $$ begin
  create type public.estado_fase as enum ('pendiente','en_curso','completada');
exception when duplicate_object then null; end $$;

alter table public.proyectos
  add column if not exists requiere_desarrollo boolean not null default false;

create table if not exists public.fases (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  clave text not null check (clave in ('levantamiento','diseno','configuracion','desarrollo',
                                       'pruebas','capacitacion','go_live','cierre')),
  nombre text not null,
  orden int not null,
  fecha_inicio date,
  fecha_fin_plan date,
  estado public.estado_fase not null default 'pendiente',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (proyecto_id, orden),
  unique (proyecto_id, clave),
  check (fecha_fin_plan is null or fecha_inicio is null or fecha_fin_plan >= fecha_inicio)
);
create index if not exists fases_proyecto_idx on public.fases (proyecto_id, orden);

-- Plantilla fija. Desarrollo (orden 4) solo si el proyecto lo requiere; si no, queda el hueco.
create or replace function public.crear_fases_proyecto(p public.proyectos) returns void
language plpgsql as $$
begin
  insert into public.fases (proyecto_id, orden, clave, nombre)
  select p.id, t.orden, t.clave, t.nombre
  from (values
    (1, 'levantamiento', 'Levantamiento'),
    (2, 'diseno',        'Diseño'),
    (3, 'configuracion', 'Configuración'),
    (4, 'desarrollo',    'Desarrollo'),
    (5, 'pruebas',       'Pruebas'),
    (6, 'capacitacion',  'Capacitación'),
    (7, 'go_live',       'Go-Live'),
    (8, 'cierre',        'Cierre')
  ) as t(orden, clave, nombre)
  where t.clave <> 'desarrollo' or p.requiere_desarrollo
  order by t.orden
  on conflict (proyecto_id, orden) do nothing;
end $$;

-- Todo proyecto nuevo nace con sus fases.
create or replace function public.proyectos_crear_fases() returns trigger
language plpgsql as $$
begin
  perform public.crear_fases_proyecto(new);
  return null;
end $$;

drop trigger if exists proyectos_crear_fases on public.proyectos;
create trigger proyectos_crear_fases after insert on public.proyectos
  for each row execute function public.proyectos_crear_fases();

-- La fase Desarrollo existe solo si proyectos.requiere_desarrollo. Al desmarcar se bloquea
-- (y se revierte todo el UPDATE) si la fase ya tiene fechas o avance.
-- El borrado es condicional en una sola sentencia: si otra transacción está cambiando la fase,
-- el DELETE espera su bloqueo y re-evalúa el WHERE con la fila ya confirmada (sin carrera).
create or replace function public.proyectos_sync_desarrollo() returns trigger
language plpgsql as $$
begin
  if new.requiere_desarrollo then
    insert into public.fases (proyecto_id, orden, clave, nombre)
    values (new.id, 4, 'desarrollo', 'Desarrollo')
    on conflict do nothing;
  else
    delete from public.fases
    where proyecto_id = new.id and clave = 'desarrollo'
      and estado = 'pendiente' and fecha_inicio is null and fecha_fin_plan is null;
    if not found and exists (select 1 from public.fases where proyecto_id = new.id and clave = 'desarrollo') then
      -- check_violation (23514): Hasura propaga el texto al cliente aunque no esté en modo dev
      -- (P0001, el código por defecto, llega solo como 'database query error').
      raise exception 'No se puede quitar la fase Desarrollo porque ya tiene fechas o avance. Déjala en Pendiente y sin fechas e inténtalo de nuevo.'
        using errcode = 'check_violation';
    end if;
  end if;
  return null;
end $$;

drop trigger if exists proyectos_sync_desarrollo on public.proyectos;
create trigger proyectos_sync_desarrollo after update of requiere_desarrollo on public.proyectos
  for each row when (old.requiere_desarrollo is distinct from new.requiere_desarrollo)
  execute function public.proyectos_sync_desarrollo();

-- Defensa en profundidad: Hasura ya no expone estas columnas en el update.
create or replace function public.fases_proteger() returns trigger
language plpgsql as $$
begin
  if new.proyecto_id is distinct from old.proyecto_id or new.clave is distinct from old.clave
     or new.nombre is distinct from old.nombre or new.orden is distinct from old.orden then
    raise exception 'Las fases no se pueden renombrar, mover ni reordenar';
  end if;
  return new;
end $$;

drop trigger if exists fases_proteger on public.fases;
create trigger fases_proteger before update on public.fases
  for each row execute function public.fases_proteger();

-- actualizado_en solo avanza si algo cambió de verdad (un UPDATE sin cambios deja la fila idéntica).
create or replace function public.fases_tocar() returns trigger
language plpgsql as $$
begin
  if new is distinct from old then
    new.actualizado_en := now();
  end if;
  return new;
end $$;

drop trigger if exists fases_tocar on public.fases;
create trigger fases_tocar before update on public.fases
  for each row execute function public.fases_tocar();

-- Eventos: altas y bajas siempre; cambios solo si la fila cambió (sin ruido por UPDATE sin cambios).
drop trigger if exists fases_evento on public.fases;
create trigger fases_evento after insert or delete on public.fases
  for each row execute function public.registrar_evento();

drop trigger if exists fases_evento_update on public.fases;
create trigger fases_evento_update after update on public.fases
  for each row when (old.* is distinct from new.*) execute function public.registrar_evento();

-- Backfill: proyectos existentes reciben sus fases en Pendiente (no duplica al re-ejecutar).
select public.crear_fases_proyecto(p) from public.proyectos p;
