import type { EntradaAnulacion } from '../api/socios.service';

type Referencia = (string | number)[];

/** Convierte la referencia de un movimiento (`['seg', id, cuota]`, `['q6', id]`...) en la anulación que le corresponde. */
export function entradaAnulacion(ref: Referencia, pago: boolean): EntradaAnulacion | null {
  const [tipo, id, indice] = ref;
  if (tipo === 'cobro') return { tipo, id: String(id) };
  if (tipo === 'seg' || tipo === 'rifa') return { tipo, id: String(id), indice: Number(indice), pago };
  if (tipo === 'lot' || tipo === 'q6' || tipo === 'quiniela') return { tipo, id: String(id), pago };
  return null;
}

export const confirmacionAnular = (pago: boolean) => pago
  ? '¿Anular este pago? Vuelve a quedar como deuda. Si se había pagado con un cobro, esa plata queda como saldo a favor del socio.'
  : '¿Anular este movimiento? Deja de contar en la cuenta del socio. Si tenía algo pagado, esa plata queda como saldo a favor.';

export const confirmacionAnularCobro = (monto: string) => `¿Anular el cobro de ${monto}? Se revertirán los pagos y abonos que quedaron vinculados.`;
