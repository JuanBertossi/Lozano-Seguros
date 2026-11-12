import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useOperacionSegura } from '../../../shared/hooks/useOperacionSegura';
import { useRevision } from '../../../shared/hooks/useSesion';
import { guardarConfiguracion, leerAjustes, reiniciarAgencia, restaurarRespaldo, type ConfiguracionEntrada } from '../api/ajustes.service';

type Opciones = { alExito?: (resultado: { revision: number }) => void };

/** Precios, sorteos, días de Toto y usuarios: lo que `publicarAjustes` armaba con el blob. */
export function useAjustes() {
  const revision = useRevision();
  return useQuery({ queryKey: ['ajustes', revision], queryFn: () => leerAjustes(revision!), enabled: revision !== null, placeholderData: keepPreviousData, retry: false });
}

export function useConfiguracion(opciones: Opciones = {}) {
  return useOperacionSegura<ConfiguracionEntrada, { revision: number }>(guardarConfiguracion, opciones);
}

export function useReiniciarAgencia(opciones: Opciones = {}) {
  return useOperacionSegura<object, { revision: number }>(reiniciarAgencia, opciones);
}

export function useRestaurarRespaldo(opciones: Opciones = {}) {
  return useOperacionSegura<{ p_estado: Record<string, unknown> }, { revision: number }>(restaurarRespaldo, opciones);
}
