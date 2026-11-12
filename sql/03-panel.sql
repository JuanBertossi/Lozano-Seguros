-- Lecturas y operaciones de cada pantalla del panel (sin runtime en el navegador).
-- Requiere 00-lozano-supabase.sql, 01-actualizar-roles.sql y 002-procedimientos.sql.
-- Los permisos de ejecución se dan en un solo lugar: 04-permisos.sql.
-- Se puede ejecutar más de una vez.
begin;

-- ============================================================
-- Nombres de usuarios (para «Cargó / editó»)
-- ============================================================
-- Un registro por usuario con su último nombre conocido, aunque ya no tenga perfil activo.
-- Reemplaza a buscar en el historial (`actividad`), que crece con cada cambio, una vez por fila de cada listado.
create table if not exists agencia.actores (
  actor text primary key,
  nombre text not null
);
alter table agencia.actores enable row level security;
revoke all on agencia.actores from public, anon, authenticated;

create or replace function agencia.registrar_actor() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into agencia.actores (actor, nombre) values (new.actor::text, new.nombre_actor)
  on conflict (actor) do update set nombre = excluded.nombre;
  return new;
end $$;

drop trigger if exists actividad_registrar_actor on agencia.actividad;
create trigger actividad_registrar_actor after insert on agencia.actividad
  for each row execute function agencia.registrar_actor();

insert into agencia.actores (actor, nombre)
select distinct on (actor) actor::text, nombre_actor from agencia.actividad order by actor, id desc
on conflict (actor) do update set nombre = excluded.nombre;

-- ============================================================
-- Sesión
-- ============================================================

create or replace function public.agencia_sesion()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  perfil agencia.perfiles;
  revision_actual bigint;
begin
  perfil := agencia.exigir_perfil();
  select revision into strict revision_actual from agencia.configuracion;
  return jsonb_build_object(
    'revision', revision_actual,
    'perfil', jsonb_build_object('id', perfil.id, 'nombre', perfil.nombre, 'rol', perfil.rol)
  );
end $$;

-- ============================================================
-- Socios
-- ============================================================

create or replace function public.agencia_socio_ficha(p_revision bigint, p_socio_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  perfil agencia.perfiles;
  revision_actual bigint;
  preferencia text;
  registro jsonb;
  usuarios jsonb;
begin
  perfil := agencia.exigir_perfil();
  if p_revision is null or coalesce(p_socio_id, '') !~ '^[a-zA-Z0-9_-]{1,128}$' then
    raise exception 'Datos de consulta inválidos' using errcode = '22023';
  end if;
  select revision, case datos->>'wsp' when 'web' then 'web' else 'app' end
    into strict revision_actual, preferencia from agencia.configuracion;
  if revision_actual <> p_revision then
    raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001';
  end if;
  select datos into registro from agencia.socios where clave = p_socio_id;
  if registro is null then return null; end if;
  -- Un usuario dado de baja conserva el último nombre con el que dejó actividad; el perfil activo manda.
  select coalesce(jsonb_object_agg(u.id, u.nombre), '{}'::jsonb) into usuarios from (
    select distinct on (t.id) t.id, t.nombre from (
      select p.id::text as id, p.nombre, 0 as origen, 0::bigint as orden
        from agencia.perfiles p where p.activo
      union all
      select n.actor, n.nombre, 1, 0::bigint from agencia.actores n
    ) t order by t.id, t.origen, t.orden
  ) u;
  return jsonb_build_object('socio', registro, 'usuarios', usuarios, 'wsp', preferencia, 'firma', perfil.nombre);
end $$;

-- Procedures de 002 que usan estas pantallas.

-- ============================================================
-- Cobros y pagos
-- ============================================================

create or replace function agencia.titulo_concepto_cobro(p_estado jsonb, p_concepto jsonb)
returns text language plpgsql stable set search_path = '' as $$
declare
  tipo text := p_concepto->>'t';
  clave text := p_concepto->'ref'->>1;
  indice integer := coalesce((p_concepto->'ref'->>2)::integer, 0);
  registro jsonb;
  sorteo jsonb;
  cuotas jsonb;
  numero text;
begin
  if tipo = 'seg' then
    select value into registro from jsonb_array_elements(coalesce(p_estado->'seguros','[]'::jsonb)) x(value)
      where value->>'id' = clave;
    cuotas := coalesce(registro->'cuotas','[]'::jsonb);
    numero := coalesce(cuotas->indice->>'n', (indice+1)::text);
    return 'Seguro ' || coalesce(registro->>'desc','') || ' · '
      || case when jsonb_array_length(cuotas) > 1 then 'cuota ' || numero || ' de ' || jsonb_array_length(cuotas) else 'contado' end;
  elsif tipo = 'q6' then
    select value into registro from jsonb_array_elements(coalesce(p_estado->'q6','[]'::jsonb)) x(value)
      where value->>'id' = clave;
    return 'Jugó Quini 6' || case when exists(
      select 1 from agencia.quini_sorteos_especiales e where e.datos->>'fecha' = registro->>'fecha'
    ) then ' · sorteo especial *' else '' end;
  elsif tipo = 'lot' then
    select value into registro from jsonb_array_elements(coalesce(p_estado->'lot','[]'::jsonb)) x(value)
      where value->>'id' = clave;
    select value into sorteo from jsonb_array_elements(coalesce(p_estado->'sorteos','[]'::jsonb)) x(value)
      where value->>'id' = registro->>'soId';
    return 'Compró el N° ' || coalesce(registro->>'numero','') || ' · ' || coalesce(nullif(sorteo->>'nombre',''),'Lotería');
  elsif tipo = 'qui' then
    select value into registro from jsonb_array_elements(coalesce(p_estado->'quiniela','[]'::jsonb)) x(value)
      where value->>'id' = clave;
    return 'Jugó quiniela · ' || coalesce(registro->>'numeros','');
  elsif tipo = 'rifa' then
    select value into registro from jsonb_array_elements(coalesce(p_estado->'rifas','[]'::jsonb)) x(value)
      where value->>'id' = clave;
    return 'Rifa Devoto N° ' || coalesce(registro->>'nro','') || ' · '
      || case when registro->>'modo' = 'contado' then 'contado'
              else 'cuota ' || (indice+1) || ' de ' || coalesce(registro->>'ncuotas','') end;
  end if;
  return '';
end $$;

-- Todo lo que necesita el diálogo "Registrar cobro": cuenta del socio, conceptos en el orden
-- de la maqueta (vencidos del más viejo al más nuevo y después los que todavía no vencen),
-- selección inicial según el concepto elegido (p_solo = 'seg|id|2', 'rifa|id|0', 'q6|id'…)
-- y botones de prioridad.
create or replace function public.agencia_cobro_datos(
  p_revision bigint, p_socio_id text, p_solo text default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  revision_actual bigint;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  estado jsonb; socio jsonb; cuenta jsonb; conceptos jsonb; elegido jsonb;
  tipos jsonb; seleccionadas jsonb; prioridades jsonb; salida jsonb;
  rifas_todas jsonb; rifas_vencidas jsonb;
  rifa_id text; tipo text; prioridad text; futuro_elegido boolean;
begin
  perform agencia.exigir_perfil();
  if p_revision is null or coalesce(p_socio_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$'
    or (p_solo is not null and length(p_solo) > 300) then
    raise exception 'Datos de consulta inválidos' using errcode = '22023';
  end if;
  select revision into strict revision_actual from agencia.configuracion;
  if revision_actual <> p_revision then
    raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001';
  end if;
  estado := agencia.estado_cobro_socio(p_socio_id);
  select value into socio from jsonb_array_elements(estado->'socios') x(value) where value->>'id' = p_socio_id;
  if socio is null then raise exception 'No se encontró el socio.' using errcode = '22023'; end if;
  cuenta := agencia.cuenta_socio_calcular(estado, p_socio_id, hoy);
  conceptos := agencia.conceptos_cobro_calcular(estado, p_socio_id, hoy);

  select coalesce(jsonb_agg(c.item || jsonb_build_object(
      'clave', c.clave, 'titulo', agencia.titulo_concepto_cobro(estado, c.item)
    ) order by c.orden), '[]'::jsonb)
    into conceptos
    from (
      select e.item, e.orden,
        array_to_string(array(select jsonb_array_elements_text(e.item->'ref')), '|') as clave
      from jsonb_array_elements(conceptos) with ordinality as e(item, orden)
    ) c;

  elegido := null;
  if p_solo is not null then
    select item into elegido from jsonb_array_elements(conceptos) x(item) where item->>'clave' = p_solo limit 1;
  end if;
  futuro_elegido := coalesce((elegido->>'fut')::boolean, false);
  rifa_id := case when elegido->>'t' = 'rifa' then elegido->'ref'->>1 end;

  -- Tipos de lo vencido, en orden de aparición.
  select coalesce(jsonb_agg(x.t order by x.primero), '[]'::jsonb) into tipos
    from (
      select item->>'t' as t, min(orden) as primero
      from jsonb_array_elements(conceptos) with ordinality as e(item, orden)
      where not coalesce((item->>'fut')::boolean, false)
      group by item->>'t'
    ) x;

  -- "Cobrar" desde una fila: viene tildado solo eso (si es una cuota de seguro, todas las
  -- cuotas vencidas de ese seguro). Si es una cuota futura, se agrega aparte.
  select coalesce(jsonb_agg(item->>'clave' order by orden), '[]'::jsonb) into seleccionadas
    from jsonb_array_elements(conceptos) with ordinality as e(item, orden)
    where not coalesce((item->>'fut')::boolean, false)
      and (elegido is null
        or item->>'clave' = elegido->>'clave'
        or (elegido->>'t' = 'seg' and not futuro_elegido and item->>'t' = 'seg'
            and item->'ref'->>1 = elegido->'ref'->>1));
  if elegido is not null and futuro_elegido then
    seleccionadas := seleccionadas || jsonb_build_array(elegido->>'clave');
  end if;
  prioridad := case when elegido is not null and not futuro_elegido and jsonb_array_length(tipos) > 1
    then elegido->>'t' else 'todo' end;

  prioridades := jsonb_build_array(jsonb_build_object(
    'clave', 'todo', 'titulo', 'Lo más viejo',
    'importe', (select coalesce(sum((item->>'imp')::numeric), 0)
                from jsonb_array_elements(conceptos) x(item)
                where not coalesce((item->>'fut')::boolean, false))
  ));
  for tipo in select jsonb_array_elements_text(tipos) loop
    prioridades := prioridades || jsonb_build_array(jsonb_build_object(
      'clave', tipo,
      'titulo', case tipo when 'seg' then 'Seguros' when 'q6' then 'Quini 6' when 'lot' then 'Lotería'
                          when 'qui' then 'Quiniela' when 'rifa' then 'Rifa Devoto' else tipo end,
      'importe', (select coalesce(sum((item->>'imp')::numeric), 0)
                  from jsonb_array_elements(conceptos) x(item)
                  where not coalesce((item->>'fut')::boolean, false) and item->>'t' = tipo)
    ));
  end loop;

  select coalesce(jsonb_agg(item->>'clave' order by orden), '[]'::jsonb),
         coalesce(jsonb_agg(item->>'clave' order by orden) filter (where not coalesce((item->>'fut')::boolean, false)), '[]'::jsonb)
    into rifas_todas, rifas_vencidas
    from jsonb_array_elements(conceptos) with ordinality as e(item, orden)
    where item->>'t' = 'rifa' and (rifa_id is null or item->'ref'->>1 = rifa_id);

  select coalesce(jsonb_agg(jsonb_build_object(
      'clave', item->>'clave', 'titulo', item->>'titulo', 'tipo', item->>'t',
      'producto', case item->>'t' when 'seg' then 'Seguros' when 'q6' then 'Quini 6' when 'lot' then 'Lotería'
                                 when 'qui' then 'Quiniela' when 'rifa' then 'Rifa Devoto' else item->>'t' end,
      'fecha', item->>'f', 'importe', (item->>'imp')::numeric,
      'futuro', coalesce((item->>'fut')::boolean, false)
    ) order by orden), '[]'::jsonb)
    into salida
    from jsonb_array_elements(conceptos) with ordinality as e(item, orden);

  return jsonb_build_object(
    'socioId', p_socio_id,
    'socio', coalesce(socio->>'nombre', ''),
    'resumen', jsonb_build_object('deuda', cuenta->'deuda', 'favor', cuenta->'favor',
      'debe', cuenta->'debe', 'aFavor', cuenta->'aFavor'),
    'inicial', jsonb_build_object('seleccionadas', seleccionadas, 'prioridad', prioridad, 'usarFavor', true),
    'mostrarFuturas', futuro_elegido,
    'prioridades', prioridades,
    'conceptos', salida,
    'rifasVencidas', rifas_vencidas,
    'rifasTodas', rifas_todas,
    'unaRifa', rifa_id is not null
  );
end $$;

-- Datos de un cobro ya registrado para "Editar cobro".
create or replace function public.agencia_cobro_obtener(p_revision bigint, p_cobro_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  revision_actual bigint;
  cobro jsonb;
  socio text;
begin
  perform agencia.exigir_perfil();
  if p_revision is null or coalesce(p_cobro_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$' then
    raise exception 'Datos de consulta inválidos' using errcode = '22023';
  end if;
  select revision into strict revision_actual from agencia.configuracion;
  if revision_actual <> p_revision then
    raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001';
  end if;
  select datos into cobro from agencia.cobros where clave = p_cobro_id;
  if cobro is null or coalesce((cobro->>'anulado')::boolean, false) then
    raise exception 'El cobro ya no está disponible.' using errcode = '22023';
  end if;
  select datos->>'nombre' into socio from agencia.socios where clave = cobro->>'sid';
  return jsonb_build_object(
    'id', p_cobro_id, 'socioId', cobro->>'sid', 'socio', coalesce(socio, ''),
    'fecha', cobro->>'fecha', 'medio', coalesce(cobro->>'medio', ''), 'det', cobro->'det',
    'monto', coalesce((cobro->>'monto')::numeric, 0), 'quedo', coalesce((cobro->>'quedo')::numeric, 0)
  );
end $$;

-- Fecha, medio y detalle de un pago existente (o vacío si todavía no se pagó) para el
-- diálogo de pago. p_tipo: q6, lot, quiniela, rifa (cuota) o seg (cuota).
create or replace function public.agencia_pago_obtener(
  p_revision bigint, p_tipo text, p_id text, p_indice integer default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  revision_actual bigint;
  registro jsonb;
  cuota jsonb;
  pago jsonb;
  socio text;
  numero_cuotas integer;
begin
  perform agencia.exigir_perfil();
  if p_revision is null or p_tipo is null or p_tipo not in ('q6','lot','quiniela','rifa','seg')
    or coalesce(p_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$'
    or (p_tipo in ('rifa','seg') and (p_indice is null or p_indice < 0)) then
    raise exception 'Datos de consulta inválidos' using errcode = '22023';
  end if;
  select revision into strict revision_actual from agencia.configuracion;
  if revision_actual <> p_revision then
    raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001';
  end if;

  if p_tipo = 'seg' then
    select datos into registro from agencia.seguros where clave = p_id;
    cuota := registro->'cuotas'->p_indice;
    if registro is null or jsonb_typeof(cuota) is distinct from 'object' then
      raise exception 'No se encontró la cuota.' using errcode = '22023';
    end if;
    select datos->>'nombre' into socio from agencia.socios where clave = registro->>'sid';
    return jsonb_build_object(
      'fecha', nullif(cuota->>'pago',''), 'medio', coalesce(cuota->>'medio',''), 'det', cuota->'det',
      'socio', coalesce(socio,''), 'descripcion', coalesce(registro->>'desc',''),
      'numero', coalesce((cuota->>'n')::integer, p_indice+1), 'total', jsonb_array_length(registro->'cuotas'),
      'importe', coalesce((cuota->>'imp')::numeric, 0), 'vencimiento', cuota->>'venc'
    );
  elsif p_tipo = 'rifa' then
    select datos into registro from agencia.rifas where clave = p_id;
    if registro is null or jsonb_typeof(registro->'pagos') is distinct from 'array'
      or p_indice >= jsonb_array_length(registro->'pagos') then
      raise exception 'No se encontró la cuota.' using errcode = '22023';
    end if;
    pago := registro->'pagos'->p_indice;
    numero_cuotas := (registro->>'ncuotas')::integer;
    select datos->>'nombre' into socio from agencia.socios where clave = registro->>'sid';
    return jsonb_build_object(
      'fecha', case when jsonb_typeof(pago) = 'string' and pago#>>'{}' <> '' then pago#>>'{}' end,
      'medio', coalesce(registro->'medios'->>p_indice, ''), 'det', registro->'dets'->p_indice,
      'socio', coalesce(socio,''), 'nro', coalesce(registro->>'nro',''), 'modo', coalesce(registro->>'modo',''),
      'numero', p_indice+1, 'total', numero_cuotas,
      'importe', agencia.cuota_rifa((registro->>'importe')::numeric, numero_cuotas, p_indice),
      'vencimiento', ((registro->>'desde')::date + make_interval(months => p_indice))::date
    );
  end if;

  if p_tipo = 'q6' then select datos into registro from agencia.quini_jugadas where clave = p_id;
  elsif p_tipo = 'lot' then select datos into registro from agencia.loteria_ventas where clave = p_id;
  else select datos into registro from agencia.quiniela_jugadas where clave = p_id;
  end if;
  if registro is null then raise exception 'No se encontró el pago.' using errcode = '22023'; end if;
  select datos->>'nombre' into socio from agencia.socios where clave = registro->>'sid';
  return jsonb_build_object(
    'fecha', nullif(registro->>'fpago',''), 'medio', coalesce(registro->>'medio',''), 'det', registro->'det',
    'socio', coalesce(socio,'')
  );
end $$;

-- Nombre de la agencia para el encabezado de los PDF de listados.
create or replace function public.agencia_nombre_agencia()
returns text language plpgsql stable security definer set search_path = '' as $$
declare nombre text;
begin
  perform agencia.exigir_perfil();
  select datos->>'nombre' into nombre from agencia.configuracion;
  return coalesce(nombre, '');
end $$;

-- ============================================================
-- Quini 6 y Quiniela
-- ============================================================

create or replace function agencia.quini_fechas(p_desde date, p_hasta date)
returns setof date language sql stable set search_path = '' as $$
  select t.f from (
    select g::date as f
    from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') g
    where (select c.datos->'q6Dias' from agencia.configuracion c) @> jsonb_build_array(extract(dow from g)::integer)
    union
    select (e.datos->>'fecha')::date
    from agencia.quini_sorteos_especiales e
    where (e.datos->>'fecha')::date between p_desde and p_hasta
  ) t order by t.f
$$;

-- Calendario del Quini: días de sorteo, fechas de -180 a +60 días, próximo sorteo y sorteos especiales.
create or replace function public.agencia_quini_fechas(p_revision bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  rev bigint; config jsonb; dias jsonb; fechas jsonb; especiales jsonb; proximo date;
  fecha_hoy date := (current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perform agencia.exigir_perfil();
  if p_revision is null then raise exception 'Datos de consulta inválidos' using errcode = '22023'; end if;
  select revision, datos into strict rev, config from agencia.configuracion;
  if rev <> p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001'; end if;
  dias := config->'q6Dias';
  if jsonb_typeof(dias) is distinct from 'array' then raise exception 'Días de sorteo inválidos' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(t.f order by t.f), '[]'::jsonb) into fechas from agencia.quini_fechas(fecha_hoy - 180, fecha_hoy + 60) as t(f);
  select min(t.f) into proximo from agencia.quini_fechas(fecha_hoy, fecha_hoy + 30) as t(f);
  select coalesce(jsonb_agg(e.datos order by e.datos->>'fecha', e.posicion), '[]'::jsonb) into especiales from agencia.quini_sorteos_especiales e;
  return jsonb_build_object('hoy', fecha_hoy, 'proximo', proximo, 'dias', dias, 'fechas', fechas, 'especiales', especiales);
end $$;

-- Datos para el formulario de una jugada de Quini: la jugada (si se edita), la cantidad inicial
-- y los socios activos para elegir (más el de la jugada, aunque esté archivado).
create or replace function public.agencia_quini_formulario(p_revision bigint, p_id text default null, p_socio_id text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  rev bigint; config jsonb; jugada jsonb; especial jsonb; socio_id text; precio numeric; cantidad integer; socios jsonb;
begin
  perform agencia.exigir_perfil();
  if p_revision is null or (p_id is not null and p_id !~ '^[a-zA-Z0-9_-]{1,128}$')
    or (p_socio_id is not null and p_socio_id !~ '^[a-zA-Z0-9_-]{1,128}$') then
    raise exception 'Datos de consulta inválidos' using errcode = '22023';
  end if;
  select revision, datos into strict rev, config from agencia.configuracion;
  if rev <> p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001'; end if;
  if p_id is not null then
    select datos into jugada from agencia.quini_jugadas where clave = p_id;
    if not found then raise exception 'Jugada inexistente' using errcode = '22023'; end if;
    socio_id := jugada->>'sid';
    select datos into especial from agencia.quini_sorteos_especiales where datos->>'fecha' = jugada->>'fecha' order by posicion limit 1;
    precio := case when especial is null then (config->>'q6Precio')::numeric else (especial->>'precio')::numeric end;
    cantidad := greatest(1, round((jugada->>'monto')::numeric / nullif(precio, 0))::integer);
  else
    socio_id := p_socio_id;
    select coalesce(nullif((datos->'q6'->>'cant')::integer, 0), 1) into cantidad from agencia.socios where clave = socio_id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.clave, 'nombre', s.datos->>'nombre', 'nro', coalesce(s.datos->>'nro', ''))
    order by s.datos->>'nombre', s.posicion), '[]'::jsonb)
  into socios from agencia.socios s where coalesce((s.datos->>'activo')::boolean, false) or s.clave = socio_id;
  return jsonb_build_object('jugada', jugada, 'cantidad', coalesce(cantidad, 1), 'socios', socios);
exception when invalid_text_representation or numeric_value_out_of_range or division_by_zero then
  raise exception 'Datos de jugada inválidos' using errcode = '22023';
end $$;

-- Días de juego habitual y jugadas por sorteo de un socio, para el diálogo del plan.
create or replace function public.agencia_quini_plan_leer(p_revision bigint, p_socio_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  rev bigint; plan jsonb;
begin
  perform agencia.exigir_perfil();
  if p_revision is null or coalesce(p_socio_id, '') !~ '^[a-zA-Z0-9_-]{1,128}$' then
    raise exception 'Datos de consulta inválidos' using errcode = '22023';
  end if;
  select revision into strict rev from agencia.configuracion;
  if rev <> p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001'; end if;
  select datos->'q6' into plan from agencia.socios where clave = p_socio_id;
  if not found then raise exception 'Socio inexistente' using errcode = '22023'; end if;
  return jsonb_build_object(
    'dias', case when jsonb_typeof(plan->'dias') = 'array' then plan->'dias' else '[]'::jsonb end,
    'cantidad', coalesce(nullif((plan->>'cant')::integer, 0), 1));
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Plan de Quini inválido' using errcode = '22023';
end $$;

-- Datos para el formulario de Quiniela: la jugada (si se edita) y los socios para elegir.
create or replace function public.agencia_quiniela_formulario(p_revision bigint, p_id text default null, p_socio_id text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  rev bigint; jugada jsonb; socio_id text; socios jsonb;
begin
  perform agencia.exigir_perfil();
  if p_revision is null or (p_id is not null and p_id !~ '^[a-zA-Z0-9_-]{1,128}$')
    or (p_socio_id is not null and p_socio_id !~ '^[a-zA-Z0-9_-]{1,128}$') then
    raise exception 'Datos de consulta inválidos' using errcode = '22023';
  end if;
  select revision into strict rev from agencia.configuracion;
  if rev <> p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001'; end if;
  if p_id is not null then
    select datos into jugada from agencia.quiniela_jugadas where clave = p_id;
    if not found then raise exception 'Jugada inexistente' using errcode = '22023'; end if;
    socio_id := jugada->>'sid';
  else
    socio_id := p_socio_id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.clave, 'nombre', s.datos->>'nombre', 'nro', coalesce(s.datos->>'nro', ''))
    order by s.datos->>'nombre', s.posicion), '[]'::jsonb)
  into socios from agencia.socios s where coalesce((s.datos->>'activo')::boolean, false) or s.clave = socio_id;
  return jsonb_build_object('jugada', jugada, 'socios', socios);
end $$;

-- Permisos de las operaciones y lecturas de 002 que usa el panel de Quini y Quiniela.

-- ============================================================
-- Lotería y Ajustes
-- ============================================================

create or replace function public.agencia_loteria_sorteos(p_revision bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  rev bigint;
  hoy text := ((current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date)::text;
  lista jsonb;
  actual text;
begin
  perform agencia.exigir_perfil();
  if p_revision is null then raise exception 'Datos de consulta inválidos' using errcode = '22023'; end if;
  select revision into strict rev from agencia.configuracion;
  if rev <> p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001'; end if;
  select coalesce(jsonb_agg(s.datos order by s.datos->>'fecha', s.posicion), '[]'::jsonb) into lista from agencia.loteria_sorteos s;
  select s.clave into actual from agencia.loteria_sorteos s
    where s.datos->>'fecha' >= hoy order by s.datos->>'fecha', s.posicion limit 1;
  if actual is null then
    select s.clave into actual from agencia.loteria_sorteos s order by s.datos->>'fecha' desc, s.posicion desc limit 1;
  end if;
  return jsonb_build_object('sorteos', lista, 'actual', actual);
end $$;

-- Datos que necesita el formulario de venta: sorteos, socios, la venta (si se
-- edita) y los valores iniciales, con el número fijo pendiente del socio.
create or replace function public.agencia_loteria_formulario(
  p_revision bigint, p_venta_id text default null, p_socio_id text default null, p_sorteo_id text default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  rev bigint;
  hoy text := ((current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date)::text;
  sorteos jsonb; socios jsonb; venta jsonb; sorteo jsonb; fijo jsonb;
  sid text; soid text; actual text; numero text; fracciones numeric;
begin
  perform agencia.exigir_perfil();
  if p_revision is null
     or (p_venta_id is not null and p_venta_id !~ '^[a-zA-Z0-9_-]{1,128}$')
     or (p_socio_id is not null and p_socio_id <> '' and p_socio_id !~ '^[a-zA-Z0-9_-]{1,128}$')
     or (p_sorteo_id is not null and p_sorteo_id <> '' and p_sorteo_id !~ '^[a-zA-Z0-9_-]{1,128}$') then
    raise exception 'Datos de consulta inválidos' using errcode = '22023';
  end if;
  select revision into strict rev from agencia.configuracion;
  if rev <> p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001'; end if;

  select coalesce(jsonb_agg(s.datos order by s.datos->>'fecha', s.posicion), '[]'::jsonb) into sorteos from agencia.loteria_sorteos s;
  if p_venta_id is not null then
    select v.datos into venta from agencia.loteria_ventas v where v.clave = p_venta_id;
    if not found then raise exception 'Venta inexistente' using errcode = '22023'; end if;
  end if;
  sid := coalesce(venta->>'sid', nullif(p_socio_id, ''), '');

  select s.clave into actual from agencia.loteria_sorteos s
    where s.datos->>'fecha' >= hoy order by s.datos->>'fecha', s.posicion limit 1;
  if actual is null then
    select s.clave into actual from agencia.loteria_sorteos s order by s.datos->>'fecha' desc, s.posicion desc limit 1;
  end if;
  soid := coalesce(venta->>'soId', nullif(p_sorteo_id, ''), actual);
  select s.datos into sorteo from agencia.loteria_sorteos s where s.clave = soid;
  if not found then
    select s.datos into sorteo from agencia.loteria_sorteos s order by s.datos->>'fecha', s.posicion limit 1;
  end if;
  if sorteo is null then
    return jsonb_build_object('sorteos', '[]'::jsonb, 'socios', '[]'::jsonb, 'venta', null, 'inicial', null);
  end if;

  if venta is null and sid <> '' then
    select f.dato into fijo
    from agencia.socios s
    cross join lateral jsonb_array_elements(case when jsonb_typeof(s.datos->'fijos') = 'array' then s.datos->'fijos' else '[]'::jsonb end) with ordinality as f(dato, orden)
    where s.clave = sid
      and not exists (select 1 from agencia.loteria_ventas v
        where v.datos->>'soId' = sorteo->>'id' and v.datos->>'sid' = sid and v.datos->>'numero' = f.dato->>'numero')
    order by f.orden limit 1;
  end if;
  numero := coalesce(venta->>'numero', fijo->>'numero', '');
  fracciones := case
    when venta is not null then (venta->>'frac')::numeric
    when fijo is not null and coalesce((fijo->>'frac')::numeric, 0) <> 0 then least((fijo->>'frac')::numeric, (sorteo->>'frac')::numeric)
    else (sorteo->>'frac')::numeric end;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.clave, 'nombre', s.datos->>'nombre', 'nro', coalesce(s.datos->>'nro', ''))
    order by case when coalesce((s.datos->>'activo')::boolean, false) then 0 else 1 end, s.datos->>'nombre', s.posicion), '[]'::jsonb)
  into socios from agencia.socios s where coalesce((s.datos->>'activo')::boolean, false) or s.clave = sid;

  return jsonb_build_object('sorteos', sorteos, 'socios', socios, 'venta', venta,
    'inicial', jsonb_build_object('sid', sid, 'soId', sorteo->>'id', 'numero', numero, 'frac', fracciones));
end $$;

-- Pantalla de Ajustes: precios, sorteos con su cantidad de ventas, días de
-- sorteo de cada juego del Toto y usuarios habilitados.
create or replace function public.agencia_ajustes(p_revision bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  rev bigint; conf jsonb; sorteos jsonb; juegos jsonb; usuarios jsonb;
  predeterminados constant jsonb := '{"q6Precio":4000,"q6Dias":[3,0],"fracPrecio":10000,"rifaImporte":17000,"rifaCuotas":10}'::jsonb;
begin
  perform agencia.exigir_perfil();
  if p_revision is null then raise exception 'Datos de consulta inválidos' using errcode = '22023'; end if;
  select revision, predeterminados || datos into strict rev, conf from agencia.configuracion;
  if rev <> p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001'; end if;

  select coalesce(jsonb_agg(s.datos || jsonb_build_object('ventas',
      (select count(*) from agencia.loteria_ventas v where v.datos->>'soId' = s.clave))
    order by s.datos->>'fecha', s.posicion), '[]'::jsonb) into sorteos from agencia.loteria_sorteos s;

  select jsonb_agg(jsonb_build_object('id', j.id, 'nombre', j.nombre,
    'dias', case when jsonb_typeof(conf->'totoDias'->j.id) = 'array' then conf->'totoDias'->j.id else j.dias end) order by j.orden)
  into juegos
  from (values
    (1, 'previa', 'Previa', '[1,2,3,4,5,6]'::jsonb), (2, 'primera', 'Primera', '[1,2,3,4,5,6]'::jsonb),
    (3, 'matutina', 'Matutina', '[1,2,3,4,5,6]'::jsonb), (4, 'vespertina', 'Vespertina', '[1,2,3,4,5,6]'::jsonb),
    (5, 'nocturna', 'Nocturna', '[1,2,3,4,5,6]'::jsonb), (6, 'turista', 'Turista', '[1,2,3,4,5,6]'::jsonb),
    (7, 'quini6', 'Quini 6', '[0,3]'::jsonb), (8, 'loto', 'Loto', '[0,3]'::jsonb)
  ) as j(orden, id, nombre, dias);

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rol', p.rol) order by p.nombre, p.id), '[]'::jsonb)
  into usuarios from agencia.perfiles p where p.activo;

  return jsonb_build_object(
    'config', jsonb_build_object('nombre', coalesce(conf->>'nombre', ''), 'q6Precio', conf->'q6Precio', 'q6Dias', conf->'q6Dias',
      'fracPrecio', conf->'fracPrecio', 'rifaImporte', conf->'rifaImporte', 'rifaCuotas', conf->'rifaCuotas',
      'wsp', case when conf->>'wsp' = 'web' then 'web' else 'app' end),
    'sorteos', sorteos, 'juegos', juegos, 'usuarios', usuarios);
end $$;

-- Respaldo descargable: mismo formato que aceptan `agencia_restaurar_verificado`
-- y `agencia.validar_respaldo` (lo que hoy se arma desde `agencia_leer`, sin
-- usuarios ni actividad). Los socios se normalizan como en la maqueta.
create or replace function public.agencia_respaldo()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  hoy text := ((current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date)::text;
  predeterminados constant jsonb := '{"q6Precio":4000,"q6Dias":[3,0],"fracPrecio":10000,"rifaImporte":17000,"rifaCuotas":10}'::jsonb;
  coleccion record; estado jsonb; datos jsonb; conf jsonb;
begin
  perform agencia.exigir_perfil();
  select predeterminados || c.datos into strict conf from agencia.configuracion c;
  estado := jsonb_build_object('ver', 1, 'conf', conf);
  for coleccion in select * from agencia.colecciones() loop
    if coleccion.clave = 'socios' then
      select coalesce(jsonb_agg(
        s.datos || jsonb_build_object(
          'fijos', case when jsonb_typeof(s.datos->'fijos') = 'array' then s.datos->'fijos' else '[]'::jsonb end,
          'activo', coalesce(s.datos->'activo', 'true'::jsonb),
          'q6', q.q6 || jsonb_build_object('dias', q.dias, 'auto', jsonb_array_length(q.dias) > 0, 'activo', jsonb_array_length(q.dias) > 0)
            || case when jsonb_array_length(q.dias) > 0 and coalesce(q.q6->>'desde', '') = '' then jsonb_build_object('desde', hoy) else '{}'::jsonb end)
        order by s.posicion), '[]'::jsonb) into datos
      from agencia.socios s
      cross join lateral (
        select x.q6, case when jsonb_typeof(x.q6->'dias') = 'array' then x.q6->'dias'
                          when coalesce((x.q6->>'activo')::boolean, false) then conf->'q6Dias' else '[]'::jsonb end as dias
        from (select case when jsonb_typeof(s.datos->'q6') = 'object' then s.datos->'q6' else '{"activo":false,"cant":1}'::jsonb end as q6) x
      ) q;
    else
      execute format('select coalesce(jsonb_agg(datos order by posicion), ''[]'') from agencia.%I', coleccion.tabla) into datos;
    end if;
    estado := estado || jsonb_build_object(coleccion.clave, datos);
  end loop;
  return estado;
end $$;

-- Permisos de las lecturas nuevas y de las operaciones de Lotería y Ajustes.

-- ============================================================
-- Rifa Devoto y Seguros
-- ============================================================

create or replace function agencia.autor_registro(p_datos jsonb)
returns text language plpgsql stable set search_path = '' as $$
declare autor text := ''; nombre text; fecha text;
begin
  if coalesce(p_datos->>'por', '') <> '' and p_datos->>'por' <> 'auto' then
    select coalesce(
      (select p.nombre from agencia.perfiles p where p.id::text = p_datos->>'por'),
      (select n.nombre from agencia.actores n where n.actor = p_datos->>'por'),
      '') into nombre;
    autor := 'Cargó ' || nombre;
  elsif p_datos->>'por' = 'auto' then
    autor := 'Automático';
  end if;
  if coalesce(p_datos->>'modPor', '') <> '' and p_datos->>'modPor' is distinct from p_datos->>'por' then
    select coalesce(
      (select p.nombre from agencia.perfiles p where p.id::text = p_datos->>'modPor'),
      (select n.nombre from agencia.actores n where n.actor = p_datos->>'modPor'),
      '') into nombre;
    fecha := left(coalesce(p_datos->>'modTs', ''), 10);
    autor := autor || case when autor <> '' then ' · ' else '' end || 'editó ' || nombre
      || case when fecha <> '' then ' ' || to_char(fecha::date, 'DD/MM/YYYY') else '' end;
  end if;
  return autor;
end $$;

-- Socios activos por nombre (como `socOrd`), más los ids que el formulario necesita aunque estén archivados.
create or replace function agencia.socios_opciones(p_incluir text[])
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('id', s.clave, 'nombre', coalesce(s.datos->>'nombre', ''), 'nro', coalesce(s.datos->>'nro', ''))
      order by lower(coalesce(s.datos->>'nombre', '')), s.posicion),
    '[]'::jsonb)
  from agencia.socios s
  where coalesce((s.datos->>'activo')::boolean, false) or s.clave = any(coalesce(p_incluir, array[]::text[]))
$$;

create or replace function public.agencia_rifa_contexto(p_revision bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  rev bigint; anios jsonb; autores jsonb;
  anio_actual integer := extract(year from (current_timestamp at time zone 'America/Argentina/Buenos_Aires'))::integer;
begin
  perform agencia.exigir_perfil();
  if p_revision is null then raise exception 'Datos de consulta inválidos' using errcode = '22023'; end if;
  select revision into strict rev from agencia.configuracion;
  if rev <> p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001'; end if;
  select coalesce(jsonb_agg(t.anio order by t.anio), '[]'::jsonb) into anios
    from (select (r.datos->>'anio')::integer as anio from agencia.rifas r union select anio_actual) t;
  select coalesce(jsonb_object_agg(x.clave, x.autor), '{}'::jsonb) into autores
    from (select r.clave, agencia.autor_registro(r.datos) as autor from agencia.rifas r) x where x.autor <> '';
  return jsonb_build_object('anios', anios, 'autores', autores);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Datos de rifa inválidos' using errcode = '22023';
end $$;

create or replace function public.agencia_rifa_formulario(p_revision bigint, p_id text default null, p_sid text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare rev bigint; config jsonb; rifa jsonb; incluir text[] := array[]::text[];
begin
  perform agencia.exigir_perfil();
  if p_revision is null or (p_id is not null and p_id !~ '^[a-zA-Z0-9_-]{1,128}$') or (p_sid is not null and p_sid !~ '^[a-zA-Z0-9_-]{1,128}$') then
    raise exception 'Datos de consulta inválidos' using errcode = '22023';
  end if;
  select revision, datos into strict rev, config from agencia.configuracion;
  if rev <> p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001'; end if;
  if p_id is not null then
    select datos into rifa from agencia.rifas where clave = p_id;
    if not found then raise exception 'Rifa inexistente' using errcode = '22023'; end if;
    incluir := array[rifa->>'sid'];
  end if;
  if p_sid is not null then incluir := incluir || p_sid; end if;
  return jsonb_build_object(
    'socios', agencia.socios_opciones(incluir),
    'ncuotas', (config->>'rifaCuotas')::integer,
    'precio', (config->>'rifaImporte')::numeric,
    'rifa', case when rifa is null then null else jsonb_build_object(
      'sid', rifa->>'sid', 'nro', coalesce(rifa->>'nro', ''), 'anio', (rifa->>'anio')::integer,
      'modo', rifa->>'modo', 'importe', (rifa->>'importe')::numeric) end);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Datos de rifa inválidos' using errcode = '22023';
end $$;

create or replace function public.agencia_seguro_formulario(p_revision bigint, p_id text default null, p_sid text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare rev bigint; seguro jsonb; incluir text[] := array[]::text[];
begin
  perform agencia.exigir_perfil();
  if p_revision is null or (p_id is not null and p_id !~ '^[a-zA-Z0-9_-]{1,128}$') or (p_sid is not null and p_sid !~ '^[a-zA-Z0-9_-]{1,128}$') then
    raise exception 'Datos de consulta inválidos' using errcode = '22023';
  end if;
  select revision into strict rev from agencia.configuracion;
  if rev <> p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001'; end if;
  if p_id is not null then
    select datos into seguro from agencia.seguros where clave = p_id;
    if not found then raise exception 'Seguro inexistente' using errcode = '22023'; end if;
    incluir := array[seguro->>'sid'];
  end if;
  if p_sid is not null then incluir := incluir || p_sid; end if;
  return jsonb_build_object(
    'socios', agencia.socios_opciones(incluir),
    'seguro', case when seguro is null then null else jsonb_build_object(
      'sid', seguro->>'sid', 'ingreso', seguro->>'ingreso', 'venc', seguro->>'venc',
      'desc', coalesce(seguro->>'desc', ''), 'valor', (seguro->>'valor')::numeric, 'plan', seguro->>'plan') end);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Datos de seguro inválidos' using errcode = '22023';
end $$;

-- Procedures de 002 que usan estas pantallas.

-- ============================================================
-- Toto, Cheques y Actividad
-- ============================================================

create or replace function public.agencia_toto_periodos(p_revision bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  rev bigint; nombre text; meses jsonb;
  hoy_ar date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  mes_actual text := to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM');
begin
  perform agencia.exigir_perfil();
  select c.revision, c.datos->>'nombre' into strict rev, nombre from agencia.configuracion c;
  if p_revision is null or rev <> p_revision then
    raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001';
  end if;
  select coalesce(jsonb_agg(x.mes order by x.mes), '[]'::jsonb) into meses
    from (
      select left(t.datos->>'fecha', 7) as mes from agencia.toto_planillas t where coalesce(t.datos->>'fecha', '') ~ '^\d{4}-\d{2}-\d{2}$'
      union
      select mes_actual
    ) x;
  return jsonb_build_object('hoy', hoy_ar, 'mesActual', mes_actual, 'meses', meses, 'porcentaje', 12, 'agencia', coalesce(nombre, ''));
end $$;

-- Una planilla puntual con su cálculo: lo necesitan el diálogo de edición y el de pagos.
-- `quitables` indica si los pagos ya están en una lista (las planillas antiguas marcadas
-- como pagadas todavía no permiten quitar pagos uno por uno).
create or replace function public.agencia_toto_planilla(p_revision bigint, p_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare rev bigint; planilla jsonb;
begin
  perform agencia.exigir_perfil();
  select c.revision into strict rev from agencia.configuracion c;
  if p_revision is null or rev <> p_revision then
    raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001';
  end if;
  if p_id is null or p_id !~ '^[a-zA-Z0-9_-]{1,128}$' then
    raise exception 'Planilla inválida' using errcode = '22023';
  end if;
  select t.datos into planilla from agencia.toto_planillas t where t.clave = p_id;
  if planilla is null then raise exception 'Planilla inexistente' using errcode = '22023'; end if;
  return jsonb_build_object('id', p_id, 'datos', planilla, 'calculo', agencia.toto_calcular(planilla),
    'quitables', jsonb_typeof(planilla->'pagos') = 'array');
end $$;

-- Texto de «Qué» de la pantalla Actividad, como audDesc() de la maqueta. El monto
-- (cobros) y el resultado (Toto) se devuelven aparte para que el panel los formatee.
create or replace function agencia.actividad_detalle(p_coleccion text, p_clave text)
returns jsonb language plpgsql stable set search_path = '' as $$
declare d jsonb; socio text; prefijo text := ''; texto text := ''; importe numeric;
begin
  if p_coleccion = 'conf' then
    return jsonb_build_object('texto', case p_clave when 'precios' then 'precios y preferencias' else 'días de sorteo de Toto Ortega' end, 'importe', null);
  end if;
  if p_coleccion = 'socios' then select s.datos into d from agencia.socios s where s.clave = p_clave;
  elsif p_coleccion = 'seguros' then select s.datos into d from agencia.seguros s where s.clave = p_clave;
  elsif p_coleccion = 'q6' then select s.datos into d from agencia.quini_jugadas s where s.clave = p_clave;
  elsif p_coleccion = 'lot' then select s.datos into d from agencia.loteria_ventas s where s.clave = p_clave;
  elsif p_coleccion = 'quiniela' then select s.datos into d from agencia.quiniela_jugadas s where s.clave = p_clave;
  elsif p_coleccion = 'rifas' then select s.datos into d from agencia.rifas s where s.clave = p_clave;
  elsif p_coleccion = 'cobros' then select s.datos into d from agencia.cobros s where s.clave = p_clave;
  elsif p_coleccion = 'toto' then select s.datos into d from agencia.toto_planillas s where s.clave = p_clave;
  elsif p_coleccion = 'sorteos' then select s.datos into d from agencia.loteria_sorteos s where s.clave = p_clave;
  elsif p_coleccion = 'q6esp' then select s.datos into d from agencia.quini_sorteos_especiales s where s.clave = p_clave;
  end if;
  -- Un registro eliminado ya no tiene datos para describir.
  if d is null then return jsonb_build_object('texto', '', 'importe', null); end if;
  if coalesce(d->>'sid', '') <> '' then
    select s.datos->>'nombre' into socio from agencia.socios s where s.clave = d->>'sid';
    prefijo := coalesce(socio, '(socio borrado)') || ' · ';
  end if;
  if p_coleccion in ('socios', 'sorteos', 'q6esp') then texto := coalesce(d->>'nombre', '');
  elsif p_coleccion = 'seguros' then texto := prefijo || coalesce(d->>'desc', '');
  elsif p_coleccion = 'q6' then
    texto := prefijo || 'sorteo ' || case when coalesce(d->>'fecha', '') ~ '^\d{4}-\d{2}-\d{2}$' then to_char((d->>'fecha')::date, 'DD/MM/YYYY') else '' end;
  elsif p_coleccion = 'lot' then texto := prefijo || 'N° ' || coalesce(d->>'numero', '');
  elsif p_coleccion = 'quiniela' then texto := prefijo || coalesce(d->>'numeros', '');
  elsif p_coleccion = 'rifas' then texto := prefijo || 'N° ' || coalesce(d->>'nro', '');
  elsif p_coleccion = 'cobros' then
    texto := prefijo;
    importe := nullif(d->>'monto', '')::numeric;
  elsif p_coleccion = 'toto' then
    texto := case when coalesce(d->>'fecha', '') ~ '^\d{4}-\d{2}-\d{2}$' then to_char((d->>'fecha')::date, 'DD/MM/YYYY') else '' end || ' · ';
    importe := (agencia.toto_calcular(d)->>'gral')::numeric;
  end if;
  return jsonb_build_object('texto', texto, 'importe', importe);
end $$;

-- Igual que agencia_actividad (últimos 3000 movimientos, 400 del usuario elegido, usuarios
-- activos para el filtro), pero con el texto descriptivo de cada movimiento.
create or replace function public.agencia_actividad_detallada(p_revision bigint, p_usuario text default 'todos')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare rev bigint; usuarios jsonb; movimientos jsonb;
begin
  perform agencia.exigir_perfil();
  if p_revision is null or p_usuario is null or (p_usuario <> 'todos' and p_usuario !~ '^[0-9a-fA-F-]{36}$') then
    raise exception 'Datos de consulta inválidos' using errcode = '22023';
  end if;
  select c.revision into strict rev from agencia.configuracion c;
  if rev <> p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode = '40001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre) order by p.nombre, p.id), '[]'::jsonb)
    into usuarios from agencia.perfiles p where p.activo;
  with recientes as materialized (select * from agencia.actividad order by id desc limit 3000),
  seleccion as (select * from recientes where p_usuario = 'todos' or actor::text = p_usuario order by id desc limit 400)
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id::text, 'usuarioId', a.actor, 'nombre', coalesce(p.nombre, n.nombre, ''), 'ts', a.fecha,
      'accion', a.accion, 'tipo', a.coleccion, 'detalle', det.valor->>'texto', 'importe', det.valor->'importe'
    ) order by a.id desc), '[]'::jsonb)
  into movimientos
  from seleccion a
  left join agencia.perfiles p on p.id = a.actor and p.activo
  left join agencia.actores n on n.actor = a.actor::text and p.id is null
  cross join lateral (select agencia.actividad_detalle(a.coleccion, a.clave) as valor) det;
  return jsonb_build_object('usuarios', usuarios, 'movimientos', movimientos);
end $$;

-- ============================================================
-- Índices
-- ============================================================
-- Las tablas guardan cada registro como JSON; sin estos índices cada consulta recorre la tabla entera
-- y el costo crece con los años de datos.
create index if not exists quiniela_jugadas_fecha_idx on agencia.quiniela_jugadas ((datos->>'fecha'));
create index if not exists quini_jugadas_fecha_idx on agencia.quini_jugadas ((datos->>'fecha'));
create index if not exists loteria_ventas_sorteo_idx on agencia.loteria_ventas ((datos->>'soId'));
create index if not exists loteria_ofertas_sorteo_idx on agencia.loteria_ofertas ((datos->>'soId'));
create index if not exists rifas_anio_idx on agencia.rifas (((datos->>'anio')::integer));
create index if not exists cobros_socio_idx on agencia.cobros ((datos->>'sid'));
create index if not exists toto_planillas_fecha_idx on agencia.toto_planillas ((datos->>'fecha'));
analyze;

-- ============================================================
-- Funciones heredadas que el panel ya no usa
-- ============================================================
-- El estado completo en un solo JSON (leer/guardar/restaurar) fue reemplazado por las lecturas
-- y operaciones de arriba; la restauración vigente es agencia_restaurar_verificado.
-- agencia_actividad y agencia_seguro_prever quedaron reemplazadas por agencia_actividad_detallada
-- y por el cálculo del vencimiento en el cliente.
do $$
declare funcion record;
begin
  for funcion in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('agencia_leer', 'agencia_guardar', 'agencia_restaurar', 'agencia_actividad', 'agencia_seguro_prever')
  loop
    execute format('drop function %s', funcion.firma);
  end loop;
end $$;

commit;
