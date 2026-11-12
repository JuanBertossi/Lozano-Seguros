-- Procedimientos del panel (cobros, saldos, anulaciones y todos los flujos de la maqueta).
-- Requiere haber ejecutado 00-lozano-supabase.sql y 01-actualizar-roles.sql.
-- Después ejecutar 03-panel.sql y, al final, 04-permisos.sql.
-- El ordenamiento acepta 64 o más conceptos con fechas coherentes. El cálculo
-- rechaza únicamente entradas inconsistentes que producen un comparador no
-- transitivo; las fechas vencidas y futuras válidas no pueden solaparse.
-- Funciones de cálculo aisladas para comparar con el maquetado.
begin;

-- Una operación sin cambios conserva la revisión. La unicidad sigue vigente
-- para las operaciones que sí avanzan el estado y sus UUID permanecen trazables.
alter table agencia.operaciones drop constraint if exists operaciones_revision_key;
create unique index if not exists operaciones_revision_mutacion_idx on agencia.operaciones(revision) where revision>revision_anterior;

create or replace function agencia.cuotas_seguro(
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

create or replace function agencia.cuota_rifa(
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

-- Emula redondear() de la maqueta: Math.round sobre números binarios de JS.
create or replace function agencia.toto_redondear(p_valor double precision)
returns double precision language plpgsql immutable set search_path = '' as $$
declare escalado double precision := (coalesce(p_valor,0)+2.220446049250313e-16::double precision)*100;
begin
  return (case when escalado-floor(escalado)<0.5 then floor(escalado) else ceil(escalado) end)/100;
end $$;

create or replace function agencia.toto_calcular(p_planilla jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  total double precision;
  comision double precision;
  neto double precision;
  premios double precision;
  general double precision;
  pagos jsonb;
  pagado double precision;
  debe double precision;
  saldado boolean;
begin
  if jsonb_typeof(p_planilla) is distinct from 'object' then
    raise exception 'Planilla inválida' using errcode = '22023';
  end if;
  select agencia.toto_redondear(coalesce(sum(coalesce(nullif(p_planilla->>juego, '')::double precision, 0)), 0))
    into total from unnest(array['previa','primera','matutina','vespertina','nocturna','turista','quini6','loto']) juego;
  comision := agencia.toto_redondear(total * 12 / 100);
  neto := agencia.toto_redondear(total - comision);
  premios := coalesce(nullif(p_planilla->>'premios','')::double precision,0);
  general := agencia.toto_redondear(neto-premios);
  pagos := case when jsonb_typeof(p_planilla->'pagos') = 'array' then p_planilla->'pagos'
    when coalesce((p_planilla->>'pagado')::boolean,false)
      then jsonb_build_array(jsonb_build_object('f',p_planilla->'fecha','m',neto))
    else '[]'::jsonb end;
  select agencia.toto_redondear(coalesce(sum(abs(coalesce(nullif(p->>'m','')::double precision,0))),0))
    into pagado from jsonb_array_elements(pagos) p;
  debe := agencia.toto_redondear(neto-pagado);
  saldado := debe <= 0 and (neto = 0 or jsonb_array_length(pagos) > 0);
  return jsonb_build_object('total',total,'com',comision,'neto',neto,'prem',premios,
    'gral',general,'pago',pagado,'debe',debe,'saldado',saldado,
    'parcial',not saldado and pagado>0,'P',pagos,
    'premAg',coalesce(nullif(p_planilla->>'premiosAg','')::numeric,0));
end $$;
revoke all on function agencia.toto_redondear(double precision) from public, anon, authenticated;

-- El comparador de la maqueta solo compara fut cuando está presente en ambos;
-- si falta en uno de ellos, JavaScript obtiene NaN y pasa a comparar fechas.
create or replace function agencia.comparar_conceptos(p_a jsonb,p_b jsonb,p_prioridad text)
returns integer language plpgsql immutable set search_path = '' as $$
declare pa integer; pb integer; fa boolean; fb boolean; a text; b text;
begin
  pa:=case when p_prioridad not in ('viejo','todo') and p_a->>'t'=p_prioridad then 0 else 1 end;
  pb:=case when p_prioridad not in ('viejo','todo') and p_b->>'t'=p_prioridad then 0 else 1 end;
  if pa<>pb then return pa-pb; end if;
  if p_a ? 'fut' and p_b ? 'fut' and p_a->'fut' <> 'null'::jsonb and p_b->'fut' <> 'null'::jsonb then
    fa:=(p_a->>'fut')::boolean; fb:=(p_b->>'fut')::boolean;
    if fa<>fb then return case when fa then 1 else -1 end; end if;
  end if;
  a:=coalesce(p_a->>'f',''); b:=coalesce(p_b->>'f','');
  return case when a collate "C" < b collate "C" then -1 when a collate "C" > b collate "C" then 1 else 0 end;
end $$;

-- V8 ordena listas cortas detectando una secuencia inicial y extendiéndola
-- mediante inserción binaria estable. Para listas largas usamos ordenamiento
-- SQL únicamente cuando el comparador es transitivo en cada grupo de prioridad.
create or replace function agencia.ordenar_conceptos_cortos(p_items jsonb,p_prioridad text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare a jsonb[]; n integer; runlen integer; i integer; j integer; lo integer; hi integer; mid integer; pivot jsonb; tmp jsonb; descendente boolean;
begin
  select coalesce(array_agg(value order by ord),array[]::jsonb[]) into a from jsonb_array_elements(p_items) with ordinality x(value,ord);
  n:=cardinality(a);
  if n>=64 then
    if exists (
      select 1 from jsonb_array_elements(p_items) x(item)
      group by case when p_prioridad not in ('viejo','todo') and item->>'t'=p_prioridad then 0 else 1 end
      having bool_or(not (item ? 'fut'))
        and bool_or(item->'fut'='true'::jsonb)
        and bool_or(item->'fut'='false'::jsonb)
        and min(coalesce(item->>'f','') collate "C") filter (where item->'fut'='true'::jsonb)
            <= max(coalesce(item->>'f','') collate "C") filter (where item->'fut'='false'::jsonb)
    ) then
      raise exception 'La distribución de 64 o más conceptos con fechas mixtas todavía no está disponible' using errcode='0A000';
    end if;
    return (
      select coalesce(jsonb_agg(item order by prioridad,
        case when faltante then 0 when item->'fut'='true'::jsonb then 1 else 0 end,
        coalesce(item->>'f','') collate "C",ord),'[]'::jsonb)
      from (
        select item,ord,prioridad,bool_or(not (item ? 'fut')) over (partition by prioridad) faltante
        from (
          select item,ord,case when p_prioridad not in ('viejo','todo') and item->>'t'=p_prioridad then 0 else 1 end prioridad
          from jsonb_array_elements(p_items) with ordinality x(item,ord)
        ) grupos
      ) ordenables
    );
  end if;
  if n<2 then return p_items; end if;
  descendente:=agencia.comparar_conceptos(a[2],a[1],p_prioridad)<0;
  runlen:=2;
  while runlen<n loop
    exit when (agencia.comparar_conceptos(a[runlen+1],a[runlen],p_prioridad)<0) is distinct from descendente;
    runlen:=runlen+1;
  end loop;
  if descendente then
    for i in 1..(runlen/2) loop tmp:=a[i]; a[i]:=a[runlen-i+1]; a[runlen-i+1]:=tmp; end loop;
  end if;
  i:=runlen+1;
  while i<=n loop
    pivot:=a[i]; lo:=1; hi:=i;
    while lo<hi loop
      mid:=(lo+hi)/2;
      if agencia.comparar_conceptos(pivot,a[mid],p_prioridad)<0 then hi:=mid; else lo:=mid+1; end if;
    end loop;
    j:=i;
    while j>lo loop a[j]:=a[j-1]; j:=j-1; end loop;
    a[lo]:=pivot; i:=i+1;
  end loop;
  return to_jsonb(a);
end $$;
revoke all on function agencia.comparar_conceptos(jsonb,jsonb,text), agencia.ordenar_conceptos_cortos(jsonb,text) from public, anon, authenticated;

-- Cada elemento conserva el concepto completo en "m" y la asignación en "ap".
create or replace function agencia.distribuir_cobro(
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
    select item from jsonb_array_elements(agencia.ordenar_conceptos_cortos(p_conceptos,p_prioridad)) with ordinality as e(item,orden)
    order by orden
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
create or replace function agencia.editar_cobro_calcular(
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
  detalle_normalizado jsonb;
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
  detalle_normalizado := agencia.seguro_detalle_pago(p_medio,p_detalle,p_cobro->'det');
  return jsonb_build_object(
    'socio',p_socio || jsonb_build_object('favor',nuevo_saldo),
    'cobro',p_cobro || jsonb_build_object('monto',p_monto,'fecha',p_fecha,
      'medio',p_medio,'det',coalesce(detalle_normalizado,'null'::jsonb),'quedo',nuevo_sobrante)
  );
end $$;

-- Calcula la vista previa con los conceptos que la operación ya seleccionó.
-- El monto nulo solicita el importe sugerido por el maquetado.
create or replace function agencia.calcular_cobro(
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
  asignaciones := agencia.distribuir_cobro(p_conceptos,round(monto+disponible_favor,2),orden);
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
create or replace function agencia.cuenta_socio_calcular(
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
        monto:=greatest(0,round(agencia.cuota_rifa((registro->>'importe')::numeric,(registro->>'ncuotas')::integer,indice)
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
create or replace function public.agencia_editar_cobro(
  p_revision bigint, p_operacion uuid, p_cobro_id text,
  p_monto numeric, p_fecha date, p_medio text, p_detalle jsonb
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  perfil agencia.perfiles;
  revision_actual bigint;
  operacion agencia.operaciones;
  huella text;
  cobro jsonb;
  socio jsonb;
  resultado jsonb;
  socio_id text;
begin
  perfil := agencia.exigir_perfil();
  if p_revision is null or p_operacion is null or p_cobro_id is null
    or p_cobro_id !~ '^[a-zA-Z0-9_-]{1,128}$' then
    raise exception 'Datos de operación inválidos' using errcode = '22023';
  end if;
  huella := encode(sha256(convert_to(jsonb_build_array(
    'editar_cobro',p_cobro_id,p_monto,p_fecha,p_medio,p_detalle
  )::text,'UTF8')),'hex');

  select revision into strict revision_actual from agencia.configuracion for update;
  select * into operacion from agencia.operaciones where id = p_operacion;
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

  select datos into cobro from agencia.cobros where clave = p_cobro_id for update;
  if not found then raise exception 'No se encontró el cobro' using errcode = '22023'; end if;
  socio_id := cobro->>'sid';
  select datos into socio from agencia.socios where clave = socio_id for update;
  if not found then raise exception 'No se encontró el socio del cobro' using errcode = '22023'; end if;
  resultado := agencia.editar_cobro_calcular(socio,cobro,p_monto,p_fecha,p_medio,p_detalle);

  update agencia.socios set datos = resultado->'socio' where clave = socio_id;
  update agencia.cobros set datos = resultado->'cobro' where clave = p_cobro_id;
  insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
    values (perfil.id,perfil.nombre,'cobros',p_cobro_id,'Modificó');
  update agencia.configuracion set revision = revision+1 returning revision into revision_actual;
  insert into agencia.operaciones(id,actor,revision,revision_anterior,huella)
    values (p_operacion,perfil.id,revision_actual,p_revision,huella);
  return revision_actual;
end $$;

-- Asigna una posición de una lista JSON, rellenando las posiciones omitidas
-- con null, como los arreglos dispersos que genera el navegador.
create or replace function agencia.lista_asignar(p_lista jsonb, p_indice integer, p_valor jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare lista jsonb := coalesce(nullif(p_lista, 'null'::jsonb), '[]'::jsonb);
begin
  if jsonb_typeof(lista) <> 'array' or p_indice is null or p_indice < 0 or p_indice > 10000 then
    raise exception 'Índice de cuota inválido' using errcode = '22023';
  end if;
  while jsonb_array_length(lista) <= p_indice loop
    lista := lista || 'null'::jsonb;
  end loop;
  return jsonb_set(lista, array[p_indice::text], coalesce(p_valor, 'null'::jsonb));
end $$;

-- Opera sobre una copia del registro; el procedimiento de cobro es responsable
-- de seleccionar y bloquear la fila real y persistir todas las filas juntas.
create or replace function agencia.aplicar_pago_registro(
  p_tipo text, p_registro jsonb, p_indice integer, p_importe numeric,
  p_fecha date, p_medio text, p_detalle jsonb, p_ahora timestamptz
) returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  resultado jsonb := p_registro;
  cuota jsonb;
  total numeric;
  abonado numeric;
  restante numeric;
  completo boolean;
begin
  if jsonb_typeof(p_registro) is distinct from 'object' or p_importe is null
     or p_importe <= 0 or p_importe <> round(p_importe,2)
     or p_fecha is null or p_ahora is null or p_medio is null then
    raise exception 'Datos de aplicación inválidos' using errcode = '22023';
  end if;
  if p_tipo = 'seg' then
    cuota := p_registro->'cuotas'->p_indice;
    if p_indice is null or p_indice < 0 or jsonb_typeof(cuota) is distinct from 'object'
       or coalesce(cuota->>'pago','') <> '' or coalesce((cuota->>'anulado')::boolean,false) then
      raise exception 'Cuota de seguro no disponible' using errcode = '22023';
    end if;
    total := (cuota->>'imp')::numeric;
    abonado := coalesce((cuota->>'abono')::numeric,0);
  elsif p_tipo = 'rifa' then
    if p_indice is null or p_indice < 0 or p_indice >= coalesce((p_registro->>'ncuotas')::integer,0)
       or coalesce(p_registro->'pagos'->>p_indice,'') <> ''
       or coalesce((p_registro->'anulados'->>p_indice)::boolean,false) then
      raise exception 'Cuota de rifa no disponible' using errcode = '22023';
    end if;
    total := agencia.cuota_rifa((p_registro->>'importe')::numeric,(p_registro->>'ncuotas')::integer,p_indice);
    abonado := coalesce((p_registro->'abonos'->>p_indice)::numeric,0);
  elsif p_tipo in ('q6','lot','quiniela') then
    if coalesce((p_registro->>'pagado')::boolean,false) or coalesce((p_registro->>'anulado')::boolean,false) then
      raise exception 'Movimiento no disponible' using errcode = '22023';
    end if;
    total := case when p_tipo = 'lot' then (p_registro->>'frac')::numeric * (p_registro->>'precio')::numeric
                  else (p_registro->>'monto')::numeric end;
    abonado := coalesce((p_registro->>'abono')::numeric,0);
  else
    raise exception 'Tipo de movimiento inválido' using errcode = '22023';
  end if;
  restante := greatest(0, round(total-abonado,2));
  if total is null or abonado < 0 or restante <= 0 or p_importe > restante then
    raise exception 'Importe de aplicación inválido' using errcode = '22023';
  end if;
  completo := p_importe >= restante;
  if p_tipo = 'seg' then
    if completo then
      cuota := cuota || jsonb_build_object('pago',p_fecha,'medio',p_medio,'pts',p_ahora,
        'det',case when p_detalle is null or p_detalle = 'null'::jsonb then 'null'::jsonb
                   else p_detalle || '{"c":1}'::jsonb end);
    else cuota := cuota || jsonb_build_object('abono',round(abonado+p_importe,2)); end if;
    resultado := jsonb_set(resultado, array['cuotas',p_indice::text], cuota);
  elsif p_tipo = 'rifa' then
    if completo then
      resultado := resultado || jsonb_build_object(
        'pagos',agencia.lista_asignar(resultado->'pagos',p_indice,to_jsonb(p_fecha)),
        'medios',agencia.lista_asignar(resultado->'medios',p_indice,to_jsonb(p_medio)),
        'dets',agencia.lista_asignar(resultado->'dets',p_indice,p_detalle),
        'pts',agencia.lista_asignar(resultado->'pts',p_indice,to_jsonb(p_ahora)));
    else
      resultado := resultado || jsonb_build_object('abonos',agencia.lista_asignar(resultado->'abonos',p_indice,to_jsonb(round(abonado+p_importe,2))));
    end if;
  elsif completo then
    resultado := resultado || jsonb_build_object('pagado',true,'fpago',p_fecha,'medio',p_medio,'det',p_detalle,'pts',p_ahora);
  else resultado := resultado || jsonb_build_object('abono',round(abonado+p_importe,2)); end if;
  return resultado;
end $$;

-- Revierte un vínculo de pago en el registro de origen. El llamador debe
-- resolver antes los vínculos de otros cobros que completaron el mismo abono.
create or replace function agencia.revertir_pago_registro(
  p_tipo text, p_registro jsonb, p_indice integer, p_completo boolean, p_abono numeric
) returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  resultado jsonb := p_registro;
  cuota jsonb;
  abono_actual numeric;
begin
  if jsonb_typeof(resultado) is distinct from 'object' or p_completo is null
     or (not p_completo and (p_abono is null or p_abono < 0)) then
    raise exception 'Vínculo de pago inválido' using errcode = '22023';
  end if;
  if p_tipo = 'seg' then
    cuota := resultado->'cuotas'->p_indice;
    if p_indice is null or p_indice < 0 or jsonb_typeof(cuota) is distinct from 'object' then
      raise exception 'Cuota de seguro inexistente' using errcode = '22023';
    end if;
    if p_completo then cuota := cuota || '{"pago":null,"medio":"","det":null}'::jsonb;
    else cuota := cuota || jsonb_build_object('abono',greatest(0,coalesce((cuota->>'abono')::numeric,0)-p_abono)); end if;
    resultado := jsonb_set(resultado,array['cuotas',p_indice::text],cuota);
  elsif p_tipo = 'rifa' then
    if p_indice is null or p_indice < 0 or p_indice >= coalesce((resultado->>'ncuotas')::integer,0) then
      raise exception 'Cuota de rifa inexistente' using errcode = '22023';
    end if;
    if p_completo then
      resultado := resultado || jsonb_build_object('pagos',agencia.lista_asignar(resultado->'pagos',p_indice,'null'::jsonb));
      if jsonb_typeof(resultado->'medios') = 'array' then resultado := resultado || jsonb_build_object('medios',agencia.lista_asignar(resultado->'medios',p_indice,'""'::jsonb)); end if;
      if jsonb_typeof(resultado->'dets') = 'array' then resultado := resultado || jsonb_build_object('dets',agencia.lista_asignar(resultado->'dets',p_indice,'null'::jsonb)); end if;
    else
      abono_actual := coalesce((resultado->'abonos'->>p_indice)::numeric,0);
      resultado := resultado || jsonb_build_object('abonos',agencia.lista_asignar(resultado->'abonos',p_indice,to_jsonb(greatest(0,abono_actual-p_abono))));
    end if;
  elsif p_tipo in ('q6','lot','quiniela') then
    if p_completo then resultado := (resultado - 'fpago' - 'medio' - 'det') || '{"pagado":false}'::jsonb;
    else resultado := resultado || jsonb_build_object('abono',greatest(0,coalesce((resultado->>'abono')::numeric,0)-p_abono)); end if;
  else raise exception 'Tipo de movimiento inválido' using errcode = '22023'; end if;
  return resultado;
end $$;

revoke all on function agencia.revertir_pago_registro(text,jsonb,integer,boolean,numeric) from public, anon, authenticated;
revoke all on function agencia.lista_asignar(jsonb,integer,jsonb),
  agencia.aplicar_pago_registro(text,jsonb,integer,numeric,date,text,jsonb,timestamptz)
  from public, anon, authenticated;
revoke all on function agencia.cuenta_socio_calcular(jsonb,text,date) from public, anon, authenticated;
revoke all on function public.agencia_editar_cobro(bigint,uuid,text,numeric,date,text,jsonb) from public, anon, authenticated;
revoke all on function agencia.calcular_cobro(jsonb,numeric,numeric,text,boolean,numeric) from public, anon, authenticated;
revoke all on function agencia.editar_cobro_calcular(jsonb,jsonb,numeric,date,text,jsonb) from public, anon, authenticated;
revoke all on function agencia.distribuir_cobro(jsonb,numeric,text) from public, anon, authenticated;
revoke all on function agencia.cuotas_seguro(date,text,numeric,jsonb),
  agencia.cuota_rifa(numeric,integer,integer), agencia.toto_calcular(jsonb)
  from public, anon, authenticated;
-- Renovación automática de Quini según los días y sorteos especiales configurados.
-- La función interna permite generar en la misma transacción que modifica
-- planes, precios o sorteos, sin registrar una operación artificial adicional.
create or replace function agencia.generar_quini_pendientes(p_perfil agencia.perfiles)
returns integer language plpgsql set search_path='' as $$
declare
 configuracion jsonb; socio record; fecha date; hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
 desde date; dias jsonb; dias_generales jsonb; especial jsonb; precio numeric; cantidad integer;
 clave_nueva text; posicion_nueva bigint; generadas integer:=0;
begin
 select datos into strict configuracion from agencia.configuracion;
 dias_generales:=coalesce(configuracion->'q6Dias','[]'::jsonb);
 if jsonb_typeof(dias_generales)<>'array' then raise exception 'Días de sorteo inválidos' using errcode='22023'; end if;
 select coalesce(max(posicion),0) into posicion_nueva from agencia.quini_jugadas;
 for socio in select datos from agencia.socios order by posicion loop
  if not coalesce((socio.datos->>'activo')::boolean,false) or not coalesce((socio.datos->'q6'->>'auto')::boolean,false) then continue; end if;
  dias:=coalesce(socio.datos->'q6'->'dias','[]'::jsonb);
  if jsonb_typeof(dias)<>'array' then raise exception 'Días de socio inválidos' using errcode='22023'; end if;
  if jsonb_array_length(dias)=0 then continue; end if;
  desde:=coalesce(nullif(socio.datos->'q6'->>'desde','')::date,hoy);
  cantidad:=coalesce(nullif((socio.datos->'q6'->>'cant')::integer,0),1);
  for fecha in select g::date from generate_series(desde::timestamp,hoy::timestamp,interval '1 day') g loop
   select datos into especial from agencia.quini_sorteos_especiales where datos->>'fecha'=fecha::text order by posicion limit 1;
   if not (dias_generales @> jsonb_build_array(extract(dow from fecha)::integer) or especial is not null) then continue; end if;
   if not (dias @> jsonb_build_array(extract(dow from fecha)::integer) or not dias_generales @> jsonb_build_array(extract(dow from fecha)::integer)) then continue; end if;
   if exists(select 1 from agencia.quini_jugadas where datos->>'sid'=socio.datos->>'id' and datos->>'fecha'=fecha::text)
    or exists(select 1 from agencia.quini_exclusiones where datos #>> '{}'=(socio.datos->>'id')||'|'||fecha::text) then continue; end if;
   precio:=case when especial is not null then (especial->>'precio')::numeric else (configuracion->>'q6Precio')::numeric end;
   if precio is null or precio<0 or cantidad<1 then raise exception 'Precio o cantidad de Quini inválido' using errcode='22023'; end if;
   clave_nueva:=replace(gen_random_uuid()::text,'-','');posicion_nueva:=posicion_nueva+1;
   insert into agencia.quini_jugadas(clave,posicion,datos) values(clave_nueva,posicion_nueva,jsonb_build_object('id',clave_nueva,'sid',socio.datos->>'id','fecha',fecha,'monto',precio*cantidad,'pagado',false,'auto',true,'ts','','por','auto'));
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_perfil.id,p_perfil.nombre,'q6',clave_nueva,'Creó');
   generadas:=generadas+1;
  end loop;
 end loop;
 return generadas;
end $$;
revoke all on function agencia.generar_quini_pendientes(agencia.perfiles) from public,anon,authenticated;

create or replace function public.agencia_generar_quini(p_revision bigint, p_operacion uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  perfil agencia.perfiles;
  anterior agencia.operaciones;
  revision_actual bigint;
  huella_actual text;
begin
  perfil := agencia.exigir_perfil();
  if p_revision is null or p_operacion is null then
    raise exception 'Revisión u operación inválida' using errcode='22023';
  end if;
  select revision into strict revision_actual from agencia.configuracion for update;
  huella_actual := encode(sha256(convert_to('generar_quini','UTF8')), 'hex');
  select * into anterior from agencia.operaciones where id=p_operacion;
  if found then
    if anterior.actor <> perfil.id or anterior.revision_anterior <> p_revision or anterior.huella <> huella_actual then
      raise exception 'El identificador de operación ya fue utilizado' using errcode='22023';
    end if;
    return anterior.revision;
  end if;
  if revision_actual <> p_revision then
    raise exception 'Los datos cambiaron. Volvé a cargarlos antes de guardar.' using errcode='40001';
  end if;
  if agencia.generar_quini_pendientes(perfil)>0 then
    update agencia.configuracion set revision=revision+1 returning revision into revision_actual;
  end if;
  insert into agencia.operaciones(id,actor,revision,revision_anterior,huella)
    values(p_operacion,perfil.id,revision_actual,p_revision,huella_actual);
  return revision_actual;
end $$;
revoke all on function public.agencia_generar_quini(bigint,uuid) from public, anon, authenticated;
-- El permiso se otorgará cuando el frontend use esta operación de forma transaccional.

-- Equivalente a aplicacionesAnteriores del maquetado para cobros sin vínculos.
create or replace function agencia.fecha_iso_segura(p_valor text)
returns timestamptz language plpgsql immutable set search_path='' as $$
begin
 if p_valor is null or p_valor !~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$' then return null; end if;
 if p_valor ~ '^\d{4}-\d{2}-\d{2}$' then return (p_valor || 'T00:00:00Z')::timestamptz; end if;
 if p_valor !~ '(Z|[+-]\d{2}:?\d{2})$' then return null; end if;
 return p_valor::timestamptz;
exception when others then return null;
end $$;

create or replace function agencia.aplicaciones_anteriores(p_cobro jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare
  r record; resultado jsonb; fecha_base timestamptz; fecha_pago timestamptz;
  fecha_texto text; n integer:=0; ambiguos integer:=0; base_valida boolean;
  candidatos jsonb:='[]'::jsonb; det jsonb; d jsonb; iguales boolean; k text;
begin
 if jsonb_typeof(p_cobro->'aplicados')='array' then return p_cobro->'aplicados'; end if;
 if p_cobro->'aplicados' is not null and p_cobro->'aplicados'<>'null'::jsonb then raise exception 'Aplicaciones históricas inválidas' using errcode='22023'; end if;
 n:=greatest(0,coalesce((p_cobro->>'cubre')::integer,0));
 if n=0 then return '[]'::jsonb; end if;
 fecha_base:=agencia.fecha_iso_segura(p_cobro->>'ts'); base_valida:=fecha_base is not null;
 for r in
   select jsonb_build_array('seg',s.clave,(q.ord-1)) ref,q.dato->>'pago' fecha,q.dato->>'medio' medio,q.dato->'det' det,q.dato->'pts' pts,s.posicion pos,q.ord indice,1 clase
   from agencia.seguros s cross join lateral jsonb_array_elements(s.datos->'cuotas') with ordinality q(dato,ord) where s.datos->>'sid'=p_cobro->>'sid'
   union all
   select jsonb_build_array('q6',s.clave),s.datos->>'fpago',s.datos->>'medio',s.datos->'det',s.datos->'pts',s.posicion,0,2 from agencia.quini_jugadas s where s.datos->>'sid'=p_cobro->>'sid'
   union all
   select jsonb_build_array('lot',s.clave),s.datos->>'fpago',s.datos->>'medio',s.datos->'det',s.datos->'pts',s.posicion,0,3 from agencia.loteria_ventas s where s.datos->>'sid'=p_cobro->>'sid'
   union all
   select jsonb_build_array('quiniela',s.clave),s.datos->>'fpago',s.datos->>'medio',s.datos->'det',s.datos->'pts',s.posicion,0,4 from agencia.quiniela_jugadas s where s.datos->>'sid'=p_cobro->>'sid'
   union all
   select jsonb_build_array('rifa',s.clave,(q.ord-1)),q.dato#>>'{}',s.datos->'medios'->>(q.ord-1)::integer,s.datos->'dets'->(q.ord-1)::integer,s.datos->'pts',s.posicion,q.ord,5
   from agencia.rifas s cross join lateral jsonb_array_elements(s.datos->'pagos') with ordinality q(dato,ord) where s.datos->>'sid'=p_cobro->>'sid'
   order by 8,6,7
 loop
   if r.fecha is distinct from p_cobro->>'fecha' or coalesce(r.medio,'')<>coalesce(p_cobro->>'medio','') then continue; end if;
   det:=nullif(p_cobro->'det','null'::jsonb); d:=nullif(r.det,'null'::jsonb);
   if (det is null)<>(d is null) then continue; end if;
   iguales:=true;
   if det is not null then
     foreach k in array array['banco','nro','librador','fcobro'] loop
       if coalesce(nullif(det->>k,''),'')<>coalesce(nullif(d->>k,''),'') then iguales:=false; exit; end if;
     end loop;
   end if;
   if not iguales then continue; end if;
   fecha_texto:=case when jsonb_typeof(r.pts)='string' then nullif(r.pts#>>'{}','')
     when jsonb_typeof(r.pts)='array' then coalesce(nullif(array_to_string(array(select jsonb_array_elements_text(r.pts)),',',''),''),'no-iso') else null end;
   fecha_texto:=coalesce(fecha_texto,p_cobro->>'ts'); fecha_pago:=agencia.fecha_iso_segura(fecha_texto);
   if base_valida and fecha_pago is null then ambiguos:=ambiguos+1; end if;
   candidatos:=candidatos||jsonb_build_array(jsonb_build_object('ref',r.ref,'completo',true,'abono',0,'pts',coalesce(nullif(r.pts,'null'::jsonb),'""'::jsonb),
     '_dist',case when base_valida and fecha_pago is not null then abs(extract(epoch from fecha_pago-fecha_base)) else null end));
 end loop;
 if ambiguos>0 and jsonb_array_length(candidatos)>1 then raise exception 'Fechas históricas ambiguas: revisar aplicaciones manualmente' using errcode='0A000'; end if;
 select coalesce(jsonb_agg(value-'_dist' order by case when base_valida then (value->>'_dist')::numeric else 0 end,ord),'[]'::jsonb) into resultado
 from (select value,ord from jsonb_array_elements(candidatos) with ordinality e(value,ord)
       order by case when base_valida then (value->>'_dist')::numeric else 0 end,ord limit n) e;
 return resultado;
end $$;
revoke all on function agencia.fecha_iso_segura(text),agencia.aplicaciones_anteriores(jsonb) from public,anon,authenticated;

-- Interna: la RPC llamadora debe validar perfil, bloquear configuracion FOR UPDATE,
-- validar revisión/idempotencia y actualizar revisión/operaciones en su transacción.
create or replace function agencia.revertir_cobro_moderno(p_cobro_id text,p_actor uuid,p_nombre text)
returns void language plpgsql set search_path='' as $$
declare
 c jsonb; socio jsonb; mov jsonb; pago jsonb; a jsonb; ref jsonb;
 otro record; x jsonb; nuevos jsonb; comp integer; recibido numeric;
 tipo text; id text; tabla text; indice integer; pagado boolean;
 saldo numeric; necesario numeric; aplicaciones jsonb;
begin
 select datos into c from agencia.cobros where clave=p_cobro_id for update;
 if c is null or coalesce((c->>'anulado')::boolean,false) then raise exception 'Cobro inexistente o anulado' using errcode='22023'; end if;
 aplicaciones:=agencia.aplicaciones_anteriores(c);
 select datos into socio from agencia.socios where clave=c->>'sid' for update;
 if socio is null then raise exception 'Socio inexistente' using errcode='22023'; end if;
 saldo:=coalesce((socio->>'favor')::numeric,0);
 necesario:=coalesce((c->>'quedo')::numeric,0)+coalesce((c->>'liberado')::numeric,0)-coalesce((c->>'usado')::numeric,0);
 if necesario>saldo then raise exception 'El saldo a favor ya se utilizó en otros pagos' using errcode='22023'; end if;
 for a in select value from jsonb_array_elements(aplicaciones) loop
   ref:=a->'ref';
   if jsonb_typeof(ref) is distinct from 'array' or jsonb_array_length(ref) not in (2,3) then raise exception 'Referencia de pago inválida' using errcode='22023'; end if;
   tipo:=ref->>0; id:=ref->>1;
   tabla:=case tipo when 'seg' then 'seguros' when 'rifa' then 'rifas' when 'q6' then 'quini_jugadas' when 'lot' then 'loteria_ventas' when 'quiniela' then 'quiniela_jugadas' end;
   if tabla is null or id is null or coalesce(a->>'completo','') not in ('true','false') then raise exception 'Aplicación de pago inválida' using errcode='22023'; end if;
   indice:=null;
   if tipo in ('seg','rifa') then
     if jsonb_array_length(ref)<>3 or (ref->>2) !~ '^[0-9]{1,6}$' then raise exception 'Índice de cuota inválido' using errcode='22023'; end if;
     indice:=(ref->>2)::integer;
   elsif jsonb_array_length(ref)<>2 then raise exception 'Referencia inválida' using errcode='22023'; end if;
   execute format('select datos from agencia.%I where clave=$1 for update',tabla) into mov using id;
   if mov is null or mov->>'sid' is distinct from c->>'sid' then raise exception 'Movimiento inexistente o de otro socio' using errcode='22023'; end if;
   if tipo='seg' then pago:=mov->'cuotas'->indice; pagado:=nullif(pago->>'pago','') is not null;
   elsif tipo='rifa' then pagado:=nullif(mov->'pagos'->>indice,'') is not null;
   else pagado:=coalesce((mov->>'pagado')::boolean,false); end if;
   comp:=0; recibido:=0;
   if not (a->>'completo')::boolean and pagado then
     for otro in select clave,datos from agencia.cobros where clave<>p_cobro_id and not coalesce((datos->>'anulado')::boolean,false) and jsonb_typeof(datos->'aplicados')='array' order by posicion for update loop
       nuevos:='[]'::jsonb;
       for x in select value from jsonb_array_elements(otro.datos->'aplicados') loop
         if jsonb_typeof(x->'ref')='array'
           and array(select jsonb_array_elements_text(x->'ref')) = array(select jsonb_array_elements_text(ref)) then
           if coalesce((x->>'completo')::boolean,false) then
             comp:=comp+1; recibido:=recibido+coalesce((x->>'imp')::numeric,0);
             x:=x||jsonb_build_object('completo',false,'abono',coalesce((x->>'imp')::numeric,0));
           else recibido:=recibido+coalesce((x->>'abono')::numeric,0); end if;
         end if;
         nuevos:=nuevos||jsonb_build_array(x);
       end loop;
       if nuevos is distinct from otro.datos->'aplicados' then
         update agencia.cobros set datos=jsonb_set(datos,'{aplicados}',nuevos) where clave=otro.clave;
         insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'cobros',otro.clave,'Modificó');
       end if;
     end loop;
   end if;
   if comp>0 then
     if tipo='rifa' then
       mov:=mov||jsonb_build_object('pagos',agencia.lista_asignar(mov->'pagos',indice,'null'::jsonb),'abonos',agencia.lista_asignar(mov->'abonos',indice,to_jsonb(recibido)));
     else
       mov:=agencia.revertir_pago_registro(tipo,mov,indice,true,0);
       if tipo='seg' then pago:=mov->'cuotas'->indice; pago:=pago||jsonb_build_object('abono',recibido); mov:=jsonb_set(mov,array['cuotas',indice::text],pago);
       else mov:=mov||jsonb_build_object('abono',recibido); end if;
     end if;
   else
     mov:=agencia.revertir_pago_registro(tipo,mov,indice,(a->>'completo')::boolean,coalesce((a->>'abono')::numeric,0));
   end if;
   execute format('update agencia.%I set datos=$1 where clave=$2',tabla) using mov,id;
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,tipo,id,'Modificó');
 end loop;
 update agencia.socios set datos=jsonb_set(datos,'{favor}',to_jsonb(greatest(0,saldo-necesario)),true) where clave=c->>'sid';
 update agencia.cobros set datos=jsonb_set(datos,'{anulado}','true'::jsonb,true) where clave=p_cobro_id;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'socios',c->>'sid','Modificó'),(p_actor,p_nombre,'cobros',p_cobro_id,'Modificó');
end $$;
revoke all on function agencia.revertir_cobro_moderno(text,uuid,text) from public,anon,authenticated;

create or replace function public.agencia_anular_cobro(p_revision bigint,p_operacion uuid,p_cobro_id text)
returns bigint language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles; op agencia.operaciones; revision_actual bigint; huella text;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or p_cobro_id is null or p_cobro_id !~ '^[a-zA-Z0-9_-]{1,128}$' then raise exception 'Datos de operación inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('anular_cobro',p_cobro_id)::text,'UTF8')),'hex');
 select revision into strict revision_actual from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
   if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
   return op.revision;
 end if;
 if revision_actual<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos antes de guardar.' using errcode='40001'; end if;
 perform agencia.revertir_cobro_moderno(p_cobro_id,perfil.id,perfil.nombre);
 update agencia.configuracion set revision=revision+1 returning revision into revision_actual;
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella) values(p_operacion,perfil.id,revision_actual,p_revision,huella);
 return revision_actual;
end $$;
revoke all on function public.agencia_anular_cobro(bigint,uuid,text) from public,anon,authenticated;

-- La función sigue sin habilitarse mientras se validan los demás flujos.
create or replace function public.agencia_estado_cheque(
  p_revision bigint, p_operacion uuid, p_referencia text, p_estado text
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  perfil agencia.perfiles;
  revision_actual bigint;
  anterior agencia.operaciones;
  huella text;
  partes text[];
  tipo text;
  registro_id text;
  indice integer;
  tabla text;
  coleccion text;
  ruta text[];
  registro jsonb;
  pago jsonb;
  detalle jsonb;
  medio text;
  fecha_pago text;
  monto numeric;
  rechazo_id text;
  fecha_hoy date;
begin
  perfil := agencia.exigir_perfil();
  if p_revision is null or p_operacion is null or p_referencia is null
     or p_estado not in ('pendiente','aprobado','rechazado') or p_estado is null then
    raise exception 'Operación o estado no válido' using errcode = '22023';
  end if;
  huella := encode(sha256(convert_to(jsonb_build_array('estado_cheque',p_referencia,p_estado)::text,'UTF8')),'hex');
  select revision into strict revision_actual from agencia.configuracion for update;
  select * into anterior from agencia.operaciones where id=p_operacion;
  if found then
    if anterior.actor <> perfil.id or anterior.revision_anterior <> p_revision or anterior.huella <> huella then
      raise exception 'El identificador de operación ya fue utilizado' using errcode='22023';
    end if;
    return anterior.revision;
  end if;
  if revision_actual <> p_revision then
    raise exception 'Los datos cambiaron. Volvé a cargarlos antes de guardar.' using errcode='40001';
  end if;

  if p_referencia like 'cobro:%' then
    tipo := 'cobro'; registro_id := substring(p_referencia from 7);
    tabla := 'cobros'; coleccion := 'cobros'; ruta := array['det'];
  else
    partes := string_to_array(p_referencia,'|'); tipo := partes[1]; registro_id := partes[2];
    if tipo in ('seg','rifa') then
      if array_length(partes,1)<>3 or partes[3] !~ '^[0-9]{1,6}$' then
        raise exception 'Referencia inválida' using errcode='22023';
      end if;
      indice := partes[3]::integer;
      if tipo='seg' then tabla := 'seguros'; coleccion := 'seguros'; ruta := array['cuotas',indice::text,'det'];
      else tabla := 'rifas'; coleccion := 'rifas'; ruta := array['dets',indice::text]; end if;
    elsif tipo in ('q6','lot','quiniela') and array_length(partes,1)=2 then
      tabla := case tipo when 'q6' then 'quini_jugadas' when 'lot' then 'loteria_ventas' else 'quiniela_jugadas' end;
      coleccion := tipo; ruta := array['det'];
    else raise exception 'Referencia inválida' using errcode='22023'; end if;
    -- Los pagos vinculados solo se pueden modificar mediante el cobro principal.
    if exists (select 1 from agencia.cobros c cross join lateral jsonb_array_elements(coalesce(c.datos->'aplicados','[]'::jsonb)) a
      where not coalesce((c.datos->>'anulado')::boolean,false)
        and array(select v #>> '{}' from jsonb_array_elements(a->'ref') v)=partes) then
      raise exception 'El cheque pertenece a un cobro' using errcode='22023';
    end if;
  end if;
  if registro_id is null or registro_id !~ '^[a-zA-Z0-9_-]{1,128}$' then
    raise exception 'Referencia inválida' using errcode='22023';
  end if;
  execute format('select datos from agencia.%I where clave=$1 for update',tabla) into registro using registro_id;
  if registro is null then raise exception 'No se encontró el cheque' using errcode='22023'; end if;
  detalle := registro #> ruta;
  if tipo='seg' then
    pago := registro #> array['cuotas',indice::text]; medio := pago->>'medio'; fecha_pago := pago->>'pago';
    if pago->>'pago' is null then raise exception 'Pago inexistente' using errcode='22023'; end if;
  elsif tipo='rifa' then
    medio := registro #>> array['medios',indice::text]; fecha_pago := registro #>> array['pagos',indice::text];
    if registro #>> array['pagos',indice::text] is null then raise exception 'Pago inexistente' using errcode='22023'; end if;
  else
    medio := registro->>'medio'; fecha_pago := registro->>'fpago';
    if tipo='cobro' and coalesce((registro->>'anulado')::boolean,false) then
      raise exception 'Cobro anulado' using errcode='22023';
    elsif tipo<>'cobro' and not coalesce((registro->>'pagado')::boolean,false) then
      raise exception 'Pago inexistente' using errcode='22023';
    end if;
  end if;
  if medio not in ('cheque','echeq') or medio is null or jsonb_typeof(detalle) is distinct from 'object' then
    raise exception 'No se encontró el cheque' using errcode='22023';
  end if;
  if tipo <> 'cobro' and coalesce(detalle->>'c', '') not in ('', '0', 'false') then
    raise exception 'El cheque pertenece a un cobro' using errcode='22023';
  end if;
  if p_estado='rechazado' then
    if tipo='cobro' then
      if jsonb_typeof(registro->'aplicados') is distinct from 'array'
         and jsonb_array_length(agencia.aplicaciones_anteriores(registro)) < greatest(0,coalesce((registro->>'cubre')::integer,0)) then
        raise exception 'No hay suficientes datos para identificar los conceptos del cheque' using errcode='0A000';
      end if;
      perform agencia.revertir_cobro_moderno(registro_id,perfil.id,perfil.nombre);
      select datos into registro from agencia.cobros where clave=registro_id;
      detalle:=jsonb_set(registro->'det','{estado}','"rechazado"'::jsonb,true);
      registro:=jsonb_set(registro,'{det}',detalle,true) || jsonb_build_object(
        'rechazoAplicado',true,'fechaRechazo',(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date);
    else
    if tipo='seg' then
      monto := (pago->>'imp')::numeric;
    elsif tipo='rifa' then
      monto := agencia.cuota_rifa((registro->>'importe')::numeric,(registro->>'ncuotas')::integer,indice);
    else
      monto := case when tipo='lot' then (registro->>'frac')::numeric*(registro->>'precio')::numeric else (registro->>'monto')::numeric end;
    end if;
    if monto is null then raise exception 'Falta el importe del cheque' using errcode='22023'; end if;
    registro := agencia.revertir_pago_registro(tipo,registro,indice,true,0);
    fecha_hoy := (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
    rechazo_id := gen_random_uuid()::text;
    detalle := jsonb_set(detalle,'{estado}','"rechazado"'::jsonb,true);
    insert into agencia.cobros(clave,posicion,datos)
    select rechazo_id,coalesce(max(posicion),0)+1,jsonb_build_object(
      'id',rechazo_id,'sid',registro->>'sid','fecha',coalesce(fecha_pago,fecha_hoy::text),
      'monto',monto,'medio',medio,'det',detalle,'anulado',true,
      'rechazoAplicado',true,'fechaRechazo',fecha_hoy,'aplicados','[]'::jsonb)
    from agencia.cobros;
    insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
      values(perfil.id,perfil.nombre,'cobros',rechazo_id,'Creó');
    end if;
  else
    if p_estado='pendiente' then detalle := detalle - 'estado';
    else detalle := jsonb_set(detalle,'{estado}',to_jsonb(p_estado),true); end if;
    registro := jsonb_set(registro,ruta,detalle,false);
  end if;
  execute format('update agencia.%I set datos=$1 where clave=$2',tabla) using registro,registro_id;
  insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
    values(perfil.id,perfil.nombre,coleccion,registro_id,'Modificó');
  update agencia.configuracion set revision=revision+1 returning revision into revision_actual;
  insert into agencia.operaciones(id,actor,revision,revision_anterior,huella)
    values(p_operacion,perfil.id,revision_actual,p_revision,huella);
  return revision_actual;
end $$;
revoke all on function public.agencia_estado_cheque(bigint,uuid,text,text) from public,anon,authenticated;

create or replace function agencia.conceptos_cobro_calcular(p_estado jsonb,p_socio_id text,p_hoy date)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare r jsonb; c jsonb; p jsonb; s jsonb; conceptos jsonb:='[]'; n integer; imp numeric; f date; h text; futuro boolean; tipo text;
begin
  if jsonb_typeof(p_estado) is distinct from 'object' or p_hoy is null or p_socio_id is null then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(p_estado->'socios','[]'::jsonb)) x where x->>'id'=p_socio_id) then raise exception 'Socio inexistente' using errcode='22023'; end if;
  for r in select value from jsonb_array_elements(coalesce(p_estado->'seguros','[]')) where value->>'sid'=p_socio_id loop
    n:=0;
    for c in select value from jsonb_array_elements(coalesce(r->'cuotas','[]')) loop
      if coalesce(c->>'pago','')='' and not coalesce((c->>'anulado')::boolean,false) then
        f:=(c->>'venc')::date; imp:=greatest(0,round(coalesce((c->>'imp')::numeric,0)-coalesce((c->>'abono')::numeric,0),2));
        conceptos:=conceptos || jsonb_build_array(jsonb_build_object('f',f,'h',case when n=0 then coalesce(r->>'ts','') else '' end,'t','seg','ref',jsonb_build_array('seg',r->>'id',n),'imp',imp,'fut',f>p_hoy));
      end if;
      n:=n+1;
    end loop;
  end loop;
  for tipo in select unnest(array['q6','lot','quiniela']) loop
    for r in select value from jsonb_array_elements(coalesce(p_estado->tipo,'[]')) where value->>'sid'=p_socio_id loop
      if coalesce((r->>'pagado')::boolean,false) or coalesce((r->>'anulado')::boolean,false) then continue; end if;
      if tipo='lot' then
        select value into s from jsonb_array_elements(coalesce(p_estado->'sorteos','[]')) where value->>'id'=r->>'soId';
        f:=coalesce(nullif(r->>'alta','')::date,case when (s->>'fecha')::date<p_hoy then (s->>'fecha')::date else p_hoy end,p_hoy);
        imp:=greatest(0,coalesce((r->>'frac')::numeric,0)*coalesce((r->>'precio')::numeric,0)-coalesce((r->>'abono')::numeric,0));
      else
        f:=(r->>'fecha')::date; imp:=greatest(0,round(coalesce((r->>'monto')::numeric,0)-coalesce((r->>'abono')::numeric,0),2));
      end if;
      conceptos:=conceptos || jsonb_build_array(jsonb_build_object('f',f,'h',coalesce(r->>'ts',''),'t',case when tipo='quiniela' then 'qui' else tipo end,'ref',jsonb_build_array(tipo,r->>'id'),'imp',imp));
    end loop;
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p_estado->'rifas','[]')) where value->>'sid'=p_socio_id loop
    n:=0;
    for p in select value from jsonb_array_elements(coalesce(r->'pagos','[]')) loop
      if p in ('null'::jsonb,'false'::jsonb,'""'::jsonb) and not coalesce((r->'anulados'->>n)::boolean,false) then
        f:=((r->>'desde')::date+make_interval(months=>n))::date;
        imp:=greatest(0,round(agencia.cuota_rifa((r->>'importe')::numeric,(r->>'ncuotas')::integer,n)-coalesce((r->'abonos'->>n)::numeric,0),2));
        conceptos:=conceptos || jsonb_build_array(jsonb_build_object('f',f,'h',case when n=0 then coalesce(r->>'ts','') else '' end,'t','rifa','ref',jsonb_build_array('rifa',r->>'id',n),'imp',imp,'fut',f>p_hoy));
      end if;
      n:=n+1;
    end loop;
  end loop;
  -- El cliente invierte la lista ordenada de movimientos por separado para
  -- vencidos y futuros. El último movimiento insertado gana los empates.
  select coalesce(jsonb_agg(item-'h' order by coalesce((item->>'fut')::boolean,false), item->>'f', item->>'h', pos desc),'[]')
  into conceptos from jsonb_array_elements(conceptos) with ordinality x(item,pos);
  return conceptos;
end $$;
revoke all on function agencia.conceptos_cobro_calcular(jsonb,text,date) from public, anon, authenticated;

-- Una sola selección y cálculo para la simulación y el registro transaccional.
create or replace function agencia.calcular_cobro_socio(
  p_estado jsonb,p_socio_id text,p_seleccion jsonb,p_prioridad text,
  p_usar_favor boolean,p_monto numeric,p_hoy date
) returns jsonb language plpgsql immutable set search_path = '' as $$
declare conceptos jsonb; seleccionados jsonb; socio jsonb; cuenta jsonb; cantidad integer;
begin
  if p_socio_id is null or jsonb_typeof(p_seleccion) is distinct from 'array'
    or p_prioridad is null or p_prioridad not in ('todo','viejo','prop','seg','q6','lot','qui','rifa')
    or p_usar_favor is null
    or exists(select 1 from jsonb_array_elements(p_seleccion) j where jsonb_typeof(j) <> 'string')
    or (select count(*) <> count(distinct value) from jsonb_array_elements_text(p_seleccion)) then
    raise exception 'Datos de cobro inválidos' using errcode='22023';
  end if;
  conceptos:=agencia.conceptos_cobro_calcular(p_estado,p_socio_id,p_hoy);
  select coalesce(jsonb_agg(value order by ord),'[]'::jsonb),count(*) into seleccionados,cantidad
    from jsonb_array_elements(conceptos) with ordinality as c(value,ord)
    where p_seleccion ? array_to_string(array(select jsonb_array_elements_text(value->'ref')),'|');
  if cantidad<>jsonb_array_length(p_seleccion) then
    raise exception 'Hay conceptos seleccionados que ya no están disponibles' using errcode='22023';
  end if;
  select value into socio from jsonb_array_elements(p_estado->'socios') x(value) where value->>'id'=p_socio_id;
  cuenta:=agencia.cuenta_socio_calcular(p_estado,p_socio_id,p_hoy);
  return agencia.calcular_cobro(seleccionados,coalesce((socio->>'favor')::numeric,0),
    (cuenta->>'deuda')::numeric,p_prioridad,p_usar_favor,p_monto);
end $$;
revoke all on function agencia.calcular_cobro_socio(jsonb,text,jsonb,text,boolean,numeric,date) from public, anon, authenticated;

create or replace function public.agencia_registrar_cobro(
  p_revision bigint, p_operacion uuid, p_socio_id text, p_seleccion jsonb,
  p_prioridad text, p_usar_favor boolean, p_monto numeric,
  p_fecha date, p_medio text, p_detalle jsonb
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  perfil agencia.perfiles; op agencia.operaciones; revision_actual bigint; v_huella text;
  estado jsonb; calculo jsonb;
  item jsonb; ref jsonb; registro jsonb; socio jsonb; cobro jsonb; aplicaciones jsonb:='[]';
  indice integer; posicion integer; clave text; tipo text; coleccion text; tabla text;
  ahora timestamptz:=clock_timestamp(); hoy date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
  id text:=gen_random_uuid()::text; cantidad integer;
begin
  perfil:=agencia.exigir_perfil();
  if p_revision is null or p_operacion is null or p_socio_id is null
    or jsonb_typeof(p_seleccion) is distinct from 'array' or p_prioridad is null
    or p_prioridad not in ('todo','viejo','prop','seg','q6','lot','qui','rifa')
    or p_usar_favor is null or p_fecha is null or p_medio is null
    or p_medio not in ('','efectivo','transferencia','mp','cheque','echeq')
    or (p_detalle is not null and p_detalle <> 'null'::jsonb and jsonb_typeof(p_detalle) <> 'object') then
    raise exception 'Datos de cobro inválidos' using errcode='22023';
  end if;
  if p_medio in ('cheque','echeq') and (coalesce(p_detalle->>'nro','')='' or coalesce(p_detalle->>'banco','')='') then
    raise exception 'Ingresá el número y el banco del cheque' using errcode='22023';
  end if;
  v_huella:=encode(sha256(convert_to(jsonb_build_array('registrar_cobro',p_socio_id,p_seleccion,p_prioridad,p_usar_favor,p_monto,p_fecha,p_medio,p_detalle)::text,'UTF8')),'hex');
  select revision into strict revision_actual from agencia.configuracion for update;
  select * into op from agencia.operaciones o where o.id=p_operacion;
  if found then
    if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>v_huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
    return op.revision;
  end if;
  if p_revision<>revision_actual then raise exception 'Los datos cambiaron. Volvé a cargarlos antes de guardar.' using errcode='40001'; end if;
  estado:=agencia.estado_cobro_socio(p_socio_id);
  select value into socio from jsonb_array_elements(estado->'socios') x(value) where value->>'id'=p_socio_id;
  calculo:=agencia.calcular_cobro_socio(estado,p_socio_id,p_seleccion,p_prioridad,p_usar_favor,p_monto,hoy);
  if (calculo->>'A')::numeric=0 and jsonb_array_length(calculo->'apl')=0 then raise exception 'Ingresá el monto que te pagó' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(calculo->'apl') loop
    ref:=item->'m'->'ref'; tipo:=ref->>0; clave:=ref->>1; indice:=case when jsonb_array_length(ref)>2 then (ref->>2)::integer else null end;
    coleccion:=case tipo when 'seg' then 'seguros' when 'rifa' then 'rifas' else tipo end;
    select (ord-1)::integer,value into posicion,registro from jsonb_array_elements(estado->coleccion) with ordinality x(value,ord) where value->>'id'=clave and value->>'sid'=p_socio_id;
    if not found then raise exception 'Movimiento seleccionado inexistente' using errcode='22023'; end if;
    registro:=agencia.aplicar_pago_registro(tipo,registro,indice,(item->>'ap')::numeric,p_fecha,p_medio,p_detalle,ahora);
    estado:=jsonb_set(estado,array[coleccion,posicion::text],registro);
    tabla:=case tipo when 'seg' then 'seguros' when 'rifa' then 'rifas'
      when 'q6' then 'quini_jugadas' when 'lot' then 'loteria_ventas' when 'quiniela' then 'quiniela_jugadas' end;
    execute format('update agencia.%I set datos=$1 where clave=$2 and datos->>''sid''=$3',tabla)
      using registro,clave,p_socio_id;
    get diagnostics cantidad = row_count;
    if cantidad<>1 then raise exception 'Movimiento seleccionado inexistente' using errcode='22023'; end if;
    aplicaciones:=aplicaciones || jsonb_build_array(jsonb_build_object('ref',ref,'completo',(item->>'ap')::numeric >= (item->'m'->>'imp')::numeric,
      'abono',case when (item->>'ap')::numeric >= (item->'m'->>'imp')::numeric then 0 else (item->>'ap')::numeric end,'imp',(item->>'ap')::numeric));
  end loop;
  insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
    select distinct perfil.id,perfil.nombre,
      case x.value->'m'->'ref'->>0 when 'seg' then 'seguros' when 'rifa' then 'rifas'
        else x.value->'m'->'ref'->>0 end,
      x.value->'m'->'ref'->>1,'Modificó'
    from jsonb_array_elements(calculo->'apl') x(value);
  socio:=socio || jsonb_build_object('favor',(calculo->>'favorFinal')::numeric);
  update agencia.socios s set datos=socio where s.clave=p_socio_id and s.datos is distinct from socio;
  if found then
    insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
      values(perfil.id,perfil.nombre,'socios',p_socio_id,'Modificó');
  end if;
  cobro:=jsonb_build_object('id',id,'sid',p_socio_id,'fecha',p_fecha,'monto',(calculo->>'A')::numeric,
    'medio',case when (calculo->>'A')::numeric>0 then p_medio else '' end,
    'det',case when (calculo->>'A')::numeric>0 then p_detalle else null end,
    'cubre',jsonb_array_length(aplicaciones),'usado',(calculo->>'usado')::numeric,'quedo',(calculo->>'quedo')::numeric,'aplicados',aplicaciones);
  if (calculo->>'A')::numeric=0 then cobro:=cobro || '{"soloFavor":true}'::jsonb; end if;
  insert into agencia.cobros(clave,posicion,datos)
    select id,coalesce(max(c.posicion),0)+1,cobro from agencia.cobros c;
  insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
    values(perfil.id,perfil.nombre,'cobros',id,'Creó');
  update agencia.configuracion set revision=revision+1 returning revision into revision_actual;
  insert into agencia.operaciones(id,actor,revision,revision_anterior,huella)
    values(p_operacion,perfil.id,revision_actual,p_revision,v_huella);
  return revision_actual;
end $$;
revoke all on function public.agencia_registrar_cobro(bigint,uuid,text,jsonb,text,boolean,numeric,date,text,jsonb) from public, anon, authenticated;

-- Solo se leen las filas del socio y sus sorteos de lotería, no el estado completo.
create or replace function agencia.estado_cobro_socio(p_socio_id text)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'socios',coalesce((select jsonb_agg(s.datos order by s.posicion) from agencia.socios s where s.clave=p_socio_id),'[]'::jsonb),
    'seguros',coalesce((select jsonb_agg(s.datos order by s.posicion) from agencia.seguros s where s.datos->>'sid'=p_socio_id),'[]'::jsonb),
    'q6',coalesce((select jsonb_agg(q.datos order by q.posicion) from agencia.quini_jugadas q where q.datos->>'sid'=p_socio_id),'[]'::jsonb),
    'lot',coalesce((select jsonb_agg(l.datos order by l.posicion) from agencia.loteria_ventas l where l.datos->>'sid'=p_socio_id),'[]'::jsonb),
    'quiniela',coalesce((select jsonb_agg(q.datos order by q.posicion) from agencia.quiniela_jugadas q where q.datos->>'sid'=p_socio_id),'[]'::jsonb),
    'rifas',coalesce((select jsonb_agg(r.datos order by r.posicion) from agencia.rifas r where r.datos->>'sid'=p_socio_id),'[]'::jsonb),
    'sorteos',coalesce((select jsonb_agg(s.datos order by s.posicion) from agencia.loteria_sorteos s
      where exists(select 1 from agencia.loteria_ventas l where l.datos->>'sid'=p_socio_id and l.datos->>'soId'=s.clave)),'[]'::jsonb)
  );
$$;
revoke all on function agencia.estado_cobro_socio(text) from public, anon, authenticated;

-- Vista previa construida íntegramente con registros y fecha del servidor.
-- La revisión evita mostrar una simulación basada en datos ya modificados.
create or replace function public.agencia_prever_cobro(
  p_revision bigint, p_socio_id text, p_seleccion jsonb,
  p_prioridad text, p_usar_favor boolean, p_monto numeric
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  revision_actual bigint; estado jsonb;
  calculo jsonb; detalles jsonb;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perform agencia.exigir_perfil();
  if p_revision is null or p_socio_id is null or jsonb_typeof(p_seleccion) is distinct from 'array'
    or p_prioridad is null or p_prioridad not in ('todo','viejo','prop','seg','q6','lot','qui','rifa')
    or p_usar_favor is null then
    raise exception 'Datos de cobro inválidos' using errcode='22023';
  end if;
  select revision into strict revision_actual from agencia.configuracion;
  if revision_actual<>p_revision then
    raise exception 'Los datos cambiaron. Volvé a cargarlos antes de guardar.' using errcode='40001';
  end if;
  estado:=agencia.estado_cobro_socio(p_socio_id);
  calculo:=agencia.calcular_cobro_socio(estado,p_socio_id,p_seleccion,p_prioridad,p_usar_favor,p_monto,hoy);
  select coalesce(jsonb_object_agg(array_to_string(array(select jsonb_array_elements_text(x.value->'m'->'ref')),'|'),
    jsonb_build_object('estado',case when (x.value->>'ap')::numeric >= (x.value->'m'->>'imp')::numeric then 'ok'
      when (x.value->>'ap')::numeric>0 then 'warn' else 'mu' end,
      'aplicado',(x.value->>'ap')::numeric,
      'restante',greatest(0,(x.value->'m'->>'imp')::numeric-(x.value->>'ap')::numeric))), '{}'::jsonb)
    into detalles from jsonb_array_elements(calculo->'al') x(value);
  return calculo || jsonb_build_object('estadoFinal',(calculo->>'deudaFinal')::numeric-(calculo->>'favorFinal')::numeric,
    'habilitado',(calculo->>'A')::numeric>0 or jsonb_array_length(calculo->'apl')>0,
    'aplicacionesDetalle',detalles);
end $$;
revoke all on function public.agencia_prever_cobro(bigint,text,jsonb,text,boolean,numeric) from public, anon, authenticated;

-- Reconstruye datos editables de una planilla sin aceptar pagos desde el cliente.
create or replace function agencia.toto_validar_datos(p_datos jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare k text; j jsonb; conc jsonb:='{}'::jsonb; salida jsonb; v numeric; f date;
begin
  if jsonb_typeof(p_datos) is distinct from 'object' or coalesce(p_datos->>'fecha','') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Fecha o planilla inválida' using errcode='22023';
  end if;
  f:=(p_datos->>'fecha')::date;
  if p_datos ? 'conc' and jsonb_typeof(p_datos->'conc') not in ('object','null') then
    raise exception 'Concursos inválidos' using errcode='22023';
  end if;
  salida:=jsonb_build_object('fecha',f,'concurso',null);
  foreach k in array array['previa','primera','matutina','vespertina','nocturna','turista','quini6','loto','premios','premiosAg'] loop
    if p_datos ? k and jsonb_typeof(p_datos->k) not in ('number','null') then
      raise exception 'Monto inválido: %',k using errcode='22023';
    end if;
    v:=coalesce((p_datos->>k)::numeric,0);
    if abs(v)>1000000000000 then raise exception 'Monto fuera de rango' using errcode='22023'; end if;
    salida:=salida||jsonb_build_object(k,v);
    if k not in ('premios','premiosAg') then
      j:=p_datos->'conc'->k;
      if j is not null and j <> 'null'::jsonb then
        if jsonb_typeof(j)<>'number' or (j#>>'{}')::numeric<=0 or trunc((j#>>'{}')::numeric)<>(j#>>'{}')::numeric or (j#>>'{}')::numeric>2147483647 then
          raise exception 'Concurso inválido: %',k using errcode='22023';
        end if;
      end if;
      conc:=conc||jsonb_build_object(k,coalesce(j,'null'::jsonb));
    end if;
  end loop;
  return salida||jsonb_build_object('conc',conc);
exception when invalid_datetime_format or datetime_field_overflow then
  raise exception 'Fecha de planilla inválida' using errcode='22023';
end $$;

-- Estima cada concurso usando la fila válida más cercana y los días de sorteo
-- configurados; respeta el orden de las filas cuando comparten fecha.
-- Planillas que tienen cargado algún número de concurso: sirven de punto de partida para estimar los demás.
-- Se arma una sola vez por consulta; la estimación por día trabaja sobre esta lista chica y no sobre todas las planillas.
create or replace function agencia.toto_anclas(p_excluir text default null)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('fecha',a.fecha,'posicion',a.posicion,'conc',a.conc) order by a.posicion),'[]'::jsonb)
  from (
    select x.datos->>'fecha' fecha,x.posicion,
      (select jsonb_object_agg(k.juego,k.valor) from (
        select j.juego,
          case when coalesce(nullif(x.datos->'conc'->>j.juego,'')::numeric,0)>0 then (x.datos->'conc'->>j.juego)::integer
               when j.juego='matutina' and coalesce(nullif(x.datos->>'concurso','')::numeric,0)>0 then (x.datos->>'concurso')::integer end valor
        from unnest(array['previa','primera','matutina','vespertina','nocturna','turista','quini6','loto']) j(juego)
      ) k where k.valor is not null) conc
    from agencia.toto_planillas x where x.clave is distinct from p_excluir
  ) a where a.conc is not null;
$$;

create or replace function agencia.toto_concursos_de(p_fecha date,p_anclas jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare k text; r record; cfg jsonb; dias jsonb; valor integer; delta integer; salida jsonb:='{}';
begin
  if p_fecha is null then raise exception 'Fecha inválida' using errcode='22023'; end if;
  select datos->'totoDias' into cfg from agencia.configuracion;
  foreach k in array array['previa','primera','matutina','vespertina','nocturna','turista','quini6','loto'] loop
    dias:=case when jsonb_typeof(cfg->k)='array' then cfg->k
      when k in ('quini6','loto') then '[0,3]'::jsonb else '[1,2,3,4,5,6]'::jsonb end;
    select (a->>'fecha')::date fecha,(a->'conc'->>k)::integer concurso into r
      from jsonb_array_elements(p_anclas) a where a->'conc' ? k
      order by case when (a->>'fecha')::date<=p_fecha then 0 else 1 end,
        case when (a->>'fecha')::date<=p_fecha then (a->>'fecha')::date end desc,
        case when (a->>'fecha')::date>p_fecha then (a->>'fecha')::date end asc,(a->>'posicion')::bigint
      limit 1;
    valor:=null;
    if found then
      select coalesce(sum(1+(greatest(p_fecha,r.fecha)-(least(p_fecha,r.fecha)+paso))/7),0)::integer
        * case when p_fecha>=r.fecha then 1 else -1 end into delta
        from generate_series(1,least(7,greatest(p_fecha,r.fecha)-least(p_fecha,r.fecha))) paso
        where dias @> to_jsonb(array[extract(dow from (least(p_fecha,r.fecha)+paso))::integer]);
      valor:=r.concurso+delta;
      if valor<=0 then valor:=null; end if;
    end if;
    salida:=salida||jsonb_build_object(k,valor);
  end loop;
  return salida;
end $$;

create or replace function agencia.toto_concursos(p_fecha date,p_excluir text default null)
returns jsonb language sql stable set search_path = '' as $$
  select agencia.toto_concursos_de(p_fecha,agencia.toto_anclas(p_excluir));
$$;

create or replace function public.agencia_toto_prever(p_revision bigint,p_fecha date,p_datos jsonb,p_id text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare rev bigint; anterior jsonb; normal jsonb; concursos jsonb; actuales jsonb; k text; guardado numeric;
begin
  perform agencia.exigir_perfil();
  select revision into strict rev from agencia.configuracion;
  if p_revision is null or rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
  normal:=agencia.toto_validar_datos(p_datos||jsonb_build_object('fecha',p_fecha));
  if p_id is not null then
    select datos into anterior from agencia.toto_planillas where clave=p_id;
    if not found then raise exception 'Planilla inexistente' using errcode='22023'; end if;
    if anterior ? 'pagos' then normal:=normal||jsonb_build_object('pagos',anterior->'pagos'); end if;
    if anterior ? 'pagado' then normal:=normal||jsonb_build_object('pagado',anterior->'pagado'); end if;
  end if;
  concursos:=agencia.toto_concursos(p_fecha,p_id);
  actuales:=concursos;
  if anterior is not null and anterior->>'fecha'=p_fecha::text then
    foreach k in array array['previa','primera','matutina','vespertina','nocturna','turista','quini6','loto'] loop
      guardado:=coalesce(nullif(anterior->'conc'->>k,'')::numeric,0);
      if guardado<=0 and k='matutina' then guardado:=coalesce(nullif(anterior->>'concurso','')::numeric,0); end if;
      if guardado>0 then actuales:=actuales||jsonb_build_object(k,guardado); end if;
    end loop;
  end if;
  return jsonb_build_object('calculo',agencia.toto_calcular(normal),'concursos',concursos,'concursosActuales',actuales, 'duplicado',exists(select 1 from agencia.toto_planillas t where t.datos->>'fecha'=p_fecha::text and (p_id is null or t.clave<>p_id)));
end $$;
revoke all on function agencia.toto_validar_datos(jsonb), agencia.toto_concursos(date,text), public.agencia_toto_prever(bigint,date,jsonb,text) from public,anon,authenticated;
create or replace function public.agencia_toto_operar(
  p_revision bigint,p_operacion uuid,p_accion text,p_id text,p_datos jsonb
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  perfil agencia.perfiles; op agencia.operaciones; rev bigint; huella_actual text;
  anterior jsonb; registro jsonb; datos jsonb; calculo jsonb; pagos jsonb;
  clave_actual text:=p_id; posicion_actual bigint; monto numeric; indice integer; fecha_pago date;
  hoy date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perfil:=agencia.exigir_perfil();
  if p_revision is null or p_operacion is null or p_accion not in ('crear','editar','pagar','quitar_pago','marcar','desmarcar','eliminar')
    or p_accion is null or jsonb_typeof(p_datos) is distinct from 'object'
    or (p_accion='crear' and p_id is not null)
    or (p_accion<>'crear' and (p_id is null or p_id !~ '^[a-zA-Z0-9_-]{1,128}$')) then
    raise exception 'Operación de planilla inválida' using errcode='22023';
  end if;
  huella_actual:=encode(sha256(convert_to(jsonb_build_array('toto',p_accion,p_id,p_datos)::text,'UTF8')),'hex');
  select revision into strict rev from agencia.configuracion for update;
  select * into op from agencia.operaciones o where o.id=p_operacion;
  if found then
    if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella_actual then
      raise exception 'El identificador de operación ya fue utilizado' using errcode='22023';
    end if;
    return op.revision;
  end if;
  if p_revision<>rev then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
  if p_accion<>'crear' then
    select t.datos,t.posicion into anterior,posicion_actual from agencia.toto_planillas t where t.clave=p_id for update;
    if not found then raise exception 'Planilla inexistente' using errcode='22023'; end if;
  end if;
  if p_accion in ('crear','editar') then
    datos:=agencia.toto_validar_datos(p_datos);
    if p_accion='crear' then
      clave_actual:=gen_random_uuid()::text;
      registro:=jsonb_build_object('id',clave_actual,'pagos','[]'::jsonb)||datos;
      insert into agencia.toto_planillas(clave,posicion,datos)
        select clave_actual,coalesce(max(t.posicion),0)+1,registro from agencia.toto_planillas t;
    else
      -- Las planillas antiguas marcadas pagadas se convierten usando el neto
      -- anterior a la edición, como hace la maqueta.
      calculo:=agencia.toto_calcular(anterior);
      registro:=(anterior-'pagado')||jsonb_build_object('pagos',calculo->'P')||datos;
      update agencia.toto_planillas set datos=registro where clave=p_id;
    end if;
  elsif p_accion='eliminar' then
    delete from agencia.toto_planillas where clave=p_id;
  else
    if p_accion='quitar_pago' then
      if jsonb_typeof(anterior->'pagos') is distinct from 'array'
        or jsonb_typeof(p_datos->'indice') is distinct from 'number'
        or (p_datos->>'indice')::numeric<>trunc((p_datos->>'indice')::numeric) then
        raise exception 'Pago inexistente' using errcode='22023';
      end if;
      indice:=(p_datos->>'indice')::integer;
      if indice<0 or indice>=jsonb_array_length(anterior->'pagos') then raise exception 'Pago inexistente' using errcode='22023'; end if;
      registro:=anterior||jsonb_build_object('pagos',(anterior->'pagos')-indice);
    else
      calculo:=agencia.toto_calcular(anterior);
      pagos:=calculo->'P';
      registro:=(anterior-'pagado')||jsonb_build_object('pagos',pagos);
      if p_accion='desmarcar' then pagos:='[]'::jsonb;
      elsif p_accion='marcar' then
        monto:=(calculo->>'debe')::numeric;
        if monto<>0 then pagos:=pagos||jsonb_build_array(jsonb_build_object('f',hoy,'m',monto)); end if;
      elsif p_accion='pagar' then
        if jsonb_typeof(p_datos->'monto') is distinct from 'number' then raise exception 'Monto inválido' using errcode='22023'; end if;
        monto:=(p_datos->>'monto')::numeric;
        if monto=0 or abs(monto)>1000000000000 then raise exception 'Monto inválido' using errcode='22023'; end if;
        if coalesce(p_datos->>'fecha','')='' then fecha_pago:=hoy;
        else
          if p_datos->>'fecha' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha inválida' using errcode='22023'; end if;
          fecha_pago:=(p_datos->>'fecha')::date;
        end if;
        pagos:=pagos||jsonb_build_array(jsonb_build_object('f',fecha_pago,'m',monto));
      end if;
      registro:=registro||jsonb_build_object('pagos',pagos);
    end if;
    update agencia.toto_planillas set datos=registro where clave=p_id;
  end if;
  insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
    values(perfil.id,perfil.nombre,'toto',clave_actual,case when p_accion='crear' then 'Creó' when p_accion='eliminar' then 'Eliminó' else 'Modificó' end);
  update agencia.configuracion set revision=revision+1 returning revision into rev;
  insert into agencia.operaciones(id,actor,revision,revision_anterior,huella)
    values(p_operacion,perfil.id,rev,p_revision,huella_actual);
  return rev;
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
  raise exception 'Datos de pago o fecha inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_toto_operar(bigint,uuid,text,text,jsonb) from public,anon,authenticated;

-- Consulta únicamente el período elegido y calcula todos los totales en PostgreSQL.
create or replace function public.agencia_toto_listar(p_revision bigint,p_periodo text,p_valor text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
 rev bigint; r record; c jsonb; estimados jsonb; concursos jsonb; k text; n numeric; anclas jsonb;
 filas jsonb; filas_a jsonb[]:='{}'; juegos jsonb:='{}'::jsonb; totales jsonb:='{}'::jsonb;
 campos text[]:=array['total','com','neto','prem','gral','pago','debe','premAg']; campo text; pagados integer:=0;
begin
 perform agencia.exigir_perfil();
 select revision into strict rev from agencia.configuracion;
 if p_revision is null or rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 if p_periodo is null or p_periodo not in ('dia','mes','todo') or
   (p_periodo='dia' and (p_valor is null or p_valor !~ '^\d{4}-\d{2}-\d{2}$')) or
   (p_periodo='mes' and (p_valor is null or p_valor !~ '^\d{4}-\d{2}$')) then
   raise exception 'Período inválido' using errcode='22023';
 end if;
 foreach k in array array['previa','primera','matutina','vespertina','nocturna','turista','quini6','loto'] loop juegos:=juegos||jsonb_build_object(k,0); end loop;
 foreach campo in array campos loop totales:=totales||jsonb_build_object(campo,0); end loop;
 anclas:=agencia.toto_anclas();
 for r in select t.clave,t.datos from agencia.toto_planillas t
   where p_periodo='todo' or (p_periodo='dia' and t.datos->>'fecha'=p_valor) or (p_periodo='mes' and left(t.datos->>'fecha',7)=p_valor)
   order by t.datos->>'fecha' desc,t.posicion loop
   c:=agencia.toto_calcular(r.datos);
   estimados:=agencia.toto_concursos_de((r.datos->>'fecha')::date,anclas); concursos:='{}'::jsonb;
   foreach k in array array['previa','primera','matutina','vespertina','nocturna','turista','quini6','loto'] loop
     n:=coalesce(nullif(r.datos->'conc'->>k,'')::numeric,0);
     if n<=0 and k='matutina' then n:=coalesce(nullif(r.datos->>'concurso','')::numeric,0); end if;
     concursos:=concursos||jsonb_build_object(k,case when n>0 then to_jsonb(n) else coalesce(estimados->k,'null'::jsonb) end);
     juegos:=juegos||jsonb_build_object(k,coalesce((juegos->>k)::double precision,0)+coalesce(nullif(r.datos->>k,'')::double precision,0));
   end loop;
   foreach campo in array campos loop totales:=totales||jsonb_build_object(campo,coalesce((totales->>campo)::double precision,0)+coalesce((c->>campo)::double precision,0)); end loop;
   if (c->>'saldado')::boolean then pagados:=pagados+1; end if;
   filas_a:=array_append(filas_a,jsonb_build_object('id',r.clave,'datos',r.datos,'calculo',c,'concursos',concursos));
 end loop;
 filas:=coalesce(to_jsonb(filas_a),'[]'::jsonb);
 foreach k in array array['previa','primera','matutina','vespertina','nocturna','turista','quini6','loto'] loop
   juegos:=juegos||jsonb_build_object(k,agencia.toto_redondear((juegos->>k)::double precision));
 end loop;
 return jsonb_build_object('filas',filas,'totales',totales,'juegos',juegos,'cantidadPagados',pagados);
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
 raise exception 'Datos o período inválido' using errcode='22023';
end $$;
revoke all on function public.agencia_toto_listar(bigint,text,text) from public,anon,authenticated;

-- El identificador asignado se conserva para devolverlo en reintentos idempotentes.
alter table agencia.operaciones add column if not exists resultado jsonb;

-- Equivale a String.trim() para los espacios reconocidos por ECMAScript.
create or replace function agencia.texto_recortar_js(p_texto text)
returns text language sql immutable set search_path='' as $$
  select btrim(p_texto,
    chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||
    chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||
    chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||
    chr(8287)||chr(12288)||chr(65279));
$$;

-- PostgreSQL lower() no expande U+0130 como String.toLowerCase() de JavaScript.
-- El caso contextual de sigma griega y otras diferencias Unicode aún requieren auditoría.
create or replace function agencia.socio_normalizar_nombre(p_nombre text)
returns text language sql immutable set search_path='' as $$
  select lower(replace(agencia.texto_recortar_js(p_nombre), chr(304), 'i'||chr(775)));
$$;

-- Equivale a Math.max(0, ...socios.map(x => parseInt(x.nro) || 0)) + 1.
create or replace function agencia.proximo_numero_socio()
returns text language plpgsql stable set search_path='' as $$
declare
  registro record; cadena text; digitos text; numero numeric; maximo numeric:=0;
  signo numeric; caracter text; indice integer;
begin
  for registro in select datos->>'nro' as nro from agencia.socios loop
    cadena:=agencia.texto_recortar_js(coalesce(registro.nro,'')); signo:=1;
    if left(cadena,1) in ('+','-') then
      if left(cadena,1)='-' then signo:=-1; end if;
      cadena:=substr(cadena,2);
    end if;
    numero:=0;
    if cadena ~ '^0[xX][0-9a-fA-F]+' then
      digitos:=substring(cadena from '^0[xX]([0-9a-fA-F]+)');
      for indice in 1..length(digitos) loop
        caracter:=lower(substr(digitos,indice,1));
        numero:=numero*16+strpos('0123456789abcdef',caracter)-1;
      end loop;
    else
      digitos:=substring(cadena from '^([0-9]+)');
      if digitos is null then continue; end if;
      numero:=digitos::numeric;
    end if;
    maximo:=greatest(maximo,numero*signo);
  end loop;
  return (maximo+1)::text;
end $$;

create or replace function public.agencia_socio_proximo_numero(p_revision bigint)
returns text language plpgsql stable security definer set search_path='' as $$
declare rev bigint;
begin
  perform agencia.exigir_perfil();
  select revision into strict rev from agencia.configuracion;
  if p_revision is null or rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
  return agencia.proximo_numero_socio();
end $$;

-- La creación rápida reutiliza coincidencias por nombre y reactiva socios archivados.
-- La creación normal acepta nombres repetidos, tal como la maqueta.
create or replace function public.agencia_socio_guardar(
  p_revision bigint,p_operacion uuid,p_accion text,p_id text,p_datos jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  perfil agencia.perfiles; anterior agencia.operaciones; rev bigint; huella_actual text;
  registro jsonb; clave_actual text; nombre text; nro text; tel text; direccion text;
  favor numeric; archivado boolean; respuesta jsonb; cambio boolean:=true; creado boolean:=false; coleccion record;
begin
  perfil:=agencia.exigir_perfil();
  if p_revision is null or p_operacion is null or p_accion is null or p_accion not in ('crear','rapido','editar','eliminar')
    or jsonb_typeof(p_datos) is distinct from 'object'
    or (p_accion in ('editar','eliminar') and (p_id is null or p_id !~ '^[a-zA-Z0-9_-]{1,128}$'))
    or (p_accion in ('crear','rapido') and p_id is not null)
    or (p_accion<>'eliminar' and (jsonb_typeof(p_datos->'nombre') is distinct from 'string'
    or jsonb_typeof(p_datos->'tel') is distinct from 'string')) then
    raise exception 'Datos de socio inválidos' using errcode='22023';
  end if;
  nombre:=agencia.texto_recortar_js(p_datos->>'nombre'); tel:=agencia.texto_recortar_js(p_datos->>'tel');
  if p_accion<>'eliminar' and nombre='' then raise exception 'Poné el nombre del socio' using errcode='22023'; end if;
  if p_accion in ('crear','editar') and (jsonb_typeof(p_datos->'nro') is distinct from 'string'
      or jsonb_typeof(p_datos->'dir') is distinct from 'string') then
    raise exception 'Datos de socio inválidos' using errcode='22023';
  end if;
  if p_accion='editar' and (jsonb_typeof(p_datos->'favor') is distinct from 'number'
      or jsonb_typeof(p_datos->'archivado') is distinct from 'boolean') then
    raise exception 'Saldo o estado inválido' using errcode='22023';
  end if;
  huella_actual:=encode(sha256(convert_to(jsonb_build_array('socio',p_accion,p_id,p_datos)::text,'UTF8')),'hex');
  select revision into strict rev from agencia.configuracion for update;
  select * into anterior from agencia.operaciones where id=p_operacion;
  if found then
    if anterior.actor<>perfil.id or anterior.revision_anterior<>p_revision or anterior.huella<>huella_actual then
      raise exception 'El identificador de operación ya fue utilizado' using errcode='22023';
    end if;
    return anterior.resultado;
  end if;
  if p_revision<>rev then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
  if p_accion='eliminar' then
    select clave,datos into clave_actual,registro from agencia.socios where clave=p_id for update;
    if not found then raise exception 'Socio inexistente' using errcode='22023'; end if;
    for coleccion in select * from (values ('seguros','seguros'),('q6','quini_jugadas'),('lot','loteria_ventas'),('quiniela','quiniela_jugadas'),('rifas','rifas'),('ofertas','loteria_ofertas')) c(nombre,tabla) loop
      execute format('insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) select $1,$2,$3,clave,''Eliminó'' from agencia.%I where datos->>''sid''=$4',coleccion.tabla)
        using perfil.id,perfil.nombre,coleccion.nombre,clave_actual;
      execute format('delete from agencia.%I where datos->>''sid''=$1',coleccion.tabla) using clave_actual;
    end loop;
    delete from agencia.socios where clave=clave_actual;
  elsif p_accion='rapido' then
    select clave,datos into clave_actual,registro from agencia.socios
      where agencia.socio_normalizar_nombre(datos->>'nombre')=agencia.socio_normalizar_nombre(nombre) order by posicion limit 1 for update;
    if found then
      if coalesce((registro->>'activo')::boolean,false) then cambio:=false;
      else registro:=registro||jsonb_build_object('activo',true);
        update agencia.socios set datos=registro where clave=clave_actual;
      end if;
    end if;
  elsif p_accion='editar' then
    select clave,datos into clave_actual,registro from agencia.socios where clave=p_id for update;
    if not found then raise exception 'Socio inexistente' using errcode='22023'; end if;
    favor:=(p_datos->>'favor')::numeric; archivado:=(p_datos->>'archivado')::boolean;
    if favor<0 then raise exception 'Saldo inválido' using errcode='22023'; end if;
    registro:=registro||jsonb_build_object('nombre',nombre,'nro',agencia.texto_recortar_js(p_datos->>'nro'),'tel',tel,
      'dir',agencia.texto_recortar_js(p_datos->>'dir'),'favor',favor,'activo',not archivado);
    update agencia.socios set datos=registro where clave=clave_actual;
  end if;
  if clave_actual is null then
    creado:=true; clave_actual:=gen_random_uuid()::text;
    nro:=case when p_accion='rapido' then agencia.proximo_numero_socio() else agencia.texto_recortar_js(p_datos->>'nro') end;
    direccion:=case when p_accion='rapido' then '' else agencia.texto_recortar_js(p_datos->>'dir') end;
    registro:=jsonb_build_object('id',clave_actual,'nombre',nombre,'nro',nro,'tel',tel,'dir',direccion,
      'activo',true,'dni','','nota','','fijos','[]'::jsonb,'q6',jsonb_build_object('activo',false,'dias','[]'::jsonb,'cant',1));
    insert into agencia.socios(clave,posicion,datos)
      select clave_actual,coalesce(max(posicion),0)+1,registro from agencia.socios;
  end if;
  if cambio then
    insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
      values(perfil.id,perfil.nombre,'socios',clave_actual,case when p_accion='eliminar' then 'Eliminó' when creado then 'Creó' else 'Modificó' end);
  end if;
  -- La maqueta vuelve a generar al refrescar tras crear, editar o reactivar.
  perform agencia.generar_quini_pendientes(perfil);
  update agencia.configuracion set revision=revision+1 returning revision into rev;
  respuesta:=jsonb_build_object('revision',rev,'id',clave_actual,'nombre',registro->>'nombre','nro',coalesce(registro->>'nro',''));
  insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado)
    values(p_operacion,perfil.id,rev,p_revision,huella_actual,respuesta);
  return respuesta;
exception when numeric_value_out_of_range or invalid_text_representation then
  raise exception 'Datos de socio inválidos' using errcode='22023';
end $$;
revoke all on function agencia.texto_recortar_js(text), agencia.socio_normalizar_nombre(text), agencia.proximo_numero_socio(), public.agencia_socio_proximo_numero(bigint),
  public.agencia_socio_guardar(bigint,uuid,text,text,jsonb) from public,anon,authenticated;


-- Libera aplicaciones registradas para una cuota y las devuelve como saldo del socio anterior.
create or replace function agencia.seguro_liberar_cuota(p_seguro jsonb,p_indice integer,p_modo text,p_actor uuid,p_nombre text)
returns jsonb language plpgsql set search_path='' as $$
declare c record; aplicacion jsonb; retenidas jsonb; cuota jsonb; importe numeric; total numeric:=0; cambiado boolean; cobro jsonb; socio jsonb; sid text; abono numeric;
begin
 if p_modo not in ('todos','completos','parciales') or p_indice<0 then raise exception 'Aplicación inválida' using errcode='22023'; end if;
 cuota:=p_seguro->'cuotas'->p_indice;
 if jsonb_typeof(cuota) is distinct from 'object' then raise exception 'Cuota inexistente' using errcode='22023'; end if;
 for c in select clave,datos from agencia.cobros where not coalesce((datos->>'anulado')::boolean,false)
    and jsonb_typeof(datos->'aplicados')='array' order by posicion for update loop
  cobro:=c.datos; retenidas:='[]'::jsonb; cambiado:=false;
  for aplicacion in select value from jsonb_array_elements(c.datos->'aplicados') loop
   if aplicacion->'ref'->>0='seg' and aplicacion->'ref'->>1=p_seguro->>'id'
      and aplicacion->'ref'->>2=p_indice::text
      and (p_modo='todos' or (p_modo='completos' and coalesce((aplicacion->>'completo')::boolean,false))
       or (p_modo='parciales' and not coalesce((aplicacion->>'completo')::boolean,false))) then
    if aplicacion ? 'imp' then importe:=coalesce((aplicacion->>'imp')::numeric,0);
    elsif coalesce((aplicacion->>'completo')::boolean,false) then importe:=coalesce((cuota->>'imp')::numeric,0)-coalesce((cuota->>'abono')::numeric,0);
    else importe:=coalesce((aplicacion->>'abono')::numeric,0); end if;
    total:=total+importe;
    cobro:=cobro||jsonb_build_object('liberado',coalesce((cobro->>'liberado')::numeric,0)+importe);
    if not coalesce((aplicacion->>'completo')::boolean,false) then
      abono:=greatest(0,coalesce((cuota->>'abono')::numeric,0)-coalesce((aplicacion->>'abono')::numeric,0));
      cuota:=cuota||jsonb_build_object('abono',abono);
    end if;
    cambiado:=true;
   else retenidas:=retenidas||jsonb_build_array(aplicacion); end if;
  end loop;
  if cambiado or (cobro->'cubre') is distinct from to_jsonb(jsonb_array_length(retenidas)) then
   cobro:=cobro||jsonb_build_object('aplicados',retenidas,'cubre',jsonb_array_length(retenidas));
   update agencia.cobros set datos=cobro where clave=c.clave;
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'cobros',c.clave,'Modificó');
  end if;
 end loop;
 if total<>0 then
  sid:=p_seguro->>'sid'; select datos into socio from agencia.socios where clave=sid for update;
  if found then
   socio:=socio||jsonb_build_object('favor',coalesce((socio->>'favor')::numeric,0)+total);
   update agencia.socios set datos=socio where clave=sid;
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'socios',sid,'Modificó');
  end if;
 end if;
 return jsonb_build_object('seguro',jsonb_set(p_seguro,array['cuotas',p_indice::text],cuota),'liberado',total);
end $$;
revoke all on function agencia.seguro_liberar_cuota(jsonb,integer,text,uuid,text) from public,anon,authenticated;

-- Conserva únicamente los campos admitidos por el medio y el estado del mismo cheque.
create or replace function agencia.seguro_detalle_pago(p_medio text,p_detalle jsonb,p_anterior jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare claves text[]; clave text; valor text; resultado jsonb:='{}'::jsonb;
begin
 if p_detalle is null or p_detalle='null'::jsonb then return null; end if;
 if jsonb_typeof(p_detalle)<>'object' then raise exception 'Detalle inválido' using errcode='22023'; end if;
 claves:=case p_medio when 'cheque' then array['banco','nro','librador','fcobro'] when 'echeq' then array['banco','nro','librador','fcobro'] when 'transferencia' then array['banco','nro','librador'] when 'mp' then array['nro','librador'] else array[]::text[] end;
 foreach clave in array claves loop
  if p_detalle ? clave and jsonb_typeof(p_detalle->clave) not in ('string','null') then raise exception 'Detalle inválido' using errcode='22023'; end if;
  valor:=agencia.texto_recortar_js(p_detalle->>clave);
  if coalesce(valor,'')<>'' then resultado:=resultado||jsonb_build_object(clave,valor); end if;
 end loop;
 if p_medio in ('cheque','echeq') and coalesce(resultado->>'nro','')<>'' and resultado->>'nro'=p_anterior->>'nro' and resultado->>'banco'=p_anterior->>'banco' then
  if coalesce(p_anterior->>'estado','')<>'' then resultado:=resultado||jsonb_build_object('estado',p_anterior->'estado'); end if;
  if coalesce(p_anterior->>'dep','')<>'' then resultado:=resultado||jsonb_build_object('dep',p_anterior->'dep'); end if;
 end if;
 return case when resultado='{}'::jsonb then null else resultado end;
end $$;
revoke all on function agencia.seguro_detalle_pago(text,jsonb,jsonb) from public,anon,authenticated;

-- Vista previa de cuotas, sin confiar en importes calculados por el cliente.
create or replace function public.agencia_seguro_prever(p_revision bigint,p_ingreso date,p_plan text,p_valor numeric,p_id text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint; anterior jsonb; cuotas jsonb;
begin
 perform agencia.exigir_perfil(); select revision into strict rev from agencia.configuracion;
 if p_revision is null or p_revision<>rev then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 if p_id is not null then select datos into anterior from agencia.seguros where clave=p_id;
   if not found then raise exception 'Seguro inexistente' using errcode='22023'; end if;
 end if;
 cuotas:=agencia.cuotas_seguro(p_ingreso,p_plan,p_valor,coalesce(anterior->'cuotas','[]'::jsonb));
 return jsonb_build_object('cuotas',cuotas,'vencimientoSugerido',(p_ingreso + interval '12 months')::date);
end $$;
revoke all on function public.agencia_seguro_prever(bigint,date,text,numeric,text) from public,anon,authenticated;
create or replace function public.agencia_seguro_operar(p_revision bigint,p_operacion uuid,p_accion text,p_id text,p_datos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 perfil agencia.perfiles; op agencia.operaciones; rev bigint; huella text; seguro jsonb; anterior jsonb; cuota jsonb; resultado jsonb;
 clave_actual text:=p_id; sid text; fecha_ingreso date; fecha_vencimiento date; fecha_pago date; plan text; valor numeric; n integer; i integer; libres integer; pagado numeric; recalcular boolean; liberado numeric:=0; modo text; detalle jsonb; cobro_id text; hoy date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date; creada boolean:=false;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or p_accion is null or p_accion not in ('crear','editar','pagar_cuota','quitar_pago','anular_cuota','eliminar')
  or jsonb_typeof(p_datos) is distinct from 'object' or (p_accion='crear' and p_id is not null)
  or (p_accion<>'crear' and (p_id is null or p_id !~ '^[a-zA-Z0-9_-]{1,128}$')) then
  raise exception 'Operación de seguro inválida' using errcode='22023';
 end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('seguro',p_accion,p_id,p_datos)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 if p_accion<>'crear' then
  select datos into seguro from agencia.seguros where clave=p_id for update;
  if not found then raise exception 'Seguro inexistente' using errcode='22023'; end if;
 end if;
 if p_accion in ('crear','editar') then
  if jsonb_typeof(p_datos->'sid') is distinct from 'string' or jsonb_typeof(p_datos->'ingreso') is distinct from 'string'
   or jsonb_typeof(p_datos->'venc') is distinct from 'string' or jsonb_typeof(p_datos->'desc') is distinct from 'string'
   or jsonb_typeof(p_datos->'valor') is distinct from 'number' or jsonb_typeof(p_datos->'plan') is distinct from 'string'
   or p_datos->>'ingreso' !~ '^\d{4}-\d{2}-\d{2}$' or p_datos->>'venc' !~ '^\d{4}-\d{2}-\d{2}$' then
   raise exception 'Datos de seguro inválidos' using errcode='22023'; end if;
  sid:=p_datos->>'sid'; fecha_ingreso:=(p_datos->>'ingreso')::date; fecha_vencimiento:=(p_datos->>'venc')::date;
  valor:=(p_datos->>'valor')::numeric; plan:=p_datos->>'plan';
  if not exists(select 1 from agencia.socios where clave=sid) or valor<=0 or valor<>round(valor,2) or plan not in ('contado','3','6','12') then
   raise exception 'Socio, valor o plan inválido' using errcode='22023'; end if;
  n:=case when plan='contado' then 1 else plan::integer end;
  if p_accion='crear' then
   creada:=true; clave_actual:=gen_random_uuid()::text;
   seguro:=jsonb_build_object('id',clave_actual,'sid',sid,'ingreso',fecha_ingreso,'venc',fecha_vencimiento,'desc',agencia.texto_recortar_js(p_datos->>'desc'),'valor',valor,'plan',plan,
     'cuotas',agencia.cuotas_seguro(fecha_ingreso,plan,valor),'ts',clock_timestamp(),'por',perfil.id);
   if p_datos ? 'pago' then raise exception 'El alta no admite pago inicial' using errcode='22023'; end if;
   insert into agencia.seguros(clave,posicion,datos) select clave_actual,coalesce(max(posicion),0)+1,seguro from agencia.seguros;
  else
   anterior:=seguro;
   recalcular:=(seguro->>'valor')::numeric<>valor or seguro->>'plan'<>plan or seguro->>'ingreso'<>fecha_ingreso::text;
   if recalcular and sid=seguro->>'sid' then
    pagado:=0; libres:=0;
    for i in 0..n-1 loop
     cuota:=seguro->'cuotas'->i;
     if cuota is null then libres:=libres+1;
     elsif coalesce(cuota->>'pago','')<>'' and not coalesce((cuota->>'anulado')::boolean,false) then pagado:=pagado+coalesce((cuota->>'imp')::numeric,0);
     elsif coalesce(cuota->>'pago','')='' and not coalesce((cuota->>'anulado')::boolean,false) then libres:=libres+1; end if;
    end loop;
    pagado:=round(pagado,2);
    if valor<pagado then raise exception 'Ya pagó más que el valor nuevo. Anulá un pago antes de bajarlo.' using errcode='22023'; end if;
    if libres=0 and valor<>pagado then raise exception 'Todas las cuotas ya están pagas. Anulá un pago o elegí más cuotas.' using errcode='22023'; end if;
   end if;
   if recalcular or sid<>seguro->>'sid' then
    for i in 0..jsonb_array_length(seguro->'cuotas')-1 loop
     cuota:=seguro->'cuotas'->i;
     if coalesce(cuota->>'pago','')<>'' and (i>=n or sid<>seguro->>'sid') then
      resultado:=agencia.seguro_liberar_cuota(seguro,i,'completos',perfil.id,perfil.nombre); seguro:=resultado->'seguro'; liberado:=liberado+(resultado->>'liberado')::numeric;
      cuota:=seguro->'cuotas'->i; cuota:=cuota||'{"pago":null,"medio":"","det":null}'::jsonb; seguro:=jsonb_set(seguro,array['cuotas',i::text],cuota);
     end if;
     cuota:=seguro->'cuotas'->i;
     if coalesce((cuota->>'abono')::numeric,0)<>0 and coalesce(cuota->>'pago','')='' then
      resultado:=agencia.seguro_liberar_cuota(seguro,i,'parciales',perfil.id,perfil.nombre); seguro:=resultado->'seguro'; liberado:=liberado+(resultado->>'liberado')::numeric;
      cuota:=(seguro->'cuotas'->i)||'{"abono":0}'::jsonb; seguro:=jsonb_set(seguro,array['cuotas',i::text],cuota);
     end if;
    end loop;
   end if;
   seguro:=seguro||jsonb_build_object('sid',sid,'ingreso',fecha_ingreso,'venc',fecha_vencimiento,'desc',agencia.texto_recortar_js(p_datos->>'desc'),'valor',valor,'plan',plan,'modPor',perfil.id,'modTs',clock_timestamp());
   if recalcular then seguro:=seguro||jsonb_build_object('cuotas',agencia.cuotas_seguro(fecha_ingreso,plan,valor,seguro->'cuotas')); end if;
   update agencia.seguros set datos=seguro where clave=p_id;
  end if;
 elsif p_accion='eliminar' then
  for i in 0..jsonb_array_length(seguro->'cuotas')-1 loop
   resultado:=agencia.seguro_liberar_cuota(seguro,i,'todos',perfil.id,perfil.nombre); seguro:=resultado->'seguro'; liberado:=liberado+(resultado->>'liberado')::numeric;
  end loop;
  delete from agencia.seguros where clave=p_id;
 else
  if jsonb_typeof(p_datos->'indice') is distinct from 'number' or (p_datos->>'indice')::numeric<>trunc((p_datos->>'indice')::numeric) then raise exception 'Cuota inválida' using errcode='22023'; end if;
  i:=(p_datos->>'indice')::integer; cuota:=seguro->'cuotas'->i;
  if i<0 or jsonb_typeof(cuota) is distinct from 'object' then raise exception 'Cuota inexistente' using errcode='22023'; end if;
  if p_accion='anular_cuota' then
   resultado:=agencia.seguro_liberar_cuota(seguro,i,'todos',perfil.id,perfil.nombre); seguro:=resultado->'seguro'; liberado:=(resultado->>'liberado')::numeric;
   cuota:=(seguro->'cuotas'->i)||'{"anulado":true}'::jsonb;
  elsif p_accion='quitar_pago' then
   if coalesce(cuota->>'pago','')<>'' then
    cuota:=cuota||'{"pago":null}'::jsonb; seguro:=jsonb_set(seguro,array['cuotas',i::text],cuota);
    resultado:=agencia.seguro_liberar_cuota(seguro,i,'completos',perfil.id,perfil.nombre); seguro:=resultado->'seguro'; liberado:=(resultado->>'liberado')::numeric;
   end if;
   cuota:=(seguro->'cuotas'->i)||'{"pago":null,"medio":"","det":null}'::jsonb;
  else
   if coalesce(p_datos->>'fecha','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha inválida' using errcode='22023'; end if;
   fecha_pago:=(p_datos->>'fecha')::date; modo:=coalesce(p_datos->>'medio',''); detalle:=p_datos->'detalle';
   if modo not in ('','efectivo','transferencia','echeq','cheque','mp') or (detalle is not null and detalle<>'null'::jsonb and jsonb_typeof(detalle)<>'object') then raise exception 'Medio o detalle inválido' using errcode='22023'; end if;
   detalle:=agencia.seguro_detalle_pago(modo,detalle,cuota->'det');
   cuota:=cuota||jsonb_build_object('pago',fecha_pago,'medio',modo,'det',coalesce(detalle,'null'::jsonb));
  end if;
  seguro:=jsonb_set(seguro,array['cuotas',i::text],cuota)||jsonb_build_object('modPor',perfil.id,'modTs',clock_timestamp());
  update agencia.seguros set datos=seguro where clave=p_id;
 end if;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'seguros',clave_actual,case when creada then 'Creó' when p_accion='eliminar' then 'Eliminó' else 'Modificó' end);
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'id',clave_actual,'liberado',liberado);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or invalid_text_representation then
 raise exception 'Datos de seguro inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_seguro_operar(bigint,uuid,text,text,jsonb) from public,anon,authenticated;


-- Listado de seguros para la pantalla general y la ficha del socio.
create or replace function public.agencia_seguros_listar(p_revision bigint,p_socio_id text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 rev bigint; r record; cuota jsonb; cuota_salida jsonb; filas jsonb:='[]'; cuotas jsonb; pos integer; primera integer;
 pendientes integer; vencidas integer; total double precision; hoy date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
 venc date; ingreso date; dias integer; por_nombre text; mod_nombre text; autor text; f_mod text;
begin
 perform agencia.exigir_perfil(); select revision into strict rev from agencia.configuracion;
 if p_revision is null or rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 if p_socio_id is not null and not exists(select 1 from agencia.socios where clave=p_socio_id) then raise exception 'Socio inexistente' using errcode='22023'; end if;
 for r in select x.clave,x.datos,coalesce(s.datos->>'nombre','(socio borrado)') nombre from agencia.seguros x
   left join agencia.socios s on s.clave=x.datos->>'sid'
   where p_socio_id is null or x.datos->>'sid'=p_socio_id
   order by case when p_socio_id is null then x.datos->>'venc' else '' end,x.posicion
 loop
   if jsonb_typeof(r.datos->'cuotas') is distinct from 'array' then raise exception 'Cuotas inválidas' using errcode='22023'; end if;
   cuotas:='[]'; pendientes:=0; vencidas:=0; total:=0; primera:=null; pos:=0;
   for cuota in select value from jsonb_array_elements(r.datos->'cuotas') loop
     venc:=(cuota->>'venc')::date;
     if coalesce(cuota->>'pago','')='' then
       pendientes:=pendientes+1; if primera is null then primera:=pos; end if;
       if venc<=hoy then vencidas:=vencidas+1; total:=total+coalesce((cuota->>'imp')::double precision,0); end if;
     end if;
     cuota_salida:=cuota||jsonb_build_object('vencida',venc<=hoy);
     cuotas:=cuotas||jsonb_build_array(cuota_salida); pos:=pos+1;
   end loop;
   ingreso:=(r.datos->>'ingreso')::date; venc:=(r.datos->>'venc')::date; dias:=venc-hoy;
   por_nombre:=''; mod_nombre:=''; autor:='';
   if coalesce(r.datos->>'por','')<>'' and r.datos->>'por'<>'auto' then
     select coalesce((select p.nombre from agencia.perfiles p where p.id::text=r.datos->>'por'),(select n.nombre from agencia.actores n where n.actor=r.datos->>'por'),'') into por_nombre;
     autor:='Cargó '||por_nombre;
   elsif r.datos->>'por'='auto' then autor:='Automático'; end if;
   if coalesce(r.datos->>'modPor','')<>'' and r.datos->>'modPor' is distinct from r.datos->>'por' then
     select coalesce((select p.nombre from agencia.perfiles p where p.id::text=r.datos->>'modPor'),(select n.nombre from agencia.actores n where n.actor=r.datos->>'modPor'),'') into mod_nombre;
     f_mod:=left(coalesce(r.datos->>'modTs',''),10);
     autor:=autor||case when autor<>'' then ' · ' else '' end||'editó '||mod_nombre||case when f_mod<>'' then ' '||to_char(f_mod::date,'DD/MM/YYYY') else '' end;
   end if;
   filas:=filas||jsonb_build_array(jsonb_build_object('id',r.clave,'sid',r.datos->>'sid','socio',r.nombre,'ingreso',ingreso,'venc',venc,'descripcion',coalesce(r.datos->>'desc',''),'plan',r.datos->>'plan','valor',coalesce((r.datos->>'valor')::numeric,0),'autor',autor,'dias',dias,'vencido',vencidas>0,'vencePronto',dias<=30,'pagado',pendientes=0,'primeraPendiente',primera,'totalVencido',agencia.toto_redondear(total),'cuotas',cuotas));
 end loop;
 return filas;
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or invalid_text_representation then
 raise exception 'Datos de seguro inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_seguros_listar(bigint,text) from public,anon,authenticated;

-- Libera aplicaciones de una jugada y las devuelve como saldo del socio anterior.
create or replace function agencia.quiniela_liberar(p_jugada jsonb,p_modo text,p_actor uuid,p_nombre text)
returns jsonb language plpgsql set search_path='' as $$
declare c record; aplicacion jsonb; retenidas jsonb; importe numeric; total numeric:=0; cambiado boolean; cobro jsonb; socio jsonb; sid text; jugada jsonb:=p_jugada;
begin
 if p_modo not in ('todos','completos','parciales') then raise exception 'Aplicación inválida' using errcode='22023'; end if;
 for c in select clave,datos from agencia.cobros where not coalesce((datos->>'anulado')::boolean,false)
   and jsonb_typeof(datos->'aplicados')='array' order by posicion for update loop
  cobro:=c.datos; retenidas:='[]'::jsonb; cambiado:=false;
  for aplicacion in select value from jsonb_array_elements(c.datos->'aplicados') loop
   if (case when jsonb_typeof(aplicacion->'ref')='array' then jsonb_array_length(aplicacion->'ref')=2 else false end)
     and aplicacion->'ref'->>0='quiniela' and aplicacion->'ref'->>1=jugada->>'id'
     and (p_modo='todos' or (p_modo='completos' and coalesce((aplicacion->>'completo')::boolean,false))
       or (p_modo='parciales' and not coalesce((aplicacion->>'completo')::boolean,false))) then
    if aplicacion ? 'imp' then importe:=coalesce((aplicacion->>'imp')::numeric,0);
    elsif coalesce((aplicacion->>'completo')::boolean,false) then importe:=coalesce((jugada->>'monto')::numeric,0)-coalesce((jugada->>'abono')::numeric,0);
    else importe:=coalesce((aplicacion->>'abono')::numeric,0); end if;
    total:=total+importe; cobro:=cobro||jsonb_build_object('liberado',coalesce((cobro->>'liberado')::numeric,0)+importe);
    if not coalesce((aplicacion->>'completo')::boolean,false) then
      jugada:=jugada||jsonb_build_object('abono',greatest(0,coalesce((jugada->>'abono')::numeric,0)-coalesce((aplicacion->>'abono')::numeric,0)));
    end if;
    cambiado:=true;
   else retenidas:=retenidas||jsonb_build_array(aplicacion); end if;
  end loop;
  if cambiado or (cobro->'cubre') is distinct from to_jsonb(jsonb_array_length(retenidas)) then
   cobro:=cobro||jsonb_build_object('aplicados',retenidas,'cubre',jsonb_array_length(retenidas));
   update agencia.cobros set datos=cobro where clave=c.clave;
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'cobros',c.clave,'Modificó');
  end if;
 end loop;
 if total<>0 then
  sid:=jugada->>'sid';select datos into socio from agencia.socios where clave=sid for update;
  if found then
   socio:=socio||jsonb_build_object('favor',coalesce((socio->>'favor')::numeric,0)+total);
   update agencia.socios set datos=socio where clave=sid;
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'socios',sid,'Modificó');
  end if;
 end if;
 return jsonb_build_object('jugada',jugada,'liberado',total);
end $$;
revoke all on function agencia.quiniela_liberar(jsonb,text,uuid,text) from public,anon,authenticated;
create or replace function public.agencia_quiniela_operar(p_revision bigint,p_operacion uuid,p_accion text,p_id text,p_datos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 perfil agencia.perfiles; op agencia.operaciones; rev bigint; huella text; jugada jsonb; resultado jsonb; fila jsonb; filas jsonb:='[]'::jsonb;
 ids jsonb:='[]'::jsonb; clave_actual text:=p_id; sid text; fecha date; fecha_pago date; numeros text; monto numeric;
 pagado boolean; cambia_sid boolean; vinculada boolean; liberado numeric:=0; modo text; detalle jsonb; creada boolean:=false; accion_log text;
 hoy date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or p_accion is null or p_accion not in ('crear','editar','editar_pago','anular_pago','anular','eliminar','marcar','desmarcar')
  or jsonb_typeof(p_datos) is distinct from 'object' or (p_accion='crear' and p_id is not null)
  or (p_accion<>'crear' and (p_id is null or p_id !~ '^[a-zA-Z0-9_-]{1,128}$')) then
  raise exception 'Operación de quiniela inválida' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('quiniela',p_accion,p_id,p_datos)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 if p_accion<>'crear' then
  select datos into jugada from agencia.quiniela_jugadas where clave=p_id for update;
  if not found then raise exception 'Jugada inexistente' using errcode='22023'; end if;
  ids:=jsonb_build_array(p_id);
 end if;
 if p_accion in ('crear','editar') then
  if jsonb_typeof(p_datos->'sid') is distinct from 'string' or jsonb_typeof(p_datos->'fecha') is distinct from 'string'
   or p_datos->>'fecha' !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(p_datos->'jugadas') is distinct from 'array'
   or jsonb_array_length(p_datos->'jugadas')<1 or jsonb_array_length(p_datos->'jugadas')>5
   or (p_accion='editar' and jsonb_array_length(p_datos->'jugadas')<>1) then raise exception 'Datos de jugada inválidos' using errcode='22023'; end if;
  sid:=p_datos->>'sid'; fecha:=(p_datos->>'fecha')::date;
  if not exists(select 1 from agencia.socios where clave=sid) then raise exception 'Socio inexistente' using errcode='22023'; end if;
  for fila in select value from jsonb_array_elements(p_datos->'jugadas') loop
   if jsonb_typeof(fila->'numeros') is distinct from 'string' or jsonb_typeof(fila->'monto') is distinct from 'number' then raise exception 'Jugada inválida' using errcode='22023'; end if;
   numeros:=agencia.texto_recortar_js(fila->>'numeros'); monto:=(fila->>'monto')::numeric;
   if monto<0 or monto<>round(monto,2) then raise exception 'Monto inválido' using errcode='22023'; end if;
   if numeros<>'' or monto<>0 then filas:=filas||jsonb_build_array(jsonb_build_object('numeros',numeros,'monto',monto)); end if;
  end loop;
  if jsonb_array_length(filas)=0 then raise exception 'Cargá al menos una jugada' using errcode='22023'; end if;
  if p_accion='crear' then
   creada:=true;
   for fila in select value from jsonb_array_elements(filas) loop
    clave_actual:=gen_random_uuid()::text;
    jugada:=jsonb_build_object('id',clave_actual,'sid',sid,'fecha',fecha,'pagado',false,'numeros',fila->'numeros','monto',fila->'monto','ts',clock_timestamp(),'por',perfil.id);
    insert into agencia.quiniela_jugadas(clave,posicion,datos) select clave_actual,coalesce(max(posicion),0)+1,jugada from agencia.quiniela_jugadas;
    insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'quiniela',clave_actual,'Creó');
    ids:=ids||jsonb_build_array(clave_actual);
   end loop;
  else
   fila:=filas->0; monto:=(fila->>'monto')::numeric; cambia_sid:=sid<>jugada->>'sid'; pagado:=coalesce((jugada->>'pagado')::boolean,false);
   if pagado and (monto<>(jugada->>'monto')::numeric or cambia_sid) then
    select exists(select 1 from agencia.cobros c cross join lateral jsonb_array_elements(case when jsonb_typeof(c.datos->'aplicados')='array' then c.datos->'aplicados' else '[]'::jsonb end) a
      where not coalesce((c.datos->>'anulado')::boolean,false) and coalesce((a->>'completo')::boolean,false)
      and case when jsonb_typeof(a->'ref')='array' then jsonb_array_length(a->'ref')=2 else false end and a->'ref'->>0='quiniela' and a->'ref'->>1=p_id) into vinculada;
    if vinculada then
     resultado:=agencia.quiniela_liberar(jugada,'completos',perfil.id,perfil.nombre); jugada:=resultado->'jugada'; liberado:=liberado+(resultado->>'liberado')::numeric;
     jugada:=(jugada-'fpago'-'medio'-'det')||'{"pagado":false}'::jsonb; pagado:=false;
    end if;
   end if;
   if coalesce((jugada->>'abono')::numeric,0)<>0 and not pagado and (monto<=coalesce((jugada->>'abono')::numeric,0) or cambia_sid) then
    resultado:=agencia.quiniela_liberar(jugada,'parciales',perfil.id,perfil.nombre); jugada:=resultado->'jugada'; liberado:=liberado+(resultado->>'liberado')::numeric;
    jugada:=jugada||'{"abono":0}'::jsonb;
   end if;
   jugada:=jugada||jsonb_build_object('sid',sid,'fecha',fecha,'pagado',pagado,'numeros',fila->'numeros','monto',fila->'monto','modPor',perfil.id,'modTs',clock_timestamp());
   update agencia.quiniela_jugadas set datos=jugada where clave=p_id;
  end if;
 elsif p_accion='eliminar' then
  resultado:=agencia.quiniela_liberar(jugada,'todos',perfil.id,perfil.nombre);jugada:=resultado->'jugada';liberado:=(resultado->>'liberado')::numeric;
  delete from agencia.quiniela_jugadas where clave=p_id;
 elsif p_accion='anular' then
  resultado:=agencia.quiniela_liberar(jugada,'todos',perfil.id,perfil.nombre);jugada:=(resultado->'jugada')||'{"anulado":true}'::jsonb;liberado:=(resultado->>'liberado')::numeric;
  update agencia.quiniela_jugadas set datos=jugada where clave=p_id;
 elsif p_accion='anular_pago' then
  jugada:=(jugada-'fpago'-'medio'-'det')||'{"pagado":false}'::jsonb;
  resultado:=agencia.quiniela_liberar(jugada,'completos',perfil.id,perfil.nombre);jugada:=resultado->'jugada';liberado:=(resultado->>'liberado')::numeric;
  update agencia.quiniela_jugadas set datos=jugada where clave=p_id;
 elsif p_accion='editar_pago' then
  if not coalesce((jugada->>'pagado')::boolean,false) then raise exception 'La jugada no está pagada' using errcode='22023'; end if;
  if coalesce(p_datos->>'fecha','')='' then fecha_pago:=hoy;
  elsif p_datos->>'fecha' ~ '^\d{4}-\d{2}-\d{2}$' then fecha_pago:=(p_datos->>'fecha')::date;
  else raise exception 'Fecha inválida' using errcode='22023'; end if;
  modo:=coalesce(p_datos->>'medio',''); detalle:=p_datos->'detalle';
  if modo not in ('','efectivo','transferencia','echeq','cheque','mp') or (detalle is not null and detalle<>'null'::jsonb and jsonb_typeof(detalle)<>'object') then raise exception 'Medio o detalle inválido' using errcode='22023'; end if;
  detalle:=agencia.seguro_detalle_pago(modo,detalle,jugada->'det');
  jugada:=jugada||jsonb_build_object('fpago',fecha_pago,'medio',modo,'det',coalesce(detalle,'null'::jsonb));
  update agencia.quiniela_jugadas set datos=jugada where clave=p_id;
 elsif p_accion='marcar' then
  jugada:=jugada||jsonb_build_object('pagado',true,'fpago',hoy,'medio','');update agencia.quiniela_jugadas set datos=jugada where clave=p_id;
 else
  jugada:=(jugada-'fpago'-'medio')||'{"pagado":false}'::jsonb;update agencia.quiniela_jugadas set datos=jugada where clave=p_id;
 end if;
 if not creada then
  accion_log:=case when p_accion='eliminar' then 'Eliminó' else 'Modificó' end;
  insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'quiniela',p_id,accion_log);
 end if;
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'ids',ids,'liberado',liberado);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or invalid_text_representation then
 raise exception 'Datos de quiniela inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_quiniela_operar(bigint,uuid,text,text,jsonb) from public,anon,authenticated;


-- Marca o deshace «no quiso» para un socio en un sorteo.
create or replace function public.agencia_loteria_oferta(
  p_revision bigint, p_operacion uuid, p_sorteo_id text, p_socio_id text, p_no_quiso boolean
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  perfil agencia.perfiles;
  anterior agencia.operaciones;
  rev bigint;
  huella text;
  clave_oferta text;
  pos bigint;
  existia boolean;
begin
  perfil := agencia.exigir_perfil();
  if p_revision is null or p_operacion is null or p_no_quiso is null
     or coalesce(p_sorteo_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$'
     or coalesce(p_socio_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$' then
    raise exception 'Datos de oferta inválidos' using errcode = '22023';
  end if;
  huella := encode(sha256(convert_to(jsonb_build_array('loteria_oferta',p_sorteo_id,p_socio_id,p_no_quiso)::text,'UTF8')),'hex');
  select revision into strict rev from agencia.configuracion for update;
  select * into anterior from agencia.operaciones where id=p_operacion;
  if found then
    if anterior.actor<>perfil.id or anterior.revision_anterior<>p_revision or anterior.huella<>huella then
      raise exception 'El identificador de operación ya fue utilizado' using errcode='22023';
    end if;
    return anterior.revision;
  end if;
  if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
  if not exists(select 1 from agencia.loteria_sorteos where clave=p_sorteo_id)
    or not exists(select 1 from agencia.socios where clave=p_socio_id) then
    raise exception 'Sorteo o socio inexistente' using errcode='22023';
  end if;
  clave_oferta:=jsonb_build_array(p_sorteo_id,p_socio_id)::text;
  select exists(select 1 from agencia.loteria_ofertas where clave=clave_oferta) into existia;
  delete from agencia.loteria_ofertas where clave=clave_oferta;
  if p_no_quiso then
    select coalesce(max(posicion),0)+1 into pos from agencia.loteria_ofertas;
    insert into agencia.loteria_ofertas(clave,posicion,datos)
      values(clave_oferta,pos,jsonb_build_object('soId',p_sorteo_id,'sid',p_socio_id));
  end if;
  if existia is distinct from p_no_quiso then
    insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
      values(perfil.id,perfil.nombre,'ofertas',clave_oferta,case when p_no_quiso then 'Creó' else 'Eliminó' end);
  end if;
  update agencia.configuracion set revision=revision+1 returning revision into rev;
  insert into agencia.operaciones(id,actor,revision,revision_anterior,huella)
    values(p_operacion,perfil.id,rev,p_revision,huella);
  return rev;
end $$;
revoke all on function public.agencia_loteria_oferta(bigint,uuid,text,text,boolean) from public,anon,authenticated;

-- Carga los números fijos activos para un sorteo, sin duplicar ventas.
create or replace function public.agencia_loteria_cargar_fijos(
  p_revision bigint, p_operacion uuid, p_sorteo_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  perfil agencia.perfiles; anterior agencia.operaciones; sorteo jsonb; socio record; fijo jsonb;
  rev bigint; huella text; pos bigint; id_venta text; venta jsonb; numero text;
  fracciones numeric; max_fracciones numeric; precio numeric; cantidad integer:=0; resultado jsonb;
  oferta record; hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perfil:=agencia.exigir_perfil();
  if p_revision is null or p_operacion is null or coalesce(p_sorteo_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$' then
    raise exception 'Datos de carga inválidos' using errcode='22023';
  end if;
  huella:=encode(sha256(convert_to(jsonb_build_array('loteria_cargar_fijos',p_sorteo_id)::text,'UTF8')),'hex');
  select revision into strict rev from agencia.configuracion for update;
  select * into anterior from agencia.operaciones where id=p_operacion;
  if found then
    if anterior.actor<>perfil.id or anterior.revision_anterior<>p_revision or anterior.huella<>huella then
      raise exception 'El identificador de operación ya fue utilizado' using errcode='22023';
    end if;
    return anterior.resultado;
  end if;
  if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
  select datos into sorteo from agencia.loteria_sorteos where clave=p_sorteo_id;
  if not found then raise exception 'Sorteo inexistente' using errcode='22023'; end if;
  max_fracciones:=(sorteo->>'frac')::numeric; precio:=(sorteo->>'precio')::numeric;
  if max_fracciones is null or max_fracciones<=0 or precio is null then
    raise exception 'Datos de sorteo inválidos' using errcode='22023';
  end if;
  select coalesce(max(posicion),0) into pos from agencia.loteria_ventas;
  for socio in select datos from agencia.socios where coalesce((datos->>'activo')::boolean,false)
    order by datos->>'nombre',posicion loop
    if jsonb_typeof(socio.datos->'fijos') is distinct from 'array' then
      raise exception 'Números fijos inválidos' using errcode='22023';
    end if;
    for fijo in select value from jsonb_array_elements(socio.datos->'fijos') loop
      numero:=fijo->>'numero';
      if numero is null then raise exception 'Número fijo inválido' using errcode='22023'; end if;
      if exists(select 1 from agencia.loteria_ventas where datos->>'soId'=p_sorteo_id
        and datos->>'sid'=socio.datos->>'id' and datos->>'numero'=numero) then continue; end if;
      fracciones:=case when coalesce((fijo->>'frac')::numeric,0)<>0
        then least((fijo->>'frac')::numeric,max_fracciones) else max_fracciones end;
      id_venta:=replace(gen_random_uuid()::text,'-',''); pos:=pos+1;
      venta:=jsonb_build_object('id',id_venta,'alta',hoy,'soId',p_sorteo_id,'sid',socio.datos->>'id',
        'numero',numero,'frac',fracciones,'precio',precio,'quien','','pagado',false);
      insert into agencia.loteria_ventas(clave,posicion,datos) values(id_venta,pos,venta);
      insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
        values(perfil.id,perfil.nombre,'lot',id_venta,'Creó');
      cantidad:=cantidad+1;
    end loop;
  end loop;
  for oferta in delete from agencia.loteria_ofertas o where o.datos->>'soId'=p_sorteo_id
    and exists(select 1 from agencia.loteria_ventas v where v.datos->>'soId'=p_sorteo_id
      and v.datos->>'sid'=o.datos->>'sid') returning o.clave loop
    insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
      values(perfil.id,perfil.nombre,'ofertas',oferta.clave,'Eliminó');
  end loop;
  update agencia.configuracion set revision=revision+1 returning revision into rev;
  resultado:=jsonb_build_object('revision',rev,'cantidad',cantidad);
  insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado)
    values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
  return resultado;
end $$;
revoke all on function public.agencia_loteria_cargar_fijos(bigint,uuid,text) from public,anon,authenticated;

create or replace function agencia.loteria_liberar(p_jugada jsonb,p_modo text,p_actor uuid,p_nombre text)
returns jsonb language plpgsql set search_path='' as $$
declare c record; aplicacion jsonb; retenidas jsonb; importe numeric; total numeric:=0; cambiado boolean; cobro jsonb; socio jsonb; sid text; jugada jsonb:=p_jugada;
begin
 if p_modo not in ('todos','completos','parciales') then raise exception 'Aplicación inválida' using errcode='22023'; end if;
 for c in select clave,datos from agencia.cobros where not coalesce((datos->>'anulado')::boolean,false)
   and jsonb_typeof(datos->'aplicados')='array' order by posicion for update loop
  cobro:=c.datos; retenidas:='[]'::jsonb; cambiado:=false;
  for aplicacion in select value from jsonb_array_elements(c.datos->'aplicados') loop
   if (case when jsonb_typeof(aplicacion->'ref')='array' then jsonb_array_length(aplicacion->'ref')=2 else false end)
     and aplicacion->'ref'->>0='lot' and aplicacion->'ref'->>1=jugada->>'id'
     and (p_modo='todos' or (p_modo='completos' and coalesce((aplicacion->>'completo')::boolean,false))
       or (p_modo='parciales' and not coalesce((aplicacion->>'completo')::boolean,false))) then
    if aplicacion ? 'imp' then importe:=coalesce((aplicacion->>'imp')::numeric,0);
    elsif coalesce((aplicacion->>'completo')::boolean,false) then importe:=coalesce((jugada->>'frac')::numeric,0)*coalesce((jugada->>'precio')::numeric,0)-coalesce((jugada->>'abono')::numeric,0);
    else importe:=coalesce((aplicacion->>'abono')::numeric,0); end if;
    total:=total+importe; cobro:=cobro||jsonb_build_object('liberado',coalesce((cobro->>'liberado')::numeric,0)+importe);
    if not coalesce((aplicacion->>'completo')::boolean,false) then
      jugada:=jugada||jsonb_build_object('abono',greatest(0,coalesce((jugada->>'abono')::numeric,0)-coalesce((aplicacion->>'abono')::numeric,0)));
    end if;
    cambiado:=true;
   else retenidas:=retenidas||jsonb_build_array(aplicacion); end if;
  end loop;
  if cambiado or (cobro->'cubre') is distinct from to_jsonb(jsonb_array_length(retenidas)) then
   cobro:=cobro||jsonb_build_object('aplicados',retenidas,'cubre',jsonb_array_length(retenidas));
   update agencia.cobros set datos=cobro where clave=c.clave;
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'cobros',c.clave,'Modificó');
  end if;
 end loop;
 if total<>0 then
  sid:=jugada->>'sid';select datos into socio from agencia.socios where clave=sid for update;
  if found then
   socio:=socio||jsonb_build_object('favor',coalesce((socio->>'favor')::numeric,0)+total);
   update agencia.socios set datos=socio where clave=sid;
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'socios',sid,'Modificó');
  end if;
 end if;
 return jsonb_build_object('jugada',jugada,'liberado',total);
end $$;
revoke all on function agencia.loteria_liberar(jsonb,text,uuid,text) from public,anon,authenticated;

-- Alta y edición de ventas de Lotería.
create or replace function public.agencia_loteria_venta(
  p_revision bigint,p_operacion uuid,p_id text,p_datos jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 perfil agencia.perfiles; op agencia.operaciones; rev bigint; huella text; sorteo jsonb; socio jsonb;
 anterior jsonb; venta jsonb; liberacion jsonb; resultado jsonb; oferta record;
 sid text; soid text; numero text; clave_venta text; precio numeric; fracciones numeric; maximo numeric;
 total_anterior numeric; total_nuevo numeric; liberado numeric:=0; pos bigint; fijo jsonb;
 hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or jsonb_typeof(p_datos) is distinct from 'object'
   or (p_id is not null and p_id !~ '^[a-zA-Z0-9_-]{1,128}$') then
   raise exception 'Datos de venta inválidos' using errcode='22023'; end if;
 sid:=p_datos->>'sid'; soid:=p_datos->>'soId'; numero:=agencia.texto_recortar_js(p_datos->>'numero');
 if coalesce(sid,'') !~ '^[a-zA-Z0-9_-]{1,128}$' or coalesce(soid,'') !~ '^[a-zA-Z0-9_-]{1,128}$'
   or coalesce(numero,'')='' or jsonb_typeof(p_datos->'frac') is distinct from 'number' then
   raise exception 'Completá socio, número y fracciones' using errcode='22023'; end if;
 fracciones:=(p_datos->>'frac')::numeric;
 huella:=encode(sha256(convert_to(jsonb_build_array('loteria_venta',p_id,p_datos)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then
   raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select datos into sorteo from agencia.loteria_sorteos where clave=soid;
 if not found then raise exception 'Elegí el sorteo' using errcode='22023'; end if;
 select datos into socio from agencia.socios where clave=sid for update;
 if not found then raise exception 'Socio inexistente' using errcode='22023'; end if;
 maximo:=(sorteo->>'frac')::numeric; precio:=(sorteo->>'precio')::numeric;
 if maximo is null or maximo<=0 or fracciones<=0 or fracciones>maximo or fracciones<>trunc(fracciones) or precio is null then
  raise exception 'Fracciones inválidas' using errcode='22023'; end if;
 if p_id is not null then
  select datos into anterior from agencia.loteria_ventas where clave=p_id for update;
  if not found then raise exception 'Venta inexistente' using errcode='22023'; end if;
  clave_venta:=p_id; venta:=anterior;
  if anterior->>'soId'=soid then precio:=(anterior->>'precio')::numeric; end if;
  total_anterior:=(anterior->>'frac')::numeric*(anterior->>'precio')::numeric;
  total_nuevo:=fracciones*precio;
  if coalesce((venta->>'pagado')::boolean,false) and (total_nuevo<>total_anterior or sid<>venta->>'sid')
    and exists(select 1 from agencia.cobros c cross join lateral jsonb_array_elements(coalesce(c.datos->'aplicados','[]'::jsonb)) a
      where not coalesce((c.datos->>'anulado')::boolean,false) and coalesce((a->>'completo')::boolean,false)
        and a->'ref'=jsonb_build_array('lot',p_id)) then
   liberacion:=agencia.loteria_liberar(venta,'completos',perfil.id,perfil.nombre);
   venta:=(liberacion->'jugada')||jsonb_build_object('pagado',false);
   liberado:=liberado+(liberacion->>'liberado')::numeric;
  end if;
  if coalesce((venta->>'abono')::numeric,0)<>0 and not coalesce((venta->>'pagado')::boolean,false)
    and (total_nuevo<=coalesce((venta->>'abono')::numeric,0) or sid<>venta->>'sid') then
   liberacion:=agencia.loteria_liberar(venta,'parciales',perfil.id,perfil.nombre);
   venta:=(liberacion->'jugada')||jsonb_build_object('abono',0);
   liberado:=liberado+(liberacion->>'liberado')::numeric;
  end if;
 else
  clave_venta:=replace(gen_random_uuid()::text,'-',''); venta:=jsonb_build_object('id',clave_venta,'alta',hoy,'pagado',false);
 end if;
 venta:=venta||jsonb_build_object('sid',sid,'soId',soid,'numero',numero,'frac',fracciones,'precio',precio);
 if p_id is null then
  select coalesce(max(posicion),0)+1 into pos from agencia.loteria_ventas;
  insert into agencia.loteria_ventas(clave,posicion,datos) values(clave_venta,pos,venta);
  if coalesce((p_datos->>'fijo')::boolean,false) then
   if jsonb_typeof(socio->'fijos') is distinct from 'array' then raise exception 'Números fijos inválidos' using errcode='22023'; end if;
   if not exists(select 1 from jsonb_array_elements(socio->'fijos') f where f->>'numero'=numero) then
    fijo:=jsonb_build_object('numero',numero,'frac',case when fracciones>=maximo then 0 else fracciones end);
    update agencia.socios set datos=jsonb_set(datos,'{fijos}',datos->'fijos'||jsonb_build_array(fijo)) where clave=sid;
    insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'socios',sid,'Modificó');
   end if;
  end if;
 else update agencia.loteria_ventas v set datos=venta where v.clave=clave_venta; end if;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
  values(perfil.id,perfil.nombre,'lot',clave_venta,case when p_id is null then 'Creó' else 'Modificó' end);
 for oferta in delete from agencia.loteria_ofertas o where o.datos->>'soId'=soid and o.datos->>'sid'=sid returning o.clave loop
  insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'ofertas',oferta.clave,'Eliminó');
 end loop;
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'id',clave_venta,'liberado',liberado);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_text_representation or numeric_value_out_of_range then
 raise exception 'Datos de venta inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_loteria_venta(bigint,uuid,text,jsonb) from public,anon,authenticated;

-- Elimina una venta y devuelve al socio los importes vinculados a cobros.
create or replace function public.agencia_loteria_eliminar_venta(
 p_revision bigint,p_operacion uuid,p_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles; op agencia.operaciones; rev bigint; huella text; venta jsonb; liberacion jsonb; resultado jsonb;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or coalesce(p_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$' then
  raise exception 'Datos de venta inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('loteria_eliminar_venta',p_id)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then
   raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select datos into venta from agencia.loteria_ventas where clave=p_id for update;
 if not found then raise exception 'Venta inexistente' using errcode='22023'; end if;
 liberacion:=agencia.loteria_liberar(venta,'todos',perfil.id,perfil.nombre);
 delete from agencia.loteria_ventas where clave=p_id;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'lot',p_id,'Eliminó');
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'liberado',(liberacion->>'liberado')::numeric);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
end $$;
revoke all on function public.agencia_loteria_eliminar_venta(bigint,uuid,text) from public,anon,authenticated;

-- Cambios de pago y anulación de una venta de Lotería.
create or replace function public.agencia_loteria_pago(
 p_revision bigint,p_operacion uuid,p_id text,p_accion text,p_datos jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles; op agencia.operaciones; rev bigint; huella text; venta jsonb; liberacion jsonb; resultado jsonb; monto_liberado numeric:=0;
 hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or coalesce(p_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$'
  or p_accion is null or p_accion not in ('editar_pago','anular_pago','marcar','desmarcar','anular')
  or jsonb_typeof(p_datos) is distinct from 'object' then
  raise exception 'Datos de pago inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('loteria_pago',p_id,p_accion,p_datos)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then
   raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select datos into venta from agencia.loteria_ventas where clave=p_id for update;
 if not found then raise exception 'Venta inexistente' using errcode='22023'; end if;
 if p_accion='editar_pago' then
  if coalesce(p_datos->>'fecha','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha inválida' using errcode='22023'; end if;
  venta:=venta||jsonb_build_object('fpago',(p_datos->>'fecha')::date,'medio',coalesce(p_datos->>'medio',''),'det',coalesce(p_datos->'detalle','null'::jsonb));
 elsif p_accion='anular_pago' then
  venta:=(venta-'fpago'-'medio'-'det')||jsonb_build_object('pagado',false);
  liberacion:=agencia.loteria_liberar(venta,'completos',perfil.id,perfil.nombre);
  venta:=liberacion->'jugada'; monto_liberado:=(liberacion->>'liberado')::numeric;
 elsif p_accion='anular' then
  liberacion:=agencia.loteria_liberar(venta,'todos',perfil.id,perfil.nombre);
  venta:=(liberacion->'jugada')||jsonb_build_object('anulado',true); monto_liberado:=(liberacion->>'liberado')::numeric;
 elsif p_accion='marcar' then venta:=venta||jsonb_build_object('pagado',true,'fpago',hoy,'medio','');
 else venta:=(venta-'fpago'-'medio')||jsonb_build_object('pagado',false); end if;
 update agencia.loteria_ventas set datos=venta where clave=p_id;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'lot',p_id,'Modificó');
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'liberado',monto_liberado);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Fecha inválida' using errcode='22023';
end $$;
revoke all on function public.agencia_loteria_pago(bigint,uuid,text,text,jsonb) from public,anon,authenticated;

-- Crear, editar y eliminar sorteos de Lotería.
create or replace function public.agencia_loteria_sorteo(
 p_revision bigint,p_operacion uuid,p_accion text,p_id text,p_datos jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles; op agencia.operaciones; rev bigint; huella text; id_sorteo text; sorteo jsonb; resultado jsonb; fila record; pos bigint; fecha date; frac numeric; precio numeric; nombre text;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or p_accion is null or p_accion not in ('crear','editar','eliminar')
  or jsonb_typeof(p_datos) is distinct from 'object' or (p_accion='crear' and p_id is not null)
  or (p_accion<>'crear' and coalesce(p_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$') then
  raise exception 'Datos de sorteo inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('loteria_sorteo',p_accion,p_id,p_datos)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 if p_accion<>'crear' then
  select datos into sorteo from agencia.loteria_sorteos where clave=p_id for update;
  if not found then raise exception 'Sorteo inexistente' using errcode='22023'; end if;
 end if;
 if p_accion in ('crear','editar') then
  if jsonb_typeof(p_datos->'nombre') is distinct from 'string' or coalesce(p_datos->>'fecha','') !~ '^\d{4}-\d{2}-\d{2}$'
   or jsonb_typeof(p_datos->'frac') is distinct from 'number' or jsonb_typeof(p_datos->'precio') is distinct from 'number' then raise exception 'Datos de sorteo inválidos' using errcode='22023'; end if;
  nombre:=p_datos->>'nombre';fecha:=(p_datos->>'fecha')::date;frac:=(p_datos->>'frac')::numeric;precio:=(p_datos->>'precio')::numeric;
  if agencia.texto_recortar_js(nombre)='' or frac<=0 or frac<>trunc(frac) or precio<0 then raise exception 'Datos de sorteo inválidos' using errcode='22023'; end if;
  if p_accion='crear' then
   id_sorteo:=replace(gen_random_uuid()::text,'-','');
   sorteo:=jsonb_build_object('id',id_sorteo,'nombre',nombre,'fecha',fecha,'frac',frac,'precio',precio);
   select coalesce(max(posicion),0)+1 into pos from agencia.loteria_sorteos;
   insert into agencia.loteria_sorteos(clave,posicion,datos) values(id_sorteo,pos,sorteo);
  else
   id_sorteo:=p_id;sorteo:=sorteo||jsonb_build_object('nombre',nombre,'fecha',fecha,'frac',frac,'precio',precio);
   update agencia.loteria_sorteos set datos=sorteo where clave=p_id;
  end if;
 else
  id_sorteo:=p_id;
  for fila in delete from agencia.loteria_ventas where datos->>'soId'=p_id returning clave loop
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'lot',fila.clave,'Eliminó'); end loop;
  for fila in delete from agencia.loteria_ofertas where datos->>'soId'=p_id returning clave loop
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'ofertas',fila.clave,'Eliminó'); end loop;
  delete from agencia.loteria_sorteos where clave=p_id;
 end if;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'sorteos',id_sorteo,
  case p_accion when 'crear' then 'Creó' when 'editar' then 'Modificó' else 'Eliminó' end);
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'id',id_sorteo);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'Datos de sorteo inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_loteria_sorteo(bigint,uuid,text,text,jsonb) from public,anon,authenticated;

-- Vista previa con el precio actual mostrado por el formulario de la maqueta.
create or replace function public.agencia_loteria_prever(
 p_revision bigint,p_sorteo_id text,p_fracciones numeric,p_venta_id text default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint; sorteo jsonb; venta jsonb; precio numeric; maximo numeric;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or coalesce(p_sorteo_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$'
  or p_fracciones is null or p_fracciones<=0 or p_fracciones<>trunc(p_fracciones) then
  raise exception 'Datos de vista previa inválidos' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select datos into sorteo from agencia.loteria_sorteos where clave=p_sorteo_id;
 if not found then raise exception 'Sorteo inexistente' using errcode='22023'; end if;
 maximo:=(sorteo->>'frac')::numeric;precio:=(sorteo->>'precio')::numeric;
 if maximo is null or maximo<=0 or precio is null or p_fracciones>maximo then raise exception 'Fracciones inválidas' using errcode='22023'; end if;
 if p_venta_id is not null then
  select datos into venta from agencia.loteria_ventas where clave=p_venta_id;
  if not found then raise exception 'Venta inexistente' using errcode='22023'; end if;
 end if;
 return jsonb_build_object('precio',precio,'fracciones',p_fracciones,'entero',p_fracciones=maximo,'total',p_fracciones*precio);
end $$;
revoke all on function public.agencia_loteria_prever(bigint,text,numeric,text) from public,anon,authenticated;

-- Agrega o quita un número fijo de un socio.
create or replace function public.agencia_loteria_numero_fijo(
 p_revision bigint,p_operacion uuid,p_socio_id text,p_accion text,p_numero text default null,p_fracciones numeric default null,p_indice integer default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles; op agencia.operaciones; rev bigint; huella text; socio jsonb; fijos jsonb; numero text; resultado jsonb;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or coalesce(p_socio_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$'
  or p_accion is null or p_accion not in ('agregar','quitar') then raise exception 'Datos de número fijo inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('loteria_numero_fijo',p_socio_id,p_accion,p_numero,p_fracciones,p_indice)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select datos into socio from agencia.socios where clave=p_socio_id for update;
 if not found then raise exception 'Socio inexistente' using errcode='22023'; end if;
 fijos:=socio->'fijos';if jsonb_typeof(fijos) is distinct from 'array' then raise exception 'Números fijos inválidos' using errcode='22023'; end if;
 if p_accion='agregar' then
  numero:=translate(coalesce(p_numero,''),E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279),'');
  if numero='' or p_fracciones is null or p_fracciones<0 or p_fracciones<>trunc(p_fracciones) then raise exception 'Escribí el número y elegí las fracciones' using errcode='22023'; end if;
  fijos:=fijos||jsonb_build_array(jsonb_build_object('numero',numero,'frac',p_fracciones));
 else
  if p_indice is null or p_indice<0 or p_indice>=jsonb_array_length(fijos) then raise exception 'Número fijo inexistente' using errcode='22023'; end if;
  fijos:=fijos-p_indice;
 end if;
 update agencia.socios set datos=jsonb_set(datos,'{fijos}',fijos) where clave=p_socio_id;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'socios',p_socio_id,'Modificó');
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
end $$;
revoke all on function public.agencia_loteria_numero_fijo(bigint,uuid,text,text,text,numeric,integer) from public,anon,authenticated;

-- Agrega los sorteos anuales que todavía no existen por nombre.
create or replace function public.agencia_loteria_agregar_anio(p_revision bigint,p_operacion uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles;op agencia.operaciones;rev bigint;huella text;conf jsonb;anio integer;objetivo integer;precio numeric;fila record;id_sorteo text;pos bigint;cantidad integer:=0;resultado jsonb;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null then raise exception 'Datos inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to('loteria_agregar_anio','UTF8')),'hex');
 select revision,datos into strict rev,conf from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select greatest(extract(year from current_timestamp at time zone 'America/Argentina/Buenos_Aires')::integer,
  coalesce(max(substring(datos->>'fecha' from 1 for 4)::integer),0)) into anio from agencia.loteria_sorteos;
 objetivo:=case when exists(select 1 from agencia.loteria_sorteos where datos->>'fecha' like anio::text||'-07%') then anio+1 else anio end;
 precio:=(conf->>'fracPrecio')::numeric;if precio is null then raise exception 'Precio de fracción inválido' using errcode='22023'; end if;
 select coalesce(max(posicion),0) into pos from agencia.loteria_sorteos;
 for fila in select * from (values ('Gordo de Reyes '||objetivo,make_date(objetivo,1,6),10),('Gordo de Invierno '||objetivo,make_date(objetivo,7,15),10),('Gordo de Navidad '||objetivo,make_date(objetivo,12,23),20)) as s(nombre,fecha,frac) loop
  if exists(select 1 from agencia.loteria_sorteos where datos->>'nombre'=fila.nombre) then continue; end if;
  id_sorteo:=replace(gen_random_uuid()::text,'-','');pos:=pos+1;
  insert into agencia.loteria_sorteos(clave,posicion,datos) values(id_sorteo,pos,jsonb_build_object('id',id_sorteo,'nombre',fila.nombre,'fecha',fila.fecha,'frac',fila.frac,'precio',precio));
  insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'sorteos',id_sorteo,'Creó');cantidad:=cantidad+1;
 end loop;
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'cantidad',cantidad);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
end $$;
revoke all on function public.agencia_loteria_agregar_anio(bigint,uuid) from public,anon,authenticated;

-- Datos y totales del sorteo consultados en una misma instantánea.
drop function if exists public.agencia_loteria_listar(bigint,text);
create or replace function public.agencia_loteria_listar(p_revision bigint,p_sorteo_id text,p_filtro text default 'todos')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint; sorteo jsonb; filas jsonb; sin_ofrecer jsonb; no_quisieron jsonb; cantidad integer; fracciones numeric; cobrado numeric; falta numeric; cobrado_filtrado numeric; falta_filtrado numeric; fijos_pendientes integer;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or coalesce(p_sorteo_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$' or p_filtro is null or p_filtro not in ('todos','deben','pagados') then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select datos into sorteo from agencia.loteria_sorteos where clave=p_sorteo_id;
 if not found then raise exception 'Sorteo inexistente' using errcode='22023'; end if;
 select count(*)::integer,coalesce(sum((v.datos->>'frac')::numeric),0),
  coalesce(sum(case when coalesce((v.datos->>'pagado')::boolean,false) then (v.datos->>'frac')::numeric*(v.datos->>'precio')::numeric
   else least((v.datos->>'frac')::numeric*(v.datos->>'precio')::numeric,coalesce((v.datos->>'abono')::numeric,0)) end),0),
  coalesce(sum(case when coalesce((v.datos->>'pagado')::boolean,false) then 0
   else greatest(0,round((v.datos->>'frac')::numeric*(v.datos->>'precio')::numeric-coalesce((v.datos->>'abono')::numeric,0),2)) end),0)
 into cantidad,fracciones,cobrado,falta from agencia.loteria_ventas v where v.datos->>'soId'=p_sorteo_id;
 select coalesce(sum(case when coalesce((v.datos->>'pagado')::boolean,false) then (v.datos->>'frac')::numeric*(v.datos->>'precio')::numeric else least((v.datos->>'frac')::numeric*(v.datos->>'precio')::numeric,coalesce((v.datos->>'abono')::numeric,0)) end),0),
  coalesce(sum(case when coalesce((v.datos->>'pagado')::boolean,false) then 0 else greatest(0,round((v.datos->>'frac')::numeric*(v.datos->>'precio')::numeric-coalesce((v.datos->>'abono')::numeric,0),2)) end),0)
 into cobrado_filtrado,falta_filtrado from agencia.loteria_ventas v where v.datos->>'soId'=p_sorteo_id and (p_filtro='todos' or (p_filtro='pagados')=coalesce((v.datos->>'pagado')::boolean,false));
 select coalesce(jsonb_agg(jsonb_build_object('venta',v.datos,'socio',coalesce(s.datos->>'nombre','(socio borrado)'),
  'nombreAutor',coalesce((select p.nombre from agencia.perfiles p where p.id::text=v.datos->>'por' and p.activo),
    (select n.nombre from agencia.actores n where n.actor=v.datos->>'por'),''),
  'nombreEditor',coalesce((select p.nombre from agencia.perfiles p where p.id::text=v.datos->>'modPor' and p.activo),
    (select n.nombre from agencia.actores n where n.actor=v.datos->>'modPor'),''),
  'importe',(v.datos->>'frac')::numeric*(v.datos->>'precio')::numeric,
  'restante',greatest(0,(v.datos->>'frac')::numeric*(v.datos->>'precio')::numeric-coalesce((v.datos->>'abono')::numeric,0)))
  order by case when regexp_replace(coalesce(v.datos->>'numero',''),'[^0-9]','','g')='' then null
   else regexp_replace(v.datos->>'numero','[^0-9]','','g')::numeric end nulls last, v.datos->>'numero',s.datos->>'nombre',v.posicion),'[]'::jsonb)
 into filas from agencia.loteria_ventas v left join agencia.socios s on s.clave=v.datos->>'sid' where v.datos->>'soId'=p_sorteo_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.clave,'nombre',s.datos->>'nombre') order by s.datos->>'nombre',s.posicion),'[]'::jsonb)
 into sin_ofrecer from agencia.socios s where coalesce((s.datos->>'activo')::boolean,false)
  and not exists(select 1 from agencia.loteria_ventas v where v.datos->>'soId'=p_sorteo_id and v.datos->>'sid'=s.clave)
  and not exists(select 1 from agencia.loteria_ofertas o where o.datos->>'soId'=p_sorteo_id and o.datos->>'sid'=s.clave);
 select coalesce(jsonb_agg(jsonb_build_object('id',s.clave,'nombre',s.datos->>'nombre') order by s.datos->>'nombre',s.posicion),'[]'::jsonb)
 into no_quisieron from agencia.socios s where coalesce((s.datos->>'activo')::boolean,false)
  and not exists(select 1 from agencia.loteria_ventas v where v.datos->>'soId'=p_sorteo_id and v.datos->>'sid'=s.clave)
  and exists(select 1 from agencia.loteria_ofertas o where o.datos->>'soId'=p_sorteo_id and o.datos->>'sid'=s.clave);
 select count(*)::integer into fijos_pendientes from agencia.socios s where coalesce((s.datos->>'activo')::boolean,false)
  and exists(select 1 from jsonb_array_elements(coalesce(s.datos->'fijos','[]'::jsonb)) f
   where not exists(select 1 from agencia.loteria_ventas v where v.datos->>'soId'=p_sorteo_id and v.datos->>'sid'=s.clave and v.datos->>'numero'=f->>'numero'));
 return jsonb_build_object('sorteo',sorteo,'dias',((sorteo->>'fecha')::date-(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date),
  'importeEntero',(sorteo->>'frac')::numeric*(sorteo->>'precio')::numeric,'cantidad',cantidad,'fraccionesVendidas',fracciones,'cobrado',cobrado,'falta',falta,'cobradoFiltrado',cobrado_filtrado,'faltaFiltrado',falta_filtrado,
  'fijosPend',fijos_pendientes,'filas',filas,'sinOf',sin_ofrecer,'noQ',no_quisieron);
end $$;
revoke all on function public.agencia_loteria_listar(bigint,text,text) from public,anon,authenticated;

-- Ventas y números fijos de un socio, con importes calculados por la base.
create or replace function public.agencia_loteria_socio_listar(p_revision bigint,p_socio_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint;socio jsonb;filas jsonb;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or coalesce(p_socio_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$' then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select datos into socio from agencia.socios where clave=p_socio_id;
 if not found then raise exception 'Socio inexistente' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('venta',v.datos,'sorteo',coalesce(s.datos->>'nombre','—'),
  'fraccionesSorteo',s.datos->'frac','importe',(v.datos->>'frac')::numeric*(v.datos->>'precio')::numeric,
  'restante',greatest(0,(v.datos->>'frac')::numeric*(v.datos->>'precio')::numeric-coalesce((v.datos->>'abono')::numeric,0)))
  order by coalesce(s.datos->>'fecha','') desc,v.posicion),'[]'::jsonb)
 into filas from agencia.loteria_ventas v left join agencia.loteria_sorteos s on s.clave=v.datos->>'soId' where v.datos->>'sid'=p_socio_id;
 return jsonb_build_object('fijos',coalesce(socio->'fijos','[]'::jsonb),'filas',filas);
end $$;
revoke all on function public.agencia_loteria_socio_listar(bigint,text) from public,anon,authenticated;

-- Alta, edición y eliminación de sorteos especiales de Quini.
create or replace function public.agencia_quini_especial(
 p_revision bigint,p_operacion uuid,p_accion text,p_id text,p_datos jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles;op agencia.operaciones;rev bigint;huella text;registro jsonb;resultado jsonb;id_registro text;fecha date;precio numeric;nombre text;pos bigint;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or p_accion is null or p_accion not in ('crear','editar','eliminar')
  or jsonb_typeof(p_datos) is distinct from 'object' or (p_accion='crear' and p_id is not null)
  or (p_accion<>'crear' and coalesce(p_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$') then raise exception 'Datos de sorteo inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('quini_especial',p_accion,p_id,p_datos)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 if p_accion<>'crear' then
  select datos into registro from agencia.quini_sorteos_especiales where clave=p_id for update;
  if not found then raise exception 'Sorteo especial inexistente' using errcode='22023'; end if;
 end if;
 if p_accion in ('crear','editar') then
  if coalesce(p_datos->>'fecha','') !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(p_datos->'precio') is distinct from 'number' then raise exception 'Poné fecha y precio' using errcode='22023'; end if;
  fecha:=(p_datos->>'fecha')::date;precio:=(p_datos->>'precio')::numeric;
  if precio=0 then raise exception 'Poné fecha y precio' using errcode='22023'; end if;
  nombre:=coalesce(nullif(agencia.texto_recortar_js(p_datos->>'nombre'),''),'Sorteo especial');
  if p_accion='crear' then
   id_registro:=replace(gen_random_uuid()::text,'-','');registro:=jsonb_build_object('id',id_registro,'fecha',fecha,'nombre',nombre,'precio',precio);
   select coalesce(max(posicion),0)+1 into pos from agencia.quini_sorteos_especiales;
   insert into agencia.quini_sorteos_especiales(clave,posicion,datos) values(id_registro,pos,registro);
  else
   id_registro:=p_id;registro:=registro||jsonb_build_object('fecha',fecha,'nombre',nombre,'precio',precio);
   update agencia.quini_sorteos_especiales set datos=registro where clave=p_id;
  end if;
 else id_registro:=p_id;delete from agencia.quini_sorteos_especiales where clave=p_id; end if;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'q6esp',id_registro,
  case p_accion when 'crear' then 'Creó' when 'editar' then 'Modificó' else 'Eliminó' end);
 perform agencia.generar_quini_pendientes(perfil);
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'id',id_registro);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'Datos de sorteo inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_quini_especial(bigint,uuid,text,text,jsonb) from public,anon,authenticated;

create or replace function agencia.quini_liberar(p_jugada jsonb,p_modo text,p_actor uuid,p_nombre text)
returns jsonb language plpgsql set search_path='' as $$
declare c record; aplicacion jsonb; retenidas jsonb; importe numeric; total numeric:=0; cambiado boolean; cobro jsonb; socio jsonb; sid text; jugada jsonb:=p_jugada;
begin
 if p_modo not in ('todos','completos','parciales') then raise exception 'Aplicación inválida' using errcode='22023'; end if;
 for c in select clave,datos from agencia.cobros where not coalesce((datos->>'anulado')::boolean,false)
   and jsonb_typeof(datos->'aplicados')='array' order by posicion for update loop
  cobro:=c.datos; retenidas:='[]'::jsonb; cambiado:=false;
  for aplicacion in select value from jsonb_array_elements(c.datos->'aplicados') loop
   if (case when jsonb_typeof(aplicacion->'ref')='array' then jsonb_array_length(aplicacion->'ref')=2 else false end)
     and aplicacion->'ref'->>0='q6' and aplicacion->'ref'->>1=jugada->>'id'
     and (p_modo='todos' or (p_modo='completos' and coalesce((aplicacion->>'completo')::boolean,false))
       or (p_modo='parciales' and not coalesce((aplicacion->>'completo')::boolean,false))) then
    if aplicacion ? 'imp' then importe:=coalesce((aplicacion->>'imp')::numeric,0);
    elsif coalesce((aplicacion->>'completo')::boolean,false) then importe:=coalesce((jugada->>'monto')::numeric,0)-coalesce((jugada->>'abono')::numeric,0);
    else importe:=coalesce((aplicacion->>'abono')::numeric,0); end if;
    total:=total+importe; cobro:=cobro||jsonb_build_object('liberado',coalesce((cobro->>'liberado')::numeric,0)+importe);
    if not coalesce((aplicacion->>'completo')::boolean,false) then
      jugada:=jugada||jsonb_build_object('abono',greatest(0,coalesce((jugada->>'abono')::numeric,0)-coalesce((aplicacion->>'abono')::numeric,0)));
    end if;
    cambiado:=true;
   else retenidas:=retenidas||jsonb_build_array(aplicacion); end if;
  end loop;
  if cambiado or (cobro->'cubre') is distinct from to_jsonb(jsonb_array_length(retenidas)) then
   cobro:=cobro||jsonb_build_object('aplicados',retenidas,'cubre',jsonb_array_length(retenidas));
   update agencia.cobros set datos=cobro where clave=c.clave;
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'cobros',c.clave,'Modificó');
  end if;
 end loop;
 if total<>0 then
  sid:=jugada->>'sid';select datos into socio from agencia.socios where clave=sid for update;
  if found then
   socio:=socio||jsonb_build_object('favor',coalesce((socio->>'favor')::numeric,0)+total);
   update agencia.socios set datos=socio where clave=sid;
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'socios',sid,'Modificó');
  end if;
 end if;
 return jsonb_build_object('jugada',jugada,'liberado',total);
end $$;
revoke all on function agencia.quini_liberar(jsonb,text,uuid,text) from public,anon,authenticated;

-- Carga, modifica o elimina una jugada Quini, con sus vínculos de cobro.
create or replace function public.agencia_quini_jugada(
 p_revision bigint,p_operacion uuid,p_accion text,p_id text,p_datos jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles;op agencia.operaciones;rev bigint;huella text;config jsonb;socio jsonb;jugada jsonb;especial jsonb;liberacion jsonb;resultado jsonb;sid text;id_jugada text;fecha date;cantidad integer;precio numeric;monto numeric;pos bigint;liberado numeric:=0;dias jsonb;plan jsonb;skip text;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or p_accion is null or p_accion not in ('crear','editar','eliminar')
  or jsonb_typeof(p_datos) is distinct from 'object' or (p_accion='crear' and p_id is not null)
  or (p_accion<>'crear' and coalesce(p_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$') then raise exception 'Datos de jugada inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('quini_jugada',p_accion,p_id,p_datos)::text,'UTF8')),'hex');
 select revision,datos into strict rev,config from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 if p_accion<>'crear' then
  select datos into jugada from agencia.quini_jugadas where clave=p_id for update;
  if not found then raise exception 'Jugada inexistente' using errcode='22023'; end if;
 end if;
 if p_accion in ('crear','editar') then
  sid:=p_datos->>'sid';
  if coalesce(sid,'') !~ '^[a-zA-Z0-9_-]{1,128}$' or coalesce(p_datos->>'fecha','') !~ '^\d{4}-\d{2}-\d{2}$'
   or jsonb_typeof(p_datos->'cantidad') is distinct from 'number' then raise exception 'Elegí el socio y el sorteo' using errcode='22023'; end if;
  if (p_datos->>'cantidad')::numeric<>trunc((p_datos->>'cantidad')::numeric) then raise exception 'Cantidad inválida' using errcode='22023'; end if;
  fecha:=(p_datos->>'fecha')::date;cantidad:=(p_datos->>'cantidad')::integer;
  if cantidad<1 then raise exception 'Cantidad inválida' using errcode='22023'; end if;
  select datos into socio from agencia.socios where clave=sid for update;
  if not found then raise exception 'Socio inexistente' using errcode='22023'; end if;
  select datos into especial from agencia.quini_sorteos_especiales where datos->>'fecha'=fecha::text order by posicion limit 1;
  precio:=case when especial is null then (config->>'q6Precio')::numeric else (especial->>'precio')::numeric end;
  if precio is null then raise exception 'Precio de Quini inválido' using errcode='22023'; end if;
  monto:=precio*cantidad;
  if p_accion='crear' then
   if exists(select 1 from agencia.quini_jugadas where datos->>'sid'=sid and datos->>'fecha'=fecha::text) then raise exception 'Ya tiene una jugada en ese sorteo; editala' using errcode='22023'; end if;
   if coalesce((p_datos->>'automatico')::boolean,false) then
    dias:=p_datos->'dias';
    if jsonb_typeof(dias) is distinct from 'array' or jsonb_array_length(dias)=0 then raise exception 'Elegí al menos un día para jugar todas las semanas' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(dias) d where jsonb_typeof(d)<>'number' or (d#>>'{}')::numeric not between 0 and 6 or (d#>>'{}')::numeric<>trunc((d#>>'{}')::numeric)) then raise exception 'Día inválido' using errcode='22023'; end if;
    plan:=coalesce(socio->'q6','{}'::jsonb);
    if jsonb_typeof(plan->'dias') is distinct from 'array' then raise exception 'Plan de Quini inválido' using errcode='22023'; end if;
    select coalesce(jsonb_agg(d order by d),'[]'::jsonb) into dias from (select distinct (value#>>'{}')::integer d from jsonb_array_elements((plan->'dias')||dias)) x;
    if not coalesce((plan->>'auto')::boolean,false) then plan:=plan||jsonb_build_object('auto',true,'desde',fecha); end if;
    plan:=plan||jsonb_build_object('dias',dias,'activo',true,'cant',cantidad);
    update agencia.socios set datos=jsonb_set(datos,'{q6}',plan,true) where clave=sid;
    insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'socios',sid,'Modificó');
   end if;
   id_jugada:=replace(gen_random_uuid()::text,'-','');jugada:=jsonb_build_object('id',id_jugada,'sid',sid,'fecha',fecha,'monto',monto,'pagado',false);
   select coalesce(max(posicion),0)+1 into pos from agencia.quini_jugadas;
   insert into agencia.quini_jugadas(clave,posicion,datos) values(id_jugada,pos,jugada);
  else
   id_jugada:=p_id;
   if coalesce((jugada->>'pagado')::boolean,false) and (monto<>coalesce((jugada->>'monto')::numeric,0) or sid<>jugada->>'sid')
    and exists(select 1 from agencia.cobros c cross join lateral jsonb_array_elements(coalesce(c.datos->'aplicados','[]'::jsonb)) a
     where not coalesce((c.datos->>'anulado')::boolean,false) and coalesce((a->>'completo')::boolean,false) and a->'ref'=jsonb_build_array('q6',p_id)) then
    liberacion:=agencia.quini_liberar(jugada,'completos',perfil.id,perfil.nombre);jugada:=(liberacion->'jugada')||jsonb_build_object('pagado',false);liberado:=liberado+(liberacion->>'liberado')::numeric;
   end if;
   if coalesce((jugada->>'abono')::numeric,0)<>0 and not coalesce((jugada->>'pagado')::boolean,false) and (monto<=coalesce((jugada->>'abono')::numeric,0) or sid<>jugada->>'sid') then
    liberacion:=agencia.quini_liberar(jugada,'parciales',perfil.id,perfil.nombre);jugada:=(liberacion->'jugada')||jsonb_build_object('abono',0);liberado:=liberado+(liberacion->>'liberado')::numeric;
   end if;
   jugada:=jugada||jsonb_build_object('sid',sid,'fecha',fecha,'monto',monto);
   update agencia.quini_jugadas set datos=jugada where clave=p_id;
  end if;
 else
  id_jugada:=p_id;liberacion:=agencia.quini_liberar(jugada,'todos',perfil.id,perfil.nombre);liberado:=(liberacion->>'liberado')::numeric;
  skip:=(jugada->>'sid')||'|'||(jugada->>'fecha');select coalesce(max(posicion),0)+1 into pos from agencia.quini_exclusiones;
  insert into agencia.quini_exclusiones(clave,posicion,datos) values(pos::text,pos,to_jsonb(skip));
  insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'q6skip',pos::text,'Creó');
  delete from agencia.quini_jugadas where clave=p_id;
 end if;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'q6',id_jugada,case p_accion when 'crear' then 'Creó' when 'editar' then 'Modificó' else 'Eliminó' end);
 -- done() en la maqueta redibuja y genera lo pendiente del plan activado.
 perform agencia.generar_quini_pendientes(perfil);
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'id',id_jugada,'liberado',liberado);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'Datos de jugada inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_quini_jugada(bigint,uuid,text,text,jsonb) from public,anon,authenticated;

-- Precio e importe de una jugada, para la vista previa.
create or replace function public.agencia_quini_prever(p_revision bigint,p_fecha date,p_cantidad integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint;config jsonb;especial jsonb;precio numeric;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or p_fecha is null or p_cantidad is null or p_cantidad<1 then raise exception 'Datos de jugada inválidos' using errcode='22023'; end if;
 select revision,datos into strict rev,config from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select datos into especial from agencia.quini_sorteos_especiales where datos->>'fecha'=p_fecha::text order by posicion limit 1;
 precio:=case when especial is null then (config->>'q6Precio')::numeric else (especial->>'precio')::numeric end;
 if precio is null then raise exception 'Precio de Quini inválido' using errcode='22023'; end if;
 return jsonb_build_object('precio',precio,'cantidad',p_cantidad,'total',precio*p_cantidad);
end $$;
revoke all on function public.agencia_quini_prever(bigint,date,integer) from public,anon,authenticated;

-- Modifica el plan semanal y genera las jugadas automáticas en la misma transacción.
create or replace function public.agencia_quini_plan(
 p_revision bigint,p_operacion uuid,p_socio_id text,p_accion text,p_datos jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles;op agencia.operaciones;rev bigint;huella text;socio jsonb;plan jsonb;dias jsonb;dias_anteriores jsonb;dias_prev_ordenados jsonb;config jsonb;cantidad integer;dia integer;habilitar boolean;resultado jsonb;hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or coalesce(p_socio_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$'
  or p_accion is null or p_accion not in ('guardar','auto','dia') or jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos del plan inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('quini_plan',p_socio_id,p_accion,p_datos)::text,'UTF8')),'hex');
 select revision,datos into strict rev,config from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select datos into socio from agencia.socios where clave=p_socio_id for update;
 if not found then raise exception 'Socio inexistente' using errcode='22023'; end if;
 plan:=socio->'q6';if jsonb_typeof(plan) is distinct from 'object' or jsonb_typeof(plan->'dias') is distinct from 'array' then raise exception 'Plan de Quini inválido' using errcode='22023'; end if;
 -- La maqueta genera antes de cambiar el plan para conservar lo que ya correspondía.
 perform agencia.generar_quini_pendientes(perfil);
 dias_anteriores:=plan->'dias';
 if p_accion='guardar' then
  dias:=p_datos->'dias';
  if jsonb_typeof(dias) is distinct from 'array' or jsonb_typeof(p_datos->'cantidad') is distinct from 'number' then raise exception 'Días o cantidad inválidos' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(dias) d where jsonb_typeof(d)<>'number' or (d#>>'{}')::numeric not between 0 and 6 or (d#>>'{}')::numeric<>trunc((d#>>'{}')::numeric)) then raise exception 'Día inválido' using errcode='22023'; end if;
  if (p_datos->>'cantidad')::numeric<>trunc((p_datos->>'cantidad')::numeric) then raise exception 'Cantidad inválida' using errcode='22023'; end if;
  cantidad:=greatest(1,(p_datos->>'cantidad')::integer);
  select coalesce(jsonb_agg(d order by d),'[]'::jsonb) into dias from (select distinct (value#>>'{}')::integer d from jsonb_array_elements(dias)) x;
  select coalesce(jsonb_agg((value#>>'{}')::integer order by (value#>>'{}')::integer),'[]'::jsonb) into dias_prev_ordenados from jsonb_array_elements(dias_anteriores);
  if jsonb_array_length(dias)>0 and (not coalesce((plan->>'auto')::boolean,false) or dias<>dias_prev_ordenados) then plan:=plan||jsonb_build_object('desde',hoy); end if;
  plan:=plan||jsonb_build_object('dias',dias,'activo',jsonb_array_length(dias)>0,'auto',jsonb_array_length(dias)>0,'cant',cantidad);
 elsif p_accion='auto' then
  if jsonb_typeof(p_datos->'habilitar') is distinct from 'boolean' then raise exception 'Estado inválido' using errcode='22023'; end if;
  habilitar:=(p_datos->>'habilitar')::boolean;dias:=plan->'dias';
  if habilitar then
   if jsonb_array_length(dias)=0 then dias:=config->'q6Dias';if jsonb_typeof(dias) is distinct from 'array' then raise exception 'Días de sorteo inválidos' using errcode='22023'; end if;end if;
   plan:=plan||jsonb_build_object('desde',hoy);
  end if;
  plan:=plan||jsonb_build_object('auto',habilitar,'dias',dias,'activo',jsonb_array_length(dias)>0);
 else
  if jsonb_typeof(p_datos->'dia') is distinct from 'number' or jsonb_typeof(p_datos->'habilitar') is distinct from 'boolean'
   or (p_datos->>'dia')::numeric not between 0 and 6 or (p_datos->>'dia')::numeric<>trunc((p_datos->>'dia')::numeric) then raise exception 'Día inválido' using errcode='22023'; end if;
  dia:=(p_datos->>'dia')::integer;habilitar:=(p_datos->>'habilitar')::boolean;
  select coalesce(jsonb_agg(d order by d),'[]'::jsonb) into dias from (select (value#>>'{}')::integer d from jsonb_array_elements(plan->'dias') where (value#>>'{}')::integer<>dia union all select dia where habilitar) x;
  plan:=plan||jsonb_build_object('dias',dias,'activo',jsonb_array_length(dias)>0);
  if jsonb_array_length(dias)=0 then plan:=plan||jsonb_build_object('auto',false);
  elsif not coalesce((plan->>'auto')::boolean,false) then plan:=plan||jsonb_build_object('auto',true,'desde',hoy); end if;
 end if;
 update agencia.socios set datos=jsonb_set(datos,'{q6}',plan,true) where clave=p_socio_id;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'socios',p_socio_id,'Modificó');
 perform agencia.generar_quini_pendientes(perfil);
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'id',p_socio_id);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Datos del plan inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_quini_plan(bigint,uuid,text,text,jsonb) from public,anon,authenticated;



-- Alta y edición de rifas; conserva cuotas cobradas según la maqueta.
create or replace function public.agencia_rifa_guardar(p_revision bigint,p_operacion uuid,p_id text,p_datos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles;op agencia.operaciones;rev bigint;config jsonb;huella text;rifa jsonb;resultado jsonb;sid text;numero text;modo text;anio integer;importe numeric;n integer;pagos jsonb;id_rifa text;pos bigint;hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or jsonb_typeof(p_datos) is distinct from 'object' or (p_id is not null and p_id !~ '^[a-zA-Z0-9_-]{1,128}$') then raise exception 'Datos de rifa inválidos' using errcode='22023'; end if;
 sid:=p_datos->>'sid';numero:=agencia.texto_recortar_js(p_datos->>'numero');modo:=p_datos->>'modo';
 if coalesce(sid,'') !~ '^[a-zA-Z0-9_-]{1,128}$' or coalesce(numero,'')='' or modo is null or modo not in ('contado','cuotas')
  or jsonb_typeof(p_datos->'anio') is distinct from 'number' or jsonb_typeof(p_datos->'importe') is distinct from 'number' then raise exception 'Completá socio y número' using errcode='22023'; end if;
 if (p_datos->>'anio')::numeric<>trunc((p_datos->>'anio')::numeric) then raise exception 'Año inválido' using errcode='22023'; end if;
 anio:=(p_datos->>'anio')::integer;importe:=(p_datos->>'importe')::numeric;if anio<0 or anio>9999 or importe<0 then raise exception 'Datos de rifa inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('rifa_guardar',p_id,p_datos)::text,'UTF8')),'hex');
 select revision,datos into strict rev,config from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 if not exists(select 1 from agencia.socios where clave=sid) then raise exception 'Socio inexistente' using errcode='22023'; end if;
 if p_id is not null then
  select datos into rifa from agencia.rifas where clave=p_id for update;
  if not found then raise exception 'Rifa inexistente' using errcode='22023'; end if;
  if jsonb_typeof(rifa->'pagos') is distinct from 'array' or (rifa ? 'abonos' and jsonb_typeof(rifa->'abonos') is distinct from 'array') then raise exception 'Cuotas inválidas' using errcode='22023'; end if;
  if ((rifa->>'importe')::numeric<>importe or rifa->>'modo'<>modo or rifa->>'sid'<>sid)
    and (exists(select 1 from jsonb_array_elements(rifa->'pagos') p where p not in ('null'::jsonb,'false'::jsonb,'""'::jsonb,'0'::jsonb))
      or exists(select 1 from jsonb_array_elements(coalesce(rifa->'abonos','[]'::jsonb)) a where a not in ('null'::jsonb,'false'::jsonb,'""'::jsonb,'0'::jsonb))) then
    raise exception 'Ya tiene cuotas cobradas: anulá esos pagos antes de cambiar el importe, la modalidad o el socio' using errcode='22023'; end if;
  n:=case when modo='contado' then 1 when rifa->>'modo'='cuotas' then (rifa->>'ncuotas')::integer else (config->>'rifaCuotas')::integer end;
 else n:=case when modo='contado' then 1 else (config->>'rifaCuotas')::integer end; end if;
 if n is null or n<1 or n>10000 then raise exception 'Cantidad de cuotas inválida' using errcode='22023'; end if;
 select jsonb_agg(case when p_id is not null and coalesce(rifa->'pagos'->i,'null'::jsonb) not in ('null'::jsonb,'false'::jsonb,'""'::jsonb,'0'::jsonb) then rifa->'pagos'->i else 'null'::jsonb end order by i) into pagos from generate_series(0,n-1) i;
 if p_id is null then
  id_rifa:=replace(gen_random_uuid()::text,'-','');rifa:=jsonb_build_object('id',id_rifa,'desde',hoy);
  select coalesce(max(posicion),0)+1 into pos from agencia.rifas;
  rifa:=rifa||jsonb_build_object('sid',sid,'nro',numero,'anio',anio,'importe',importe,'modo',modo,'ncuotas',n,'pagos',pagos);
  insert into agencia.rifas(clave,posicion,datos) values(id_rifa,pos,rifa);
 else
  id_rifa:=p_id;rifa:=rifa||jsonb_build_object('sid',sid,'nro',numero,'anio',anio,'importe',importe,'modo',modo,'ncuotas',n,'pagos',pagos);
  update agencia.rifas set datos=rifa where clave=p_id;
 end if;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'rifas',id_rifa,case when p_id is null then 'Creó' else 'Modificó' end);
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'id',id_rifa,'anio',anio);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Datos de rifa inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_rifa_guardar(bigint,uuid,text,jsonb) from public,anon,authenticated;

create or replace function agencia.rifa_liberar_cuota(p_rifa jsonb,p_indice integer,p_modo text,p_actor uuid,p_nombre text)
returns jsonb language plpgsql set search_path='' as $$
declare c record; aplicacion jsonb; retenidas jsonb; importe numeric; total numeric:=0; cambiado boolean; cobro jsonb; socio jsonb; abonos jsonb; abono numeric;
begin
 if p_modo not in ('todos','completos','parciales') or p_indice is null or p_indice<0 or jsonb_typeof(p_rifa->'pagos') is distinct from 'array' or p_indice>=jsonb_array_length(p_rifa->'pagos') then raise exception 'Cuota inexistente' using errcode='22023'; end if;
 abonos:=coalesce(nullif(p_rifa->'abonos','null'::jsonb),'[]'::jsonb);
 if jsonb_typeof(abonos) is distinct from 'array' then raise exception 'Abonos inválidos' using errcode='22023'; end if;
 for c in select clave,datos from agencia.cobros where not coalesce((datos->>'anulado')::boolean,false) and jsonb_typeof(datos->'aplicados')='array' order by posicion for update loop
  cobro:=c.datos;retenidas:='[]'::jsonb;cambiado:=false;
  for aplicacion in select value from jsonb_array_elements(c.datos->'aplicados') loop
   if aplicacion->'ref'->>0='rifa' and aplicacion->'ref'->>1=p_rifa->>'id' and aplicacion->'ref'->>2=p_indice::text
    and (p_modo='todos' or (p_modo='completos' and coalesce((aplicacion->>'completo')::boolean,false)) or (p_modo='parciales' and not coalesce((aplicacion->>'completo')::boolean,false))) then
    if aplicacion ? 'imp' then importe:=coalesce((aplicacion->>'imp')::numeric,0);
    elsif coalesce((aplicacion->>'completo')::boolean,false) then importe:=agencia.cuota_rifa((p_rifa->>'importe')::numeric,(p_rifa->>'ncuotas')::integer,p_indice)-coalesce((abonos->>p_indice)::numeric,0);
    else importe:=coalesce((aplicacion->>'abono')::numeric,0); end if;
    total:=total+importe;cobro:=cobro||jsonb_build_object('liberado',coalesce((cobro->>'liberado')::numeric,0)+importe);
    if not coalesce((aplicacion->>'completo')::boolean,false) then
     abono:=greatest(0,coalesce((abonos->>p_indice)::numeric,0)-coalesce((aplicacion->>'abono')::numeric,0));
     abonos:=agencia.lista_asignar(abonos,p_indice,to_jsonb(abono));
    end if;
    cambiado:=true;
   else retenidas:=retenidas||jsonb_build_array(aplicacion); end if;
  end loop;
  if cambiado or (cobro->'cubre') is distinct from to_jsonb(jsonb_array_length(retenidas)) then
   cobro:=cobro||jsonb_build_object('aplicados',retenidas,'cubre',jsonb_array_length(retenidas));update agencia.cobros set datos=cobro where clave=c.clave;
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'cobros',c.clave,'Modificó');
  end if;
 end loop;
 if total<>0 then
  select datos into socio from agencia.socios where clave=p_rifa->>'sid' for update;
  if found then
   socio:=socio||jsonb_build_object('favor',coalesce((socio->>'favor')::numeric,0)+total);update agencia.socios set datos=socio where clave=p_rifa->>'sid';
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(p_actor,p_nombre,'socios',p_rifa->>'sid','Modificó');
  end if;
 end if;
 if p_rifa ? 'abonos' or jsonb_array_length(abonos)>0 then p_rifa:=p_rifa||jsonb_build_object('abonos',abonos); end if;
 return jsonb_build_object('rifa',p_rifa,'liberado',total);
end $$;
revoke all on function agencia.rifa_liberar_cuota(jsonb,integer,text,uuid,text) from public,anon,authenticated;

-- Pago, anulación de cuota y eliminación de rifas.
create or replace function public.agencia_rifa_operar(p_revision bigint,p_operacion uuid,p_accion text,p_id text,p_datos jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles;op agencia.operaciones;rev bigint;huella text;rifa jsonb;resultado jsonb;liberacion jsonb;liberado numeric:=0;i integer;j integer;fecha_pago date;medio text;detalle jsonb;pagos jsonb;medios jsonb;dets jsonb;anulados jsonb;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or coalesce(p_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$' or p_accion is null or p_accion not in ('pagar_cuota','quitar_pago','anular_pago','anular_cuota','eliminar') or jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos de rifa inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('rifa_operar',p_accion,p_id,p_datos)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select datos into rifa from agencia.rifas where clave=p_id for update;
 if not found then raise exception 'Rifa inexistente' using errcode='22023'; end if;
 if jsonb_typeof(rifa->'pagos') is distinct from 'array' then raise exception 'Cuotas inválidas' using errcode='22023'; end if;
 if p_accion='eliminar' then
  if jsonb_array_length(rifa->'pagos')>0 then
   for j in 0..jsonb_array_length(rifa->'pagos')-1 loop liberacion:=agencia.rifa_liberar_cuota(rifa,j,'todos',perfil.id,perfil.nombre);rifa:=liberacion->'rifa';liberado:=liberado+(liberacion->>'liberado')::numeric;end loop;
  end if;
  delete from agencia.rifas where clave=p_id;
 else
  if jsonb_typeof(p_datos->'indice') is distinct from 'number' or (p_datos->>'indice')::numeric<>trunc((p_datos->>'indice')::numeric) then raise exception 'Cuota inválida' using errcode='22023'; end if;
  i:=(p_datos->>'indice')::integer;if i<0 or i>=jsonb_array_length(rifa->'pagos') then raise exception 'Cuota inexistente' using errcode='22023'; end if;
  pagos:=rifa->'pagos';medios:=coalesce(nullif(rifa->'medios','null'::jsonb),'[]'::jsonb);dets:=coalesce(nullif(rifa->'dets','null'::jsonb),'[]'::jsonb);
  if p_accion='anular_cuota' then
   liberacion:=agencia.rifa_liberar_cuota(rifa,i,'todos',perfil.id,perfil.nombre);rifa:=liberacion->'rifa';liberado:=(liberacion->>'liberado')::numeric;
   anulados:=agencia.lista_asignar(rifa->'anulados',i,'true'::jsonb);rifa:=rifa||jsonb_build_object('anulados',anulados);
  elsif p_accion in ('quitar_pago','anular_pago') then
   if p_accion='anular_pago' or coalesce(pagos->>i,'')<>'' then
    pagos:=agencia.lista_asignar(pagos,i,'null'::jsonb);rifa:=rifa||jsonb_build_object('pagos',pagos);
    liberacion:=agencia.rifa_liberar_cuota(rifa,i,'completos',perfil.id,perfil.nombre);rifa:=liberacion->'rifa';liberado:=(liberacion->>'liberado')::numeric;
   end if;
   pagos:=agencia.lista_asignar(rifa->'pagos',i,'null'::jsonb);
   if p_accion='quitar_pago' or rifa ? 'medios' then medios:=agencia.lista_asignar(medios,i,to_jsonb(''::text));rifa:=rifa||jsonb_build_object('medios',medios); end if;
   if p_accion='quitar_pago' then dets:=agencia.lista_asignar(dets,i,'null'::jsonb);rifa:=rifa||jsonb_build_object('dets',dets); end if;
   rifa:=rifa||jsonb_build_object('pagos',pagos);
  else
   if coalesce(p_datos->>'fecha','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha inválida' using errcode='22023'; end if;
   fecha_pago:=(p_datos->>'fecha')::date;medio:=coalesce(p_datos->>'medio','');detalle:=p_datos->'detalle';
   if medio not in ('','efectivo','transferencia','echeq','cheque','mp') or (detalle is not null and detalle<>'null'::jsonb and jsonb_typeof(detalle)<>'object') then raise exception 'Medio o detalle inválido' using errcode='22023'; end if;
   detalle:=agencia.seguro_detalle_pago(medio,detalle,dets->i);
   pagos:=agencia.lista_asignar(pagos,i,to_jsonb(fecha_pago));medios:=agencia.lista_asignar(medios,i,to_jsonb(medio));dets:=agencia.lista_asignar(dets,i,coalesce(detalle,'null'::jsonb));
   rifa:=rifa||jsonb_build_object('pagos',pagos,'medios',medios,'dets',dets);
  end if;
  update agencia.rifas set datos=rifa where clave=p_id;
 end if;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'rifas',p_id,case when p_accion='eliminar' then 'Eliminó' else 'Modificó' end);
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'id',p_id,'liberado',liberado);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'Datos de rifa inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_rifa_operar(bigint,uuid,text,text,jsonb) from public,anon,authenticated;

-- Listado de rifas y cuotas con importes y vencimientos calculados en la base.
drop function if exists public.agencia_rifa_listar(bigint,integer,text);
create or replace function public.agencia_rifa_listar(p_revision bigint,p_anio integer default null,p_socio_id text default null,p_filtro text default 'todos')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint;fila record;rifa jsonb;cuotas jsonb;filas jsonb:='[]'::jsonb;pago jsonb;fecha date;importe numeric;abono numeric;pagado numeric;saldo numeric;total numeric:=0;total_pagado numeric:=0;total_saldo numeric:=0;cobrado_filtrado numeric:=0;falta_filtrado numeric:=0;i integer;pagas integer;primera integer;vencido boolean;es_pago boolean;hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;config jsonb;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or p_filtro is null or p_filtro not in ('todos','deben','pagados') or (p_socio_id is not null and p_socio_id !~ '^[a-zA-Z0-9_-]{1,128}$') then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision,datos into strict rev,config from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 for fila in select r.datos,coalesce(s.datos->>'nombre','(socio borrado)') nombre from agencia.rifas r left join agencia.socios s on s.clave=r.datos->>'sid'
  where (p_anio is null or (r.datos->>'anio')::integer=p_anio) and (p_socio_id is null or r.datos->>'sid'=p_socio_id)
  order by case when p_socio_id is not null then (r.datos->>'anio')::integer end desc,coalesce(s.datos->>'nombre','(socio borrado)'),r.datos->>'nro',r.posicion loop
  rifa:=fila.datos;cuotas:='[]'::jsonb;pagado:=0;pagas:=0;primera:=-1;vencido:=false;
  if jsonb_typeof(rifa->'pagos') is distinct from 'array' then raise exception 'Cuotas inválidas' using errcode='22023'; end if;
  if jsonb_array_length(rifa->'pagos')>0 then for i in 0..jsonb_array_length(rifa->'pagos')-1 loop
   pago:=rifa->'pagos'->i;es_pago:=pago not in ('null'::jsonb,'false'::jsonb,'""'::jsonb,'0'::jsonb);
   importe:=agencia.cuota_rifa((rifa->>'importe')::numeric,(rifa->>'ncuotas')::integer,i);abono:=coalesce((rifa->'abonos'->>i)::numeric,0);
   fecha:=((rifa->>'desde')::date+make_interval(months=>i))::date;
   if es_pago then pagado:=pagado+importe;pagas:=pagas+1;else pagado:=pagado+least(importe,abono);if primera<0 then primera:=i;end if;if fecha<=hoy then vencido:=true;end if;end if;
   cuotas:=cuotas||jsonb_build_array(jsonb_build_object('indice',i,'importe',importe,'vencimiento',fecha,'pago',pago,'pagada',es_pago,'vencida',not es_pago and fecha<=hoy));
  end loop; end if;
  pagado:=round(pagado,2);saldo:=(rifa->>'importe')::numeric-pagado;
  total:=total+(rifa->>'importe')::numeric;total_pagado:=total_pagado+pagado;total_saldo:=total_saldo+saldo;
  if p_filtro='todos' or (p_filtro='pagados')=(saldo<=0) then cobrado_filtrado:=cobrado_filtrado+pagado;falta_filtrado:=falta_filtrado+greatest(0,saldo); end if;
  filas:=filas||jsonb_build_array(jsonb_build_object('rifa',rifa,'socio',fila.nombre,'pagado',pagado,'saldo',saldo,'saldada',saldo<=0,'vencido',vencido,'primera',primera,'pagas',pagas,'cuotas',cuotas));
 end loop;
 return jsonb_build_object('filas',filas,'cantidad',jsonb_array_length(filas),'total',round(total,2),'cobrado',round(total_pagado,2),'falta',round(total_saldo,2),'cobradoFiltrado',round(cobrado_filtrado,2),'faltaFiltrado',round(falta_filtrado,2),'precio',(config->>'rifaImporte')::numeric,'ncuotas',(config->>'rifaCuotas')::integer,'cuota',agencia.cuota_rifa((config->>'rifaImporte')::numeric,(config->>'rifaCuotas')::integer,0));
end $$;
revoke all on function public.agencia_rifa_listar(bigint,integer,text,text) from public,anon,authenticated;

-- Listado de Quini con precios, estados y totales calculados en la base.
create or replace function public.agencia_quini_listar(p_revision bigint,p_fecha date,p_filtro text default 'todos')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint;config jsonb;especial jsonb;precio numeric;fecha_hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;filas jsonb;fijos jsonb;ese_dia jsonb;especiales jsonb;cantidad integer;total numeric;cobrado numeric;falta numeric;cobrado_filtrado numeric;falta_filtrado numeric;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or p_fecha is null or p_filtro is null or p_filtro not in ('todos','deben','pagados') then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision,datos into strict rev,config from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 if jsonb_typeof(config->'q6Dias') is distinct from 'array' then raise exception 'Días de sorteo inválidos' using errcode='22023'; end if;
 select datos into especial from agencia.quini_sorteos_especiales where datos->>'fecha'=p_fecha::text order by posicion limit 1;
 precio:=case when especial is null then (config->>'q6Precio')::numeric else (especial->>'precio')::numeric end;
 if precio is null then raise exception 'Precio de Quini inválido' using errcode='22023'; end if;
 select count(*)::integer,coalesce(sum((j.datos->>'monto')::numeric),0),
  coalesce(sum(case when coalesce((j.datos->>'pagado')::boolean,false) then (j.datos->>'monto')::numeric else least((j.datos->>'monto')::numeric,coalesce((j.datos->>'abono')::numeric,0)) end),0),
  coalesce(sum(case when coalesce((j.datos->>'pagado')::boolean,false) then 0 else greatest(0,round((j.datos->>'monto')::numeric-coalesce((j.datos->>'abono')::numeric,0),2)) end),0),
  coalesce(sum(case when p_filtro='todos' or (p_filtro='pagados')=coalesce((j.datos->>'pagado')::boolean,false) then case when coalesce((j.datos->>'pagado')::boolean,false) then (j.datos->>'monto')::numeric else least((j.datos->>'monto')::numeric,coalesce((j.datos->>'abono')::numeric,0)) end else 0 end),0),
  coalesce(sum(case when (p_filtro='todos' or (p_filtro='pagados')=coalesce((j.datos->>'pagado')::boolean,false)) and not coalesce((j.datos->>'pagado')::boolean,false) then greatest(0,round((j.datos->>'monto')::numeric-coalesce((j.datos->>'abono')::numeric,0),2)) else 0 end),0)
 into cantidad,total,cobrado,falta,cobrado_filtrado,falta_filtrado from agencia.quini_jugadas j where j.datos->>'fecha'=p_fecha::text;
 select coalesce(jsonb_agg(jsonb_build_object('jugada',j.datos,'socio',coalesce(s.datos->>'nombre','(socio borrado)'),
  'restante',greatest(0,(j.datos->>'monto')::numeric-coalesce((j.datos->>'abono')::numeric,0)),
  'nombreAutor',coalesce((select p.nombre from agencia.perfiles p where p.id::text=j.datos->>'por' and p.activo),(select n.nombre from agencia.actores n where n.actor=j.datos->>'por'),''),
  'nombreEditor',coalesce((select p.nombre from agencia.perfiles p where p.id::text=j.datos->>'modPor' and p.activo),(select n.nombre from agencia.actores n where n.actor=j.datos->>'modPor'),''))
  order by coalesce(s.datos->>'nombre','(socio borrado)'),j.posicion),'[]'::jsonb)
 into filas from agencia.quini_jugadas j left join agencia.socios s on s.clave=j.datos->>'sid' where j.datos->>'fecha'=p_fecha::text;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.clave,'nombre',s.datos->>'nombre','dias',s.datos->'q6'->'dias','cantidad',s.datos->'q6'->'cant',
  'semanal',(config->>'q6Precio')::numeric*coalesce((s.datos->'q6'->>'cant')::numeric,0)*jsonb_array_length(s.datos->'q6'->'dias')) order by s.datos->>'nombre',s.posicion),'[]'::jsonb)
 into fijos from agencia.socios s where coalesce((s.datos->>'activo')::boolean,false) and jsonb_typeof(s.datos->'q6'->'dias')='array' and jsonb_array_length(s.datos->'q6'->'dias')>0;
 select coalesce(jsonb_agg(s.datos->>'nombre' order by s.datos->>'nombre',s.posicion),'[]'::jsonb)
 into ese_dia from agencia.socios s where coalesce((s.datos->>'activo')::boolean,false) and jsonb_typeof(s.datos->'q6'->'dias')='array' and jsonb_array_length(s.datos->'q6'->'dias')>0
  and ((s.datos->'q6'->'dias') @> jsonb_build_array(extract(dow from p_fecha)::integer) or not (config->'q6Dias') @> jsonb_build_array(extract(dow from p_fecha)::integer));
 select coalesce(jsonb_agg(datos order by datos->>'fecha',posicion),'[]'::jsonb) into especiales from agencia.quini_sorteos_especiales;
 return jsonb_build_object('fecha',p_fecha,'dias',p_fecha-fecha_hoy,'precio',precio,'especial',coalesce(especial->>'nombre',''),'precioComun',(config->>'q6Precio')::numeric,
  'cantidad',cantidad,'total',round(total,2),'cobrado',round(cobrado,2),'falta',round(falta,2),'cobradoFiltrado',round(cobrado_filtrado,2),'faltaFiltrado',round(falta_filtrado,2),
  'filas',filas,'fijos',fijos,'eseDia',ese_dia,'especiales',especiales);
end $$;
revoke all on function public.agencia_quini_listar(bigint,date,text) from public,anon,authenticated;

-- Cambios de pago y anulación de una jugada de Lotería.
create or replace function public.agencia_quini_pago(
 p_revision bigint,p_operacion uuid,p_id text,p_accion text,p_datos jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles; op agencia.operaciones; rev bigint; huella text; jugada jsonb; liberacion jsonb; resultado jsonb; monto_liberado numeric:=0;
 hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or coalesce(p_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$'
  or p_accion is null or p_accion not in ('editar_pago','anular_pago','marcar','desmarcar','anular')
  or jsonb_typeof(p_datos) is distinct from 'object' then
  raise exception 'Datos de pago inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('quini_pago',p_id,p_accion,p_datos)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into op from agencia.operaciones where id=p_operacion;
 if found then
  if op.actor<>perfil.id or op.revision_anterior<>p_revision or op.huella<>huella then
   raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return op.resultado;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select datos into jugada from agencia.quini_jugadas where clave=p_id for update;
 if not found then raise exception 'Jugada inexistente' using errcode='22023'; end if;
 if p_accion='editar_pago' then
  if coalesce(p_datos->>'fecha','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha inválida' using errcode='22023'; end if;
  jugada:=jugada||jsonb_build_object('fpago',(p_datos->>'fecha')::date,'medio',coalesce(p_datos->>'medio',''),'det',coalesce(p_datos->'detalle','null'::jsonb));
 elsif p_accion='anular_pago' then
  jugada:=(jugada-'fpago'-'medio'-'det')||jsonb_build_object('pagado',false);
  liberacion:=agencia.quini_liberar(jugada,'completos',perfil.id,perfil.nombre);
  jugada:=liberacion->'jugada'; monto_liberado:=(liberacion->>'liberado')::numeric;
 elsif p_accion='anular' then
  liberacion:=agencia.quini_liberar(jugada,'todos',perfil.id,perfil.nombre);
  jugada:=(liberacion->'jugada')||jsonb_build_object('anulado',true); monto_liberado:=(liberacion->>'liberado')::numeric;
 elsif p_accion='marcar' then jugada:=jugada||jsonb_build_object('pagado',true,'fpago',hoy,'medio','');
 else jugada:=(jugada-'fpago'-'medio')||jsonb_build_object('pagado',false); end if;
 update agencia.quini_jugadas set datos=jugada where clave=p_id;
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'q6',p_id,'Modificó');
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'liberado',monto_liberado);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Fecha inválida' using errcode='22023';
end $$;
revoke all on function public.agencia_quini_pago(bigint,uuid,text,text,jsonb) from public,anon,authenticated;

-- Datos de Quiniela para el día y las deudas de otras fechas.
create or replace function public.agencia_quiniela_listar(p_revision bigint,p_fecha date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint;filas jsonb;otros jsonb;cantidad integer;total numeric;cobrado numeric;falta numeric;otros_total numeric;hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or p_fecha is null then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select count(*)::integer,coalesce(sum((j.datos->>'monto')::numeric),0),coalesce(sum(case when coalesce((j.datos->>'pagado')::boolean,false) then (j.datos->>'monto')::numeric else least((j.datos->>'monto')::numeric,coalesce((j.datos->>'abono')::numeric,0)) end),0),coalesce(sum(case when coalesce((j.datos->>'pagado')::boolean,false) then 0 else greatest(0,round((j.datos->>'monto')::numeric-coalesce((j.datos->>'abono')::numeric,0),2)) end),0)
 into cantidad,total,cobrado,falta from agencia.quiniela_jugadas j where j.datos->>'fecha'=p_fecha::text;
 select coalesce(jsonb_agg(jsonb_build_object('jugada',j.datos,'socio',coalesce(s.datos->>'nombre','(socio borrado)'),
  'restante',greatest(0,(j.datos->>'monto')::numeric-coalesce((j.datos->>'abono')::numeric,0)),
  'nombreAutor',coalesce((select p.nombre from agencia.perfiles p where p.id::text=j.datos->>'por' and p.activo),(select n.nombre from agencia.actores n where n.actor=j.datos->>'por'),''),
  'nombreEditor',coalesce((select p.nombre from agencia.perfiles p where p.id::text=j.datos->>'modPor' and p.activo),(select n.nombre from agencia.actores n where n.actor=j.datos->>'modPor'),''))
  order by coalesce(s.datos->>'nombre','(socio borrado)'),j.posicion),'[]'::jsonb) into filas
 from agencia.quiniela_jugadas j left join agencia.socios s on s.clave=j.datos->>'sid' where j.datos->>'fecha'=p_fecha::text;
 select coalesce(jsonb_agg(jsonb_build_object('jugada',j.datos,'socio',coalesce(s.datos->>'nombre','(socio borrado)'),
  'restante',greatest(0,(j.datos->>'monto')::numeric-coalesce((j.datos->>'abono')::numeric,0)),
  'nombreAutor',coalesce((select p.nombre from agencia.perfiles p where p.id::text=j.datos->>'por' and p.activo),(select n.nombre from agencia.actores n where n.actor=j.datos->>'por'),''),
  'nombreEditor',coalesce((select p.nombre from agencia.perfiles p where p.id::text=j.datos->>'modPor' and p.activo),(select n.nombre from agencia.actores n where n.actor=j.datos->>'modPor'),''))
  order by j.datos->>'fecha' desc,j.posicion),'[]'::jsonb),coalesce(sum(greatest(0,round((j.datos->>'monto')::numeric-coalesce((j.datos->>'abono')::numeric,0),2))),0) into otros,otros_total
 from agencia.quiniela_jugadas j left join agencia.socios s on s.clave=j.datos->>'sid' where not coalesce((j.datos->>'pagado')::boolean,false) and j.datos->>'fecha'<>p_fecha::text;
 return jsonb_build_object('fecha',p_fecha,'dias',p_fecha-hoy,'cantidad',cantidad,'total',round(total,2),'cobrado',round(cobrado,2),'falta',round(falta,2),'otrosTotal',round(otros_total,2),'filas',filas,'otros',otros);
end $$;
revoke all on function public.agencia_quiniela_listar(bigint,date) from public,anon,authenticated;

-- Jugadas Quini y Quiniela de una ficha de socio.
create or replace function public.agencia_jugadas_socio_listar(p_revision bigint,p_socio_id text,p_tipo text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint;filas jsonb;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or coalesce(p_socio_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$' or p_tipo is null or p_tipo not in ('q6','quiniela') then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 if not exists(select 1 from agencia.socios where clave=p_socio_id) then raise exception 'Socio inexistente' using errcode='22023'; end if;
 if p_tipo='q6' then
  select coalesce(jsonb_agg(jsonb_build_object('jugada',j.datos,'especial',exists(select 1 from agencia.quini_sorteos_especiales e where e.datos->>'fecha'=j.datos->>'fecha'),
   'restante',greatest(0,(j.datos->>'monto')::numeric-coalesce((j.datos->>'abono')::numeric,0))) order by j.datos->>'fecha' desc,j.posicion),'[]'::jsonb)
   into filas from agencia.quini_jugadas j where j.datos->>'sid'=p_socio_id;
 else
  select coalesce(jsonb_agg(jsonb_build_object('jugada',j.datos,'especial',false,'restante',greatest(0,(j.datos->>'monto')::numeric-coalesce((j.datos->>'abono')::numeric,0))) order by j.datos->>'fecha' desc,j.posicion),'[]'::jsonb)
   into filas from agencia.quiniela_jugadas j where j.datos->>'sid'=p_socio_id;
 end if;
 return filas;
end $$;
revoke all on function public.agencia_jugadas_socio_listar(bigint,text,text) from public,anon,authenticated;

-- Resumen de cuenta y cantidades de productos para la ficha del socio.
create or replace function public.agencia_socio_resumen(p_revision bigint,p_socio_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint;estado jsonb;cuenta jsonb;conceptos jsonb;productos jsonb;conteos jsonb;hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or coalesce(p_socio_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$' then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 estado:=agencia.estado_cobro_socio(p_socio_id);
 cuenta:=agencia.cuenta_socio_calcular(estado,p_socio_id,hoy);
 conceptos:=agencia.conceptos_cobro_calcular(estado,p_socio_id,hoy);
 select coalesce(jsonb_agg(jsonb_build_object('tipo',tipo,'monto',importe) order by orden),'[]'::jsonb) into productos from (
  select item->>'t' tipo,sum((item->>'imp')::numeric) importe,case item->>'t' when 'seg' then 1 when 'q6' then 2 when 'lot' then 3 when 'qui' then 4 when 'rifa' then 5 else 6 end orden
  from jsonb_array_elements(conceptos) with ordinality e(item,orden)
  where not coalesce((item->>'fut')::boolean,false) and (item->>'t' not in ('seg','rifa') or (item->>'imp')::numeric>0)
  group by item->>'t'
 ) x;
 conteos:=jsonb_build_object('seg',jsonb_array_length(estado->'seguros'),'q6',jsonb_array_length(estado->'q6'),'lot',jsonb_array_length(estado->'lot'),'qui',jsonb_array_length(estado->'quiniela'),'rifa',jsonb_array_length(estado->'rifas'));
 return cuenta||jsonb_build_object('productos',productos,'conteos',conteos);
end $$;
revoke all on function public.agencia_socio_resumen(bigint,text) from public,anon,authenticated;

-- Movimientos de un socio, con importes y agrupación calculados en el servidor.
create or replace function public.agencia_socio_movimientos(p_revision bigint,p_socio_id text,p_filtro text default 'todo')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint;estado jsonb;cuenta jsonb;movimientos jsonb:='[]'::jsonb;ordenados jsonb;visibles jsonb:='[]'::jsonb;fusionados jsonb:='{}'::jsonb;ocultos jsonb:='[]'::jsonb;grupos jsonb:='[]'::jsonb;
 r jsonb;c jsonb;p jsonb;sorteo jsonb;m jsonb;a jsonb;cobro jsonb;coincidente jsonb;grupo jsonb;fila record;registro record;i integer;importe numeric;venc date;f date;pagado boolean;futuro boolean;clave_ref text;coincidencias integer;conteo integer;fecha_grupo text;debe_grupo numeric;cobrado_grupo numeric;hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or coalesce(p_socio_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$' or p_filtro is null or p_filtro not in ('todo','debe','pdf') then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 estado:=agencia.estado_cobro_socio(p_socio_id);cuenta:=agencia.cuenta_socio_calcular(estado,p_socio_id,hoy);
 for registro in select datos from agencia.seguros where datos->>'sid'=p_socio_id order by posicion loop
  r:=registro.datos;i:=0;
  for c in select value from jsonb_array_elements(r->'cuotas') loop
   if not coalesce((c->>'anulado')::boolean,false) then
    venc:=(c->>'venc')::date;pagado:=coalesce(c->>'pago','')<>'';futuro:=not pagado and venc>hoy;f:=case when pagado and venc>hoy then (c->>'pago')::date else venc end;
    importe:=case when pagado then (c->>'imp')::numeric else greatest(0,round((c->>'imp')::numeric-coalesce((c->>'abono')::numeric,0),2)) end;
    movimientos:=movimientos||jsonb_build_array(jsonb_build_object('tipo','seg','fecha',f,'hora',case when i=0 then coalesce(r->>'ts','') else '' end,'ref',jsonb_build_array('seg',r->>'id',i),'importe',importe,'pagado',pagado,'futuro',futuro,'registro',case when i=0 then r else 'null'::jsonb end,'origen',r,'cuota',c,'indice',i));
   end if;i:=i+1;
  end loop;
 end loop;
 for registro in select datos from agencia.quini_jugadas where datos->>'sid'=p_socio_id and not coalesce((datos->>'anulado')::boolean,false) order by posicion loop
  r:=registro.datos;pagado:=coalesce((r->>'pagado')::boolean,false);importe:=case when pagado then (r->>'monto')::numeric else greatest(0,round((r->>'monto')::numeric-coalesce((r->>'abono')::numeric,0),2)) end;
  movimientos:=movimientos||jsonb_build_array(jsonb_build_object('tipo','q6','fecha',r->'fecha','hora',coalesce(r->>'ts',''),'ref',jsonb_build_array('q6',r->>'id'),'importe',importe,'pagado',pagado,'futuro',false,'registro',r,'origen',r,'especial',exists(select 1 from agencia.quini_sorteos_especiales e where e.datos->>'fecha'=r->>'fecha')));
 end loop;
 for registro in select datos from agencia.loteria_ventas where datos->>'sid'=p_socio_id and not coalesce((datos->>'anulado')::boolean,false) order by posicion loop
  r:=registro.datos;select datos into sorteo from agencia.loteria_sorteos where clave=r->>'soId';sorteo:=coalesce(sorteo,'{}'::jsonb);
  f:=coalesce(nullif(r->>'alta','')::date,case when nullif(sorteo->>'fecha','')::date<hoy then (sorteo->>'fecha')::date else hoy end);pagado:=coalesce((r->>'pagado')::boolean,false);
  importe:=(r->>'frac')::numeric*(r->>'precio')::numeric;if not pagado then importe:=greatest(0,importe-coalesce((r->>'abono')::numeric,0));end if;
  movimientos:=movimientos||jsonb_build_array(jsonb_build_object('tipo','lot','fecha',f,'hora',coalesce(r->>'ts',''),'ref',jsonb_build_array('lot',r->>'id'),'importe',importe,'pagado',pagado,'futuro',false,'registro',r,'origen',r,'sorteo',sorteo));
 end loop;
 for registro in select datos from agencia.quiniela_jugadas where datos->>'sid'=p_socio_id and not coalesce((datos->>'anulado')::boolean,false) order by posicion loop
  r:=registro.datos;pagado:=coalesce((r->>'pagado')::boolean,false);importe:=case when pagado then (r->>'monto')::numeric else greatest(0,round((r->>'monto')::numeric-coalesce((r->>'abono')::numeric,0),2)) end;
  movimientos:=movimientos||jsonb_build_array(jsonb_build_object('tipo','qui','fecha',r->'fecha','hora',coalesce(r->>'ts',''),'ref',jsonb_build_array('quiniela',r->>'id'),'importe',importe,'pagado',pagado,'futuro',false,'registro',r,'origen',r));
 end loop;
 for registro in select datos from agencia.rifas where datos->>'sid'=p_socio_id order by posicion loop
  r:=registro.datos;i:=0;
  for p in select value from jsonb_array_elements(r->'pagos') loop
   if not coalesce((r->'anulados'->>i)::boolean,false) then
    venc:=((r->>'desde')::date+make_interval(months=>i))::date;pagado:=p not in ('null'::jsonb,'false'::jsonb,'""'::jsonb,'0'::jsonb);futuro:=not pagado and venc>hoy;f:=case when pagado and venc>hoy then (p#>>'{}')::date else venc end;
    importe:=agencia.cuota_rifa((r->>'importe')::numeric,(r->>'ncuotas')::integer,i);if not pagado then importe:=greatest(0,round(importe-coalesce((r->'abonos'->>i)::numeric,0),2));end if;
    movimientos:=movimientos||jsonb_build_array(jsonb_build_object('tipo','rifa','fecha',f,'hora',case when i=0 then coalesce(r->>'ts','') else '' end,'ref',jsonb_build_array('rifa',r->>'id',i),'importe',importe,'pagado',pagado,'futuro',futuro,'registro',case when i=0 then r else 'null'::jsonb end,'origen',r,'indice',i,'vencimiento',venc,'pago',p));
   end if;i:=i+1;
  end loop;
 end loop;
 for registro in select datos from agencia.cobros where datos->>'sid'=p_socio_id and not coalesce((datos->>'anulado')::boolean,false) order by posicion loop
  r:=registro.datos;movimientos:=movimientos||jsonb_build_array(jsonb_build_object('tipo','pago','fecha',r->'fecha','hora',coalesce(r->>'ts',''),'ref',jsonb_build_array('cobro',r->>'id'),'importe',coalesce((r->>'monto')::numeric,0),'pagado',true,'futuro',false,'registro',r,'origen',r,
   'completos',(select count(*) from jsonb_array_elements(case when jsonb_typeof(r->'aplicados')='array' then r->'aplicados' else '[]'::jsonb end) x where coalesce((x->>'completo')::boolean,false)),
   'parciales',(select count(*) from jsonb_array_elements(case when jsonb_typeof(r->'aplicados')='array' then r->'aplicados' else '[]'::jsonb end) x where not coalesce((x->>'completo')::boolean,false))));
 end loop;
 select coalesce(jsonb_agg(item order by item->>'fecha' desc,item->>'hora' desc,(item->>'tipo'='pago') desc,orden),'[]'::jsonb) into ordenados from jsonb_array_elements(movimientos) with ordinality e(item,orden);
 -- El PDF de la maqueta usa movs() sin fusionar cobros y omite futuros.
 if p_filtro='pdf' then
  select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) into visibles from jsonb_array_elements(ordenados) with ordinality e(item,ord) where not coalesce((item->>'futuro')::boolean,false);
  return jsonb_build_object('movimientos',visibles,'cuenta',cuenta,'hoy',hoy);
 end if;
 -- Fusionar un cobro únicamente cuando corresponde a un único concepto pagado.
 for registro in select datos from agencia.cobros where datos->>'sid'=p_socio_id and not coalesce((datos->>'anulado')::boolean,false) and coalesce((datos->>'monto')::numeric,0)>0 and coalesce((datos->>'quedo')::numeric,0)=0 and coalesce((datos->>'usado')::numeric,0)=0 and coalesce((datos->>'liberado')::numeric,0)=0 and jsonb_typeof(datos->'aplicados')='array' and jsonb_array_length(datos->'aplicados')=1 order by posicion loop
  cobro:=registro.datos;a:=cobro->'aplicados'->0;if not coalesce((a->>'completo')::boolean,false) or jsonb_typeof(a->'ref') is distinct from 'array' then continue;end if;
  select string_agg(value#>>'{}','|' order by ord) into clave_ref from jsonb_array_elements(a->'ref') with ordinality e(value,ord);
  select item into coincidente from jsonb_array_elements(ordenados) e(item) where item->>'tipo'<>'pago' and coalesce((item->>'pagado')::boolean,false) and not coalesce((item->>'futuro')::boolean,false)
   and (select string_agg(value#>>'{}','|' order by ord) from jsonb_array_elements(item->'ref') with ordinality v(value,ord))=clave_ref limit 1;
  if coincidente is null then continue;end if;
  select count(*) into coincidencias from agencia.cobros c2
   where c2.datos->>'sid'=p_socio_id and not coalesce((c2.datos->>'anulado')::boolean,false)
    and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(c2.datos->'aplicados')='array' then c2.datos->'aplicados' else '[]'::jsonb end) x(ap)
     where jsonb_typeof(ap->'ref')='array'
      and (select string_agg(value#>>'{}','|' order by ord) from jsonb_array_elements(ap->'ref') with ordinality z(value,ord))=clave_ref);
  if coincidencias<>1 or round(coalesce((a->>'imp')::numeric,(cobro->>'monto')::numeric),2)<>round((coincidente->>'importe')::numeric,2) or round((cobro->>'monto')::numeric,2)<>round((coincidente->>'importe')::numeric,2) then continue;end if;
  ocultos:=ocultos||jsonb_build_array(cobro->>'id');fusionados:=fusionados||jsonb_build_object(clave_ref,cobro);
 end loop;
 for m in select value from jsonb_array_elements(ordenados) loop
  if coalesce((m->>'futuro')::boolean,false) or (m->>'tipo'='pago' and ocultos @> jsonb_build_array(m->'origen'->>'id')) or (p_filtro='debe' and (coalesce((m->>'pagado')::boolean,false) or m->>'tipo'='pago')) then continue;end if;
  select string_agg(value#>>'{}','|' order by ord) into clave_ref from jsonb_array_elements(m->'ref') with ordinality e(value,ord);
  if fusionados ? clave_ref then m:=m||jsonb_build_object('cobroUnico',fusionados->clave_ref);end if;
  visibles:=visibles||jsonb_build_array(m);
 end loop;
 for fila in select distinct item->>'fecha' fecha from jsonb_array_elements(visibles) e(item) order by 1 desc loop
  fecha_grupo:=fila.fecha;
  select coalesce(sum((item->>'importe')::numeric) filter(where not coalesce((item->>'pagado')::boolean,false)),0),coalesce(sum((item->>'importe')::numeric) filter(where item->>'tipo'='pago'),0),coalesce(jsonb_agg(item order by ord),'[]'::jsonb)
   into debe_grupo,cobrado_grupo,grupo from jsonb_array_elements(visibles) with ordinality e(item,ord) where item->>'fecha'=fecha_grupo;
  grupos:=grupos||jsonb_build_array(jsonb_build_object('fecha',fecha_grupo,'debe',round(debe_grupo,2),'cobrado',round(cobrado_grupo,2),'filas',grupo));
 end loop;
 return jsonb_build_object('grupos',grupos,'cantidad',jsonb_array_length(visibles),'cuenta',cuenta,'hoy',hoy,'ayer',hoy-1);
end $$;
revoke all on function public.agencia_socio_movimientos(bigint,text,text) from public,anon,authenticated;

-- Datos de PDF sin fusión de cobros; la maqueta no imprime movimientos futuros.
create or replace function public.agencia_socio_pdf(p_revision bigint,p_socio_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare resultado jsonb;socio jsonb;nombre_agencia text;
begin
 resultado:=public.agencia_socio_movimientos(p_revision,p_socio_id,'pdf');
 select datos into socio from agencia.socios where clave=p_socio_id;
 select datos->>'nombre' into nombre_agencia from agencia.configuracion;
 return resultado||jsonb_build_object('socio',socio,'nombreAgencia',coalesce(nombre_agencia,''),'futuros','[]'::jsonb);
end $$;
revoke all on function public.agencia_socio_pdf(bigint,text) from public,anon,authenticated;

create or replace function agencia.cheque_vinculado(p_referencia jsonb)
returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from agencia.cobros c cross join lateral jsonb_array_elements(case when jsonb_typeof(c.datos->'aplicados')='array' then c.datos->'aplicados' else '[]'::jsonb end) x(a)
  where not coalesce((c.datos->>'anulado')::boolean,false) and jsonb_typeof(x.a->'ref')='array'
   and (select string_agg(value#>>'{}','|' order by ord) from jsonb_array_elements(x.a->'ref') with ordinality t(value,ord))=
       (select string_agg(value#>>'{}','|' order by ord) from jsonb_array_elements(p_referencia) with ordinality t(value,ord)));
$$;
revoke all on function agencia.cheque_vinculado(jsonb) from public,anon,authenticated;

-- Historial de cheques de cobros y pagos independientes.
create or replace function public.agencia_cheques_listar(p_revision bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint;registro record;r jsonb;cuota jsonb;detalle jsonb;pago jsonb;medio text;fecha text;importe numeric;ref jsonb;filas jsonb:='[]'::jsonb;resultado jsonb;i integer;tipo text;
begin
 perform agencia.exigir_perfil();
 if p_revision is null then raise exception 'Revisión inválida' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 for registro in select c.datos,coalesce(s.datos->>'nombre','(socio borrado)') socio from agencia.cobros c left join agencia.socios s on s.clave=c.datos->>'sid' order by c.posicion loop
  r:=registro.datos;medio:=r->>'medio';detalle:=r->'det';
  if medio in ('cheque','echeq') and jsonb_typeof(detalle)='object' then
   filas:=filas||jsonb_build_array(jsonb_build_object('id','cobro:'||(r->>'id'),'numero',coalesce(detalle->>'nro',''),'banco',coalesce(detalle->>'banco',''),'socio',registro.socio,'medio',medio,'fecha',r->>'fecha','monto',coalesce((r->>'monto')::numeric,0),'estado',case when detalle->>'estado' in ('aprobado','rechazado') then detalle->>'estado' else 'pendiente' end,'anulado',coalesce((r->>'anulado')::boolean,false),'rechazoAplicado',coalesce((r->>'rechazoAplicado')::boolean,false),'depositado',coalesce(detalle->>'dep','')<>''));
  end if;
 end loop;
 for registro in select x.datos,coalesce(s.datos->>'nombre','(socio borrado)') socio from agencia.seguros x left join agencia.socios s on s.clave=x.datos->>'sid' order by x.posicion loop
  r:=registro.datos;i:=0;
  for cuota in select value from jsonb_array_elements(r->'cuotas') loop
   detalle:=cuota->'det';medio:=cuota->>'medio';ref:=jsonb_build_array('seg',r->>'id',i);
   if coalesce(cuota->>'pago','')<>'' and medio in ('cheque','echeq') and jsonb_typeof(detalle)='object' and not coalesce((detalle->>'c')::boolean,false) and not agencia.cheque_vinculado(ref) then
    filas:=filas||jsonb_build_array(jsonb_build_object('id',array_to_string(array['seg',r->>'id',i::text],'|'),'numero',coalesce(detalle->>'nro',''),'banco',coalesce(detalle->>'banco',''),'socio',registro.socio,'medio',medio,'fecha',cuota->>'pago','monto',coalesce((cuota->>'imp')::numeric,0),'estado',case when detalle->>'estado' in ('aprobado','rechazado') then detalle->>'estado' else 'pendiente' end,'anulado',false,'rechazoAplicado',false,'depositado',coalesce(detalle->>'dep','')<>''));
   end if;i:=i+1;
  end loop;
 end loop;
 for registro in select x.datos,coalesce(s.datos->>'nombre','(socio borrado)') socio from agencia.rifas x left join agencia.socios s on s.clave=x.datos->>'sid' order by x.posicion loop
  r:=registro.datos;i:=0;
  for pago in select value from jsonb_array_elements(r->'pagos') loop
   detalle:=r->'dets'->i;medio:=r->'medios'->>i;ref:=jsonb_build_array('rifa',r->>'id',i);
   if pago not in ('null'::jsonb,'false'::jsonb,'""'::jsonb,'0'::jsonb) and medio in ('cheque','echeq') and jsonb_typeof(detalle)='object' and not coalesce((detalle->>'c')::boolean,false) and not agencia.cheque_vinculado(ref) then
    filas:=filas||jsonb_build_array(jsonb_build_object('id',array_to_string(array['rifa',r->>'id',i::text],'|'),'numero',coalesce(detalle->>'nro',''),'banco',coalesce(detalle->>'banco',''),'socio',registro.socio,'medio',medio,'fecha',pago#>>'{}','monto',agencia.cuota_rifa((r->>'importe')::numeric,(r->>'ncuotas')::integer,i),'estado',case when detalle->>'estado' in ('aprobado','rechazado') then detalle->>'estado' else 'pendiente' end,'anulado',false,'rechazoAplicado',false,'depositado',coalesce(detalle->>'dep','')<>''));
   end if;i:=i+1;
  end loop;
 end loop;
 for tipo in select unnest(array['q6','lot','quiniela']) loop
  for registro in select x.datos,x.nombre from (
   select q.datos,coalesce(s.datos->>'nombre','(socio borrado)') nombre,q.posicion from agencia.quini_jugadas q left join agencia.socios s on s.clave=q.datos->>'sid' where tipo='q6'
   union all select l.datos,coalesce(s.datos->>'nombre','(socio borrado)'),l.posicion from agencia.loteria_ventas l left join agencia.socios s on s.clave=l.datos->>'sid' where tipo='lot'
   union all select q.datos,coalesce(s.datos->>'nombre','(socio borrado)'),q.posicion from agencia.quiniela_jugadas q left join agencia.socios s on s.clave=q.datos->>'sid' where tipo='quiniela'
  ) x order by x.posicion loop
   r:=registro.datos;detalle:=r->'det';medio:=r->>'medio';ref:=jsonb_build_array(tipo,r->>'id');
   if coalesce((r->>'pagado')::boolean,false) and medio in ('cheque','echeq') and jsonb_typeof(detalle)='object' and not coalesce((detalle->>'c')::boolean,false) and not agencia.cheque_vinculado(ref) then
    importe:=case when tipo='lot' then (r->>'frac')::numeric*(r->>'precio')::numeric else (r->>'monto')::numeric end;
    filas:=filas||jsonb_build_array(jsonb_build_object('id',tipo||'|'||(r->>'id'),'numero',coalesce(detalle->>'nro',''),'banco',coalesce(detalle->>'banco',''),'socio',registro.nombre,'medio',medio,'fecha',r->>'fpago','monto',importe,'estado',case when detalle->>'estado' in ('aprobado','rechazado') then detalle->>'estado' else 'pendiente' end,'anulado',false,'rechazoAplicado',false,'depositado',coalesce(detalle->>'dep','')<>''));
   end if;
  end loop;
 end loop;
 select coalesce(jsonb_agg(item order by coalesce(item->>'fecha','') desc,ord),'[]'::jsonb) into resultado from jsonb_array_elements(filas) with ordinality e(item,ord);
 return resultado;
end $$;
revoke all on function public.agencia_cheques_listar(bigint) from public,anon,authenticated;

-- Las consultas por socio se usan en la cuenta y en el listado. Estos índices
-- evitan recorrer todas las colecciones por cada socio de la agencia.
create index if not exists seguros_socio_idx on agencia.seguros ((datos->>'sid'));
create index if not exists quini_jugadas_socio_idx on agencia.quini_jugadas ((datos->>'sid'));
create index if not exists loteria_ventas_socio_idx on agencia.loteria_ventas ((datos->>'sid'));
create index if not exists quiniela_jugadas_socio_idx on agencia.quiniela_jugadas ((datos->>'sid'));
create index if not exists rifas_socio_idx on agencia.rifas ((datos->>'sid'));

-- Listado: las etiquetas de producto reflejan la existencia histórica, no
-- solo los conceptos pendientes. El cliente aplica el orden local por nombre.
create or replace function public.agencia_socios_listar(p_revision bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 rev bigint; filas jsonb;
 hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perform agencia.exigir_perfil();
 if p_revision is null then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 -- Una sola pasada: armar el arreglo fila por fila con `||` copia todo lo anterior en cada vuelta y se vuelve cuadrático.
 select coalesce(jsonb_agg(jsonb_build_object('socio',s.datos,'cuenta',cu.cuenta,'productos',pr.productos) order by s.posicion),'[]'::jsonb) into filas
 from agencia.socios s
 cross join lateral (select agencia.estado_cobro_socio(s.clave) estado) e
 cross join lateral (select agencia.cuenta_socio_calcular(e.estado,s.clave,hoy) cuenta) cu
 cross join lateral (
  select coalesce(jsonb_agg(to_jsonb(t.producto) order by t.orden),'[]'::jsonb) productos
  from (values
   ('seg',1,jsonb_array_length(e.estado->'seguros')>0),
   ('q6',2,coalesce((s.datos->'q6'->>'activo')::boolean,false) or jsonb_array_length(e.estado->'q6')>0),
   ('lot',3,jsonb_array_length(e.estado->'lot')>0 or (jsonb_typeof(s.datos->'fijos')='array' and jsonb_array_length(s.datos->'fijos')>0)),
   ('qui',4,jsonb_array_length(e.estado->'quiniela')>0),
   ('rifa',5,jsonb_array_length(e.estado->'rifas')>0)
  ) t(producto,orden,tiene) where t.tiene
 ) pr;
 return filas;
end $$;
revoke all on function public.agencia_socios_listar(bigint) from public,anon,authenticated;

-- Datos calculados para Inicio. Los rótulos y el orden alfabético por idioma
-- son presentación; importes y criterios de inclusión quedan en el servidor.
create or replace function public.agencia_inicio(p_revision bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 rev bigint; hoy date:=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
 pendientes jsonb; sorteo jsonb; vencimientos jsonb; cheques jsonb;
 productos jsonb; deudores jsonb; sin_ofrecer jsonb; no_compran jsonb;
 total numeric; a_favor numeric; fracciones numeric; compradores bigint;
begin
 perform agencia.exigir_perfil();
 if p_revision is null then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 with conceptos as (
  select s.datos->>'sid' sid,'seg'::text tipo,1 orden,s.posicion,cu.ord suborden,
   greatest(0,round(coalesce((cu.dato->>'imp')::numeric,0)-coalesce((cu.dato->>'abono')::numeric,0),2)) importe
  from agencia.seguros s cross join lateral jsonb_array_elements(coalesce(s.datos->'cuotas','[]'::jsonb)) with ordinality cu(dato,ord)
  where coalesce(cu.dato->>'pago','')='' and not coalesce((cu.dato->>'anulado')::boolean,false) and (cu.dato->>'venc')::date<=hoy
   and greatest(0,round(coalesce((cu.dato->>'imp')::numeric,0)-coalesce((cu.dato->>'abono')::numeric,0),2))>0
  union all
  select q.datos->>'sid','q6',2,q.posicion,0,greatest(0,round(coalesce((q.datos->>'monto')::numeric,0)-coalesce((q.datos->>'abono')::numeric,0),2))
  from agencia.quini_jugadas q where not coalesce((q.datos->>'pagado')::boolean,false) and not coalesce((q.datos->>'anulado')::boolean,false)
  union all
  select l.datos->>'sid','lot',3,l.posicion,0,greatest(0,coalesce((l.datos->>'frac')::numeric,0)*coalesce((l.datos->>'precio')::numeric,0)-coalesce((l.datos->>'abono')::numeric,0))
  from agencia.loteria_ventas l where not coalesce((l.datos->>'pagado')::boolean,false) and not coalesce((l.datos->>'anulado')::boolean,false)
  union all
  select q.datos->>'sid','qui',4,q.posicion,0,greatest(0,round(coalesce((q.datos->>'monto')::numeric,0)-coalesce((q.datos->>'abono')::numeric,0),2))
  from agencia.quiniela_jugadas q where not coalesce((q.datos->>'pagado')::boolean,false) and not coalesce((q.datos->>'anulado')::boolean,false)
  union all
  select r.datos->>'sid','rifa',5,r.posicion,p.ord,
   greatest(0,round(agencia.cuota_rifa((r.datos->>'importe')::numeric,(r.datos->>'ncuotas')::integer,(p.ord-1)::integer)-coalesce((r.datos->'abonos'->>((p.ord-1)::integer))::numeric,0),2))
  from agencia.rifas r cross join lateral jsonb_array_elements(coalesce(r.datos->'pagos','[]'::jsonb)) with ordinality p(dato,ord)
  where p.dato in ('null'::jsonb,'false'::jsonb,'""'::jsonb) and not coalesce((r.datos->'anulados'->>((p.ord-1)::integer))::boolean,false)
   and ((r.datos->>'desde')::date+make_interval(months=>(p.ord-1)::integer))::date<=hoy
   and greatest(0,round(agencia.cuota_rifa((r.datos->>'importe')::numeric,(r.datos->>'ncuotas')::integer,(p.ord-1)::integer)-coalesce((r.datos->'abonos'->>((p.ord-1)::integer))::numeric,0),2))>0
 ) select coalesce(jsonb_agg(jsonb_build_object('sid',sid,'tipo',tipo,'importe',importe) order by orden,posicion,suborden),'[]'::jsonb) into pendientes from conceptos;
 -- Deuda de cada socio = suma de sus pendientes vencidos (igual que agencia.cuenta_socio_calcular), en una sola pasada.
 with por_socio as (select p->>'sid' sid,round(sum((p->>'importe')::numeric),2) deuda from jsonb_array_elements(pendientes) p group by 1)
 select coalesce(round(sum(greatest(0,coalesce(d.deuda,0)-coalesce((s.datos->>'favor')::numeric,0))),2),0),
  coalesce(round(sum(greatest(0,coalesce((s.datos->>'favor')::numeric,0)-coalesce(d.deuda,0))),2),0)
 into total,a_favor from agencia.socios s left join por_socio d on d.sid=s.clave;
 select coalesce(jsonb_agg(jsonb_build_object('tipo',tip,'importe',importe) order by ord),'[]'::jsonb) into productos from (
  select t.tip,t.ord,coalesce(round(sum((p->>'importe')::numeric),2),0) importe
  from (values ('seg',1),('q6',2),('lot',3),('qui',4),('rifa',5)) t(tip,ord)
  left join lateral jsonb_array_elements(pendientes) p on p->>'tipo'=t.tip group by t.tip,t.ord
 ) x;
 select coalesce(jsonb_agg(jsonb_build_object('sid',sid,'nombre',nombre,'monto',monto,'productos',tipos) order by monto desc,primer_orden),'[]'::jsonb) into deudores from (
  select p.sid,coalesce(s.datos->>'nombre','(socio borrado)') nombre,
   greatest(0,sum(p.importe)-coalesce((s.datos->>'favor')::numeric,0)) monto,min(p.ord) primer_orden,
   (select coalesce(jsonb_agg(x.tipo order by x.primer_orden),'[]'::jsonb) from (select z->>'tipo' tipo,min(i) primer_orden from jsonb_array_elements(pendientes) with ordinality e(z,i) where z->>'sid'=p.sid group by z->>'tipo') x) tipos
  from (select x->>'sid' sid,(x->>'importe')::numeric importe,ord from jsonb_array_elements(pendientes) with ordinality e(x,ord)) p
  left join agencia.socios s on s.clave=p.sid group by p.sid,s.datos having greatest(0,sum(p.importe)-coalesce((s.datos->>'favor')::numeric,0))>0
  order by monto desc,primer_orden limit 12
 ) x;
 select datos into sorteo from agencia.loteria_sorteos order by case when (datos->>'fecha')::date>=hoy then 0 else 1 end,
  case when (datos->>'fecha')::date>=hoy then (datos->>'fecha')::date end asc,
  case when (datos->>'fecha')::date<hoy then (datos->>'fecha')::date end desc,
  case when (datos->>'fecha')::date>=hoy then posicion end asc,
  case when (datos->>'fecha')::date<hoy then posicion end desc limit 1;
 select coalesce(sum((datos->>'frac')::numeric),0),count(distinct datos->>'sid') into fracciones,compradores from agencia.loteria_ventas where datos->>'soId'=sorteo->>'id';
 -- Solo el nombre: la pantalla de inicio no muestra más y mandar cada socio completo pesa cientos de KB.
 select coalesce(jsonb_agg(jsonb_build_object('nombre',s.datos->>'nombre') order by s.posicion),'[]'::jsonb) into sin_ofrecer from agencia.socios s where sorteo is not null and coalesce((s.datos->>'activo')::boolean,false)
  and not exists(select 1 from agencia.loteria_ventas v where v.datos->>'soId'=sorteo->>'id' and v.datos->>'sid'=s.clave)
  and not exists(select 1 from agencia.loteria_ofertas o where o.datos->>'soId'=sorteo->>'id' and o.datos->>'sid'=s.clave);
 select coalesce(jsonb_agg(jsonb_build_object('nombre',s.datos->>'nombre') order by s.posicion),'[]'::jsonb) into no_compran from agencia.socios s where coalesce((s.datos->>'activo')::boolean,false)
  and exists(select 1 from agencia.loteria_ofertas o where o.datos->>'soId'=sorteo->>'id' and o.datos->>'sid'=s.clave);
 select coalesce(jsonb_agg(jsonb_build_object('seguro',s.datos,'socio',coalesce(a.datos->>'nombre','(socio borrado)'),'dias',(s.datos->>'venc')::date-hoy) order by s.datos->>'venc',s.posicion),'[]'::jsonb)
 into vencimientos from agencia.seguros s left join agencia.socios a on a.clave=s.datos->>'sid' where (s.datos->>'venc')::date-hoy between -7 and 30;
 with crudos as (
  select 'c|'||c.clave id,c.datos->>'sid' sid,c.datos->>'medio' medio,c.datos->'det' det,(c.datos->>'monto')::numeric monto,1 orden,c.posicion,0::bigint suborden
  from agencia.cobros c where not coalesce((c.datos->>'anulado')::boolean,false) and c.datos->>'medio' in ('cheque','echeq') and coalesce(c.datos->'det'->>'fcobro','')<>'' and coalesce(c.datos->'det'->>'dep','')=''
  union all
  select 's|'||s.clave||'|'||(q.ord-1),s.datos->>'sid',q.dato->>'medio',q.dato->'det',(q.dato->>'imp')::numeric,2,s.posicion,q.ord
  from agencia.seguros s cross join lateral jsonb_array_elements(coalesce(s.datos->'cuotas','[]'::jsonb)) with ordinality q(dato,ord)
  where coalesce(q.dato->'det'->>'fcobro','')<>'' and coalesce(q.dato->'det'->>'dep','')='' and not coalesce((q.dato->'det'->>'c')::boolean,false)
 ), unicos as (
  select c.*,row_number() over (partition by coalesce(medio,'')||coalesce(det->>'nro','')||coalesce(det->>'fcobro','')||coalesce(sid,'') order by orden,posicion,suborden) repeticion from crudos c
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'sid',c.sid,'socio',coalesce(s.datos->>'nombre','(socio borrado)'),'medio',c.medio,'detalle',c.det,'monto',c.monto,'dias',(c.det->>'fcobro')::date-hoy) order by c.det->>'fcobro',c.orden,c.posicion,c.suborden),'[]'::jsonb)
 into cheques from unicos c left join agencia.socios s on s.clave=c.sid where coalesce(c.det->>'nro','')='' or c.repeticion=1;
 return jsonb_build_object('hoy',hoy,'total',total,'aFavor',a_favor,'productos',productos,'deudores',deudores,'sorteo',sorteo,'fracciones',fracciones,'compradores',compradores,'sinOfrecer',sin_ofrecer,'noCompran',no_compran,'vencimientos',vencimientos,'cheques',cheques);
end $$;
revoke all on function public.agencia_inicio(bigint) from public,anon,authenticated;

-- La maqueta marca también las cuotas de seguros que comparten número,
-- banco y fecha de cobro con el cheque depositado.
create or replace function public.agencia_depositar_cheque(p_revision bigint,p_operacion uuid,p_referencia text)
returns bigint language plpgsql security definer set search_path='' as $$
declare
 perfil agencia.perfiles; rev bigint; anterior agencia.operaciones; huella text;
 partes text[]; tipo text; v_clave text; indice integer; registro jsonb; detalle jsonb;
 seguro record; cuota record; nuevas_cuotas jsonb; modificada boolean; fecha date;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or p_referencia is null then raise exception 'Datos de operación inválidos' using errcode='22023'; end if;
 partes:=string_to_array(p_referencia,'|');tipo:=partes[1];v_clave:=partes[2];
 if v_clave is null or v_clave !~ '^[a-zA-Z0-9_-]{1,128}$' or not ((tipo='c' and array_length(partes,1)=2) or (tipo='s' and array_length(partes,1)=3 and partes[3] ~ '^[0-9]{1,6}$')) then
  raise exception 'Referencia inválida' using errcode='22023';
 end if;
 if tipo='s' then indice:=partes[3]::integer; end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('depositar_cheque',p_referencia)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into anterior from agencia.operaciones where id=p_operacion;
 if found then
  if anterior.actor<>perfil.id or anterior.revision_anterior<>p_revision or anterior.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return anterior.revision;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos antes de guardar.' using errcode='40001'; end if;
 if tipo='c' then
  select datos into registro from agencia.cobros where agencia.cobros.clave=v_clave for update;
  detalle:=registro->'det';
  if registro is null or coalesce((registro->>'anulado')::boolean,false) or registro->>'medio' not in ('cheque','echeq') then raise exception 'No se encontró el cheque' using errcode='22023'; end if;
 else
  select datos into registro from agencia.seguros where agencia.seguros.clave=v_clave for update;
  detalle:=registro#>array['cuotas',indice::text,'det'];
 end if;
 if registro is null or jsonb_typeof(detalle) is distinct from 'object' or coalesce(detalle->>'fcobro','')='' or coalesce(detalle->>'dep','')<>'' or (tipo='s' and coalesce((detalle->>'c')::boolean,false)) then
  raise exception 'No se encontró el cheque pendiente' using errcode='22023';
 end if;
 fecha:=(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
 if tipo='c' then
  update agencia.cobros set datos=jsonb_set(datos,'{det,dep}',to_jsonb(fecha::text),true) where agencia.cobros.clave=v_clave;
  insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'cobros',v_clave,'Modificó');
 end if;
 for seguro in select s.clave,s.datos from agencia.seguros s where (tipo='s' and s.clave=v_clave) or (coalesce(detalle->>'nro','')<>'' and exists (
  select 1 from jsonb_array_elements(coalesce(s.datos->'cuotas','[]'::jsonb)) q where q->'det'->>'nro'=detalle->>'nro' and q->'det'->>'banco' is not distinct from detalle->>'banco' and q->'det'->>'fcobro'=detalle->>'fcobro')) for update loop
  nuevas_cuotas:='[]'::jsonb;modificada:=false;
  for cuota in select q.dato,q.ord from jsonb_array_elements(coalesce(seguro.datos->'cuotas','[]'::jsonb)) with ordinality q(dato,ord) loop
   if (tipo='s' and seguro.clave=v_clave and cuota.ord=indice+1) or (coalesce(detalle->>'nro','')<>'' and cuota.dato->'det'->>'nro'=detalle->>'nro' and cuota.dato->'det'->>'banco' is not distinct from detalle->>'banco' and cuota.dato->'det'->>'fcobro'=detalle->>'fcobro') then
    nuevas_cuotas:=nuevas_cuotas||jsonb_build_array(jsonb_set(cuota.dato,'{det,dep}',to_jsonb(fecha::text),true));modificada:=true;
   else nuevas_cuotas:=nuevas_cuotas||jsonb_build_array(cuota.dato); end if;
  end loop;
  if modificada then
   update agencia.seguros set datos=jsonb_set(datos,'{cuotas}',nuevas_cuotas,false) where agencia.seguros.clave=seguro.clave;
   insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'seguros',seguro.clave,'Modificó');
  end if;
 end loop;
 update agencia.configuracion set revision=revision+1 returning revision into rev;
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella) values(p_operacion,perfil.id,rev,p_revision,huella);
 return rev;
end $$;
revoke all on function public.agencia_depositar_cheque(bigint,uuid,text) from public,anon,authenticated;

-- Precios, preferencias y calendario afectan operaciones nuevas. No reescriben
-- ventas ni planillas ya cargadas.
create or replace function public.agencia_configurar(p_revision bigint,p_operacion uuid,p_accion text,p_datos jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare
 perfil agencia.perfiles; rev bigint; anterior agencia.operaciones; huella text; cambios jsonb;
 juego text; dias jsonb; predeterminados constant jsonb:='{"previa":[1,2,3,4,5,6],"primera":[1,2,3,4,5,6],"matutina":[1,2,3,4,5,6],"vespertina":[1,2,3,4,5,6],"nocturna":[1,2,3,4,5,6],"turista":[1,2,3,4,5,6],"quini6":[0,3],"loto":[0,3]}'::jsonb;
begin
 perfil:=agencia.exigir_perfil();
 if p_revision is null or p_operacion is null or p_accion not in ('precios','toto_dias','toto_restablecer') or p_accion is null or jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos de configuración inválidos' using errcode='22023'; end if;
 if p_accion='precios' then
  if jsonb_typeof(p_datos->'nombre') is distinct from 'string' or jsonb_typeof(p_datos->'wsp') is distinct from 'string' or p_datos->>'wsp' not in ('app','web')
   or jsonb_typeof(p_datos->'q6Precio') is distinct from 'number' or jsonb_typeof(p_datos->'fracPrecio') is distinct from 'number' or jsonb_typeof(p_datos->'rifaImporte') is distinct from 'number' or jsonb_typeof(p_datos->'rifaCuotas') is distinct from 'number'
   or jsonb_typeof(p_datos->'q6Dias') is distinct from 'array' then raise exception 'Datos de precios inválidos' using errcode='22023'; end if;
  if (p_datos->>'q6Precio')::numeric<0 or (p_datos->>'fracPrecio')::numeric<0 or (p_datos->>'rifaImporte')::numeric<0 or (p_datos->>'rifaCuotas')::numeric<1 or (p_datos->>'rifaCuotas')::numeric<>trunc((p_datos->>'rifaCuotas')::numeric)
   or exists(select 1 from jsonb_array_elements(p_datos->'q6Dias') d where jsonb_typeof(d)<>'number' or (d#>>'{}')::numeric not between 0 and 6 or (d#>>'{}')::numeric<>trunc((d#>>'{}')::numeric))
   or (select count(*)<>count(distinct d) from jsonb_array_elements(p_datos->'q6Dias') d) then raise exception 'Datos de precios inválidos' using errcode='22023'; end if;
  cambios:=jsonb_build_object('nombre',p_datos->'nombre','wsp',p_datos->'wsp','q6Precio',p_datos->'q6Precio','q6Dias',p_datos->'q6Dias','fracPrecio',p_datos->'fracPrecio','rifaImporte',p_datos->'rifaImporte','rifaCuotas',p_datos->'rifaCuotas');
 else
  if p_accion='toto_restablecer' then dias:=predeterminados; else dias:=p_datos; end if;
  for juego in select jsonb_object_keys(predeterminados) loop
   if jsonb_typeof(dias->juego) is distinct from 'array' then raise exception 'Faltan días de un juego' using errcode='22023'; end if;
   if jsonb_array_length(dias->juego)=0 or exists(select 1 from jsonb_array_elements(dias->juego) d where jsonb_typeof(d)<>'number' or (d#>>'{}')::numeric not between 0 and 6 or (d#>>'{}')::numeric<>trunc((d#>>'{}')::numeric))
    or (select count(*)<>count(distinct d) from jsonb_array_elements(dias->juego) d) then raise exception 'Días de juego inválidos' using errcode='22023'; end if;
  end loop;
  if exists(select 1 from jsonb_object_keys(dias) k where not predeterminados ? k) then raise exception 'Juego inválido' using errcode='22023'; end if;
  cambios:=jsonb_build_object('totoDias',dias);
 end if;
 huella:=encode(sha256(convert_to(jsonb_build_array('configurar',p_accion,p_datos)::text,'UTF8')),'hex');
 select revision into strict rev from agencia.configuracion for update;
 select * into anterior from agencia.operaciones where id=p_operacion;
 if found then
  if anterior.actor<>perfil.id or anterior.revision_anterior<>p_revision or anterior.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return anterior.revision;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos antes de guardar.' using errcode='40001'; end if;
 update agencia.configuracion set datos=datos||cambios,revision=revision+1 returning revision into rev;
 perform agencia.generar_quini_pendientes(perfil);
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) values(perfil.id,perfil.nombre,'conf',p_accion,'Modificó');
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella) values(p_operacion,perfil.id,rev,p_revision,huella);
 return rev;
end $$;
revoke all on function public.agencia_configurar(bigint,uuid,text,jsonb) from public,anon,authenticated;

-- Búsqueda global: misma precedencia y límite que la maqueta. Se comparan
-- cadenas literalmente para que '%' y '_' no actúen como comodines.
create or replace function public.agencia_buscar(p_revision bigint,p_consulta text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint; consulta text; resultado jsonb;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or p_consulta is null then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 consulta:=lower(replace(agencia.texto_recortar_js(p_consulta),chr(304),'i'||chr(775)));
 if consulta='' then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'principal',principal,'secundario',secundario) order by categoria,posicion,suborden),'[]'::jsonb) into resultado from (
  select 1 categoria,s.posicion,0::bigint suborden,s.clave id,s.datos->>'nombre' principal,'Socio '||coalesce(s.datos->>'nro','undefined') secundario
  from agencia.socios s where position(consulta in lower(replace(coalesce(s.datos->>'nombre',''),chr(304),'i'||chr(775))))>0
   or lower(replace(coalesce(s.datos->>'nro','undefined'),chr(304),'i'||chr(775)))=consulta or position(consulta in coalesce(s.datos->>'dni',''))>0
  union all
  select 2,v.posicion,0,v.datos->>'sid',coalesce(v.datos->>'numero','undefined')||' · '||coalesce(s.datos->>'nombre','(socio borrado)'),coalesce(d.datos->>'nombre','')
  from agencia.loteria_ventas v left join agencia.socios s on s.clave=v.datos->>'sid' left join agencia.loteria_sorteos d on d.clave=v.datos->>'soId'
  where position(consulta in coalesce(v.datos->>'numero','undefined'))>0
  union all
  select 3,s.posicion,f.ord,s.clave,coalesce(f.dato->>'numero','undefined')||' · '||coalesce(s.datos->>'nombre',''),'Número fijo'
  from agencia.socios s cross join lateral jsonb_array_elements(case when jsonb_typeof(s.datos->'fijos')='array' then s.datos->'fijos' else '[]'::jsonb end) with ordinality f(dato,ord)
  where position(consulta in coalesce(f.dato->>'numero','undefined'))>0
  union all
  select 4,r.posicion,0,r.datos->>'sid','Rifa '||coalesce(r.datos->>'nro','undefined')||' · '||coalesce(s.datos->>'nombre','(socio borrado)'),coalesce(r.datos->>'anio','undefined')
  from agencia.rifas r left join agencia.socios s on s.clave=r.datos->>'sid' where position(consulta in coalesce(r.datos->>'nro','undefined'))>0
  order by categoria,posicion,suborden limit 12
 ) coincidencias;
 return resultado;
end $$;
revoke all on function public.agencia_buscar(bigint,text) from public,anon,authenticated;

-- Como en la maqueta: considerar los últimos 3000 movimientos y mostrar los
-- últimos 400 del usuario seleccionado. Los usuarios activos alimentan filtros.
create or replace function public.agencia_actividad(p_revision bigint,p_usuario text default 'todos')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint; usuarios jsonb; movimientos jsonb;
begin
 perform agencia.exigir_perfil();
 if p_revision is null or p_usuario is null or (p_usuario<>'todos' and p_usuario !~ '^[0-9a-fA-F-]{36}$') then raise exception 'Datos de consulta inválidos' using errcode='22023'; end if;
 select revision into strict rev from agencia.configuracion;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos.' using errcode='40001'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre) order by p.nombre,p.id),'[]'::jsonb) into usuarios from agencia.perfiles p where p.activo;
 with recientes as materialized (select * from agencia.actividad order by id desc limit 3000),
 seleccion as (select * from recientes where p_usuario='todos' or actor::text=p_usuario order by id desc limit 400)
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id::text,'usuarioId',a.actor,'nombre',coalesce(p.nombre,b.nombre_actor,''),'ts',a.fecha,'accion',a.accion,'tipo',a.coleccion,'detalle',a.clave) order by a.id desc),'[]'::jsonb)
 into movimientos from seleccion a left join agencia.perfiles p on p.id=a.actor and p.activo
 left join lateral (select nombre_actor from agencia.actividad h where h.actor=a.actor order by h.id desc limit 1) b on p.id is null;
 return jsonb_build_object('usuarios',usuarios,'movimientos',movimientos);
end $$;
revoke all on function public.agencia_actividad(bigint,text) from public,anon,authenticated;

-- Reinicio explícito de datos de negocio. Conserva usuarios de Auth, perfiles,
-- actividad y nombre de la agencia; requiere confirmación en la interfaz.
create or replace function public.agencia_reiniciar(p_revision bigint,p_operacion uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles;rev bigint;anterior agencia.operaciones;huella text;coleccion record;nombre text;config_nueva jsonb;
begin
 perfil:=agencia.exigir_perfil(true);
 if p_revision is null or p_operacion is null then raise exception 'Datos de operación inválidos' using errcode='22023'; end if;
 huella:=encode(sha256(convert_to('reiniciar_agencia','UTF8')),'hex');
 select revision,datos->>'nombre' into strict rev,nombre from agencia.configuracion for update;
 select * into anterior from agencia.operaciones where id=p_operacion;
 if found then
  if anterior.actor<>perfil.id or anterior.revision_anterior<>p_revision or anterior.huella<>huella then raise exception 'El identificador de operación ya fue utilizado' using errcode='22023'; end if;
  return anterior.revision;
 end if;
 if rev<>p_revision then raise exception 'Los datos cambiaron. Volvé a cargarlos antes de guardar.' using errcode='40001'; end if;
 for coleccion in select * from agencia.colecciones() loop
  execute format('insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) select $1,$2,$3,clave,''Eliminó'' from agencia.%I',coleccion.tabla)
   using perfil.id,perfil.nombre,coleccion.clave;
  execute format('delete from agencia.%I',coleccion.tabla);
 end loop;
 config_nueva:=jsonb_build_object('nombre',coalesce(nombre,''),'q6Precio',4000,'q6Dias',jsonb_build_array(3,0),'fracPrecio',10000,'rifaImporte',17000,'rifaCuotas',10);
 insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion) select perfil.id,perfil.nombre,'ajustes','Configuración','Modificó' from agencia.configuracion where datos is distinct from config_nueva;
 update agencia.configuracion set datos=config_nueva,revision=revision+1 returning revision into rev;
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella) values(p_operacion,perfil.id,rev,p_revision,huella);
 return rev;
end $$;
revoke all on function public.agencia_reiniciar(bigint,uuid) from public,anon,authenticated;

-- Validación previa del respaldo normalizado antes de cualquier reemplazo.
-- No transforma datos ni omite entidades históricas cuyos socios ya se borraron.
create or replace function agencia.validar_respaldo(p_estado jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare conf jsonb; r jsonb; c jsonb; x jsonb; clave text; hoy date:='2000-01-01';
begin
 if jsonb_typeof(p_estado) is distinct from 'object' or jsonb_typeof(p_estado->'conf') is distinct from 'object' then raise exception 'Respaldo inválido: configuración' using errcode='22023'; end if;
 conf:=p_estado->'conf';
 if jsonb_typeof(conf->'q6Dias') is distinct from 'array' or jsonb_typeof(conf->'q6Precio') is distinct from 'number'
  or jsonb_typeof(conf->'fracPrecio') is distinct from 'number' or jsonb_typeof(conf->'rifaImporte') is distinct from 'number' or jsonb_typeof(conf->'rifaCuotas') is distinct from 'number'
  or coalesce((conf->>'q6Precio')::numeric,-1)<0 or coalesce((conf->>'fracPrecio')::numeric,-1)<0 or coalesce((conf->>'rifaImporte')::numeric,-1)<0
  or coalesce((conf->>'rifaCuotas')::numeric,0)<1 or (conf->>'rifaCuotas')::numeric<>trunc((conf->>'rifaCuotas')::numeric)
  or exists(select 1 from jsonb_array_elements(conf->'q6Dias') d where jsonb_typeof(d)<>'number' or (d#>>'{}')::numeric not between 0 and 6 or (d#>>'{}')::numeric<>trunc((d#>>'{}')::numeric)) then
  raise exception 'Respaldo inválido: configuración' using errcode='22023'; end if;
 foreach clave in array array['socios','seguros','q6esp','q6','q6skip','cobros','sorteos','lot','ofertas','quiniela','rifas','toto'] loop
  if jsonb_typeof(p_estado->clave) is distinct from 'array' then raise exception 'Respaldo inválido: colección %',clave using errcode='22023'; end if;
 end loop;
 -- Cobros y exclusiones pueden conservar referencias históricas tras una baja.
 foreach clave in array array['seguros','q6','lot','ofertas','quiniela','rifas'] loop
  for r in select value from jsonb_array_elements(p_estado->clave) loop
   if coalesce(r->>'sid','')='' or not exists(select 1 from jsonb_array_elements(p_estado->'socios') s where s->>'id'=r->>'sid') then
    raise exception 'Respaldo inválido: socio inexistente en %',clave using errcode='22023';
   end if;
   if clave in ('lot','ofertas') and (coalesce(r->>'soId','')='' or not exists(select 1 from jsonb_array_elements(p_estado->'sorteos') s where s->>'id'=r->>'soId')) then
    raise exception 'Respaldo inválido: sorteo inexistente en %',clave using errcode='22023';
   end if;
  end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_estado->'q6skip') e where jsonb_typeof(e)<>'string') then raise exception 'Respaldo inválido: exclusiones' using errcode='22023'; end if;
 for r in select value from jsonb_array_elements(p_estado->'socios') loop
  if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'nombre') is distinct from 'string' or jsonb_typeof(r->'fijos') is distinct from 'array'
   or jsonb_typeof(r->'q6') is distinct from 'object' or jsonb_typeof(r->'q6'->'dias') is distinct from 'array'
   or (r ? 'activo' and jsonb_typeof(r->'activo') is distinct from 'boolean') or (r ? 'favor' and jsonb_typeof(r->'favor') is distinct from 'number')
   or (r->'q6' ? 'auto' and jsonb_typeof(r->'q6'->'auto') is distinct from 'boolean') or (r ? 'favor' and (r->>'favor')::numeric<0)
   or (r->'q6' ? 'cant' and (jsonb_typeof(r->'q6'->'cant') is distinct from 'number' or (r->'q6'->>'cant')::numeric<1 or (r->'q6'->>'cant')::numeric<>trunc((r->'q6'->>'cant')::numeric)))
   or exists(select 1 from jsonb_array_elements(r->'fijos') f where jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f->'numero') is distinct from 'string')
   or exists(select 1 from jsonb_array_elements(r->'q6'->'dias') d where jsonb_typeof(d)<>'number' or (d#>>'{}')::numeric not between 0 and 6 or (d#>>'{}')::numeric<>trunc((d#>>'{}')::numeric)) then
   raise exception 'Respaldo inválido: socio %',coalesce(r->>'id','') using errcode='22023'; end if;
  perform agencia.cuenta_socio_calcular(p_estado,r->>'id',hoy);
  perform agencia.conceptos_cobro_calcular(p_estado,r->>'id',hoy);
 end loop;
 for r in select value from jsonb_array_elements(p_estado->'seguros') loop
  if jsonb_typeof(r->'cuotas') is distinct from 'array' or coalesce(r->>'sid','')='' then raise exception 'Respaldo inválido: seguro' using errcode='22023'; end if;
  perform (r->>'ingreso')::date;perform (r->>'venc')::date;
  if coalesce(r->>'ingreso','')='' or coalesce(r->>'venc','')='' then raise exception 'Respaldo inválido: fechas de seguro' using errcode='22023'; end if;
  for c in select value from jsonb_array_elements(r->'cuotas') loop
   if jsonb_typeof(c->'imp') is distinct from 'number' or (c->>'imp')::numeric<0 or coalesce(c->>'venc','')='' or (c ? 'abono' and (jsonb_typeof(c->'abono') is distinct from 'number' or (c->>'abono')::numeric<0)) then raise exception 'Respaldo inválido: cuota de seguro' using errcode='22023'; end if;
   perform (c->>'venc')::date;if coalesce(c->>'pago','')<>'' then perform (c->>'pago')::date; end if;
  end loop;
 end loop;
 foreach clave in array array['q6','quiniela'] loop
  for r in select value from jsonb_array_elements(p_estado->clave) loop
   if jsonb_typeof(r->'monto') is distinct from 'number' or (r->>'monto')::numeric<0 or coalesce(r->>'sid','')='' or coalesce(r->>'fecha','')='' or (r ? 'pagado' and jsonb_typeof(r->'pagado') is distinct from 'boolean') then raise exception 'Respaldo inválido: %',clave using errcode='22023'; end if;
   perform (r->>'fecha')::date;
  end loop;
 end loop;
 for r in select value from jsonb_array_elements(p_estado->'sorteos') loop
  if coalesce(r->>'fecha','')='' or jsonb_typeof(r->'frac') is distinct from 'number' or (r->>'frac')::numeric<1 or (r->>'frac')::numeric<>trunc((r->>'frac')::numeric) or jsonb_typeof(r->'precio') is distinct from 'number' or (r->>'precio')::numeric<0 then raise exception 'Respaldo inválido: sorteo' using errcode='22023'; end if;perform (r->>'fecha')::date;
 end loop;
 for r in select value from jsonb_array_elements(p_estado->'q6esp') loop
  if coalesce(r->>'fecha','')='' or jsonb_typeof(r->'precio') is distinct from 'number' then raise exception 'Respaldo inválido: sorteo especial' using errcode='22023'; end if;perform (r->>'fecha')::date;
 end loop;
 for r in select value from jsonb_array_elements(p_estado->'lot') loop
  if jsonb_typeof(r->'frac') is distinct from 'number' or (r->>'frac')::numeric<1 or (r->>'frac')::numeric<>trunc((r->>'frac')::numeric) or jsonb_typeof(r->'precio') is distinct from 'number' or (r->>'precio')::numeric<0 or coalesce(r->>'sid','')='' or coalesce(r->>'soId','')='' or (r ? 'pagado' and jsonb_typeof(r->'pagado') is distinct from 'boolean') then raise exception 'Respaldo inválido: venta de lotería' using errcode='22023'; end if;
 end loop;
 for r in select value from jsonb_array_elements(p_estado->'rifas') loop
  if jsonb_typeof(r->'importe') is distinct from 'number' or (r->>'importe')::numeric<0 or jsonb_typeof(r->'ncuotas') is distinct from 'number' or (r->>'ncuotas')::numeric<1 or (r->>'ncuotas')::numeric<>trunc((r->>'ncuotas')::numeric) or jsonb_typeof(r->'pagos') is distinct from 'array' or coalesce(r->>'sid','')='' or coalesce(r->>'desde','')='' then raise exception 'Respaldo inválido: rifa' using errcode='22023'; end if;
  perform (r->>'desde')::date;perform agencia.cuota_rifa((r->>'importe')::numeric,(r->>'ncuotas')::integer,0);
  for x in select value from jsonb_array_elements(r->'pagos') loop if x not in ('null'::jsonb,'false'::jsonb,'""'::jsonb,'0'::jsonb) then perform (x#>>'{}')::date; end if;end loop;
 end loop;
 for r in select value from jsonb_array_elements(p_estado->'cobros') loop
  if jsonb_typeof(r->'monto') is distinct from 'number' or (r->>'monto')::numeric<0 or coalesce(r->>'sid','')='' or coalesce(r->>'fecha','')=''
   or (r ? 'aplicados' and jsonb_typeof(r->'aplicados') is distinct from 'array')
   or (r ? 'anulado' and jsonb_typeof(r->'anulado') is distinct from 'boolean')
   or (r ? 'rechazoAplicado' and jsonb_typeof(r->'rechazoAplicado') is distinct from 'boolean')
   or (r ? 'det' and jsonb_typeof(r->'det') not in ('object','null')) then raise exception 'Respaldo inválido: cobro' using errcode='22023'; end if;
  perform (r->>'fecha')::date;
  if coalesce(r->'det'->>'fcobro','')<>'' then perform (r->'det'->>'fcobro')::date; end if;
  if coalesce(r->'det'->>'dep','')<>'' then perform (r->'det'->>'dep')::date; end if;
  if r->'det' ? 'estado' and r->'det'->>'estado' not in ('pendiente','aprobado','rechazado') then raise exception 'Respaldo inválido: estado de cheque' using errcode='22023'; end if;
  for x in select value from jsonb_array_elements(coalesce(r->'aplicados','[]'::jsonb)) loop
   if jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(x->'ref') is distinct from 'array' or jsonb_typeof(x->'completo') is distinct from 'boolean'
    or (x ? 'abono' and (jsonb_typeof(x->'abono') is distinct from 'number' or (x->>'abono')::numeric<0))
    or (x ? 'imp' and (jsonb_typeof(x->'imp') is distinct from 'number' or (x->>'imp')::numeric<0)) then raise exception 'Respaldo inválido: aplicación de cobro' using errcode='22023'; end if;
   if coalesce(x->'ref'->>1,'') !~ '^[a-zA-Z0-9_-]{1,128}$' or not (
    (x->'ref'->>0 in ('q6','lot','quiniela') and jsonb_array_length(x->'ref')=2) or
    (x->'ref'->>0 in ('seg','rifa') and jsonb_array_length(x->'ref')=3 and coalesce(x->'ref'->>2,'') ~ '^[0-9]{1,6}$')
   ) then raise exception 'Respaldo inválido: referencia de cobro' using errcode='22023'; end if;
  end loop;
 end loop;
 for r in select value from jsonb_array_elements(p_estado->'toto') loop perform agencia.toto_validar_datos(r); end loop;
exception when data_exception then raise exception 'Respaldo inválido: campos, fechas o importes incorrectos' using errcode='22023';
end $$;
revoke all on function agencia.validar_respaldo(jsonb) from public,anon,authenticated;

-- Variante controlada: valida y reemplaza todo atómicamente, solo como administrador.
create or replace function public.agencia_restaurar_verificado(p_revision bigint,p_operacion uuid,p_estado jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare perfil agencia.perfiles;rev bigint;existente boolean;
begin
 perfil:=agencia.exigir_perfil(true);
 perform agencia.validar_respaldo(p_estado);
 -- Serializar la comprobación del UUID con el reemplazo y la generación.
 select revision into strict rev from agencia.configuracion for update;
 select exists(select 1 from agencia.operaciones where id=p_operacion) into existente;
 rev:=agencia.persistir(p_revision,p_operacion,p_estado,true);
 if not existente then perform agencia.generar_quini_pendientes(perfil); end if;
 return rev;
end $$;
revoke all on function public.agencia_restaurar_verificado(bigint,uuid,jsonb) from public,anon,authenticated;

commit;
