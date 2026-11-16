-- Migración incremental 003: progresión de lotería y PDF con cuotas futuras.
-- Aplicar una sola vez después de 00, 01, 002, 03-panel y 04-permisos.
-- No crea tablas: usa el JSONB ya existente.

begin;

create or replace function public.agencia_loteria_venta(
  p_revision bigint,p_operacion uuid,p_id text,p_datos jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 perfil agencia.perfiles; op agencia.operaciones; rev bigint; huella text; sorteo jsonb; socio jsonb;
 anterior jsonb; venta jsonb; liberacion jsonb; resultado jsonb; oferta record;
 sid text; soid text; numero text; progresion text; clave_venta text; precio numeric; fracciones numeric; maximo numeric;
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
 if p_datos ? 'progresion' then
  if jsonb_typeof(p_datos->'progresion') is distinct from 'string' or length(p_datos->>'progresion')>10
    or coalesce(p_datos->>'progresion','') !~ '^\d*$' then
   raise exception 'La progresión debe contener hasta 10 dígitos' using errcode='22023'; end if;
  progresion:=p_datos->>'progresion';
 else progresion:=''; end if;
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
 venta:=venta||jsonb_build_object('sid',sid,'soId',soid,'numero',numero,'progresion',progresion,'frac',fracciones,'precio',precio);
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
 update agencia.configuracion set revision=revision+1 where unica=true returning revision into rev;
 resultado:=jsonb_build_object('revision',rev,'id',clave_venta,'liberado',liberado);
 insert into agencia.operaciones(id,actor,revision,revision_anterior,huella,resultado) values(p_operacion,perfil.id,rev,p_revision,huella,resultado);
 return resultado;
exception when invalid_text_representation or numeric_value_out_of_range then
 raise exception 'Datos de venta inválidos' using errcode='22023';
end $$;
revoke all on function public.agencia_loteria_venta(bigint,uuid,text,jsonb) from public,anon,authenticated;

create or replace function public.agencia_socio_movimientos(p_revision bigint,p_socio_id text,p_filtro text default 'todo')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rev bigint;estado jsonb;cuenta jsonb;movimientos jsonb:='[]'::jsonb;ordenados jsonb;visibles jsonb:='[]'::jsonb;futuros jsonb:='[]'::jsonb;futuro_total numeric:=0;fusionados jsonb:='{}'::jsonb;ocultos jsonb:='[]'::jsonb;grupos jsonb:='[]'::jsonb;
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
 -- PDF conserva movimientos históricos y separa las cuotas que todavía no vencen.
 if p_filtro='pdf' then
  select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) into visibles from jsonb_array_elements(ordenados) with ordinality e(item,ord) where not coalesce((item->>'futuro')::boolean,false);
  select coalesce(jsonb_agg(item order by item->>'fecha',item->>'tipo'),'[]'::jsonb),coalesce(sum((item->>'importe')::numeric),0)
    into futuros,futuro_total from jsonb_array_elements(ordenados) e(item) where coalesce((item->>'futuro')::boolean,false);
  cuenta:=cuenta||jsonb_build_object('futuro',round(futuro_total,2),'totalPendiente',round(coalesce((cuenta->>'debe')::numeric,0)+futuro_total,2));
  return jsonb_build_object('movimientos',visibles,'futuros',futuros,'cuenta',cuenta,'hoy',hoy);
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

create or replace function public.agencia_socio_pdf(p_revision bigint,p_socio_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare resultado jsonb;socio jsonb;nombre_agencia text;
begin
 resultado:=public.agencia_socio_movimientos(p_revision,p_socio_id,'pdf');
 select datos into socio from agencia.socios where clave=p_socio_id;
 select datos->>'nombre' into nombre_agencia from agencia.configuracion;
 return resultado||jsonb_build_object('socio',socio,'nombreAgencia',coalesce(nombre_agencia,''));
end $$;
revoke all on function public.agencia_socio_pdf(bigint,text) from public,anon,authenticated;

-- Inicializa el nuevo dato sin alterar ventas ni importes existentes.
update agencia.loteria_ventas set datos=jsonb_set(datos,'{progresion}',to_jsonb(''::text),true) where not (datos ? 'progresion');

grant execute on function public.agencia_loteria_venta(bigint,uuid,text,jsonb) to authenticated;
grant execute on function public.agencia_socio_movimientos(bigint,text,text) to authenticated;
grant execute on function public.agencia_socio_pdf(bigint,text) to authenticated;

commit;
