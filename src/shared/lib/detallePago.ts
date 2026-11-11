import type { PagoInput } from '../schemas/pago.schema';

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
