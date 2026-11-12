import { rpc } from '../lib/supabase.service';
import { useOperacionSegura } from './useOperacionSegura';
export interface ResultadoPagoQuiniela { revision:number; ids:string[]; liberado:number }
export interface EntradaPagoQuiniela { p_id:string; p_accion:'editar_pago'|'anular_pago'|'anular'; p_datos:Record<string,unknown> }
interface SolicitudPagoQuiniela extends EntradaPagoQuiniela { p_revision:number; p_operacion:string }
interface Opciones { alExito?:(resultado:ResultadoPagoQuiniela)=>void }
/** Cambios de pago de una jugada de Quiniela (editar pago, anular pago, anular). */
export function usePagoQuiniela(opciones:Opciones={}) {
 return useOperacionSegura<EntradaPagoQuiniela,ResultadoPagoQuiniela>((solicitud:SolicitudPagoQuiniela)=>rpc<ResultadoPagoQuiniela>('agencia_quiniela_operar',solicitud),opciones);
}
