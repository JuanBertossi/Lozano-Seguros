import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOperacionSegura, type PuenteOperacion } from './useOperacionSegura';
import { sociosService, type ResultadoSocio, type SolicitudSocio } from '../lib/socios.service';

export function useProximoNumeroSocio(revision: number | null) {
  return useQuery({
    queryKey: ['socios', 'proximo-numero', revision],
    queryFn: () => sociosService.proximoNumero(revision!),
    enabled: revision !== null,
    retry: false,
  });
}

type EntradaSocio = SolicitudSocio extends infer S
  ? S extends SolicitudSocio ? Omit<S, 'p_revision' | 'p_operacion'> : never : never;

export function useOperacionSocioSegura(puente: PuenteOperacion<ResultadoSocio>) {
  const queryClient = useQueryClient();
  const operacion = useMutation({
    mutationFn: (solicitud: SolicitudSocio) => sociosService.guardar(solicitud),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['estado-agencia'], refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: ['socios'], refetchType: 'none' }),
      ]);
    },
  });
  return useOperacionSegura<EntradaSocio, ResultadoSocio>(puente, operacion.mutateAsync);
}
