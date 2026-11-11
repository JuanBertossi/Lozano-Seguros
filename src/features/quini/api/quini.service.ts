import { rpc } from '../../../shared/lib/supabase.service';
export interface ResultadoQuini { revision:number; id:string; liberado?:number }
export interface SolicitudQuini { p_revision:number; p_operacion:string; p_accion:'crear'|'editar'|'eliminar'; p_id:string|null; p_datos:Record<string,unknown> }
export interface SolicitudPreviaQuini { p_revision:number; p_fecha:string; p_cantidad:number }
export interface PreviaQuini { precio:number; cantidad:number; total:number }
export interface SolicitudPlanQuini { p_revision:number; p_operacion:string; p_socio_id:string; p_accion:'guardar'|'auto'|'dia'; p_datos:Record<string,unknown> }
export const quiniService={
 jugada:(solicitud:SolicitudQuini)=>rpc<ResultadoQuini>('agencia_quini_jugada',solicitud),
 especial:(solicitud:SolicitudQuini)=>rpc<ResultadoQuini>('agencia_quini_especial',solicitud),
 prever:(solicitud:SolicitudPreviaQuini)=>rpc<PreviaQuini>('agencia_quini_prever',solicitud),
 plan:(solicitud:SolicitudPlanQuini)=>rpc<ResultadoQuini>('agencia_quini_plan',solicitud),
};
