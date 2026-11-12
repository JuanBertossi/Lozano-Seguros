import { useQueryClient } from '@tanstack/react-query';
import { obtenerRevision } from '../../../shared/hooks/useSesion';
import { avisar } from '../../../shared/stores/avisos.store';
import { leerPdfSocio } from '../api/socios.service';
import { generarPdfSocio } from '../lib/pdfSocio';

/** `soloArmar` devuelve el archivo (para adjuntarlo a WhatsApp) en lugar de descargarlo. */
export function usePdfSocio() {
  const cliente = useQueryClient();
  return async (socioId: string, soloArmar: boolean) => {
    const revision = obtenerRevision();
    if (revision === null) return null;
    try {
      const datos = await cliente.fetchQuery({ queryKey: ['socios', 'pdf', revision, socioId], queryFn: () => leerPdfSocio(revision, socioId), staleTime: 0 });
      return await generarPdfSocio(datos, soloArmar);
    } catch (error) {
      avisar(error instanceof Error ? error.message : 'No se pudo preparar el PDF.');
      return null;
    }
  };
}
