import { useQuery } from '@tanstack/react-query';
import { useRevision } from '../../../shared/hooks/useSesion';
import { presentarSeguro } from '../../../shared/lib/presentarSeguro';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { listarSegurosSocio } from '../api/socios.service';

export function useSegurosDeSocio(socioId: string) {
  const revision = useRevision();
  const abrir = useDialogos((estado) => estado.abrir);
  const listado = useQuery({
    queryKey: ['socios', 'seguros', revision, socioId],
    queryFn: () => listarSegurosSocio(revision!, socioId),
    select: (seguros) => seguros.map((seguro) => presentarSeguro(seguro)),
    placeholderData: (previo, consultaPrevia) => (consultaPrevia?.queryKey.includes(socioId) ? previo : undefined),
    enabled: revision !== null,
    retry: false,
  });
  return {
    seguros: listado.data,
    mensaje: listado.error instanceof Error ? listado.error.message : 'Cargando seguros…',
    agregar: () => abrir({ tipo: 'seguro', sid: socioId }),
    editar: (id: string) => abrir({ tipo: 'seguro', id }),
    cuota: (id: string, indice: number) => abrir({ tipo: 'pagoSeguro', id, cuota: indice }),
    cobrar: (id: string, indice?: number) => { if (indice !== undefined) abrir({ tipo: 'cobro', sid: socioId, solo: `seg|${id}|${indice}` }); },
  };
}
