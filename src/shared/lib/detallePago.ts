import type { PagoInput } from '../schemas/pago.schema';
import { hoy } from './fechas';

const mediosValidos = ['efectivo', 'transferencia', 'echeq', 'cheque', 'mp'] as const;
const texto = (valor: unknown) => (typeof valor === 'string' || typeof valor === 'number' ? String(valor) : '');

// El servidor conserva los datos históricos cuando corresponde.
export function prepararDetallePago(datos: PagoInput): Record<string, string> | null {
  if (!datos.cargarDetalle) return null;
  const campos: Record<string, (keyof PagoInput)[]> = {
    cheque: ['banco','nro','librador','fcobro'], echeq: ['banco','nro','librador','fcobro'],
    transferencia: ['banco','nro','librador'], mp: ['nro','librador'],
  };
  const detalle=Object.fromEntries((campos[datos.medio]??[]).flatMap(campo=>{
    const valor=datos[campo]; return typeof valor==='string'&&valor?[[campo,valor]]:[];
  }));
  return Object.keys(detalle).length?detalle:null;
}

/** Valores iniciales del formulario de pago (el `abrirPago` de la maqueta). */
export function valoresPago(origen: { fecha?: string | null; medio?: string; det?: Record<string, unknown> | null; monto?: string }): PagoInput {
  const anterior = origen.det ?? {};
  const medio = mediosValidos.find((valido) => valido === origen.medio) ?? '';
  const conDetalle = medio !== '' && medio !== 'efectivo';
  return {
    monto: origen.monto,
    fecha: origen.fecha || hoy(),
    medio,
    cargarDetalle: conDetalle && (Object.keys(anterior).length > 0 || medio === 'cheque' || medio === 'echeq'),
    banco: texto(anterior.banco),
    nro: texto(anterior.nro),
    librador: texto(anterior.librador),
    fcobro: texto(anterior.fcobro),
  };
}
