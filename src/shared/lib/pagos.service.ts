import { rpc } from './supabase.service';

export type TipoPago = 'q6' | 'lot' | 'quiniela' | 'rifa' | 'seg';
export type DetalleGuardado = Record<string, unknown> | null;

/** Datos del pago de una jugada, una cuota de rifa o una cuota de seguro (`agencia_pago_obtener`). */
export interface PagoExistente {
  fecha: string | null;
  medio: string;
  det: DetalleGuardado;
  socio: string;
  descripcion?: string;
  nro?: string;
  modo?: string;
  numero?: number;
  total?: number;
  importe?: number;
  vencimiento?: string;
}

/** Cobro registrado que se puede editar (`agencia_cobro_obtener`). */
export interface CobroExistente {
  id: string;
  socioId: string;
  socio: string;
  fecha: string | null;
  medio: string;
  det: DetalleGuardado;
  monto: number;
  quedo: number;
}

export const pagosService = {
  obtenerPago: (revision: number, tipo: TipoPago, id: string, indice: number | null) =>
    rpc<PagoExistente>('agencia_pago_obtener', { p_revision: revision, p_tipo: tipo, p_id: id, p_indice: indice }),
  obtenerCobro: (revision: number, id: string) =>
    rpc<CobroExistente>('agencia_cobro_obtener', { p_revision: revision, p_cobro_id: id }),
  nombreAgencia: () => rpc<string>('agencia_nombre_agencia'),
};
