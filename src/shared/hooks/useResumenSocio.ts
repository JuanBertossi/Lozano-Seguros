import { useQuery } from '@tanstack/react-query';
import { rpc } from '../lib/supabase.service';
import { useRevision } from './useSesion';

export interface ResumenSocio { deuda:number;favor:number;debe:number;aFavor:number;proximo:number;productos:{tipo:string;monto:number}[];conteos:Record<string,number> }

export function useResumenSocio(socioId: string | null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['socios', 'resumen', revision, socioId],
    queryFn: () => rpc<ResumenSocio>('agencia_socio_resumen', { p_revision: revision, p_socio_id: socioId }),
    // Al cambiar la revisión se sigue mostrando lo anterior hasta que llegan los datos nuevos (no se pierde el scroll).
    placeholderData: (previo, consultaPrevia) => (consultaPrevia?.queryKey.includes(socioId) ? previo : undefined),
    enabled: revision !== null && socioId !== null,
    retry: false,
  });
}
