import { useQuery } from '@tanstack/react-query';
import { rpc } from '../lib/supabase.service';
import { useRevision } from './useSesion';

export interface JugadaSocio { jugada:{id:string;fecha:string;numeros?:string;auto?:boolean;monto:number;pagado:boolean;abono?:number};especial:boolean;restante:number }

export function useJugadasSocio(socioId: string | null, tipo: 'q6' | 'quiniela') {
  const revision = useRevision();
  return useQuery({
    queryKey: ['socios', 'jugadas', tipo, revision, socioId],
    queryFn: () => rpc<JugadaSocio[]>('agencia_jugadas_socio_listar', { p_revision: revision, p_socio_id: socioId, p_tipo: tipo }),
    // Al cambiar la revisión se sigue mostrando lo anterior hasta que llegan los datos nuevos (no se pierde el scroll).
    placeholderData: (previo, consultaPrevia) => (consultaPrevia?.queryKey.includes(socioId) ? previo : undefined),
    enabled: revision !== null && socioId !== null,
    retry: false,
  });
}
