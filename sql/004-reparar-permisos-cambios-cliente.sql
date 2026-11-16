-- Repara los permisos quitados por la primera versión de 003.
begin;
grant execute on function public.agencia_loteria_venta(bigint,uuid,text,jsonb) to authenticated;
grant execute on function public.agencia_socio_movimientos(bigint,text,text) to authenticated;
grant execute on function public.agencia_socio_pdf(bigint,text) to authenticated;
commit;
