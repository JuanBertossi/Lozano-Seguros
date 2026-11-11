import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpc } from '../lib/supabase.service';
import { useOperacionSegura, type PuenteOperacion } from './useOperacionSegura';
export interface ResultadoPagoLoteria { revision:number; liberado:number }
export interface EntradaPagoLoteria { p_id:string; p_accion:'editar_pago'|'anular_pago'|'marcar'|'desmarcar'|'anular'; p_datos:Record<string,unknown> }
interface SolicitudPagoLoteria extends EntradaPagoLoteria { p_revision:number; p_operacion:string }
export function usePagoLoteria(puente:PuenteOperacion<ResultadoPagoLoteria>) {
 const cliente=useQueryClient();
 const operacion=useMutation({mutationFn:(solicitud:SolicitudPagoLoteria)=>rpc<ResultadoPagoLoteria>('agencia_loteria_pago',solicitud),onSuccess:async()=>{
  await cliente.invalidateQueries({queryKey:['estado-agencia'],refetchType:'none'});
  await cliente.invalidateQueries({queryKey:['loteria'],refetchType:'none'});
 }});
 return useOperacionSegura<EntradaPagoLoteria,ResultadoPagoLoteria>(puente,operacion.mutateAsync);
}
