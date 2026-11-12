import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRevision } from '../../../shared/hooks/useSesion';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { leerFicha, listarSocios } from '../api/socios.service';
import { presentarListadoSocios } from '../lib/listadoSocios';

export * from '../../../shared/hooks/useSociosOperacion';

export function useListadoSocios() {
  const revision = useRevision();
  return useQuery({
    queryKey: ['socios', 'listado', revision],
    queryFn: () => listarSocios(revision!),
    select: presentarListadoSocios,
    placeholderData: keepPreviousData,
    enabled: revision !== null,
    retry: false,
  });
}

// Si el socio abierto ya no existe (lo eliminaron), la ficha vuelve al listado y se cierran sus diálogos.
function alDesaparecerSocio(socioId: string) {
  const navegacion = useNavegacion.getState();
  if (navegacion.pagina === 'socio' && navegacion.socioId === socioId) navegacion.volverASocios();
  const { dialogo, cerrar } = useDialogos.getState();
  if ((dialogo?.tipo === 'socio' && dialogo.id === socioId) || (dialogo?.tipo === 'whatsapp' && dialogo.sid === socioId)) cerrar();
}

export function useFichaSocio(socioId: string | null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['socios', 'ficha', revision, socioId],
    queryFn: async () => {
      const ficha = await leerFicha(revision!, socioId!);
      if (!ficha) alDesaparecerSocio(socioId!);
      return ficha;
    },
    placeholderData: (previo, consultaPrevia) => (consultaPrevia?.queryKey.includes(socioId) ? previo : undefined),
    enabled: revision !== null && socioId !== null,
    retry: false,
  });
}
