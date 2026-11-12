import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOperacionSegura } from '../../../shared/hooks/useOperacionSegura';
import { useRevision } from '../../../shared/hooks/useSesion';
import { loteriaService, type ResultadoVenta, type SolicitudVenta, type ResultadoEliminarVenta, type SolicitudEliminarVenta, type SolicitudPreviaVenta, type SolicitudAccionLoteria, type ResultadoAccionLoteria } from '../api/loteria.service';

type Opciones<R> = { alExito?: (resultado: R) => void };

/** Sorteos ordenados por fecha y cuál es el actual (el primero que todavía no pasó, o el último). */
export function useSorteosLoteria() {
  const revision = useRevision();
  return useQuery({ queryKey: ['loteria', 'sorteos', revision], queryFn: () => loteriaService.sorteos(revision!), enabled: revision !== null, placeholderData: keepPreviousData, retry: false });
}

/** Datos del formulario de venta. Conserva lo anterior mientras se vuelve a pedir tras un cambio de revisión. */
export function useFormularioVenta(ventaId: string | null, socioId: string | null, sorteoId: string | null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['loteria', 'formulario', revision, ventaId, socioId, sorteoId],
    queryFn: () => loteriaService.formulario(revision!, ventaId, socioId, sorteoId),
    enabled: revision !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function usePreviaVenta(solicitud: SolicitudPreviaVenta | null) {
  return useQuery({ queryKey: ['loteria', 'previa', solicitud], queryFn: () => loteriaService.preverVenta(solicitud!), enabled: solicitud !== null, retry: false });
}

export function useListadoLoteria(revision: number | null, sorteoId: string | null, filtro: string) {
  return useQuery({ queryKey: ['loteria', 'listado', revision, sorteoId, filtro], queryFn: () => loteriaService.listar(revision!, sorteoId!, filtro), enabled: revision !== null && sorteoId !== null,
    // Al cambiar la revisión se muestra lo anterior mientras llega lo nuevo, siempre que sea del mismo sorteo.
    placeholderData: (anterior) => (anterior && anterior.sorteo.id === sorteoId ? anterior : undefined),
    retry: false,
  });
}

/** Primer número fijo del socio (para completar el formulario al elegirlo), o null si no tiene. */
export function useFijoSocio() {
  const cliente = useQueryClient();
  const revision = useRevision();
  return async (socioId: string) => {
    if (revision === null) return null;
    try {
      const datos = await cliente.fetchQuery({ queryKey: ['loteria', 'socio', revision, socioId], queryFn: () => loteriaService.fijosSocio(revision, socioId) });
      return datos.fijos[0] ?? null;
    } catch {
      return null;
    }
  };
}

export function useGuardarVenta(opciones: Opciones<ResultadoVenta>) {
  return useOperacionSegura<Omit<SolicitudVenta, 'p_revision' | 'p_operacion'>, ResultadoVenta>((solicitud) => loteriaService.guardarVenta(solicitud), opciones);
}

export function useEliminarVenta(opciones: Opciones<ResultadoEliminarVenta>) {
  return useOperacionSegura<Omit<SolicitudEliminarVenta, 'p_revision' | 'p_operacion'>, ResultadoEliminarVenta>((solicitud) => loteriaService.eliminarVenta(solicitud), opciones);
}

export function useAccionLoteria(opciones: Opciones<ResultadoAccionLoteria>) {
  return useOperacionSegura<Omit<SolicitudAccionLoteria, 'p_revision' | 'p_operacion'>, ResultadoAccionLoteria>((solicitud) => loteriaService.ejecutar(solicitud), opciones);
}
