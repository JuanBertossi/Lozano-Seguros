import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOperacionSegura, type PuenteOperacion } from '../../../shared/hooks/useOperacionSegura';
import { loteriaService, type ResultadoVenta, type SolicitudVenta, type ResultadoEliminarVenta, type SolicitudEliminarVenta, type SolicitudPreviaVenta, type SolicitudAccionLoteria, type ResultadoAccionLoteria } from '../api/loteria.service';

export function usePreviaVenta(solicitud:SolicitudPreviaVenta|null) {
  return useQuery({queryKey:['loteria','previa',solicitud],queryFn:()=>loteriaService.preverVenta(solicitud!),enabled:solicitud!==null,retry:false});
}

export function useListadoLoteria(revision:number|null,sorteoId:string|null,filtro:string) {
  return useQuery({queryKey:['loteria','listado',revision,sorteoId,filtro],queryFn:()=>loteriaService.listar(revision!,sorteoId!,filtro),enabled:revision!==null&&sorteoId!==null,retry:false});
}

export function useGuardarVenta(puente:PuenteOperacion<ResultadoVenta>) {
  const cliente=useQueryClient();
  const operacion=useMutation({mutationFn:(solicitud:SolicitudVenta)=>loteriaService.guardarVenta(solicitud),onSuccess:async()=>{
    await cliente.invalidateQueries({queryKey:['estado-agencia'],refetchType:'none'});
  }});
  return useOperacionSegura<Omit<SolicitudVenta,'p_revision'|'p_operacion'>,ResultadoVenta>(puente,operacion.mutateAsync);
}

export function useEliminarVenta(puente:PuenteOperacion<ResultadoEliminarVenta>) {
  const cliente=useQueryClient();
  const operacion=useMutation({mutationFn:(solicitud:SolicitudEliminarVenta)=>loteriaService.eliminarVenta(solicitud),onSuccess:async()=>{
    await cliente.invalidateQueries({queryKey:['estado-agencia'],refetchType:'none'});
  }});
  return useOperacionSegura<Omit<SolicitudEliminarVenta,'p_revision'|'p_operacion'>,ResultadoEliminarVenta>(puente,operacion.mutateAsync);
}

export function useAccionLoteria(puente:PuenteOperacion<ResultadoAccionLoteria>) {
  const cliente=useQueryClient();
  const operacion=useMutation({mutationFn:(solicitud:SolicitudAccionLoteria)=>loteriaService.ejecutar(solicitud),onSuccess:async()=>{
    await cliente.invalidateQueries({queryKey:['estado-agencia'],refetchType:'none'});
  }});
  return useOperacionSegura<Omit<SolicitudAccionLoteria,'p_revision'|'p_operacion'>,ResultadoAccionLoteria>(puente,operacion.mutateAsync);
}
