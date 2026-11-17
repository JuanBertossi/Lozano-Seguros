import { useQuery } from '@tanstack/react-query';
import { useRevision } from '../../../shared/hooks/useSesion';
import { avisar, useAvisos } from '../../../shared/stores/avisos.store';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { enviarWhatsApp, esMovil, mensajeCuenta } from '../lib/whatsapp';
import { numeroWhatsApp } from '../lib/socios.helpers';
import { usePdfSocio } from './usePdfSocio';
import { useFichaSocio } from './useSocios';
import { leerPdfSocio } from '../api/socios.service';

export function useWhatsAppSocio(socioId: string) {
  const cerrar = useDialogos((estado) => estado.cerrar);
  const ficha = useFichaSocio(socioId);
  const revision = useRevision();
  const resumen = useQuery({ queryKey: ['socios', 'pdf', revision, socioId], queryFn: () => leerPdfSocio(revision!, socioId), enabled: revision !== null, staleTime: 0 });
  const pdfSocio = usePdfSocio();

  const error = ficha.error ?? resumen.error;
  const datos = ficha.data && resumen.data ? {
    nombre: ficha.data.socio.nombre,
    telefono: numeroWhatsApp(ficha.data.socio.tel || ''),
    movil: esMovil(),
    mensaje: mensajeCuenta(ficha.data.socio.nombre, resumen.data.cuenta),
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
