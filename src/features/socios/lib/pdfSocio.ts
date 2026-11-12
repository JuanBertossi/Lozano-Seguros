import { crearDocumentoPdf } from '../../../shared/lib/pdfListado';
import { avisar } from '../../../shared/stores/avisos.store';
import type { DatosPdfSocio } from '../api/socios.service';
import { presentarMovimiento } from './movimientosVista';

const fecha = (valor: string) => valor.split('-').reverse().join('/');
const moneda = (valor: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: Number.isInteger(valor) ? 0 : 2, maximumFractionDigits: Number.isInteger(valor) ? 0 : 2 }).format(valor).replace(/\u00a0/g, ' ');
const escapar = (valor: string) => String(valor).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function filasPdf(datos: DatosPdfSocio) {
  return datos.movimientos.map(movimiento => {
    const vista = presentarMovimiento(movimiento, {}, datos.hoy);
    return [fecha(movimiento.fecha) + (movimiento.hora ? '\n' + vista.hora : ''), vista.nombre, (vista.texto + (vista.sub ? '\n' + vista.sub : '')).replace(/★/g, '*'), vista.monto.replace(/\u00a0/g, ' '), vista.cobro ? 'Cobro' : vista.pagado ? 'Pagado' : 'Debe'];
  });
}

function imprimirAlternativa(datos: DatosPdfSocio, filas: string[][]) {
  const ventana = window.open('', '_blank');
  if (!ventana) { avisar('Sin internet no se pudo crear el PDF. Permití ventanas emergentes para imprimirlo.'); return; }
  const filasImpresion = filas.map((fila, indice) => [fecha(datos.movimientos[indice].fecha), fila[1], fila[2], moneda(datos.movimientos[indice].importe), datos.movimientos[indice].pagado ? 'Pagado' : 'Debe']);
  ventana.document.write(`<html><head><title>${escapar(datos.socio.nombre)}</title><style>body{font:13px system-ui,sans-serif;margin:24px;color:#1C1F24}table{width:100%;border-collapse:collapse;margin:8px 0 20px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{background:#f1f0eb}</style></head><body><h2>${escapar(datos.socio.nombre)}</h2><p>Socio N° ${escapar(datos.socio.nro)} · Estado de cuenta al ${fecha(datos.hoy)}</p><h3>${datos.cuenta.debe ? 'Saldo pendiente: ' + moneda(datos.cuenta.debe) : 'Está al día'}</h3><table><tr><th>Fecha</th><th>Producto</th><th>Detalle</th><th>Monto</th><th>Estado</th></tr>${filasImpresion.map(fila => `<tr>${fila.map(valor => `<td>${escapar(valor).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</table><p style="color:#888">Elegí “Guardar como PDF” en la ventana de impresión.</p></body></html>`);
  ventana.document.close(); ventana.focus(); setTimeout(() => ventana.print(), 300);
}

export async function generarPdfSocio(datos: DatosPdfSocio, soloArmar: boolean) {
  if (!soloArmar) avisar('Armando el PDF…');
  const filas = filasPdf(datos);
  let doc;
  try { doc = await crearDocumentoPdf(); } catch { if (!soloArmar) imprimirAlternativa(datos, filas); return null; }
  const ancho = doc.internal.pageSize.getWidth();
  const { socio, cuenta } = datos;
  doc.setFillColor(14,107,79); doc.rect(0,0,ancho,30,'F'); doc.setTextColor(255); doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.text(socio.nombre,14,14);
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(`Socio N° ${socio.nro}${socio.tel?'  ·  '+socio.tel:''}${socio.dir?'  ·  '+socio.dir:''}`,14,21);
  doc.text(`Estado de cuenta al ${fecha(datos.hoy)}`,ancho-14,14,{align:'right'}); doc.text(datos.nombreAgencia,ancho-14,21,{align:'right'});
  doc.setTextColor(30); doc.setFontSize(12); doc.setFont('helvetica','bold');
  doc.text((cuenta.debe?`Saldo pendiente: ${moneda(cuenta.debe)}`:'Está al día')+(cuenta.favor?`   ·   A favor: ${moneda(cuenta.favor)}`:''),14,42);
  doc.setTextColor(30); doc.setFontSize(11); doc.text('Movimientos',14,52);
  doc.autoTable({ startY:55, head:[['Fecha','Producto','Detalle','Monto','Estado']], body:filas.length?filas:[['','','Sin movimientos','','']], foot:[['','','Total pendiente',moneda(cuenta.debe),'']],
    styles:{fontSize:9,cellPadding:2.2,textColor:30},headStyles:{fillColor:[241,240,235],textColor:80,fontStyle:'bold'},columnStyles:{0:{cellWidth:22},1:{cellWidth:24},3:{halign:'right',cellWidth:26},4:{cellWidth:18}},margin:{left:14,right:14},footStyles:{fillColor:[255,255,255],textColor:30,fontStyle:'bold',halign:'right'},
    didParseCell:(celda:{section:string;column:{index:number};cell:{raw:unknown;styles:{textColor:number[]}}})=>{if(celda.section==='body'&&celda.column.index===4)celda.cell.styles.textColor=celda.cell.raw==='Debe'?[179,48,42]:[14,107,79]},
  });
  const paginas=doc.getNumberOfPages();for(let i=1;i<=paginas;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(130);doc.text(`Página ${i} de ${paginas}`,ancho-14,290,{align:'right'})}
  const nombre=`${socio.nombre.replace(/[^\wáéíóúñÁÉÍÓÚÑ ]+/g,'').trim().replace(/\s+/g,'_')}_${datos.hoy}.pdf`;
  if(soloArmar)return {blob:doc.output('blob'),nombre};
  doc.save(nombre);avisar('PDF descargado');return null;
}
