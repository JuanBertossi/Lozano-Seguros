import { fechaCorta, horaArgentina } from '../../../shared/lib/fechas';
import type { ActividadServidor } from '../api/actividad.service';

export interface Actividad {
  id: string;
  usuarioId: string;
  nombre: string;
  fecha: string;
  hora: string;
  accion: string;
  tipo: string;
  detalle: string;
}
export interface DatosActividad {
  usuarios: ActividadServidor['usuarios'];
  movimientos: Actividad[];
}

// `AUDN` de la maqueta; `conf` lo registra el servidor al guardar precios o días de sorteo.
const nombres: Record<string, string> = {
  socios: 'socio', seguros: 'seguro', q6: 'jugada de Quini 6', lot: 'venta de lotería',
  quiniela: 'jugada de quiniela', rifas: 'rifa', cobros: 'cobro', sorteos: 'sorteo de lotería',
  q6esp: 'sorteo especial', toto: 'planilla de Toto Ortega', conf: 'configuración',
};
const zona = 'America/Argentina/Buenos_Aires';

const dinero = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);

// Día en hora de Argentina (la hora del servidor puede caer en otro día en UTC).
const diaArgentina = (marca: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date(marca));

export function presentarActividad(datos: ActividadServidor): DatosActividad {
  return {
    usuarios: datos.usuarios,
    movimientos: datos.movimientos.map((item) => ({
      id: item.id, usuarioId: item.usuarioId, nombre: item.nombre,
      fecha: item.ts ? fechaCorta(diaArgentina(item.ts)) : '—', hora: horaArgentina(item.ts),
      accion: item.accion, tipo: nombres[item.tipo] ?? item.tipo,
      detalle: item.detalle + (item.importe === null ? '' : dinero(item.importe)),
    })),
  };
}
