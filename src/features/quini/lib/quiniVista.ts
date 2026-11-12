import { fechaCorta, fechaLarga, leerFecha, nombreDia } from '../../../shared/lib/fechas';
import { moneda } from '../../../shared/lib/moneda';
import type { EspecialQuini, ListadoQuini } from '../api/quini.service';

export const diasQuini = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const tituloSorteo = (fecha: string) => `Sorteo del ${nombreDia(fecha)} ${fechaCorta(fecha)}`;
export const diaDeSemana = (fecha: string) => leerFecha(fecha).getDay();

/** Texto de cada sorteo en el desplegable del formulario: «jueves 12/11 ★ especial (hoy)». */
export const etiquetaSorteo = (fecha: string, especiales: EspecialQuini[], hoy: string) =>
  `${fechaLarga(fecha)}${especiales.some(e => e.fecha === fecha) ? ' ★ especial' : ''}${fecha === hoy ? ' (hoy)' : ''}`;

export function presentarQuini(datos: ListadoQuini, filtro: string) {
  return {
    distancia: datos.dias === 0 ? 'Hoy' : datos.dias > 0 ? `Falta${datos.dias > 1 ? 'n' : ''} ${datos.dias} día${datos.dias > 1 ? 's' : ''}` : `Fue hace ${-datos.dias} día${datos.dias < -1 ? 's' : ''}`,
    precio: moneda(datos.precio), especial: datos.especial, cantidad: datos.cantidad,
    total: moneda(datos.total), cobrado: moneda(datos.cobrado), falta: moneda(datos.falta),
    deuda: datos.falta > 0, futuro: datos.dias > 0, eseDia: datos.eseDia, precioComun: moneda(datos.precioComun),
    fijos: datos.fijos.map(f => ({ id: f.id, nombre: f.nombre, detalle: `${f.dias.map(d => diasQuini[d]).join(' y ')} · ${f.cantidad} jugada${f.cantidad > 1 ? 's' : ''}`, semanal: moneda(f.semanal) })),
    especiales: datos.especiales.map(e => ({ id: e.id, nombre: e.nombre, fecha: fechaLarga(e.fecha), precio: moneda(e.precio) })),
    filas: datos.filas.filter(({ jugada }) => filtro === 'todos' || (filtro === 'pagados' ? jugada.pagado : !jugada.pagado)).map(({ jugada, socio, restante, nombreAutor, nombreEditor }) => ({
      id: jugada.id, sid: jugada.sid, socio, tipo: jugada.auto ? 'Juega siempre' : 'Jugada suelta',
      autor: [jugada.por === 'auto' ? 'Automático' : jugada.por ? `Cargó ${nombreAutor}` : '', jugada.modPor && jugada.modPor !== jugada.por ? `editó ${nombreEditor}${jugada.modTs ? ` ${fechaCorta(jugada.modTs.slice(0, 10))}` : ''}` : ''].filter(Boolean).join(' · ') || '—',
      monto: moneda(jugada.monto), pagado: jugada.pagado, abono: jugada.abono ? moneda(jugada.abono) : '', restante: moneda(restante),
    })),
  };
}
export type VistaListadoQuini = ReturnType<typeof presentarQuini>;
