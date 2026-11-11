import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { totoService, type OperacionToto, type SolicitudListadoToto, type SolicitudVistaToto } from '../api/toto.service';
import { useOperacionSegura, type PuenteOperacion } from '../../../shared/hooks/useOperacionSegura';

export function useVistaToto(solicitud: SolicitudVistaToto | null) {
  return useQuery({
    queryKey: ['toto', 'vista-previa', solicitud],
    queryFn: () => totoService.prever(solicitud!),
    enabled: solicitud !== null,
    retry: false,
  });
}

export function useListadoToto(solicitud: SolicitudListadoToto | null) {
  return useQuery({ queryKey: ['toto','listado',solicitud], queryFn: () => totoService.listar(solicitud!), enabled: solicitud !== null, retry: false });
}

type EntradaToto = Pick<OperacionToto, 'p_accion' | 'p_id' | 'p_datos'>;
export function useOperacionTotoSegura(puente: PuenteOperacion<number>) {
  const operacion = useOperacionToto();
  return useOperacionSegura<EntradaToto, number>(puente, operacion.mutateAsync);
}

export function useOperacionToto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (solicitud: OperacionToto) => totoService.operar(solicitud),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['estado-agencia'], refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: ['toto', 'vista-previa'], refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: ['toto', 'listado'], refetchType: 'none' }),
      ]);
    },
  });
}
