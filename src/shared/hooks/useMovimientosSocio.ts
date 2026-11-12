import { useQuery } from '@tanstack/react-query';
import { rpc } from '../lib/supabase.service';
import { useRevision } from './useSesion';

export interface DetallePagoSocio { banco?:string;nro?:string;librador?:string;fcobro?:string;dep?:string }
export interface RegistroMovimiento { id:string;desc?:string;nro?:string;numero?:string;numeros?:string;modo?:string;ncuotas?:number;cuotas?:unknown[];frac?:number;fecha?:string;desde?:string;medio?:string;fpago?:string;det?:DetallePagoSocio|null;medios?:string[];dets?:(DetallePagoSocio|null)[];abonos?:(number|null)[];abono?:number;auto?:boolean;por?:string;modPor?:string;modTs?:string;monto?:number;usado?:number;quedo?:number }
export interface MovimientoServidor { tipo:'seg'|'q6'|'lot'|'qui'|'rifa'|'pago';fecha:string;hora:string;ref:(string|number)[];importe:number;pagado:boolean;futuro:boolean;registro:RegistroMovimiento|null;origen:RegistroMovimiento;cuota?:{n:number;venc:string;imp:number;abono?:number;pago?:string|null;medio?:string;det?:DetallePagoSocio|null};indice?:number;vencimiento?:string;pago?:string|null;especial?:boolean;sorteo?:{nombre?:string;fecha?:string;frac?:number};cobroUnico?:RegistroMovimiento;completos?:number;parciales?:number }
export interface MovimientosSocio { grupos:{fecha:string;debe:number;cobrado:number;filas:MovimientoServidor[]}[];cantidad:number;cuenta:{favor:number;debe:number;aFavor:number};hoy:string;ayer:string }

export function useMovimientosSocio(socioId: string | null, filtro: 'todo' | 'debe') {
  const revision = useRevision();
  return useQuery({
    queryKey: ['socios', 'movimientos', revision, socioId, filtro],
    queryFn: () => rpc<MovimientosSocio>('agencia_socio_movimientos', { p_revision: revision, p_socio_id: socioId, p_filtro: filtro }),
    // Al cambiar la revisión se sigue mostrando lo anterior hasta que llegan los datos nuevos (no se pierde el scroll).
    placeholderData: (previo, consultaPrevia) => (consultaPrevia?.queryKey.includes(socioId) && consultaPrevia.queryKey.includes(filtro) ? previo : undefined),
    enabled: revision !== null && socioId !== null,
    retry: false,
  });
}
