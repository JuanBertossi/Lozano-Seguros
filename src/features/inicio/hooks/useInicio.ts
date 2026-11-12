import { useQuery } from '@tanstack/react-query';
import { depositarCheque, leerInicio } from '../api/inicio.service';
import { presentarInicio } from '../lib/inicioVista';
import { useOperacionSegura } from '../../../shared/hooks/useOperacionSegura';
import { useRevision } from '../../../shared/hooks/useSesion';
import { avisar } from '../../../shared/stores/avisos.store';

export function useInicio() {
  const revision = useRevision();
  return useQuery({ queryKey: ['inicio', revision], queryFn: () => leerInicio(revision!), select: presentarInicio, enabled: revision !== null, retry: false });
}

export function useDepositarCheque() {
  return useOperacionSegura<{ p_referencia: string }, { revision: number }>(depositarCheque, { alExito: () => avisar('Estado actualizado') });
}
