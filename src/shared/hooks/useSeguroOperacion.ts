import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOperacionSegura, type PuenteOperacion } from './useOperacionSegura';
import { segurosService, type ResultadoSeguro, type SolicitudCuotas, type SolicitudSeguro } from '../lib/seguros.service';

export function usePreviaSeguro(solicitud:SolicitudCuotas|null) {
  return useQuery({ queryKey:['seguros','cuotas',solicitud], queryFn:()=>segurosService.prever(solicitud!), enabled:solicitud!==null, retry:false });
}

export function useListadoSeguros(revision:number|null,socioId:string|null) {
  return useQuery({queryKey:['seguros','listado',revision,socioId],queryFn:()=>segurosService.listar(revision!,socioId),enabled:revision!==null,retry:false});
}

export function useOperacionSeguro(puente:PuenteOperacion<ResultadoSeguro>) {
  const queryClient=useQueryClient();
  const operacion=useMutation({ mutationFn:(solicitud:SolicitudSeguro)=>segurosService.operar(solicitud), onSuccess:async()=>{
    await Promise.all([
      queryClient.invalidateQueries({queryKey:['estado-agencia'],refetchType:'none'}),
      queryClient.invalidateQueries({queryKey:['seguros'],refetchType:'none'}),
    ]);
  }});
  return useOperacionSegura<Omit<SolicitudSeguro,'p_revision'|'p_operacion'>,ResultadoSeguro>(puente,operacion.mutateAsync);
}
