export function esMovil(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function abrirChatWhatsApp(numero: string, mensaje: string, preferencia: string, mostrarAlternativa: (abrirWeb: () => void) => void): void {
  const texto = encodeURIComponent(mensaje);
  const web = `https://web.whatsapp.com/send?phone=${numero}&text=${texto}`;
  const app = `whatsapp://send?phone=${numero}&text=${texto}`;
  const abrirWeb = () => { if (!window.open(web, '_blank')) location.href = web; };
  if (esMovil()) { location.href = `https://wa.me/${numero}?text=${texto}`; return; }
  if (preferencia === 'web') { abrirWeb(); return; }
  location.href = app;
  setTimeout(() => mostrarAlternativa(abrirWeb), 2500);
}

export function mensajeCuenta(nombre: string, firma: string, debe: number, favor: number): string {
  const moneda = (n: number) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n).replace(/\u00a0/g, ' ');
  const texto = debe
    ? `Te paso tu estado de cuenta. Saldo pendiente: ${moneda(debe)}.`
    : `Te paso tu estado de cuenta. Estás al día${favor ? `, con ${moneda(favor)} a favor` : ''}. ¡Gracias!`;
  return `Hola ${nombre.split(' ')[0]}! ${texto}\n${firma}`;
}

interface PdfSocio { blob: Blob; nombre: string }
export interface EnvioWhatsApp {
  telefono: string;
  preferencia: string;
  mensaje: string;
  pdf: boolean;
  generarPdf: () => Promise<PdfSocio | null>;
  cerrar: () => void;
  avisar: (mensaje: string) => void;
  ofrecerWeb: (abrir: () => void) => void;
  ofrecerDescarga: (nombre: string, descargar: () => void) => void;
}

export async function enviarWhatsApp(datos: EnvioWhatsApp): Promise<void> {
  let pdf: PdfSocio | null = null;
  if (datos.pdf) {
    pdf = await datos.generarPdf();
    if (!pdf) datos.avisar('Para armar el PDF hace falta internet. Se envía solo el mensaje.');
  }
  const archivo = pdf ? new File([pdf.blob], pdf.nombre, { type: 'application/pdf' }) : null;
  if (archivo && esMovil() && navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], text: datos.mensaje }); datos.cerrar(); datos.avisar('Listo'); return; }
    catch (error) { if (error instanceof Error && error.name === 'AbortError') return; }
  }
  function descargar() {
    if (!pdf) return;
    const url = URL.createObjectURL(pdf.blob);
    const enlace = document.createElement('a');
    enlace.href = url; enlace.download = pdf.nombre; document.body.appendChild(enlace); enlace.click(); enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  if (archivo) descargar();
  datos.cerrar();
  abrirChatWhatsApp(datos.telefono, datos.mensaje, datos.preferencia, datos.ofrecerWeb);
  if (archivo && pdf) setTimeout(() => datos.ofrecerDescarga(pdf!.nombre, descargar), 900);
}
