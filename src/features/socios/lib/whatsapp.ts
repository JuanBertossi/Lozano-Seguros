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
