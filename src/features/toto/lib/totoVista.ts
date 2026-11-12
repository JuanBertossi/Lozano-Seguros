import { fechaCorta, nombreDia } from '../../../shared/lib/fechas';
import type { CalculoToto, JuegoToto, ListadoTotoServidor, PeriodosToto, PeriodoToto, PlanillaGuardada } from '../api/toto.service';

export const JUEGOS: { id: JuegoToto; nombre: string }[] = [
  { id: 'previa', nombre: 'Previa' }, { id: 'primera', nombre: 'Primera' }, { id: 'matutina', nombre: 'Matutina' },
  { id: 'vespertina', nombre: 'Vespertina' }, { id: 'nocturna', nombre: 'Nocturna' }, { id: 'turista', nombre: 'Turista' },
  { id: 'quini6', nombre: 'Quini 6' }, { id: 'loto', nombre: 'Loto' },
];

export const dinero = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
const dineroPdf = (n: number) => dinero(n).replace(/ /g, ' ');

/** «Debe» como lo muestra la maqueta: lo que falta, o «+» si pagó de más. */
export const textoDebe = (n: number) => (n > 0 ? dinero(n) : n < 0 ? `+${dinero(-n)}` : '—');

/** Número para escribir en un campo (`fmtN` de la maqueta). */
export function numeroEditable(n?: number | null) {
  if (!n) return '';
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: Math.round(n * 100) % 100 ? 2 : 0 });
}

/** Número escrito con formato argentino (`1.234,5`) como lo espera el servidor. */
export const leerNumero = (texto: string) => (texto ? Number(texto.replace(/\./g, '').replace(',', '.')) : 0);

export const colorSigno = (n: number) => (n < 0 ? 'text-[var(--bad)]' : n > 0 ? 'text-[var(--ok)]' : '');

const mesTexto = (mes: string) => {
  const texto = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date(`${mes}-15T12:00:00`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export interface PeriodoElegido {
  vista: PeriodoToto;
  mes: string;
  dia: string;
  /** Lo que recibe el servidor: el día, el mes o `completo`. */
  valor: string;
  titulo: string;
  bajo: string;
  indiceMes: number;
  esHoy: boolean;
}

/** Período por defecto y mes disponible: salen del servidor (`totoPer` de la maqueta). */
export function elegirPeriodo(periodos: PeriodosToto, vista: PeriodoToto | null, mes: string | null, dia: string | null): PeriodoElegido {
  const vistaActual = vista ?? 'mes';
  const mesActual = mes && periodos.meses.includes(mes) ? mes : periodos.mesActual;
  const diaActual = dia ?? periodos.hoy;
  const indiceMes = periodos.meses.indexOf(mesActual);
  const esHoy = diaActual === periodos.hoy;
  if (vistaActual === 'dia') {
    const texto = `${nombreDia(diaActual)} ${fechaCorta(diaActual)}`;
    return { vista: vistaActual, mes: mesActual, dia: diaActual, valor: diaActual, titulo: texto.charAt(0).toUpperCase() + texto.slice(1), bajo: `el ${fechaCorta(diaActual)}`, indiceMes, esHoy };
  }
  if (vistaActual === 'todo') {
    return { vista: vistaActual, mes: mesActual, dia: diaActual, valor: 'completo', titulo: 'Todos los días', bajo: 'todos los días', indiceMes, esHoy };
  }
  return { vista: vistaActual, mes: mesActual, dia: diaActual, valor: mesActual, titulo: mesTexto(mesActual), bajo: mesTexto(mesActual).toLowerCase(), indiceMes, esHoy };
}

export function subtituloPeriodo(periodo: PeriodoElegido, cantidad: number) {
  if (periodo.vista === 'dia') {
    return `${cantidad ? `${cantidad} fila${cantidad === 1 ? '' : 's'} cargada${cantidad === 1 ? '' : 's'}` : 'Sin cargar'}${periodo.esHoy ? ' · Hoy' : ''}`;
  }
  return `${cantidad} día${cantidad === 1 ? '' : 's'} cargado${cantidad === 1 ? '' : 's'}`;
}

export interface DetalleToto {
  total: string; com: string; neto: string; prem: string; premAg: string; gral: string; pago: string; debe: string;
  signoGral: number; signoDebe: number;
}
export interface FilaToto extends DetalleToto {
  id: string;
  fecha: string;
  valores: { monto: string; concurso: number | null }[];
  estado: 'r-ok' | 'r-par' | 'r-bad';
  saldado: boolean;
  pagos: number;
}
export interface ListadoPresentado {
  resumen: [string, string, string][];
  pagado: string;
  deuda: string;
  hayDeuda: boolean;
  signoGral: number;
  filas: FilaToto[];
  total: DetalleToto & { valores: string[] };
  cantidadPagados: number;
}

export const detalleToto = (c: Pick<CalculoToto, 'total' | 'com' | 'neto' | 'prem' | 'premAg' | 'gral' | 'pago' | 'debe'>): DetalleToto => ({
  total: dinero(c.total), com: dinero(c.com), neto: dinero(c.neto), prem: c.prem ? dinero(c.prem) : '—', premAg: c.premAg ? dinero(c.premAg) : '—',
  gral: dinero(c.gral), pago: c.pago ? dinero(c.pago) : '—', debe: textoDebe(c.debe), signoGral: Math.sign(c.gral), signoDebe: Math.sign(c.debe),
});

export function presentarListado(listado: ListadoTotoServidor, porcentaje: number): ListadoPresentado {
  const t = listado.totales;
  return {
    resumen: [
      ['Total jugado', dinero(t.total), ''], [`${porcentaje}%`, dinero(t.com), ''], [`Total − ${porcentaje}%`, dinero(t.neto), ''],
      ['Premios', dinero(t.prem), ''], ['Total general', dinero(t.gral), t.gral < 0 ? 'En contra' : t.gral > 0 ? 'A favor' : '—'],
    ],
    pagado: dinero(t.pago), deuda: dinero(Math.max(0, t.debe)), hayDeuda: t.debe > 0, signoGral: Math.sign(t.gral),
    filas: listado.filas.map((fila): FilaToto => ({
      id: fila.id, fecha: fechaCorta(fila.datos.fecha),
      valores: JUEGOS.map(({ id }) => {
        const monto = fila.datos[id];
        return { monto: monto ? dinero(monto) : '—', concurso: fila.concursos[id] };
      }),
      ...detalleToto(fila.calculo),
      estado: fila.calculo.saldado ? 'r-ok' : fila.calculo.parcial ? 'r-par' : 'r-bad',
      saldado: fila.calculo.saldado, pagos: fila.calculo.P.length,
    })),
    total: { ...detalleToto(t), valores: JUEGOS.map(({ id }) => dinero(listado.juegos[id])), prem: dinero(t.prem), premAg: dinero(t.premAg) },
    cantidadPagados: listado.cantidadPagados,
  };
}

export interface DatosPdfToto {
  periodo: string;
  agencia: string;
  encabezados: string[];
  filas: string[][];
  totales: string[];
  resumen: string[];
  archivo: string;
}

/** Mismas columnas y textos que `pdfToto` de la maqueta; las filas salen ordenadas de la más antigua a la más nueva. */
export function armarPdfToto(listado: ListadoTotoServidor, titulo: string, clave: string, porcentaje: number, agencia: string): DatosPdfToto {
  const presentado = presentarListado(listado, porcentaje);
  const porId = new Map(presentado.filas.map((fila) => [fila.id, fila]));
  const filas = [...listado.filas].sort((a, b) => a.datos.fecha.localeCompare(b.datos.fecha)).map((origen) => {
    const f = porId.get(origen.id)!;
    return [f.fecha, ...f.valores.map((v) => v.monto + (v.concurso ? `\nN° ${v.concurso}` : '')), f.total, f.com, f.neto, f.prem, f.premAg, f.gral, f.pago, f.debe].map((x) => x.replace(/ /g, ' '));
  });
  const t = presentado.total;
  const g = listado.totales;
  return {
    periodo: titulo, agencia,
    encabezados: ['Fecha', ...JUEGOS.map((j) => j.nombre), 'Total', `${porcentaje}%`, `Total − ${porcentaje}%`, 'Premios', 'Premios agencia (Ema)', 'Total general', 'Pagó', 'Debe'],
    filas,
    totales: ['Total', ...t.valores, t.total, t.com, t.neto, t.prem, t.premAg, t.gral, '', ''].map((x) => x.replace(/ /g, ' ')),
    resumen: [
      `Total jugado ${dineroPdf(g.total)}`, `${porcentaje}% ${dineroPdf(g.com)}`, `Total − ${porcentaje}% ${dineroPdf(g.neto)}`, `Premios ${dineroPdf(g.prem)}`,
      `Total general ${dineroPdf(g.gral)}`, `Me pagó ${dineroPdf(g.pago)}`, `Me debe ${dineroPdf(Math.max(0, g.debe))}`,
    ],
    archivo: `Toto_Ortega_${clave}.pdf`,
  };
}

/** Datos de la planilla para el formulario: los montos con formato argentino y vacío cuando no hay nada. */
export function jugadasEditables(datos: PlanillaGuardada) {
  return Object.fromEntries(JUEGOS.map(({ id }) => [id, numeroEditable(datos[id])]));
}

export interface FilaVistaPrevia { nombre: string; valor: string; signo: number }

/** Resumen que se ve al cargar un día (`vista` del diálogo de la maqueta). */
export function filasVistaPrevia(c: CalculoToto, porcentaje: number): FilaVistaPrevia[] {
  const filas: FilaVistaPrevia[] = [
    { nombre: 'Total', valor: dinero(c.total), signo: 0 },
    { nombre: `− ${porcentaje}%`, valor: dinero(c.com), signo: 0 },
    { nombre: `Total − ${porcentaje}%`, valor: dinero(c.neto), signo: 0 },
    { nombre: '− Premios', valor: dinero(c.prem), signo: 0 },
    { nombre: `Total general${c.gral < 0 ? ' (en contra)' : c.gral > 0 ? ' (a favor)' : ''}`, valor: dinero(c.gral), signo: Math.sign(c.gral) },
    { nombre: `Tiene que pagar (total − ${porcentaje}%)`, valor: dinero(c.neto), signo: 0 },
  ];
  if (c.pago) filas.push({ nombre: 'Ya pagó', valor: dinero(c.pago), signo: 0 }, { nombre: 'Debe', valor: textoDebe(c.debe), signo: -Math.sign(c.debe) });
  return filas;
}
