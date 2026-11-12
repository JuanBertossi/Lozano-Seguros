-- Ejecutar en el SQL Editor de Supabase. Los borradores anteriores no son dependencias.
begin;

create schema agencia;
revoke all on schema agencia from public, anon, authenticated;

create table agencia.roles (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$')
);
insert into agencia.roles (codigo) values ('administrador'), ('empleado');

create table agencia.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  rol text not null references agencia.roles(codigo),
  activo boolean not null default true
);

create table agencia.configuracion (
  unica boolean primary key default true check (unica),
  revision bigint not null default 0,
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);
insert into agencia.configuracion(datos) values (
  '{"nombre":"","q6Precio":4000,"q6Dias":[3,0],"fracPrecio":10000,"rifaImporte":17000,"rifaCuotas":10}'
);

-- Se conserva el formato de cada registro del HTML. Cuotas y aplicaciones
-- permanecen dentro de su registro de origen, junto con sus referencias históricas.
create table agencia.socios (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);

create table agencia.seguros (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);

create table agencia.quini_sorteos_especiales (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);

create table agencia.quini_jugadas (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);

create table agencia.quini_exclusiones (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'string')
);

create table agencia.cobros (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);

create table agencia.loteria_sorteos (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);

create table agencia.loteria_ventas (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);

create table agencia.loteria_ofertas (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);

create table agencia.quiniela_jugadas (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);

create table agencia.rifas (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);

create table agencia.toto_planillas (
  clave text primary key,
  posicion bigint not null check (posicion > 0),
  datos jsonb not null check (jsonb_typeof(datos) = 'object')
);

create table agencia.actividad (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default clock_timestamp(),
  actor uuid not null,
  nombre_actor text not null,
  coleccion text not null,
  clave text not null,
  accion text not null check (accion in ('Creó','Modificó','Eliminó'))
);

create table agencia.operaciones (
  id uuid primary key,
  actor uuid not null,
  revision bigint not null unique,
  revision_anterior bigint not null,
  huella text not null
);

do $$
declare tabla text;
begin
  for tabla in select tablename from pg_catalog.pg_tables where schemaname = 'agencia'
  loop
    execute format('alter table agencia.%I enable row level security', tabla);
  end loop;
end $$;

create function agencia.exigir_perfil(p_admin boolean default false)
returns agencia.perfiles language plpgsql stable set search_path = '' as $$
declare perfil agencia.perfiles;
begin
  select * into perfil from agencia.perfiles where id = auth.uid() and activo;
  if not found or (p_admin and perfil.rol <> 'administrador') then
    raise exception 'Acceso denegado para esta cuenta' using errcode = '42501';
  end if;
  return perfil;
end $$;

create function agencia.colecciones()
returns table (clave text, tabla text) language sql immutable set search_path = '' as $$
  values ('socios', 'socios'),
         ('seguros', 'seguros'),
         ('q6esp', 'quini_sorteos_especiales'),
         ('q6', 'quini_jugadas'),
         ('q6skip', 'quini_exclusiones'),
         ('cobros', 'cobros'),
         ('sorteos', 'loteria_sorteos'),
         ('lot', 'loteria_ventas'),
         ('ofertas', 'loteria_ofertas'),
         ('quiniela', 'quiniela_jugadas'),
         ('rifas', 'rifas'),
         ('toto', 'toto_planillas');
$$;

create function agencia.filas(p_clave text, p_datos jsonb)
returns table (clave text, posicion bigint, datos jsonb)
language sql immutable set search_path = '' as $$
  select case p_clave
           when 'q6skip' then orden::text
           when 'ofertas' then jsonb_build_array(registro->>'soId', registro->>'sid')::text
           else registro->>'id'
         end,
         orden, registro
  from jsonb_array_elements(p_datos) with ordinality as e(registro, orden);
$$;

create function public.agencia_leer()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  perfil agencia.perfiles;
  coleccion record;
  estado jsonb;
  datos jsonb;
  revision_actual bigint;
begin
  perfil := agencia.exigir_perfil();
  select revision, jsonb_build_object('ver', 1, 'conf', c.datos)
    into strict revision_actual, estado from agencia.configuracion c;

  for coleccion in select * from agencia.colecciones()
  loop
    execute format('select coalesce(jsonb_agg(datos order by posicion), ''[]'') from agencia.%I', coleccion.tabla)
      into datos;
    estado := estado || jsonb_build_object(coleccion.clave, datos);
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'nombre', nombre, 'rol', rol
  ) order by nombre, id), '[]') into datos from agencia.perfiles where activo;
  estado := estado || jsonb_build_object('usuarios', datos);

  select coalesce(jsonb_agg(jsonb_build_object(
    'ts', a.fecha, 'uid', a.actor, 'acc', a.accion, 'k', a.coleccion, 'txt', a.clave
  ) order by a.id), '[]') into datos
  from (select * from agencia.actividad order by id desc limit 3000) a;
  estado := estado || jsonb_build_object('log', datos);

  select coalesce(jsonb_agg(jsonb_build_object('id', actor, 'nombre', nombre_actor)), '[]')
    into datos from (
      select distinct on (actor) actor, nombre_actor
      from agencia.actividad order by actor, id desc
    ) a;
  estado := estado || jsonb_build_object('usuariosBaja', datos);

  return jsonb_build_object('revision', revision_actual, 'estado', estado,
    'perfil', jsonb_build_object('id', perfil.id, 'nombre', perfil.nombre, 'rol', perfil.rol));
end $$;

create function agencia.persistir(
  p_revision bigint, p_operacion uuid, p_estado jsonb, p_importar boolean
) returns bigint language plpgsql set search_path = '' as $$
declare
  perfil agencia.perfiles;
  coleccion record;
  datos jsonb;
  revision_actual bigint;
  guardada agencia.operaciones;
  huella_actual text;
begin
  perfil := agencia.exigir_perfil(p_importar);
  if p_operacion is null or p_revision is null or
     jsonb_typeof(p_estado) is distinct from 'object' or
     jsonb_typeof(p_estado->'conf') is distinct from 'object' then
    raise exception 'Estado, configuración, revisión u operación inválidos' using errcode = '22023';
  end if;

  select revision into strict revision_actual from agencia.configuracion for update;
  huella_actual := encode(sha256(convert_to(jsonb_build_array(p_importar, p_estado)::text, 'UTF8')), 'hex');
  select * into guardada from agencia.operaciones where id = p_operacion;
  if found then
    if guardada.actor <> perfil.id or guardada.revision_anterior <> p_revision or guardada.huella <> huella_actual then
      raise exception 'El identificador de operación ya fue utilizado' using errcode = '22023';
    end if;
    return guardada.revision;
  end if;
  if p_revision <> revision_actual then
    raise exception 'Los datos cambiaron. Volvé a cargarlos antes de guardar.' using errcode = '40001';
  end if;

  for coleccion in select * from agencia.colecciones()
  loop
    datos := p_estado->coleccion.clave;
    if jsonb_typeof(datos) is distinct from 'array' then
      raise exception 'La colección % debe ser una lista', coleccion.clave using errcode = '22023';
    end if;
    if exists (
      select 1 from agencia.filas(coleccion.clave, datos) f
      where f.clave is null or f.clave = ''
        or (coleccion.clave not in ('ofertas', 'q6skip') and f.clave !~ '^[a-zA-Z0-9_-]{1,128}$')
        or (coleccion.clave = 'ofertas' and
            (coalesce(f.datos->>'sid','') !~ '^[a-zA-Z0-9_-]{1,128}$'
             or coalesce(f.datos->>'soId','') !~ '^[a-zA-Z0-9_-]{1,128}$'))
    ) then
      raise exception 'Identificador inválido en %', coleccion.clave using errcode = '22023';
    end if;
    if exists (
      select 1 from agencia.filas(coleccion.clave, datos) f
      group by f.clave having count(*) > 1
    ) then
      raise exception 'Identificadores duplicados en %', coleccion.clave using errcode = '22023';
    end if;

    execute format($sql$
      insert into agencia.actividad(actor, nombre_actor, coleccion, clave, accion)
      select $3, $4, $1, coalesce(nuevo.clave, anterior.clave),
        case when anterior.clave is null then 'Creó'
             when nuevo.clave is null then 'Eliminó'
             else 'Modificó' end
      from agencia.%1$I anterior
      full join agencia.filas($1, $2) nuevo using (clave)
      where anterior.datos is distinct from nuevo.datos
    $sql$, coleccion.tabla) using coleccion.clave, datos, perfil.id, perfil.nombre;

    execute format($sql$
      delete from agencia.%I anterior
      where not exists (select 1 from agencia.filas($1, $2) nuevo where nuevo.clave = anterior.clave)
    $sql$, coleccion.tabla) using coleccion.clave, datos;

    execute format($sql$
      insert into agencia.%I as anterior (clave, posicion, datos)
      select clave, posicion, datos from agencia.filas($1, $2)
      on conflict (clave) do update set posicion = excluded.posicion, datos = excluded.datos
      where (anterior.posicion, anterior.datos) is distinct from (excluded.posicion, excluded.datos)
    $sql$, coleccion.tabla) using coleccion.clave, datos;
  end loop;

  insert into agencia.actividad(actor, nombre_actor, coleccion, clave, accion)
    select perfil.id, perfil.nombre, 'ajustes', 'Configuración', 'Modificó'
    from agencia.configuracion c where c.datos is distinct from p_estado->'conf';

  update agencia.configuracion set datos = p_estado->'conf', revision = revision + 1
    returning revision into revision_actual;
  insert into agencia.operaciones(id, actor, revision, revision_anterior, huella)
    values (p_operacion, perfil.id, revision_actual, p_revision, huella_actual);
  return revision_actual;
end $$;

-- Guardado normal. El cliente envía el resultado completo de la operación
-- con la revisión que leyó. Postgres aplica todas las colecciones o ninguna.
create function public.agencia_guardar(p_revision bigint, p_operacion uuid, p_estado jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
begin
  perform agencia.exigir_perfil(true);
  return agencia.persistir(p_revision, p_operacion, p_estado, false);
end;
$$;

-- Restauración de un respaldo o reinicio con colecciones vacías.
create function public.agencia_restaurar(p_revision bigint, p_operacion uuid, p_estado jsonb)
returns bigint language sql security definer set search_path = '' as $$
  select agencia.persistir(p_revision, p_operacion, p_estado, true);
$$;

revoke all on all tables in schema agencia from public, anon, authenticated;
revoke all on all functions in schema agencia from public, anon, authenticated;
revoke all on function public.agencia_leer(),
  public.agencia_guardar(bigint, uuid, jsonb),
  public.agencia_restaurar(bigint, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.agencia_leer(),
  public.agencia_guardar(bigint, uuid, jsonb),
  public.agencia_restaurar(bigint, uuid, jsonb) to authenticated;

commit;
