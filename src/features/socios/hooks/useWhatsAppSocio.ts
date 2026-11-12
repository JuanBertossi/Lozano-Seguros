import { useResumenSocio } from '../../../shared/hooks/useResumenSocio';
import { avisar, useAvisos } from '../../../shared/stores/avisos.store';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { enviarWhatsApp, esMovil, mensajeCuenta } from '../lib/whatsapp';
import { numeroWhatsApp } from '../lib/socios.helpers';
import { usePdfSocio } from './usePdfSocio';
import { useFichaSocio } from './useSocios';

export function useWhatsAppSocio(socioId: string) {
  const cerrar = useDialogos((estado) => estado.cerrar);
  const ficha = useFichaSocio(socioId);
  const resumen = useResumenSocio(socioId);
  const pdfSocio = usePdfSocio();

  const error = ficha.error ?? resumen.error;
  const datos = ficha.data && resumen.data ? {
    nombre: ficha.data.socio.nombre,
    telefono: numeroWhatsApp(ficha.data.socio.tel || ''),
    movil: esMovil(),
    mensaje: mensajeCuenta(ficha.data.socio.nombre, ficha.data.firma, resumen.data.debe, resumen.data.favor),
  } : null;

  async function enviar(formulario: { mensaje: string; pdf: boolean }) {
    if (!datos || !ficha.data) return;
    await enviarWhatsApp({
      telefono: datos.telefono,
      preferencia: ficha.data.wsp,
      mensaje: formulario.mensaje,
      pdf: formulario.pdf,
      generarPdf: () => pdfSocio(socioId, true),
      cerrar,
      avisar,
      ofrecerWeb: (abrir) => {
        if (!useAvisos.getState().accion) useAvisos.getState().mostrarAccion({ texto: '¿No se abrió la app de WhatsApp?', boton: 'Abrir WhatsApp Web', ejecutar: abrir });
      },
      ofrecerDescarga: (nombre, descargar) => useAvisos.getState().mostrarAccion({ texto: `PDF descargado: ${nombre}. Adjuntalo en el chat con 📎`, boton: 'Descargar de nuevo', ejecutar: descargar }),
    });
  }

  return { datos, mensaje: error instanceof Error ? error.message : 'Preparando estado de cuenta…', cerrar, enviar };
}
