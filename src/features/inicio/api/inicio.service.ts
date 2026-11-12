import { rpc } from '../../../shared/lib/supabase.service';

type Producto = 'seg' | 'q6' | 'lot' | 'qui' | 'rifa';
interface Socio { nombre: string }
interface DetalleCheque { banco?: string; nro?: string; librador?: string; fcobro?: string; dep?: string }
export interface InicioServidor {
  hoy: string; total: number; aFavor: number;
  productos: { tipo: Producto; importe: number }[];
  deudores: { sid: string; nombre: string; monto: number; productos: Producto[] }[];
  sorteo: { nombre: string; fecha: string } | null; fracciones: number; compradores: number;
  sinOfrecer: Socio[]; noCompran: Socio[];
  vencimientos: { seguro: { id: string; sid: string; desc: string; venc: string }; socio: string; dias: number }[];
  cheques: { id: string; sid: string; socio: string; medio: string; detalle: DetalleCheque; monto: number; dias: number }[];
}
export const leerInicio = (revision: number) => rpc<InicioServidor>('agencia_inicio', { p_revision: revision });
export const depositarCheque = async (solicitud: { p_revision: number; p_operacion: string; p_referencia: string }) =>
  ({ revision: await rpc<number>('agencia_depositar_cheque', solicitud) });
