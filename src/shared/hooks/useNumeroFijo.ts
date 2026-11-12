import { useQuery } from '@tanstack/react-query';
import { rpc } from '../lib/supabase.service';
import { useOperacionSegura } from './useOperacionSegura';

export interface ResultadoNumeroFijo { revision: number }
export interface EntradaNumeroFijo { p_socio_id: string; p_accion: 'agregar' | 'quitar'; p_numero: string | null; p_fracciones: number | null; p_indice: number | null }
export interface LoteriaSocioListado {
  fijos: { numero: string; frac: number }[];
  filas: { venta: { id: string; numero: string; frac: number; pagado: boolean; abono?: number }; sorteo: string; fraccionesSorteo: number | null; importe: number; restante: number }[];
}

export function useLoteriaSocio(revision: number | null, socioId: string | null) {
  return useQuery({
    queryKey: ['loteria', 'socio', revision, socioId],
    queryFn: () => rpc<LoteriaSocioListado>('agencia_loteria_socio_listar', { p_revision: revision, p_socio_id: socioId }),
    enabled: revision !== null && socioId !== null,
    retry: false,
  });
}

export function useNumeroFijo(opciones: { alExito?: (resultado: ResultadoNumeroFijo) => void } = {}) {
  return useOperacionSegura<EntradaNumeroFijo, ResultadoNumeroFijo>((solicitud) => rpc<ResultadoNumeroFijo>('agencia_loteria_numero_fijo', solicitud), opciones);
}
