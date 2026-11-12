import { keepPreviousData,useMutation,useQuery } from '@tanstack/react-query';
import { useRevision } from '../../../shared/hooks/useSesion';
import { useOperacionSegura } from '../../../shared/hooks/useOperacionSegura';
import { quiniService,type ResultadoQuini,type SolicitudQuini,type SolicitudPlanQuini } from '../api/quini.service';

type EntradaQuini=Omit<SolicitudQuini,'p_revision'|'p_operacion'>;
type EntradaPlanQuini=Omit<SolicitudPlanQuini,'p_revision'|'p_operacion'>;
/** Resultado del servidor más la acción que lo originó, para elegir el aviso. */
export type ResultadoOperacionQuini=ResultadoQuini&{accion:SolicitudQuini['p_accion']};

/** Jugadas automáticas de los días que ya pasaron. Lo usan el ingreso y `GeneracionQuini`. */
export function useGenerarQuini(){
 return useMutation({mutationFn:quiniService.generar,retry:(intentos,error)=>!(error as {code?:string})?.code&&intentos<2});
}
export function useCalendarioQuini(){
 const revision=useRevision();
 return useQuery({queryKey:['quini','calendario',revision],queryFn:()=>quiniService.fechas(revision!),enabled:revision!==null,placeholderData:keepPreviousData,retry:false});
}
export function useListadoQuini(fecha:string|null,filtro:string){
 const revision=useRevision();
 return useQuery({queryKey:['quini','listado',revision,fecha,filtro],queryFn:()=>quiniService.listar(revision!,fecha!,filtro),enabled:revision!==null&&fecha!==null,placeholderData:keepPreviousData,retry:false});
}
export function usePreviaQuini(fecha:string,cantidad:string){
 const revision=useRevision();
 return useQuery({queryKey:['quini','previa',revision,fecha,cantidad],queryFn:()=>quiniService.prever({p_revision:revision!,p_fecha:fecha,p_cantidad:Number(cantidad)}),enabled:revision!==null&&fecha!==''&&/^[1-9]\d*$/.test(cantidad),placeholderData:keepPreviousData,retry:false});
}
export function useFormularioQuini(id:string|null,socioId:string|null){
 const revision=useRevision();
 return useQuery({queryKey:['quini','formulario',revision,id,socioId],queryFn:()=>quiniService.formulario(revision!,id,socioId),enabled:revision!==null,placeholderData:keepPreviousData,retry:false});
}
export function usePlanSocioQuini(socioId:string){
 const revision=useRevision();
 return useQuery({queryKey:['quini','plan',revision,socioId],queryFn:()=>quiniService.planSocio(revision!,socioId),enabled:revision!==null,placeholderData:keepPreviousData,retry:false});
}
export function useOperacionQuini(tipo:'jugada'|'especial',alExito:(resultado:ResultadoOperacionQuini)=>void){
 return useOperacionSegura<EntradaQuini,ResultadoOperacionQuini>(async solicitud=>({...await quiniService[tipo](solicitud),accion:solicitud.p_accion}),{alExito});
}
export function usePlanQuini(alExito:(resultado:ResultadoQuini)=>void){
 return useOperacionSegura<EntradaPlanQuini,ResultadoQuini>(solicitud=>quiniService.plan(solicitud),{alExito});
}
