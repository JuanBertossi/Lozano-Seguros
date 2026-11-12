import { useQuery } from '@tanstack/react-query';
import { useOperacionSegura } from './useOperacionSegura';
import { useRevision } from './useSesion';
import { sociosService, type ResultadoSocio, type SolicitudSocio } from '../lib/socios.service';

export function useProximoNumeroSocio(habilitado = true) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['socios', 'proximo-numero', revision],
    queryFn: () => sociosService.proximoNumero(revision!),
    enabled: habilitado && revision !== null,
    retry: false,
  });
}

type EntradaSocio = SolicitudSocio extends infer S
  ? S extends SolicitudSocio ? Omit<S, 'p_revision' | 'p_operacion'> : never : never;

/** Alta, edición, baja y alta rápida de socios. `alExito` recibe el resultado una vez que la pantalla ya tiene los datos nuevos. */
export function useOperacionSocioSegura(alExito?: (resultado: ResultadoSocio) => void) {
  return useOperacionSegura<EntradaSocio, ResultadoSocio>(sociosService.guardar, { alExito });
}
