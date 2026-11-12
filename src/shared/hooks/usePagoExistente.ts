import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { pagosService, type TipoPago } from '../lib/pagos.service';
import { useRevision } from './useSesion';

/** Fecha, medio y detalle del pago que se está por editar. La revisión nueva lo vuelve a pedir sola. */
export function usePagoExistente(tipo: TipoPago, id: string, indice: number | null = null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['pagos', 'pago', revision, tipo, id, indice],
    queryFn: () => pagosService.obtenerPago(revision!, tipo, id, indice),
    enabled: revision !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** Datos del cobro que se está por editar. */
export function useCobroExistente(id: string | null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['pagos', 'cobro', revision, id],
    queryFn: () => pagosService.obtenerCobro(revision!, id!),
    enabled: revision !== null && id !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
