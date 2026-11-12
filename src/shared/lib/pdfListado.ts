import { fechaCorta, hoy } from './fechas';
import { pagosService } from './pagos.service';
import { queryClient } from './supabase.service';
import { avisar } from '../stores/avisos.store';

interface CeldaPdf { section: string; column: { index: number }; cell: { raw: unknown; styles: { textColor: number[] } } }
export interface DocumentoPdf {
  internal: { pageSize: { getWidth: () => number } };
  setFillColor: (...color: number[]) => void;
  rect: (x: number, y: number, ancho: number, alto: number, estilo: string) => void;
  setTextColor: (...color: number[]) => void;
  setFont: (familia: string, estilo: string) => void;
  setFontSize: (tamano: number) => void;
  text: (texto: string, x: number, y: number, opciones?: { align: string }) => void;
  autoTable: (opciones: Record<string, unknown>) => void;
  getNumberOfPages: () => number;
  setPage: (pagina: number) => void;
  save: (archivo: string) => void;
  output: (tipo: 'blob') => Blob;
}
interface ConstructorPdf {
  new (opciones: { unit: string; format: string }): DocumentoPdf;
  API: { autoTable?: unknown };
}
type VentanaPdf = Window & { jspdf?: { jsPDF: ConstructorPdf } };
export interface DatosListadoPdf {
  titulo: string;
  subtitulo: string;
  encabezados: string[];
  filas: string[][];
  totales: string[];
  archivo: string;
  columnasDerecha: number[];
}
export interface DatosPdfProducto { filas: string[][]; cobrado: string; falta: string; filtro: string }
export interface DatosPdfRifa extends DatosPdfProducto { anio: number }
export interface DatosPdfLoteria extends DatosPdfProducto { nombre: string; fecha: string }
export interface DatosPdfQuini extends DatosPdfProducto { fecha: string }

const filtros: Record<string, string> = { todos: '', deben: ' · solo los que deben', pagados: ' · solo pagados' };
const fechaMostrar = (fecha: string) => fechaCorta(fecha);
const limpiar = (texto: string) => texto.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/★/g, '*').replace(/\u00a0/g, ' ');
const escapar = (texto: string) => String(texto).replace(/[&<>"']/g, caracter => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter]!);

let carga: Promise<void> | undefined;
function cargarLibrerias() {
  if (!carga) carga = (async () => {
    const ventana = window as VentanaPdf;
    const cargar = (src: string) => new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => { script.remove(); reject(new Error('No se pudo cargar la librería de PDF.')); };
      document.head.append(script);
    });
    if (!ventana.jspdf) await cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (!ventana.jspdf?.jsPDF.API.autoTable) await cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  })().catch(error => { carga = undefined; throw error; });
  return carga;
}

export async function crearDocumentoPdf(): Promise<DocumentoPdf> {
  await cargarLibrerias();
  return new (window as VentanaPdf).jspdf!.jsPDF({ unit: 'mm', format: 'a4' });
}

/** Aviso breve (toast) durante la generación de un PDF. */
export const avisarPdf = (mensaje: string) => avisar(mensaje);

// El nombre de la agencia sale del servidor; si no se puede leer, el encabezado queda sin nombre.
const nombreAgencia = () => queryClient.fetchQuery({ queryKey: ['pagos', 'nombre-agencia'], queryFn: pagosService.nombreAgencia, staleTime: 0 }).catch(() => '');

function imprimirAlternativa(datos: DatosListadoPdf) {
  const ventana = window.open('', '_blank');
  if (!ventana) { avisarPdf('Sin internet no se pudo crear el PDF. Permití ventanas emergentes para imprimirlo.'); return; }
  ventana.document.write(`<html><head><title>${escapar(datos.titulo)}</title><style>body{font:13px system-ui,sans-serif;margin:24px;color:#1C1F24}table{width:100%;border-collapse:collapse;margin:8px 0 20px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{background:#f1f0eb}</style></head><body><h2>${escapar(datos.titulo)}</h2><p>${escapar(datos.subtitulo)}</p><table><tr>${datos.encabezados.map(x => `<th>${escapar(x)}</th>`).join('')}</tr>${datos.filas.map(fila => `<tr>${fila.map(x => `<td>${escapar(x)}</td>`).join('')}</tr>`).join('')}</table><p>${datos.totales.map(escapar).join(' · ')}</p><p style="color:#888">Elegí “Guardar como PDF” en la ventana de impresión.</p></body></html>`);
  ventana.document.close();
  ventana.focus();
  setTimeout(() => ventana.print(), 300);
}

export async function descargarListadoPdf(datos: DatosListadoPdf) {
  avisarPdf('Armando el PDF…');
  try { await cargarLibrerias(); } catch { imprimirAlternativa(datos); return; }
  const Constructor = (window as VentanaPdf).jspdf!.jsPDF;
  const doc = new Constructor({ unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const agencia = await nombreAgencia();
  doc.setFillColor(14, 107, 79); doc.rect(0, 0, ancho, 30, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(datos.titulo, 14, 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(datos.subtitulo, 14, 21);
  doc.text(`Al ${fechaMostrar(hoy())}`, ancho - 14, 14, { align: 'right' }); doc.text(agencia, ancho - 14, 21, { align: 'right' });
  doc.setTextColor(30); doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(datos.totales.join('   ·   '), 14, 40);
  const columnas = Object.fromEntries(datos.columnasDerecha.map(i => [i, { halign: 'right' }]));
  doc.autoTable({ startY: 45, head: [datos.encabezados], body: datos.filas, styles: { fontSize: 9, cellPadding: 2.2, textColor: 30 }, headStyles: { fillColor: [241, 240, 235], textColor: 80, fontStyle: 'bold' }, columnStyles: columnas, margin: { left: 14, right: 14 },
    didParseCell: (celda: CeldaPdf) => { if (celda.section === 'body' && celda.column.index === datos.encabezados.length - 1) celda.cell.styles.textColor = String(celda.cell.raw).startsWith('Debe') ? [179, 48, 42] : [14, 107, 79]; },
  });
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(130); doc.text(`Página ${i} de ${paginas}`, ancho - 14, 290, { align: 'right' }); }
  doc.save(datos.archivo); avisarPdf('PDF descargado');
}

export function descargarRifaPdf(datos: DatosPdfRifa) {
  return descargarListadoPdf({ titulo: 'Rifa Devoto', subtitulo: `Año ${datos.anio}${filtros[datos.filtro] || ''}`, encabezados: ['Socio', 'N° rifa', 'Modalidad', 'Importe', 'Pagado', 'Saldo', 'Estado'], filas: datos.filas, totales: [`${datos.filas.length} rifas`, `Cobrado ${datos.cobrado}`, `Saldo ${datos.falta}`], archivo: `Rifa_Devoto_${datos.anio}.pdf`, columnasDerecha: [3, 4, 5] });
}
export function descargarLoteriaPdf(datos: DatosPdfLoteria) {
  const nombre = limpiar(datos.nombre);
  return descargarListadoPdf({ titulo: `Lotería · ${nombre}`, subtitulo: `Sorteo del ${fechaMostrar(datos.fecha)}${filtros[datos.filtro] || ''}`, encabezados: ['N°', 'Socio', 'Fracciones', 'Importe', 'Estado'], filas: datos.filas, totales: [`${datos.filas.length} número${datos.filas.length === 1 ? '' : 's'}`, `Cobrado ${datos.cobrado}`, `Falta cobrar ${datos.falta}`], archivo: `Loteria_${nombre.replace(/[^\wáéíóúñÁÉÍÓÚÑ ]+/g, '').trim().replace(/\s+/g, '_')}_${datos.fecha}.pdf`, columnasDerecha: [3] });
}
export function descargarQuiniPdf(datos: DatosPdfQuini) {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const dia = new Date(`${datos.fecha}T12:00:00Z`).getUTCDay();
  return descargarListadoPdf({ titulo: 'Quini 6', subtitulo: `Sorteo del ${dias[dia]} ${fechaMostrar(datos.fecha)}${filtros[datos.filtro] || ''}`, encabezados: ['Socio', 'Cómo juega', 'Monto', 'Estado'], filas: datos.filas, totales: [`${datos.filas.length} jugada${datos.filas.length === 1 ? '' : 's'}`, `Cobrado ${datos.cobrado}`, `Falta cobrar ${datos.falta}`], archivo: `Quini6_${datos.fecha}.pdf`, columnasDerecha: [2] });
}
