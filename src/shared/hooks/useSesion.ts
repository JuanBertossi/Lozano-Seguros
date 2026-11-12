import { useQuery } from '@tanstack/react-query';
import { claveSesion, leerSesion, queryClient, type Sesion } from '../lib/supabase.service';
import { useAuth } from '../stores/auth.store';

/** Revisión y perfil de la cuenta. Cada operación confirmada vuelve a leerla y eso refresca todas las pantallas. */
export function useSesion() {
  const ingresado = useAuth((estado) => estado.ingresado);
  return useQuery({ queryKey: claveSesion, queryFn: leerSesion, enabled: ingresado, staleTime: Infinity, retry: false });
}

/** Revisión vigente, o null mientras carga. Las consultas la incluyen en su clave: al cambiar, se vuelven a pedir. */
export function useRevision() {
  return useSesion().data?.revision ?? null;
}

export const obtenerRevision = () => queryClient.getQueryData<Sesion>(claveSesion)?.revision ?? null;

export const recargarSesion = () => queryClient.fetchQuery({ queryKey: claveSesion, queryFn: leerSesion, staleTime: 0 });

/**
 * Toma la revisión nueva del resultado de la operación y evita una llamada extra a `agencia_sesion`.
 * Solo la acepta si avanza: ante un reintento idempotente el servidor devuelve la revisión de la operación
 * original, que puede ser anterior a la vigente; en ese caso se consulta al servidor.
 */
export async function sincronizarRevision(resultado: unknown) {
  const nueva = typeof resultado === 'number' ? resultado : (resultado as { revision?: unknown } | null)?.revision;
  const actual = queryClient.getQueryData<Sesion>(claveSesion);
  if (actual && typeof nueva === 'number' && nueva > actual.revision) {
    queryClient.setQueryData<Sesion>(claveSesion, { ...actual, revision: nueva });
    return;
  }
  await recargarSesion();
}
