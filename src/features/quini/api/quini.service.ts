import { rpc } from '../../../shared/lib/supabase.service';
export interface ResultadoQuini { revision:number; id:string; liberado?:number }
export interface SolicitudQuini { p_revision:number; p_operacion:string; p_accion:'crear'|'editar'|'eliminar'; p_id:string|null; p_datos:Record<string,unknown> }
export interface SolicitudPreviaQuini { p_revision:number; p_fecha:string; p_cantidad:number }
export interface PreviaQuini { precio:number; cantidad:number; total:number }
export interface SolicitudPlanQuini { p_revision:number; p_operacion:string; p_socio_id:string; p_accion:'guardar'|'auto'|'dia'; p_datos:Record<string,unknown> }
export interface EspecialQuini { id:string; nombre:string; fecha:string; precio:number }
export interface CalendarioQuini { hoy:string; proximo:string|null; dias:number[]; fechas:string[]; especiales:EspecialQuini[] }
export interface SocioOpcion { id:string; nombre:string; nro:string }
export interface FormularioQuini { jugada:{id:string;sid:string;fecha:string;monto:number;pagado:boolean}|null; cantidad:number; socios:SocioOpcion[] }
export interface PlanSocioQuini { dias:number[]; cantidad:number }
export interface ListadoQuini {
 fecha:string;dias:number;precio:number;especial:string;precioComun:number;cantidad:number;total:number;cobrado:number;falta:number;cobradoFiltrado:number;faltaFiltrado:number;
 filas:{jugada:{id:string;sid:string;auto?:boolean;monto:number;pagado:boolean;abono?:number;por?:string;modPor?:string;modTs?:string};socio:string;restante:number;nombreAutor:string;nombreEditor:string}[];
 fijos:{id:string;nombre:string;dias:number[];cantidad:number;semanal:number}[];eseDia:string[];especiales:EspecialQuini[];
}
export const quiniService={
 generar:(solicitud:{p_revision:number;p_operacion:string})=>rpc<number>('agencia_generar_quini',solicitud),
 jugada:(solicitud:SolicitudQuini)=>rpc<ResultadoQuini>('agencia_quini_jugada',solicitud),
 especial:(solicitud:SolicitudQuini)=>rpc<ResultadoQuini>('agencia_quini_especial',solicitud),
 prever:(solicitud:SolicitudPreviaQuini)=>rpc<PreviaQuini>('agencia_quini_prever',solicitud),
 plan:(solicitud:SolicitudPlanQuini)=>rpc<ResultadoQuini>('agencia_quini_plan',solicitud),
 listar:(revision:number,fecha:string,filtro:string)=>rpc<ListadoQuini>('agencia_quini_listar',{p_revision:revision,p_fecha:fecha,p_filtro:filtro}),
 fechas:(revision:number)=>rpc<CalendarioQuini>('agencia_quini_fechas',{p_revision:revision}),
 formulario:(revision:number,id:string|null,socioId:string|null)=>rpc<FormularioQuini>('agencia_quini_formulario',{p_revision:revision,p_id:id,p_socio_id:socioId}),
 planSocio:(revision:number,socioId:string)=>rpc<PlanSocioQuini>('agencia_quini_plan_leer',{p_revision:revision,p_socio_id:socioId}),
};
