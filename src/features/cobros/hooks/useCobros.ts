import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cobrosService, type RegistrarCobroServidor, type SolicitudCobroServidor } from '../api/cobros.service';

export function useVistaPreviaCobro(solicitud: SolicitudCobroServidor | null) {
  return useQuery({
    queryKey: ['cobros', 'vista-previa', solicitud],
    queryFn: () => cobrosService.prever(solicitud!),
    enabled: solicitud !== null,
    retry: false,
  });
}

export function useRegistrarCobro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (solicitud: RegistrarCobroServidor) => cobrosService.registrar(solicitud),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['estado-agencia'] }),
        queryClient.invalidateQueries({ queryKey: ['cobros', 'vista-previa'] }),
      ]);
    },
  });
}
