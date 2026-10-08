-- Módulo 1 · Proyectos (ADR-0002). Idempotente: se puede re-ejecutar.
-- Aplicar con: python db/aplicar.py   (ver db/README.md)

do $$ begin
  create type public.rol_proyecto as enum ('responsable','colaborador','cliente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_proyecto as enum ('planificado','en_curso','pausado','cerrado');
exception when duplicate_object then null; end $$;

-- Usuario autenticado según Hasura (viaja en la variable de sesión `hasura.user`).
-- Es null para el admin secret sin x-hasura-user-id (jobs, scripts).
create or replace function public.usuario_actual() returns uuid
language sql stable as $$
  select nullif(nullif(current_setting('hasura.user', true), '')::json ->> 'x-hasura-user-id', '')::uuid
$$;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  creado_por uuid not null default public.usuario_actual() references auth.users(id),
  creado_en timestamptz not null default now()
);

create table if not exists public.proyectos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id),
  nombre text not null check (length(trim(nombre)) > 0),
  sistema text,
  fecha_inicio date,
  fecha_fin_plan date,
  estado public.estado_proyecto not null default 'planificado',
  creado_por uuid not null default public.usuario_actual() references auth.users(id),
  creado_en timestamptz not null default now(),
  check (fecha_fin_plan is null or fecha_inicio is null or fecha_fin_plan >= fecha_inicio)
);
create index if not exists proyectos_cliente_idx on public.proyectos (cliente_id);

create table if not exists public.proyecto_miembros (
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rol public.rol_proyecto not null,
  primary key (proyecto_id, user_id)
);
create index if not exists proyecto_miembros_user_idx on public.proyecto_miembros (user_id);

-- Trazabilidad mínima (transversal). Por ahora solo se engancha a proyectos.
create table if not exists public.eventos (
  id bigserial primary key,
  entidad text not null,
  entidad_id uuid not null,
  proyecto_id uuid,
  accion text not null,
  usuario_id uuid,
  antes jsonb,
  despues jsonb,
  creado_en timestamptz not null default now()
);
create index if not exists eventos_proyecto_idx on public.eventos (proyecto_id, creado_en desc);

-- creado_por nunca viene del cliente: si hay usuario en la sesión de Hasura, manda ese.
create or replace function public.fijar_creado_por() returns trigger
language plpgsql as $$
begin
  new.creado_por := coalesce(public.usuario_actual(), new.creado_por);
  return new;
end $$;

drop trigger if exists clientes_creado_por on public.clientes;
create trigger clientes_creado_por before insert on public.clientes
  for each row execute function public.fijar_creado_por();

drop trigger if exists proyectos_creado_por on public.proyectos;
create trigger proyectos_creado_por before insert on public.proyectos
  for each row execute function public.fijar_creado_por();

-- El creador queda como responsable.
create or replace function public.proyecto_agregar_creador() returns trigger
language plpgsql as $$
begin
  insert into public.proyecto_miembros (proyecto_id, user_id, rol)
  values (new.id, new.creado_por, 'responsable')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists proyectos_agregar_creador on public.proyectos;
create trigger proyectos_agregar_creador after insert on public.proyectos
  for each row execute function public.proyecto_agregar_creador();

create or replace function public.registrar_evento() returns trigger
language plpgsql as $$
declare
  fila jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.eventos (entidad, entidad_id, proyecto_id, accion, usuario_id, antes, despues)
  values (
    tg_table_name,
    (fila ->> 'id')::uuid,
    coalesce((fila ->> 'proyecto_id')::uuid, case when tg_table_name = 'proyectos' then (fila ->> 'id')::uuid end),
    lower(tg_op),
    public.usuario_actual(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

drop trigger if exists proyectos_evento on public.proyectos;
create trigger proyectos_evento after insert or update or delete on public.proyectos
  for each row execute function public.registrar_evento();

-- Límites de longitud (idempotente: se añaden también a tablas ya existentes).
do $$ begin
  alter table public.clientes  add constraint clientes_nombre_largo  check (length(nombre)  <= 200);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.proyectos add constraint proyectos_nombre_largo check (length(nombre)  <= 200);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.proyectos add constraint proyectos_sistema_largo check (length(sistema) <= 200);
exception when duplicate_object then null; end $$;
