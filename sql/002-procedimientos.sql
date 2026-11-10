-- INCOMPLETO: no ejecutar. Falta portar cobros, saldos y anulaciones.
-- Funciones de cálculo aisladas para comparar con el maquetado.
begin;

create or replace function lozano.cuotas_seguro(
  p_ingreso date, p_plan text, p_valor numeric, p_anteriores jsonb default '[]'::jsonb
) returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  n integer;
  i integer;
  libre integer := 0;
  libre_actual integer := 0;
  pagado numeric := 0;
  resto numeric;
  base numeric;
  importe numeric;
  previa jsonb;
  cuota jsonb;
  resultado jsonb := '[]'::jsonb;
  fija boolean;
  cancelada boolean;
begin
  if p_ingreso is null or p_valor is null or p_valor < 0
    or p_plan is null or p_plan not in ('contado', '3', '6', '12')
    or jsonb_typeof(p_anteriores) is distinct from 'array' then
    raise exception 'Datos de seguro inválidos' using errcode = '22023';
  end if;
  n := case p_plan when 'contado' then 1 else p_plan::integer end;
  for i in 0..n-1 loop
    previa := p_anteriores -> i;
    cancelada := coalesce((previa->>'anulado')::boolean, false);
    fija := coalesce(previa->>'pago', '') <> '' or cancelada;
    if fija and not cancelada then
      pagado := pagado + coalesce((previa->>'imp')::numeric, 0);
    elsif not fija then
      libre := libre + 1;
    end if;
  end loop;
  resto := greatest(0, p_valor - round(pagado, 2));
  base := case when libre > 0 then floor(resto / libre) else 0 end;
  for i in 0..n-1 loop
    previa := p_anteriores -> i;
    cancelada := coalesce((previa->>'anulado')::boolean, false);
    fija := coalesce(previa->>'pago', '') <> '' or cancelada;
    if fija then
      importe := coalesce((previa->>'imp')::numeric, 0);
    else
      libre_actual := libre_actual + 1;
      importe := case when libre_actual = libre then resto - base * (libre - 1) else base end;
    end if;
    cuota := jsonb_build_object(
      'n', i+1,
      'venc', (p_ingreso + make_interval(months => i))::date,
      'imp', round(importe, 2),
      'pago', case when coalesce(previa->>'pago','') <> '' then previa->'pago' else 'null'::jsonb end,
      'medio', coalesce(nullif(previa->>'medio',''), '')
    );
    if previa ? 'det' and previa->'det' <> 'null'::jsonb then cuota := cuota || jsonb_build_object('det',previa->'det'); end if;
    if previa ? 'pts' and previa->'pts' <> 'null'::jsonb then cuota := cuota || jsonb_build_object('pts',previa->'pts'); end if;
    if previa ? 'anulado' and previa->'anulado' <> 'null'::jsonb then cuota := cuota || jsonb_build_object('anulado',previa->'anulado'); end if;
    if coalesce((previa->>'abono')::numeric,0) <> 0 then
      cuota := cuota || jsonb_build_object('abono',
        case when coalesce(previa->>'pago','') <> '' then (previa->>'abono')::numeric
             else least((previa->>'abono')::numeric, round(importe,2)) end);
    end if;
    resultado := resultado || jsonb_build_array(cuota);
  end loop;
  return resultado;
end $$;

create or replace function lozano.cuota_rifa(
  p_importe numeric, p_cuotas integer, p_indice integer
) returns numeric
language plpgsql immutable set search_path = ''
as $$
declare
  por_cuota numeric;
  centavos bigint;
  base bigint;
  restantes bigint;
begin
  if p_importe is null or p_importe < 0 or p_cuotas is null or p_cuotas < 1
     or p_indice is null or p_indice < 0 or p_indice >= p_cuotas then
    raise exception 'Datos de rifa inválidos' using errcode = '22023';
  end if;
  por_cuota := floor(p_importe / p_cuotas + 0.5);
  if p_importe - por_cuota * (p_cuotas - 1) >= 0 then
    return round(case when p_indice = p_cuotas - 1
      then p_importe - por_cuota * (p_cuotas - 1) else por_cuota end, 2);
  end if;
  centavos := floor(p_importe * 100 + 0.5);
  base := centavos / p_cuotas;
  restantes := centavos % p_cuotas;
  return (base + case when p_indice < restantes then 1 else 0 end)::numeric / 100;
end $$;

create or replace function lozano.toto_calcular(p_planilla jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  total numeric;
  comision numeric;
  neto numeric;
  premios numeric;
  general numeric;
  pagos jsonb;
  pagado numeric;
  debe numeric;
  saldado boolean;
begin
  if jsonb_typeof(p_planilla) is distinct from 'object' then
    raise exception 'Planilla inválida' using errcode = '22023';
  end if;
  select round(coalesce(sum(coalesce(nullif(p_planilla->>juego, '')::numeric, 0)), 0),2)
    into total from unnest(array['previa','primera','matutina','vespertina','nocturna','turista','quini6','loto']) juego;
  comision := round(total * 0.12,2);
  neto := round(total - comision,2);
  premios := coalesce(nullif(p_planilla->>'premios','')::numeric,0);
  general := round(neto-premios,2);
  pagos := case when jsonb_typeof(p_planilla->'pagos') = 'array' then p_planilla->'pagos'
    when coalesce((p_planilla->>'pagado')::boolean,false)
      then jsonb_build_array(jsonb_build_object('f',p_planilla->'fecha','m',neto))
    else '[]'::jsonb end;
  select round(coalesce(sum(abs(coalesce(nullif(p->>'m','')::numeric,0))),0),2)
    into pagado from jsonb_array_elements(pagos) p;
  debe := round(neto-pagado,2);
  saldado := debe <= 0 and (neto = 0 or jsonb_array_length(pagos) > 0);
  return jsonb_build_object('total',total,'com',comision,'neto',neto,'prem',premios,
    'gral',general,'pago',pagado,'debe',debe,'saldado',saldado,
    'parcial',not saldado and pagado>0,'P',pagos,
    'premAg',coalesce(nullif(p_planilla->>'premiosAg','')::numeric,0));
end $$;

-- Cada elemento conserva el concepto completo en "m" y la asignación en "ap".
create or replace function lozano.distribuir_cobro(
  p_conceptos jsonb, p_disponible numeric, p_prioridad text default 'viejo'
) returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  concepto record;
  ordenados jsonb;
  distribucion jsonb := '[]'::jsonb;
  total bigint := 0;
  restante bigint;
  importe bigint;
  asignado bigint;
  suma_asignada bigint := 0;
  sobrante bigint;
begin
  if jsonb_typeof(p_conceptos) is distinct from 'array' or p_disponible is null then
    raise exception 'Datos de distribución inválidos' using errcode = '22023';
  end if;
  restante := greatest(0, floor(p_disponible * 100 + 0.5))::bigint;
  if restante = 0 or jsonb_array_length(p_conceptos) = 0 then
    select coalesce(jsonb_agg(jsonb_build_object('m', item, 'ap', 0) order by orden), '[]'::jsonb)
      into distribucion
      from jsonb_array_elements(p_conceptos) with ordinality as e(item, orden);
    return distribucion;
  end if;

  if p_prioridad = 'prop' then
    select coalesce(sum(greatest(0,floor(coalesce((item->>'imp')::numeric,0)*100+0.5))),0)::bigint
      into total from jsonb_array_elements(p_conceptos) as item;
    if restante >= total then
      select coalesce(jsonb_agg(jsonb_build_object('m',item,'ap',
        greatest(0,floor(coalesce((item->>'imp')::numeric,0)*100+0.5))/100) order by orden),'[]'::jsonb)
        into distribucion from jsonb_array_elements(p_conceptos) with ordinality as e(item,orden);
      return distribucion;
    end if;
    for concepto in select item from jsonb_array_elements(p_conceptos) with ordinality as e(item,orden) order by orden
    loop
      importe := greatest(0,floor(coalesce((concepto.item->>'imp')::numeric,0)*100+0.5))::bigint;
      asignado := floor(restante::numeric * importe / total)::bigint;
      suma_asignada := suma_asignada + asignado;
      distribucion := distribucion || jsonb_build_array(jsonb_build_object('m',concepto.item,'centavos',asignado));
    end loop;
    sobrante := restante - suma_asignada;
    ordenados := '[]'::jsonb;
    for concepto in select item from jsonb_array_elements(distribucion) with ordinality as e(item,orden) order by orden
    loop
      importe := greatest(0,floor(coalesce((concepto.item->'m'->>'imp')::numeric,0)*100+0.5))::bigint;
      asignado := (concepto.item->>'centavos')::bigint;
      total := least(sobrante, importe-asignado);
      asignado := asignado+total;
      sobrante := sobrante-total;
      ordenados := ordenados || jsonb_build_array(jsonb_build_object('m',concepto.item->'m','ap',asignado::numeric/100));
    end loop;
    return ordenados;
  end if;

  for concepto in
    select item from jsonb_array_elements(p_conceptos) with ordinality as e(item,orden)
    order by case when p_prioridad not in ('viejo','todo') and item->>'t' = p_prioridad then 0 else 1 end,
      case when coalesce((item->>'fut')::boolean,false) then 1 else 0 end,
      coalesce(item->>'f',''), orden
  loop
    importe := greatest(0,floor(coalesce((concepto.item->>'imp')::numeric,0)*100+0.5))::bigint;
    asignado := least(restante,importe);
    restante := restante-asignado;
    distribucion := distribucion || jsonb_build_array(jsonb_build_object('m',concepto.item,'ap',asignado::numeric/100));
  end loop;
  return distribucion;
end $$;

-- Devuelve el socio y el cobro actualizados sin alterar el estado recibido.
-- La transacción que persista ambos registros se implementa en la capa RPC.
create or replace function lozano.editar_cobro_calcular(
  p_socio jsonb, p_cobro jsonb, p_monto numeric,
  p_fecha date, p_medio text, p_detalle jsonb
) returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  monto_anterior numeric;
  sobrante_anterior numeric;
  saldo_anterior numeric;
  aplicado numeric;
  reduccion numeric;
  nuevo_sobrante numeric;
  nuevo_saldo numeric;
begin
  if jsonb_typeof(p_socio) is distinct from 'object'
     or jsonb_typeof(p_cobro) is distinct from 'object'
     or p_cobro->>'sid' is distinct from p_socio->>'id'
     or p_cobro->>'sid' is null
     or coalesce((p_cobro->>'anulado')::boolean,false)
     or p_fecha is null or p_monto is null or p_monto < 0 or p_monto <> round(p_monto,2)
     or p_medio is null or p_medio not in ('','efectivo','transferencia','echeq','cheque','mp')
     or (p_detalle is not null and jsonb_typeof(p_detalle) not in ('object','null')) then
    raise exception 'Datos de edición de cobro inválidos' using errcode = '22023';
  end if;

  monto_anterior := coalesce((p_cobro->>'monto')::numeric,0);
  sobrante_anterior := coalesce((p_cobro->>'quedo')::numeric,0);
  saldo_anterior := coalesce((p_socio->>'favor')::numeric,0);
  aplicado := monto_anterior-sobrante_anterior;
  reduccion := monto_anterior-p_monto;
  if p_monto < aplicado then
    raise exception 'El monto no puede quedar por debajo de lo ya aplicado' using errcode = '22023';
  end if;
  if reduccion > saldo_anterior then
    raise exception 'Parte del saldo a favor de este cobro ya se utilizó' using errcode = '22023';
  end if;
  nuevo_sobrante := greatest(0,sobrante_anterior-reduccion);
  nuevo_saldo := greatest(0,saldo_anterior+nuevo_sobrante-sobrante_anterior);
  return jsonb_build_object(
    'socio',p_socio || jsonb_build_object('favor',nuevo_saldo),
    'cobro',p_cobro || jsonb_build_object('monto',p_monto,'fecha',p_fecha,
      'medio',p_medio,'det',p_detalle,'quedo',nuevo_sobrante)
  );
end $$;

-- Calcula la vista previa con los conceptos que la operación ya seleccionó.
-- El monto nulo solicita el importe sugerido por el maquetado.
create or replace function lozano.calcular_cobro(
  p_conceptos jsonb, p_favor numeric, p_deuda numeric,
  p_prioridad text, p_usar_favor boolean, p_monto numeric default null
) returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  concepto jsonb;
  asignacion jsonb;
  asignaciones jsonb;
  aplicados jsonb := '[]'::jsonb;
  favor_usado numeric;
  disponible_favor numeric;
  base numeric := 0;
  total numeric := 0;
  monto numeric;
  importe numeric;
  aplicado numeric := 0;
  aplicado_vencido numeric := 0;
  sugerido numeric;
  sobrante numeric;
  falta numeric;
  favor_final numeric;
  deuda_final numeric;
  orden text;
begin
  if jsonb_typeof(p_conceptos) is distinct from 'array'
    or p_favor is null or p_favor < 0 or p_deuda is null or p_deuda < 0
    or p_usar_favor is null or p_prioridad is null
    or (p_monto is not null and (p_monto < 0 or round(p_monto,2) <> p_monto)) then
    raise exception 'Datos de cobro inválidos' using errcode = '22023';
  end if;
  orden := case when p_prioridad = 'todo' then 'viejo' else p_prioridad end;
  disponible_favor := case when p_usar_favor then p_favor else 0 end;
  for concepto in select value from jsonb_array_elements(p_conceptos)
  loop
    if jsonb_typeof(concepto) is distinct from 'object'
      or jsonb_typeof(concepto->'imp') is distinct from 'number'
      or (concepto->>'imp')::numeric < 0
      or (concepto->>'imp')::numeric <> round((concepto->>'imp')::numeric,2) then
      raise exception 'Concepto de cobro inválido' using errcode = '22023';
    end if;
    importe := (concepto->>'imp')::numeric;
    total := total+importe;
    if orden = 'viejo' or concepto->>'t' = orden or coalesce((concepto->>'fut')::boolean,false) then
      base := base+importe;
    end if;
  end loop;
  sugerido := greatest(0,round(base-disponible_favor,2));
  monto := coalesce(p_monto,sugerido);
  asignaciones := lozano.distribuir_cobro(p_conceptos,round(monto+disponible_favor,2),orden);
  for asignacion in select value from jsonb_array_elements(asignaciones)
  loop
    importe := (asignacion->>'ap')::numeric;
    if importe > 0 then
      aplicados := aplicados || jsonb_build_array(asignacion);
      aplicado := aplicado+importe;
      if not coalesce((asignacion->'m'->>'fut')::boolean,false) then
        aplicado_vencido := aplicado_vencido+importe;
      end if;
    end if;
  end loop;
  favor_usado := least(disponible_favor,round(aplicado,2));
  sobrante := greatest(0,round(monto-(aplicado-favor_usado),2));
  falta := greatest(0,round(total-aplicado,2));
  favor_final := round(p_favor-favor_usado+sobrante,2);
  deuda_final := round(p_deuda-aplicado_vencido,2);
  return jsonb_build_object(
    'A',monto,'al',asignaciones,'apl',aplicados,'usado',favor_usado,
    'quedo',sobrante,'falta',falta,'favorFinal',favor_final,
    'deudaFinal',deuda_final,'sugerido',sugerido
  );
end $$;

-- Calcula el estado de cuenta a partir de la instantánea transaccional de la agencia.
create or replace function lozano.cuenta_socio_calcular(
  p_estado jsonb, p_socio_id text, p_hoy date
) returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  socio jsonb;
  registro jsonb;
  cuota jsonb;
  pago jsonb;
  indice integer;
  monto numeric;
  vencimiento date;
  deuda numeric := 0;
  proximo numeric := 0;
  favor numeric;
begin
  if jsonb_typeof(p_estado) is distinct from 'object' or p_socio_id is null or p_hoy is null then
    raise exception 'Datos de cuenta inválidos' using errcode = '22023';
  end if;
  select value into socio from jsonb_array_elements(coalesce(p_estado->'socios','[]'::jsonb))
    where value->>'id' = p_socio_id;
  if not found then raise exception 'No se encontró el socio' using errcode = '22023'; end if;
  favor := coalesce((socio->>'favor')::numeric,0);

  for registro in select value from jsonb_array_elements(coalesce(p_estado->'seguros','[]'::jsonb))
    where value->>'sid'=p_socio_id
  loop
    for cuota in select value from jsonb_array_elements(coalesce(registro->'cuotas','[]'::jsonb))
    loop
      if coalesce(cuota->>'pago','') <> '' or coalesce((cuota->>'anulado')::boolean,false) then continue; end if;
      monto := greatest(0,round(coalesce((cuota->>'imp')::numeric,0)-coalesce((cuota->>'abono')::numeric,0),2));
      vencimiento := (cuota->>'venc')::date;
      if vencimiento <= p_hoy then deuda:=deuda+monto; else proximo:=proximo+monto; end if;
    end loop;
  end loop;

  for registro in select value from jsonb_array_elements(coalesce(p_estado->'q6','[]'::jsonb))
    where value->>'sid'=p_socio_id
  loop
    if coalesce((registro->>'pagado')::boolean,false) or coalesce((registro->>'anulado')::boolean,false) then continue; end if;
    deuda:=deuda+greatest(0,round(coalesce((registro->>'monto')::numeric,0)-coalesce((registro->>'abono')::numeric,0),2));
  end loop;
  for registro in select value from jsonb_array_elements(coalesce(p_estado->'quiniela','[]'::jsonb))
    where value->>'sid'=p_socio_id
  loop
    if coalesce((registro->>'pagado')::boolean,false) or coalesce((registro->>'anulado')::boolean,false) then continue; end if;
    deuda:=deuda+greatest(0,round(coalesce((registro->>'monto')::numeric,0)-coalesce((registro->>'abono')::numeric,0),2));
  end loop;
  for registro in select value from jsonb_array_elements(coalesce(p_estado->'lot','[]'::jsonb))
    where value->>'sid'=p_socio_id
  loop
    if coalesce((registro->>'pagado')::boolean,false) or coalesce((registro->>'anulado')::boolean,false) then continue; end if;
    deuda:=deuda+greatest(0,coalesce((registro->>'frac')::numeric,0)*coalesce((registro->>'precio')::numeric,0)-coalesce((registro->>'abono')::numeric,0));
  end loop;

  for registro in select value from jsonb_array_elements(coalesce(p_estado->'rifas','[]'::jsonb))
    where value->>'sid'=p_socio_id
  loop
    indice:=0;
    for pago in select value from jsonb_array_elements(coalesce(registro->'pagos','[]'::jsonb))
    loop
      if pago in ('null'::jsonb, 'false'::jsonb, '""'::jsonb)
        and not coalesce((registro->'anulados'->>indice)::boolean,false) then
        monto:=greatest(0,round(lozano.cuota_rifa((registro->>'importe')::numeric,(registro->>'ncuotas')::integer,indice)
          -coalesce((registro->'abonos'->>indice)::numeric,0),2));
        vencimiento:=((registro->>'desde')::date+make_interval(months=>indice))::date;
        if vencimiento<=p_hoy then deuda:=deuda+monto; else proximo:=proximo+monto; end if;
      end if;
      indice:=indice+1;
    end loop;
  end loop;

  deuda:=round(deuda,2);
  proximo:=round(proximo,2);
  return jsonb_build_object('deuda',deuda,'favor',favor,'neto',deuda-favor,
    'debe',greatest(0,deuda-favor),'aFavor',greatest(0,favor-deuda),'proximo',proximo);
end $$;

-- La revisión de la agencia serializa esta operación con los guardados existentes.
-- El UUID permite reintentar una solicitud sin aplicar el cambio dos veces.
create or replace function public.lozano_editar_cobro(
  p_revision bigint, p_operacion uuid, p_cobro_id text,
  p_monto numeric, p_fecha date, p_medio text, p_detalle jsonb
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  perfil lozano.perfiles;
  revision_actual bigint;
  operacion lozano.operaciones;
  huella text;
  cobro jsonb;
  socio jsonb;
  resultado jsonb;
  socio_id text;
begin
  perfil := lozano.exigir_perfil();
  if p_revision is null or p_operacion is null or p_cobro_id is null
    or p_cobro_id !~ '^[a-zA-Z0-9_-]{1,128}$' then
    raise exception 'Datos de operación inválidos' using errcode = '22023';
  end if;
  huella := encode(sha256(convert_to(jsonb_build_array(
    'editar_cobro',p_cobro_id,p_monto,p_fecha,p_medio,p_detalle
  )::text,'UTF8')),'hex');

  select revision into strict revision_actual from lozano.configuracion for update;
  select * into operacion from lozano.operaciones where id = p_operacion;
  if found then
    if operacion.actor <> perfil.id or operacion.revision_anterior <> p_revision
      or operacion.huella <> huella then
      raise exception 'El identificador de operación ya fue utilizado' using errcode = '22023';
    end if;
    return operacion.revision;
  end if;
  if p_revision <> revision_actual then
    raise exception 'Los datos cambiaron. Volvé a cargarlos antes de guardar.' using errcode = '40001';
  end if;

  select datos into cobro from lozano.cobros where clave = p_cobro_id for update;
  if not found then raise exception 'No se encontró el cobro' using errcode = '22023'; end if;
  socio_id := cobro->>'sid';
  select datos into socio from lozano.socios where clave = socio_id for update;
  if not found then raise exception 'No se encontró el socio del cobro' using errcode = '22023'; end if;
  resultado := lozano.editar_cobro_calcular(socio,cobro,p_monto,p_fecha,p_medio,p_detalle);

  update lozano.socios set datos = resultado->'socio' where clave = socio_id;
  update lozano.cobros set datos = resultado->'cobro' where clave = p_cobro_id;
  insert into lozano.actividad(actor,nombre_actor,coleccion,clave,accion)
    values (perfil.id,perfil.nombre,'cobros',p_cobro_id,'Modificó');
  update lozano.configuracion set revision = revision+1 returning revision into revision_actual;
  insert into lozano.operaciones(id,actor,revision,revision_anterior,huella)
    values (p_operacion,perfil.id,revision_actual,p_revision,huella);
  return revision_actual;
end $$;

revoke all on function lozano.cuenta_socio_calcular(jsonb,text,date) from public, anon, authenticated;
revoke all on function public.lozano_editar_cobro(bigint,uuid,text,numeric,date,text,jsonb) from public, anon, authenticated;
revoke all on function lozano.calcular_cobro(jsonb,numeric,numeric,text,boolean,numeric) from public, anon, authenticated;
revoke all on function lozano.editar_cobro_calcular(jsonb,jsonb,numeric,date,text,jsonb) from public, anon, authenticated;
revoke all on function lozano.distribuir_cobro(jsonb,numeric,text) from public, anon, authenticated;
revoke all on function lozano.cuotas_seguro(date,text,numeric,jsonb),
  lozano.cuota_rifa(numeric,integer,integer), lozano.toto_calcular(jsonb)
  from public, anon, authenticated;
commit;
