import { rpc } from '../lib/supabase.service';
import { useOperacionSegura } from './useOperacionSegura';

export interface ResultadoSorteo { revision: number; id: string }
export interface EntradaSorteo { p_accion: 'crear' | 'editar' | 'eliminar'; p_id: string | null; p_datos: Record<string, unknown> }

export function useSorteoOperacion(opciones: { alExito?: (resultado: ResultadoSorteo) => void } = {}) {
  return useOperacionSegura<EntradaSorteo, ResultadoSorteo>((solicitud) => rpc<ResultadoSorteo>('agencia_loteria_sorteo', solicitud), opciones);
}
