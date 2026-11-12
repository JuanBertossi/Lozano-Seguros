import type { TabSocio } from '../../../shared/stores/navegacion.store';
import type { ResumenSocio } from '../../../shared/hooks/useResumenSocio';
import type { FichaSocio } from '../api/socios.service';
import { actor } from './movimientosVista';
import { moneda } from '../../../shared/lib/moneda';

const productos: Record<TabSocio, { nombre: string; color: string }> = {
  det: { nombre: 'Detalle', color: 'var(--ink)' },
  seg: { nombre: 'Seguros', color: 'var(--seg)' },
  q6: { nombre: 'Quini 6', color: 'var(--q6)' },
  lot: { nombre: 'Lotería', color: 'var(--lot)' },
  qui: { nombre: 'Quiniela', color: 'var(--qui)' },
  rifa: { nombre: 'Rifa Devoto', color: 'var(--rifa)' },
};
const orden: TabSocio[] = ['det', 'seg', 'q6', 'lot', 'qui', 'rifa'];

export function presentarCabecera({ socio, usuarios }: FichaSocio, resumen: ResumenSocio) {
  return {
    nombre: socio.nombre,
    numero: String(socio.nro ?? ''),
    telefono: socio.tel || '',
    direccion: socio.dir || '',
    activo: !!socio.activo,
    autor: actor(socio, usuarios, false),
    deuda: moneda(resumen.deuda),
    tieneDeuda: !!resumen.deuda,
    favor: moneda(resumen.favor),
    tieneFavor: !!resumen.favor,
    resultado: resumen.debe ? 'Debe' : resumen.aFavor ? 'Tiene a favor' : 'Al día',
    resultadoMonto: moneda(resumen.debe || resumen.aFavor || 0),
    resultadoTexto: resumen.debe ? 'Lo que te tiene que pagar hoy' : resumen.aFavor ? 'Se descuenta en el próximo cobro' : 'No debe nada vencido',
    resultadoDeuda: !!resumen.debe,
    proximo: resumen.proximo ? moneda(resumen.proximo) : '',
    productos: resumen.productos.map((p) => ({
      nombre: productos[p.tipo as TabSocio]?.nombre || p.tipo,
      color: productos[p.tipo as TabSocio]?.color || 'currentColor',
      monto: moneda(p.monto),
    })),
    tabs: orden.map((id) => ({ id, ...productos[id], cantidad: resumen.conteos[id] || 0 })),
  };
}
export type VistaCabecera = ReturnType<typeof presentarCabecera>;
