import { rpc } from '../lib/supabase.service';
import { useOperacionSegura } from './useOperacionSegura';
export interface ResultadoPagoQuini { revision:number; liberado:number }
export interface EntradaPagoQuini { p_id:string; p_accion:'editar_pago'|'anular_pago'|'marcar'|'desmarcar'|'anular'; p_datos:Record<string,unknown> }
interface SolicitudPagoQuini extends EntradaPagoQuini { p_revision:number; p_operacion:string }
interface Opciones { alExito?:(resultado:ResultadoPagoQuini)=>void }
/** Cambios de pago de una jugada de Quini (editar pago, anular pago, marcar, desmarcar, anular). */
export function usePagoQuini(opciones:Opciones={}) {
 return useOperacionSegura<EntradaPagoQuini,ResultadoPagoQuini>((solicitud:SolicitudPagoQuini)=>rpc<ResultadoPagoQuini>('agencia_quini_pago',solicitud),opciones);
}
