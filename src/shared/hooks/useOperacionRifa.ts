import { useMutation,useQueryClient } from '@tanstack/react-query';
import { rpc } from '../lib/supabase.service';
import { useOperacionSegura,type PuenteOperacion } from './useOperacionSegura';
export interface ResultadoRifa { revision:number; id:string; liberado?:number; anio?:number }
export type EntradaRifa = {tipo:'guardar';p_id:string|null;p_datos:Record<string,unknown>} | {tipo:'operar';p_accion:'pagar_cuota'|'quitar_pago'|'anular_cuota'|'eliminar';p_id:string;p_datos:Record<string,unknown>};
type SolicitudRifa=EntradaRifa & {p_revision:number;p_operacion:string};
export function useOperacionRifa(puente:PuenteOperacion<ResultadoRifa>){
 const cliente=useQueryClient();const operacion=useMutation({mutationFn:({tipo,...solicitud}:SolicitudRifa)=>rpc<ResultadoRifa>(tipo==='guardar'?'agencia_rifa_guardar':'agencia_rifa_operar',solicitud),onSuccess:async()=>{
  await cliente.invalidateQueries({queryKey:['estado-agencia'],refetchType:'none'});await cliente.invalidateQueries({queryKey:['rifa'],refetchType:'none'});
 }});return useOperacionSegura<EntradaRifa,ResultadoRifa>(puente,operacion.mutateAsync);
}
