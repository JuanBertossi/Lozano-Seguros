import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useOperacionSegura } from '../../../shared/hooks/useOperacionSegura';
import { useRevision } from '../../../shared/hooks/useSesion';
import { cobrosService, type RegistrarCobroServidor } from '../api/cobros.service';

/** Cuenta, conceptos y selección inicial del socio para el diálogo "Registrar cobro". */
export function useDatosCobro(socioId: string, solo: string | null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['cobros', 'datos', revision, socioId, solo],
    queryFn: () => cobrosService.datos(revision!, socioId, solo),
    enabled: revision !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export interface SolicitudPrevia {
  socioId: string;
  seleccion: string[];
  prioridad: string;
  usarFavor: boolean;
  monto: number | null;
}

/** Simulación del servidor con lo seleccionado; `null` la deja en espera (monto inválido o todavía cambiando). */
export function useVistaPreviaCobro(solicitud: SolicitudPrevia | null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['cobros', 'vista-previa', revision, solicitud],
    queryFn: () => cobrosService.prever({
      p_revision: revision!, p_socio_id: solicitud!.socioId, p_seleccion: solicitud!.seleccion,
      p_prioridad: solicitud!.prioridad, p_usar_favor: solicitud!.usarFavor, p_monto: solicitud!.monto,
    }),
    enabled: revision !== null && solicitud !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useRegistrarCobro(alExito: () => void) {
  return useOperacionSegura<RegistrarCobroServidor, number>((entrada) => cobrosService.registrar(entrada), { alExito });
}
