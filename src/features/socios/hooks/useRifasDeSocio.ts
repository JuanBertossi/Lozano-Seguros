import { useQuery } from '@tanstack/react-query';
import { useRevision } from '../../../shared/hooks/useSesion';
import { mapearFilaRifa } from '../../../shared/lib/rifaVista';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { listarRifasSocio } from '../api/socios.service';

export function useRifasDeSocio(socioId: string) {
  const revision = useRevision();
  const abrir = useDialogos((estado) => estado.abrir);
  const listado = useQuery({
    queryKey: ['socios', 'rifas', revision, socioId],
    queryFn: () => listarRifasSocio(revision!, socioId),
    select: ({ filas }) => filas.map((fila) => mapearFilaRifa(fila)),
    placeholderData: (previo, consultaPrevia) => (consultaPrevia?.queryKey.includes(socioId) ? previo : undefined),
    enabled: revision !== null,
    retry: false,
  });
  return {
    filas: listado.data,
    mensaje: listado.error instanceof Error ? listado.error.message : 'Cargando rifas…',
    agregar: () => abrir({ tipo: 'rifa', sid: socioId }),
    editar: (id: string) => abrir({ tipo: 'rifa', id }),
    cuotaPago: (id: string, cuota: number) => abrir({ tipo: 'pagoRifa', id, cuota }),
    cobrar: (id: string, cuota: number) => abrir({ tipo: 'cobro', sid: socioId, solo: `rifa|${id}|${cuota}` }),
  };
}
