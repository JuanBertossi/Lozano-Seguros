import { crearDocumentoPdf } from '../../../shared/lib/pdfListado';
import { fechaCorta, hoy } from '../../../shared/lib/fechas';
import { avisar } from '../../../shared/stores/avisos.store';
import type { DatosPdfToto } from './totoVista';

interface CeldaPdf { section: string; column: { index: number }; cell: { raw: unknown; styles: { halign?: string; textColor?: number[] } } }
interface DocumentoHorizontal {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
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
}
type VentanaPdf = Window & { jspdf?: { jsPDF: new (opciones: { unit: string; format: string; orientation: string }) => DocumentoHorizontal } };

const escapar = (texto: string) => String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Sin internet no hay librería de PDF: se abre una página imprimible (como hace la maqueta).
function imprimirAlternativa(datos: DatosPdfToto) {
  const ventana = window.open('', '_blank');
  if (!ventana) { avisar('Sin internet no se pudo crear el PDF. Permití ventanas emergentes para imprimirlo.'); return; }
  const fila = (celdas: string[], etiqueta: string) => `<tr>${celdas.map((c, i) => `<${etiqueta} style="text-align:${i ? 'right' : 'left'}">${escapar(c)}</${etiqueta}>`).join('')}</tr>`;
  ventana.document.write(`<html><head><title>Toto Ortega · ${escapar(datos.periodo)}</title><style>@page{size:A4 landscape;margin:10mm}body{font:11px system-ui,sans-serif;margin:0;color:#1C1F24}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border-bottom:1px solid #ddd;padding:4px 5px;white-space:nowrap}th{background:#f1f0eb}tfoot td{font-weight:700}</style></head><body><h2>Toto Ortega · ${escapar(datos.periodo)}</h2><p><b>${datos.resumen.map(escapar).join(' · ')}</b></p><table><thead>${fila(datos.encabezados, 'th')}</thead><tbody>${datos.filas.map((f) => fila(f, 'td')).join('')}</tbody><tfoot>${fila(datos.totales, 'td')}</tfoot></table><p style="color:#888">Elegí “Guardar como PDF” en la ventana de impresión.</p></body></html>`);
  ventana.document.close();
  ventana.focus();
  setTimeout(() => ventana.print(), 300);
}

export async function descargarPdfToto(datos: DatosPdfToto) {
  avisar('Armando el PDF…');
  // `crearDocumentoPdf` carga jsPDF y autoTable; el documento de Toto es horizontal, así que se crea acá.
  try { await crearDocumentoPdf(); } catch { imprimirAlternativa(datos); return; }
  const doc = new (window as VentanaPdf).jspdf!.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const { encabezados } = datos;
  doc.setFillColor(61, 90, 128); doc.rect(0, 0, ancho, 24, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Toto Ortega', 12, 11);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(datos.periodo, 12, 18); doc.text(`Al ${fechaCorta(hoy())}`, ancho - 12, 11, { align: 'right' }); doc.text(datos.agencia, ancho - 12, 18, { align: 'right' });
  doc.setTextColor(30); doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.text(datos.resumen.join('   ·   '), 12, 32);
  const columnas: Record<number, { halign?: string; cellWidth?: number }> = { 0: { cellWidth: 18 } };
  for (let i = 1; i < encabezados.length; i++) columnas[i] = { halign: 'right' };
  const ultima = encabezados.length - 1;
  doc.autoTable({
    startY: 36, head: [encabezados], body: datos.filas, foot: [datos.totales],
    styles: { fontSize: 7.5, cellPadding: 1.6, textColor: 30, overflow: 'linebreak' },
    headStyles: { fillColor: [241, 240, 235], textColor: 80, fontStyle: 'bold', halign: 'right' },
    footStyles: { fillColor: [255, 255, 255], textColor: 30, fontStyle: 'bold', halign: 'right' },
    columnStyles: columnas, margin: { left: 10, right: 10 },
    didParseCell: (celda: CeldaPdf) => {
      if (celda.column.index === 0) celda.cell.styles.halign = 'left';
      if (celda.section !== 'body') return;
      const texto = String(celda.cell.raw);
      if (celda.column.index === ultima && texto.startsWith('$')) celda.cell.styles.textColor = [179, 48, 42];
      if (celda.column.index === ultima - 2 && texto.startsWith('-')) celda.cell.styles.textColor = [179, 48, 42];
      if (celda.column.index === ultima - 3) celda.cell.styles.textColor = [61, 90, 128];
    },
  });
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(130); doc.text(`Página ${i} de ${paginas}`, ancho - 12, alto - 6, { align: 'right' }); }
  doc.save(datos.archivo);
  avisar('PDF descargado');
}
