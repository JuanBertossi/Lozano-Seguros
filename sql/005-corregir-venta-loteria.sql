-- Corrige la actualización de configuración para Supabase safe updates.
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

grant execute on function public.agencia_loteria_venta(bigint,uuid,text,jsonb) to authenticated;
commit;
