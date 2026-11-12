import { rpc } from '../lib/supabase.service';
import { useOperacionSegura } from './useOperacionSegura';

export interface ResultadoPagoLoteria { revision: number; liberado: number }
export interface EntradaPagoLoteria { p_id: string; p_accion: 'editar_pago' | 'anular_pago' | 'marcar' | 'desmarcar' | 'anular'; p_datos: Record<string, unknown> }

export function usePagoLoteria(opciones: { alExito?: (resultado: ResultadoPagoLoteria) => void } = {}) {
  return useOperacionSegura<EntradaPagoLoteria, ResultadoPagoLoteria>((solicitud) => rpc<ResultadoPagoLoteria>('agencia_loteria_pago', solicitud), opciones);
}
