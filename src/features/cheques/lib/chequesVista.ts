import { fechaCorta } from '../../../shared/lib/fechas';
import type { ChequeServidor, EntradaCheque } from '../api/cheques.service';

export type EstadoCheque = EntradaCheque['p_estado'];
export interface ChequeVista {
  id: string; numero: string; banco: string; socio: string; medio: string; fecha: string; monto: string;
  estado: EstadoCheque; anulado: boolean; rechazoAplicado: boolean; depositado: boolean;
}

export const estadosCheque: Record<EstadoCheque, string> = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' };
const medios: Record<string, string> = { echeq: 'E-cheq', cheque: 'Cheque físico' };

const moneda = (valor: number) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: Number.isInteger(valor) ? 0 : 2,
  maximumFractionDigits: Number.isInteger(valor) ? 0 : 2,
}).format(valor);

export const presentarCheques = (cheques: ChequeServidor[]): ChequeVista[] =>
  cheques.map((cheque) => ({ ...cheque, medio: medios[cheque.medio] ?? cheque.medio, fecha: fechaCorta(cheque.fecha), monto: moneda(cheque.monto) }));
