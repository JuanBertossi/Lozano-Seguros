import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rpc } from '../lib/supabase.service';
import { useOperacionSegura, type PuenteOperacion } from './useOperacionSegura';

export interface ResultadoNumeroFijo { revision:number }
export interface EntradaNumeroFijo { p_socio_id:string; p_accion:'agregar'|'quitar'; p_numero:string|null; p_fracciones:number|null; p_indice:number|null }
interface SolicitudNumeroFijo extends EntradaNumeroFijo { p_revision:number; p_operacion:string }
export interface LoteriaSocioListado {
 fijos:{numero:string;frac:number}[];
 filas:{venta:{id:string;numero:string;frac:number;pagado:boolean;abono?:number};sorteo:string;fraccionesSorteo:number|null;importe:number;restante:number}[];
}

export function useLoteriaSocio(revision:number|null,socioId:string|null) {
 return useQuery({queryKey:['loteria','socio',revision,socioId],queryFn:()=>rpc<LoteriaSocioListado>('agencia_loteria_socio_listar',{p_revision:revision,p_socio_id:socioId}),enabled:revision!==null&&socioId!==null,retry:false});
}

export function useNumeroFijo(puente:PuenteOperacion<ResultadoNumeroFijo>) {
  const cliente=useQueryClient();
  const operacion=useMutation({mutationFn:(solicitud:SolicitudNumeroFijo)=>rpc<ResultadoNumeroFijo>('agencia_loteria_numero_fijo',solicitud),onSuccess:async()=>{
    await cliente.invalidateQueries({queryKey:['estado-agencia'],refetchType:'none'});
    await cliente.invalidateQueries({queryKey:['loteria'],refetchType:'none'});
  }});
  return useOperacionSegura<EntradaNumeroFijo,ResultadoNumeroFijo>(puente,operacion.mutateAsync);
}
