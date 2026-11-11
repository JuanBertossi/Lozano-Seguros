import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rpc } from '../lib/supabase.service';
import { useOperacionSegura, type PuenteOperacion } from './useOperacionSegura';

export interface ResultadoSorteo { revision:number; id:string }
export interface EntradaSorteo { p_accion:'crear'|'editar'|'eliminar'; p_id:string|null; p_datos:Record<string,unknown> }
interface SolicitudSorteo extends EntradaSorteo { p_revision:number; p_operacion:string }
export function useSorteoOperacion(puente:PuenteOperacion<ResultadoSorteo>) {
 const cliente=useQueryClient();
 const operacion=useMutation({mutationFn:(solicitud:SolicitudSorteo)=>rpc<ResultadoSorteo>('agencia_loteria_sorteo',solicitud),onSuccess:async()=>{
  await cliente.invalidateQueries({queryKey:['estado-agencia'],refetchType:'none'});
  await cliente.invalidateQueries({queryKey:['loteria'],refetchType:'none'});
 }});
 return useOperacionSegura<EntradaSorteo,ResultadoSorteo>(puente,operacion.mutateAsync);
}
