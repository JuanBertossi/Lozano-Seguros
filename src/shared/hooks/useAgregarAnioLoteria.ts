import { rpc } from '../lib/supabase.service';
import { useOperacionSegura } from './useOperacionSegura';

export interface ResultadoAnioLoteria { revision: number; cantidad: number }

export function useAgregarAnioLoteria(opciones: { alExito?: (resultado: ResultadoAnioLoteria) => void } = {}) {
  return useOperacionSegura<Record<string, never>, ResultadoAnioLoteria>((solicitud) => rpc<ResultadoAnioLoteria>('agencia_loteria_agregar_anio', solicitud), opciones);
}
