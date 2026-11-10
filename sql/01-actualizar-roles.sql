-- Ejecutar después de 00 en una instalación nueva, o solo si ya instalaste 00.
begin;

create table if not exists lozano.roles (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$')
);
insert into lozano.roles (codigo) values ('administrador'), ('empleado')
on conflict (codigo) do nothing;

alter table lozano.roles enable row level security;
revoke all on lozano.roles from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'lozano' and table_name = 'perfiles' and column_name = 'administrador'
  ) then
    alter table lozano.perfiles add column rol text references lozano.roles(codigo);
    update lozano.perfiles
      set rol = case when administrador then 'administrador' else 'empleado' end;
    alter table lozano.perfiles alter column rol set not null;
    alter table lozano.perfiles drop column administrador;
  end if;
end $$;

create or replace function lozano.exigir_perfil(p_admin boolean default false)
returns lozano.perfiles language plpgsql stable set search_path = '' as $$
declare perfil lozano.perfiles;
begin
  select * into perfil from lozano.perfiles where id = auth.uid() and activo;
  if not found or (p_admin and perfil.rol <> 'administrador') then
    raise exception 'Acceso denegado para esta cuenta' using errcode = '42501';
  end if;
  return perfil;
end $$;

create or replace function public.lozano_leer()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  perfil lozano.perfiles;
  coleccion record;
  estado jsonb;
  datos jsonb;
  revision_actual bigint;
begin
  perfil := lozano.exigir_perfil();
  select revision, jsonb_build_object('ver', 1, 'conf', c.datos)
    into strict revision_actual, estado from lozano.configuracion c;

  for coleccion in select * from lozano.colecciones()
  loop
    execute format('select coalesce(jsonb_agg(datos order by posicion), ''[]'') from lozano.%I', coleccion.tabla)
      into datos;
    estado := estado || jsonb_build_object(coleccion.clave, datos);
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'nombre', nombre, 'rol', rol
  ) order by nombre, id), '[]') into datos from lozano.perfiles where activo;
  estado := estado || jsonb_build_object('usuarios', datos);

  select coalesce(jsonb_agg(jsonb_build_object(
    'ts', a.fecha, 'uid', a.actor, 'acc', a.accion, 'k', a.coleccion, 'txt', a.clave
  ) order by a.id), '[]') into datos
  from (select * from lozano.actividad order by id desc limit 3000) a;
  estado := estado || jsonb_build_object('log', datos);

  select coalesce(jsonb_agg(jsonb_build_object('id', actor, 'nombre', nombre_actor)), '[]')
    into datos from (
      select distinct on (actor) actor, nombre_actor
      from lozano.actividad order by actor, id desc
    ) a;
  estado := estado || jsonb_build_object('usuariosBaja', datos);

  return jsonb_build_object('revision', revision_actual, 'estado', estado,
    'perfil', jsonb_build_object('id', perfil.id, 'nombre', perfil.nombre, 'rol', perfil.rol));
end $$;

commit;
