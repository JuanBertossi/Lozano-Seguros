-- INCOMPLETO: no ejecutar. Existen procedimientos de cobros, saldos y anulaciones,
-- pero falta completar su integración, validación y el resto de los flujos.
-- La distribución de 64 o más conceptos con comparación no transitiva todavía
-- requiere portar TimSort del navegador; por ahora se rechaza expresamente.
-- Funciones de cálculo aisladas para comparar con el maquetado.
begin;

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
create or replace function public.agencia_generar_quini(p_revision bigint, p_operacion uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  perfil agencia.perfiles;
  anterior agencia.operaciones;
  revision_actual bigint;
  configuracion jsonb;
  socio record;
  fecha date;
  hoy date := (current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date;
  desde date;
  dias jsonb;
  dias_generales jsonb;
  especial jsonb;
  precio numeric;
  cantidad integer;
  clave_nueva text;
  posicion_nueva bigint;
  generadas integer := 0;
  huella_actual text;
begin
  perfil := agencia.exigir_perfil();
  if p_revision is null or p_operacion is null then
    raise exception 'Revisión u operación inválida' using errcode='22023';
  end if;
  select revision, datos into strict revision_actual, configuracion from agencia.configuracion for update;
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
  dias_generales := coalesce(configuracion->'q6Dias','[]'::jsonb);
  if jsonb_typeof(dias_generales) <> 'array' then raise exception 'Días de sorteo inválidos' using errcode='22023'; end if;
  select coalesce(max(posicion),0) into posicion_nueva from agencia.quini_jugadas;
  for socio in select datos from agencia.socios order by posicion loop
    if not coalesce((socio.datos->>'activo')::boolean,false)
      or not coalesce((socio.datos->'q6'->>'auto')::boolean,false) then continue; end if;
    dias := coalesce(socio.datos->'q6'->'dias','[]'::jsonb);
    if jsonb_typeof(dias) <> 'array' then raise exception 'Días de socio inválidos' using errcode='22023'; end if;
    if jsonb_array_length(dias)=0 then continue; end if;
    desde := coalesce(nullif(socio.datos->'q6'->>'desde','')::date,hoy);
    cantidad := coalesce(nullif((socio.datos->'q6'->>'cant')::integer,0),1);
    for fecha in select g::date from generate_series(desde::timestamp,hoy::timestamp,interval '1 day') g loop
      select datos into especial from agencia.quini_sorteos_especiales where datos->>'fecha'=fecha::text order by posicion limit 1;
      if not (dias_generales @> jsonb_build_array(extract(dow from fecha)::integer) or especial is not null) then continue; end if;
      if not (dias @> jsonb_build_array(extract(dow from fecha)::integer) or not dias_generales @> jsonb_build_array(extract(dow from fecha)::integer)) then continue; end if;
      if exists(select 1 from agencia.quini_jugadas where datos->>'sid'=socio.datos->>'id' and datos->>'fecha'=fecha::text)
        or exists(select 1 from agencia.quini_exclusiones where datos #>> '{}' = (socio.datos->>'id') || '|' || fecha::text) then continue; end if;
      precio := case when especial is not null then (especial->>'precio')::numeric else (configuracion->>'q6Precio')::numeric end;
      if precio is null or precio < 0 or cantidad < 1 then raise exception 'Precio o cantidad de Quini inválido' using errcode='22023'; end if;
      clave_nueva := replace(gen_random_uuid()::text,'-','');
      posicion_nueva := posicion_nueva+1;
      insert into agencia.quini_jugadas(clave,posicion,datos) values(clave_nueva,posicion_nueva,jsonb_build_object(
        'id',clave_nueva,'sid',socio.datos->>'id','fecha',fecha,'monto',precio*cantidad,
        'pagado',false,'auto',true,'ts',clock_timestamp(),'por','auto'));
      insert into agencia.actividad(actor,nombre_actor,coleccion,clave,accion)
        values(perfil.id,perfil.nombre,'q6',clave_nueva,'Creó');
      generadas := generadas+1;
    end loop;
  end loop;
  update agencia.configuracion set revision=revision+1 returning revision into revision_actual;
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
create or replace function agencia.toto_concursos(p_fecha date,p_excluir text default null)
returns jsonb language plpgsql stable set search_path = '' as $$
declare k text; r record; cfg jsonb; dias jsonb; candidatos jsonb; valor integer; delta integer; salida jsonb:='{}';
begin
  if p_fecha is null then raise exception 'Fecha inválida' using errcode='22023'; end if;
  select datos->'totoDias' into cfg from agencia.configuracion;
  foreach k in array array['previa','primera','matutina','vespertina','nocturna','turista','quini6','loto'] loop
    dias:=case when jsonb_typeof(cfg->k)='array' then cfg->k
      when k in ('quini6','loto') then '[0,3]'::jsonb else '[1,2,3,4,5,6]'::jsonb end;
    select x.datos, (x.datos->>'fecha')::date fecha,
      case when coalesce(nullif(x.datos->'conc'->>k,'')::numeric,0)>0 then (x.datos->'conc'->>k)::integer
           when k='matutina' and coalesce(nullif(x.datos->>'concurso','')::numeric,0)>0 then (x.datos->>'concurso')::integer
           else null end concurso
      into r from agencia.toto_planillas x
      where x.clave is distinct from p_excluir
        and (coalesce(nullif(x.datos->'conc'->>k,'')::numeric,0)>0 or (k='matutina' and coalesce(nullif(x.datos->>'concurso','')::numeric,0)>0))
      order by case when (x.datos->>'fecha')::date<=p_fecha then 0 else 1 end,
        case when (x.datos->>'fecha')::date<=p_fecha then (x.datos->>'fecha')::date end desc,
        case when (x.datos->>'fecha')::date>p_fecha then (x.datos->>'fecha')::date end asc, x.posicion
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
 rev bigint; r record; c jsonb; estimados jsonb; concursos jsonb; k text; n numeric;
 filas jsonb:='[]'::jsonb; juegos jsonb:='{}'::jsonb; totales jsonb:='{}'::jsonb;
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
 for r in select t.clave,t.datos from agencia.toto_planillas t
   where p_periodo='todo' or (p_periodo='dia' and t.datos->>'fecha'=p_valor) or (p_periodo='mes' and left(t.datos->>'fecha',7)=p_valor)
   order by t.datos->>'fecha' desc,t.posicion loop
   c:=agencia.toto_calcular(r.datos);
   estimados:=agencia.toto_concursos((r.datos->>'fecha')::date,r.clave); concursos:='{}'::jsonb;
   foreach k in array array['previa','primera','matutina','vespertina','nocturna','turista','quini6','loto'] loop
     n:=coalesce(nullif(r.datos->'conc'->>k,'')::numeric,0);
     if n<=0 and k='matutina' then n:=coalesce(nullif(r.datos->>'concurso','')::numeric,0); end if;
     concursos:=concursos||jsonb_build_object(k,case when n>0 then to_jsonb(n) else coalesce(estimados->k,'null'::jsonb) end);
     juegos:=juegos||jsonb_build_object(k,coalesce((juegos->>k)::double precision,0)+coalesce(nullif(r.datos->>k,'')::double precision,0));
   end loop;
   foreach campo in array campos loop totales:=totales||jsonb_build_object(campo,coalesce((totales->>campo)::double precision,0)+coalesce((c->>campo)::double precision,0)); end loop;
   if (c->>'saldado')::boolean then pagados:=pagados+1; end if;
   filas:=filas||jsonb_build_array(jsonb_build_object('id',r.clave,'datos',r.datos,'calculo',c,'concursos',concursos));
 end loop;
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
     select coalesce((select p.nombre from agencia.perfiles p where p.id::text=r.datos->>'por'),(select a.nombre_actor from agencia.actividad a where a.actor::text=r.datos->>'por' order by a.id desc limit 1),'') into por_nombre;
     autor:='Cargó '||por_nombre;
   elsif r.datos->>'por'='auto' then autor:='Automático'; end if;
   if coalesce(r.datos->>'modPor','')<>'' and r.datos->>'modPor' is distinct from r.datos->>'por' then
     select coalesce((select p.nombre from agencia.perfiles p where p.id::text=r.datos->>'modPor'),(select a.nombre_actor from agencia.actividad a where a.actor::text=r.datos->>'modPor' order by a.id desc limit 1),'') into mod_nombre;
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
    (select a.nombre_actor from agencia.actividad a where a.actor::text=v.datos->>'por' order by a.id desc limit 1),''),
  'nombreEditor',coalesce((select p.nombre from agencia.perfiles p where p.id::text=v.datos->>'modPor' and p.activo),
    (select a.nombre_actor from agencia.actividad a where a.actor::text=v.datos->>'modPor' order by a.id desc limit 1),''),
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
 rev:=public.agencia_generar_quini(rev,gen_random_uuid());
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
 rev:=public.agencia_generar_quini(rev,gen_random_uuid());
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
 if p_revision is null or p_operacion is null or coalesce(p_id,'') !~ '^[a-zA-Z0-9_-]{1,128}$' or p_accion is null or p_accion not in ('pagar_cuota','quitar_pago','anular_cuota','eliminar') or jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos de rifa inválidos' using errcode='22023'; end if;
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
  elsif p_accion='quitar_pago' then
   if coalesce(pagos->>i,'')<>'' then
    pagos:=agencia.lista_asignar(pagos,i,'null'::jsonb);rifa:=rifa||jsonb_build_object('pagos',pagos);
    liberacion:=agencia.rifa_liberar_cuota(rifa,i,'completos',perfil.id,perfil.nombre);rifa:=liberacion->'rifa';liberado:=(liberacion->>'liberado')::numeric;
   end if;
   pagos:=agencia.lista_asignar(rifa->'pagos',i,'null'::jsonb);medios:=agencia.lista_asignar(medios,i,to_jsonb(''::text));dets:=agencia.lista_asignar(dets,i,'null'::jsonb);
   rifa:=rifa||jsonb_build_object('pagos',pagos,'medios',medios,'dets',dets);
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

commit;
