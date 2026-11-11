import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpc } from '../lib/supabase.service';
import { useOperacionSegura, type PuenteOperacion } from './useOperacionSegura';
export interface ResultadoAnioLoteria { revision:number; cantidad:number }
interface SolicitudAnioLoteria { p_revision:number; p_operacion:string }
export function useAgregarAnioLoteria(puente:PuenteOperacion<ResultadoAnioLoteria>) {
 const cliente=useQueryClient();
 const operacion=useMutation({mutationFn:(solicitud:SolicitudAnioLoteria)=>rpc<ResultadoAnioLoteria>('agencia_loteria_agregar_anio',solicitud),onSuccess:async()=>{
  await cliente.invalidateQueries({queryKey:['estado-agencia'],refetchType:'none'});
  await cliente.invalidateQueries({queryKey:['loteria'],refetchType:'none'});
 }});
 return useOperacionSegura<Record<string,never>,ResultadoAnioLoteria>(puente,operacion.mutateAsync);
}
