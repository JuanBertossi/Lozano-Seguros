import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { totoService, type AccionToto, type OperacionToto, type PeriodoToto, type SolicitudVistaToto } from '../api/toto.service';
import { useOperacionSegura } from '../../../shared/hooks/useOperacionSegura';
import { useRevision } from '../../../shared/hooks/useSesion';

/** Meses disponibles, hoy, porcentaje y nombre de la agencia. */
export function usePeriodosToto() {
  const revision = useRevision();
  return useQuery({
    queryKey: ['toto', 'periodos', revision],
    queryFn: () => totoService.periodos(revision!),
    enabled: revision !== null,
    placeholderData: keepPreviousData,
  });
}

export function useListadoToto(periodo: { periodo: PeriodoToto; valor: string } | null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['toto', 'listado', revision, periodo],
    queryFn: () => totoService.listar({ p_revision: revision!, p_periodo: periodo!.periodo, p_valor: periodo!.valor }),
    enabled: revision !== null && periodo !== null,
    placeholderData: keepPreviousData,
  });
}

/** Una planilla guardada con su cálculo (diálogos de edición y de pagos). */
export function usePlanillaToto(id: string | null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['toto', 'planilla', revision, id],
    queryFn: () => totoService.planilla(revision!, id!),
    enabled: revision !== null && id !== null,
    placeholderData: keepPreviousData,
  });
}

/** Cálculo y concursos sugeridos mientras se completa el formulario. */
export function useVistaToto(solicitud: Omit<SolicitudVistaToto, 'p_revision'> | null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['toto', 'vista-previa', revision, solicitud],
    queryFn: () => totoService.prever({ ...solicitud!, p_revision: revision! }),
    enabled: revision !== null && solicitud !== null,
    placeholderData: keepPreviousData,
  });
}

type EntradaToto = Pick<OperacionToto, 'p_accion' | 'p_id' | 'p_datos'>;
export interface ResultadoToto { revision: number; accion: AccionToto; fecha: string | null }

export function useOperacionToto(alExito: (resultado: ResultadoToto) => void) {
  return useOperacionSegura<EntradaToto, ResultadoToto>(
    async (solicitud) => ({
      revision: await totoService.operar(solicitud),
      accion: solicitud.p_accion,
      fecha: typeof solicitud.p_datos.fecha === 'string' ? solicitud.p_datos.fecha : null,
    }),
    { alExito },
  );
}
