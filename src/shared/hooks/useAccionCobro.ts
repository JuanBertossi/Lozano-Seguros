import { rpc } from '../lib/supabase.service';
import { useOperacionSegura } from './useOperacionSegura';

export interface ResultadoAccionCobro { revision: number }
export type EntradaAccionCobro =
  | { tipo: 'editar'; p_cobro_id: string; p_monto: number; p_fecha: string; p_medio: string; p_detalle: Record<string, string> | null }
  | { tipo: 'anular'; p_cobro_id: string };
interface Opciones { alExito?: (resultado: ResultadoAccionCobro) => void }

/** Edita (`agencia_editar_cobro`) o anula (`agencia_anular_cobro`) un cobro ya registrado. */
export function useAccionCobro(opciones: Opciones = {}) {
  return useOperacionSegura<EntradaAccionCobro, ResultadoAccionCobro>(
    async ({ tipo, ...solicitud }) => ({
      revision: await rpc<number>(tipo === 'editar' ? 'agencia_editar_cobro' : 'agencia_anular_cobro', solicitud),
    }),
    opciones,
  );
}
