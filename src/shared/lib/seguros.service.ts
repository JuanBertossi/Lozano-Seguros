import { rpc } from './supabase.service';

export type AccionSeguro = 'crear'|'editar'|'pagar_cuota'|'quitar_pago'|'anular_cuota'|'eliminar';
export interface SolicitudSeguro { p_revision:number; p_operacion:string; p_accion:AccionSeguro; p_id:string|null; p_datos:Record<string, unknown> }
export interface ResultadoSeguro { revision:number; id:string; liberado:number }
export interface SolicitudCuotas { p_revision:number; p_ingreso:string; p_plan:string; p_valor:number; p_id:string|null }
export interface CuotaSeguro { n:number; venc:string; imp:number; pago:string|null; medio:string; det?:Record<string,string>|null; abono?:number; anulado?:boolean; vencida?:boolean }
export interface SeguroListado {
  id:string; sid:string; socio:string; ingreso:string; venc:string; descripcion:string; plan:string; valor:number; autor:string;
  dias:number; vencido:boolean; vencePronto:boolean; pagado:boolean; primeraPendiente:number|null; totalVencido:number; cuotas:CuotaSeguro[];
}

export const segurosService = {
  prever: (solicitud:SolicitudCuotas) => rpc<{cuotas:CuotaSeguro[]; vencimientoSugerido:string}>('agencia_seguro_prever', solicitud),
  operar: (solicitud:SolicitudSeguro) => rpc<ResultadoSeguro>('agencia_seguro_operar', solicitud),
  listar: (revision:number, socioId:string|null) => rpc<SeguroListado[]>('agencia_seguros_listar',{p_revision:revision,p_socio_id:socioId}),
};
