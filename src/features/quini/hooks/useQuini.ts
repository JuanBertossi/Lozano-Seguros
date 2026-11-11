import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useOperacionSegura,type PuenteOperacion } from '../../../shared/hooks/useOperacionSegura';
import { quiniService,type ResultadoQuini,type SolicitudQuini,type SolicitudPreviaQuini,type SolicitudPlanQuini } from '../api/quini.service';
export function usePreviaQuini(solicitud:SolicitudPreviaQuini|null){return useQuery({queryKey:['quini','previa',solicitud],queryFn:()=>quiniService.prever(solicitud!),enabled:solicitud!==null,retry:false})}
export function useQuiniOperacion(puente:PuenteOperacion<ResultadoQuini>,tipo:'jugada'|'especial'){
 const cliente=useQueryClient();const operacion=useMutation({mutationFn:(solicitud:SolicitudQuini)=>quiniService[tipo](solicitud),onSuccess:async()=>{
  await cliente.invalidateQueries({queryKey:['estado-agencia'],refetchType:'none'});await cliente.invalidateQueries({queryKey:['quini'],refetchType:'none'});
 }});return useOperacionSegura<Omit<SolicitudQuini,'p_revision'|'p_operacion'>,ResultadoQuini>(puente,operacion.mutateAsync);
}
export function usePlanQuini(puente:PuenteOperacion<ResultadoQuini>){
 const cliente=useQueryClient();const operacion=useMutation({mutationFn:(solicitud:SolicitudPlanQuini)=>quiniService.plan(solicitud),onSuccess:async()=>{
  await cliente.invalidateQueries({queryKey:['estado-agencia'],refetchType:'none'});await cliente.invalidateQueries({queryKey:['quini'],refetchType:'none'});
 }});return useOperacionSegura<Omit<SolicitudPlanQuini,'p_revision'|'p_operacion'>,ResultadoQuini>(puente,operacion.mutateAsync);
}
