import type { InicioServidor } from '../api/inicio.service';

const productos = {
  seg: { nombre: 'Seguros', color: 'var(--seg)' }, q6: { nombre: 'Quini 6', color: 'var(--q6)' },
  lot: { nombre: 'Lotería', color: 'var(--lot)' }, qui: { nombre: 'Quiniela', color: 'var(--qui)' },
  rifa: { nombre: 'Rifa Devoto', color: 'var(--rifa)' },
};
const medios: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', echeq: 'E-cheq', cheque: 'Cheque físico', mp: 'Mercado Pago' };
const moneda = (valor: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: Number.isInteger(valor) ? 0 : 2, maximumFractionDigits: Number.isInteger(valor) ? 0 : 2 }).format(valor);
const fecha = (valor: string) => valor.split('-').reverse().join('/');
const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function presentarInicio(datos: InicioServidor) {
  const nombres = (socios: { nombre: string }[]) => socios.map(s => s.nombre).sort((a, b) => a.localeCompare(b));
  return {
    fecha: `${dias[new Date(`${datos.hoy}T12:00:00Z`).getUTCDay()]} ${fecha(datos.hoy)}`,
    total: moneda(datos.total), debe: !!datos.total, favor: moneda(datos.aFavor), tieneFavor: !!datos.aFavor,
    productos: datos.productos.map(p => ({ ...productos[p.tipo], monto: moneda(p.importe) })),
    sorteo: datos.sorteo ? { nombre: datos.sorteo.nombre, resumen: `${fecha(datos.sorteo.fecha)} · vendidas ${datos.fracciones} fracciones a ${datos.compradores} socios` } : { nombre: 'Lotería', resumen: '' },
    sinOf: nombres(datos.sinOfrecer), noCompr: nombres(datos.noCompran),
    cheques: datos.cheques.map(c => ({ id: c.id, sid: c.sid, nombre: c.socio, monto: moneda(c.monto),
      medio: [medios[c.medio] || '', c.detalle.banco, c.detalle.nro ? `N° ${c.detalle.nro}` : '', c.detalle.librador, c.detalle.fcobro ? `${c.medio === 'echeq' ? 'paga' : 'cobro'} ${fecha(c.detalle.fcobro)}` : '', c.detalle.dep ? 'depositado' : ''].filter(Boolean).join(' · '),
      fecha: c.dias < 0 ? 'Para depositar' : c.dias === 0 ? 'Se cobra hoy' : `En ${c.dias} d · ${fecha(c.detalle.fcobro || '')}` })),
    vencimientos: datos.vencimientos.map(v => ({ id: v.seguro.id, sid: v.seguro.sid, nombre: v.socio, descripcion: v.seguro.desc, dias: v.dias,
      fecha: v.dias < 0 ? `Venció hace ${-v.dias} d` : v.dias === 0 ? 'Vence hoy' : v.dias <= 7 ? `Vence en ${v.dias} d` : `Vence ${fecha(v.seguro.venc)}` })),
    deudores: datos.deudores.map(d => ({ sid: d.sid, nombre: d.nombre, monto: moneda(d.monto), productos: d.productos.map(p => productos[p]) })),
  };
}
