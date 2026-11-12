import { useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useListadoSocios } from './useSocios';

export function useListadoSociosPagina() {
  const consulta = useListadoSocios();
  const verSocio = useNavegacion((estado) => estado.verSocio);
  const abrir = useDialogos((estado) => estado.abrir);
  return {
    filas: consulta.data,
    mensaje: consulta.error instanceof Error ? consulta.error.message : 'Cargando socios…',
    hayError: consulta.isError,
    reintentar: () => void consulta.refetch(),
    abrir: verSocio,
    editar: (id?: string) => abrir({ tipo: 'socio', id }),
  };
}
