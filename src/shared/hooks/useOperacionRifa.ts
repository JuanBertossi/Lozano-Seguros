import { keepPreviousData,useQuery } from '@tanstack/react-query';
import { rpc } from '../lib/supabase.service';
import { monedaRifa } from '../lib/rifaVista';
import { useOperacionSegura } from './useOperacionSegura';
import { avisar } from '../stores/avisos.store';
import { useDialogos } from '../stores/dialogos.store';
import { useNavegacion } from '../stores/navegacion.store';
type AccionOperarRifa='pagar_cuota'|'quitar_pago'|'anular_pago'|'anular_cuota'|'eliminar';
export interface ResultadoRifa { revision:number; id:string; liberado?:number; anio?:number }
export type ResultadoOperacionRifa = ResultadoRifa & { accion:'guardar'|AccionOperarRifa };
export type EntradaRifa = {tipo:'guardar';p_id:string|null;p_datos:Record<string,unknown>} | {tipo:'operar';p_accion:AccionOperarRifa;p_id:string;p_datos:Record<string,unknown>};
type SolicitudRifa=EntradaRifa & {p_revision:number;p_operacion:string};
export interface RifaListado {
 filas:{rifa:{id:string;sid:string;anio:number;nro:string;modo:string;ncuotas:number;importe:number};socio:string;pagado:number;saldo:number;saldada:boolean;vencido:boolean;primera:number;pagas:number;cuotas:{indice:number;importe:number;vencimiento:string;pago:string|null;pagada:boolean;vencida:boolean}[]}[];
 cantidad:number;total:number;cobrado:number;falta:number;cobradoFiltrado:number;faltaFiltrado:number;precio:number;ncuotas:number;cuota:number;
}
export interface ContextoRifa { anios:number[]; autores:Record<string,string> }
export function useListadoRifa(revision:number|null,anio:number|null,socioId:string|null,filtro='todos'){
 return useQuery({
  queryKey:['rifa','listado',revision,anio,socioId,filtro],
  queryFn:()=>rpc<RifaListado>('agencia_rifa_listar',{p_revision:revision,p_anio:anio,p_socio_id:socioId,p_filtro:filtro}),
  // Al confirmarse una operación o cambiar el filtro se muestra lo anterior hasta que llegue lo nuevo.
  placeholderData:(previo,consulta)=>consulta?.queryKey[3]===anio&&consulta?.queryKey[4]===socioId?previo:undefined,
  enabled:revision!==null,retry:false,
 });
}
/** Años con rifas (más el actual) y "cargó/editó" de cada rifa, para el selector de año y la tabla. */
export function useContextoRifa(revision:number|null){
 return useQuery({queryKey:['rifa','contexto',revision],queryFn:()=>rpc<ContextoRifa>('agencia_rifa_contexto',{p_revision:revision}),placeholderData:keepPreviousData,enabled:revision!==null,retry:false});
}
/** Mensajes de la maqueta (`done(...)`) y el aviso de saldo a favor 2,5 s después; al guardar elige el año de la rifa. */
export function avisarResultadoRifa({accion,liberado=0,anio}:ResultadoOperacionRifa){
 if(anio!==undefined)useNavegacion.getState().elegirAnioRifa(anio);
 avisar(accion==='guardar'?'Rifa guardada':accion==='pagar_cuota'?'Pago guardado':accion==='eliminar'?'Eliminado':accion==='anular_cuota'?'Movimiento anulado':'Pago quitado');
 if(liberado>0){
  const monto=monedaRifa(liberado);
  setTimeout(()=>avisar(accion==='eliminar'?`Lo que ya había pagado (${monto}) quedó como saldo a favor`:`${monto} quedaron como saldo a favor`),2500);
 }
}
function ejecutarRifa(solicitud:SolicitudRifa):Promise<ResultadoOperacionRifa>{
 const {p_revision,p_operacion,p_datos}=solicitud;
 if(solicitud.tipo==='guardar')return rpc<ResultadoRifa>('agencia_rifa_guardar',{p_revision,p_operacion,p_id:solicitud.p_id,p_datos}).then(r=>({...r,accion:'guardar' as const}));
 const accion=solicitud.p_accion;
 return rpc<ResultadoRifa>('agencia_rifa_operar',{p_revision,p_operacion,p_accion:accion,p_id:solicitud.p_id,p_datos}).then(r=>({...r,accion}));
}
/** Guardar, eliminar, pagar o quitar el pago de una rifa. Sin `alExito`: cierra el diálogo abierto y avisa como la maqueta. */
export function useOperacionRifa(opciones:{alExito?:(resultado:ResultadoOperacionRifa)=>void}={}){
 return useOperacionSegura<EntradaRifa,ResultadoOperacionRifa>(ejecutarRifa,{alExito:opciones.alExito??((resultado)=>{useDialogos.getState().cerrar();avisarResultadoRifa(resultado)})});
}
