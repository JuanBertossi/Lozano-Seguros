import { keepPreviousData,useQuery } from '@tanstack/react-query';
import { useRevision } from '../../../shared/hooks/useSesion';
import { useOperacionSegura } from '../../../shared/hooks/useOperacionSegura';
import { quinielaService,type ResultadoQuiniela,type SolicitudQuiniela } from '../api/quiniela.service';

type EntradaQuiniela=Omit<SolicitudQuiniela,'p_revision'|'p_operacion'>;
/** Resultado del servidor más la acción y la fecha enviadas, para elegir el aviso y el día a mostrar. */
export type ResultadoOperacionQuiniela=ResultadoQuiniela&{accion:SolicitudQuiniela['p_accion'];fecha:string|null};
export function useListadoQuiniela(fecha:string){
 const revision=useRevision();
 return useQuery({queryKey:['quiniela','listado',revision,fecha],queryFn:()=>quinielaService.listar(revision!,fecha),enabled:revision!==null,placeholderData:keepPreviousData,retry:false});
}
export function useFormularioQuiniela(id:string|null,socioId:string|null){
 const revision=useRevision();
 return useQuery({queryKey:['quiniela','formulario',revision,id,socioId],queryFn:()=>quinielaService.formulario(revision!,id,socioId),enabled:revision!==null,placeholderData:keepPreviousData,retry:false});
}
export function useQuinielaOperacion(alExito:(resultado:ResultadoOperacionQuiniela)=>void){
 return useOperacionSegura<EntradaQuiniela,ResultadoOperacionQuiniela>(async solicitud=>({...await quinielaService.operar(solicitud),accion:solicitud.p_accion,fecha:typeof solicitud.p_datos.fecha==='string'?solicitud.p_datos.fecha:null}),{alExito});
}
