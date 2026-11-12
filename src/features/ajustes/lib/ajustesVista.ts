import { fechaCorta } from '../../../shared/lib/fechas';
import type { DatosAjustes } from '../api/ajustes.service';
import type { AjustesInput, SorteoInput } from '../ajustes.schema';
import { moneda, numeroEditable } from '../../../shared/lib/moneda';

export const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Orden de la semana en las grillas: de lunes a domingo. */
export const semana = [1, 2, 3, 4, 5, 6, 0];

/** Valores iniciales del formulario de precios (`config` de `publicarAjustes`). */
export function configuracionInicial(config: DatosAjustes['config']): AjustesInput {
  return {
    nombre: config.nombre,
    q6Precio: numeroEditable(config.q6Precio),
    q6Dias: config.q6Dias.map(String),
    fracPrecio: numeroEditable(config.fracPrecio),
    rifaImporte: numeroEditable(config.rifaImporte),
    rifaCuotas: String(config.rifaCuotas),
    wsp: config.wsp,
  };
}

/** Líneas de la lista de sorteos de lotería. */
export function resumenSorteos(sorteos: DatosAjustes['sorteos']) {
  return sorteos.map((sorteo) => ({
    id: sorteo.id,
    nombre: sorteo.nombre,
    resumen: `${fechaCorta(sorteo.fecha)} · ${sorteo.frac} fracciones · ${moneda(sorteo.precio)} c/u · ${sorteo.ventas} vendidos`,
  }));
}

/** Valores iniciales del formulario de sorteo, o null si el sorteo que se quiere editar ya no existe. */
export function sorteoInicial(datos: DatosAjustes, id?: string): { inicial: SorteoInput; ventas: number } | null {
  if (!id) return { inicial: { nombre: '', fecha: '', frac: '10', precio: numeroEditable(datos.config.fracPrecio) }, ventas: 0 };
  const sorteo = datos.sorteos.find((x) => x.id === id);
  if (!sorteo) return null;
  return { inicial: { nombre: sorteo.nombre, fecha: sorteo.fecha, frac: String(sorteo.frac), precio: numeroEditable(sorteo.precio) }, ventas: sorteo.ventas };
}

/** Días de sorteo de cada juego como los necesitan los checkboxes. */
export function diasTotoIniciales(juegos: DatosAjustes['juegos']) {
  return Object.fromEntries(juegos.map((juego) => [juego.id, juego.dias.map(String)]));
}
