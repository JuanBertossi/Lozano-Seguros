import type { SocioListadoServidor } from '../api/socios.service';

const productos = {
  seg: { nombre: 'Seguros', color: 'var(--seg)' },
  q6: { nombre: 'Quini 6', color: 'var(--q6)' },
  lot: { nombre: 'Lotería', color: 'var(--lot)' },
  qui: { nombre: 'Quiniela', color: 'var(--qui)' },
  rifa: { nombre: 'Rifa Devoto', color: 'var(--rifa)' },
};

const moneda = (valor: number) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: Number.isInteger(valor) ? 0 : 2,
  maximumFractionDigits: Number.isInteger(valor) ? 0 : 2,
}).format(valor);

export function presentarListadoSocios(datos: SocioListadoServidor[]) {
  return datos.map(({ socio, cuenta, productos: claves }) => ({
    id: socio.id, numero: socio.nro, nombre: socio.nombre, telefono: socio.tel || '', activo: socio.activo,
    productos: claves.map((clave) => ({ clave, ...productos[clave] })),
    saldo: cuenta.debe ? `Debe ${moneda(cuenta.debe)}` : cuenta.aFavor ? `A favor ${moneda(cuenta.aFavor)}` : cuenta.favor ? 'Al día' : '',
    deuda: cuenta.debe > 0,
  })).sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre));
}
