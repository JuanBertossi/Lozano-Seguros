-- Permisos de ejecución, en un solo lugar. Ejecutar al final y cada vez que se agregue una función.
--  * Funciones públicas agencia_*: la API de Supabase solo las deja usar a cuentas autenticadas.
--    Cada una valida la cuenta y el rol con agencia.exigir_perfil(); `anon` nunca puede ejecutarlas.
--  * Funciones internas del esquema agencia: nadie las ejecuta directamente, solo las públicas.
begin;

do $$
declare funcion record;
begin
  for funcion in
    select p.oid::regprocedure as firma, n.nspname as esquema
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname like 'agencia\_%' escape '\') or n.nspname = 'agencia'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', funcion.firma);
    if funcion.esquema = 'public' then
      execute format('grant execute on function %s to authenticated', funcion.firma);
    end if;
  end loop;
end $$;

commit;
