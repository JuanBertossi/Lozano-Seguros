import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useOperacionSegura } from '../../../shared/hooks/useOperacionSegura';
import { useRevision } from '../../../shared/hooks/useSesion';
import { avisar } from '../../../shared/stores/avisos.store';
import { chequesService, type EntradaCheque } from '../api/cheques.service';
import { presentarCheques } from '../lib/chequesVista';

export interface ResultadoCheque { revision: number; estado: EntradaCheque['p_estado'] }

export function useListadoCheques() {
  const revision = useRevision();
  return useQuery({
    queryKey: ['cheques', 'listado', revision],
    queryFn: () => chequesService.listar(revision!),
    enabled: revision !== null,
    select: presentarCheques,
    placeholderData: keepPreviousData,
  });
}

export function useEstadoCheque() {
  return useOperacionSegura<EntradaCheque, ResultadoCheque>(
    async (solicitud) => ({ revision: await chequesService.actualizar(solicitud), estado: solicitud.p_estado }),
    { alExito: ({ estado }) => avisar(estado === 'rechazado' ? 'Cheque rechazado · cobro revertido' : 'Estado actualizado') },
  );
}
