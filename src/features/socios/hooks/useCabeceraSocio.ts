import { useResumenSocio } from '../../../shared/hooks/useResumenSocio';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { avisar } from '../../../shared/stores/avisos.store';
import { useNavegacion, type TabSocio } from '../../../shared/stores/navegacion.store';
import { numeroWhatsApp } from '../lib/socios.helpers';
import { presentarCabecera } from '../lib/cabeceraVista';
import { useFichaSocio } from './useSocios';
import { usePdfSocio } from './usePdfSocio';

export function useCabeceraSocio(socioId: string) {
  const ficha = useFichaSocio(socioId);
  const resumen = useResumenSocio(socioId);
  const tab = useNavegacion((estado) => estado.tabSocio);
  const elegirTabSocio = useNavegacion((estado) => estado.elegirTabSocio);
  const navegar = useNavegacion((estado) => estado.navegar);
  const abrir = useDialogos((estado) => estado.abrir);
  const pdfSocio = usePdfSocio();

  const vista = ficha.data && resumen.data ? presentarCabecera(ficha.data, resumen.data) : null;
  const error = ficha.error ?? resumen.error;

  function whatsapp() {
    if (!ficha.data) return;
    if (!numeroWhatsApp(ficha.data.socio.tel || '')) {
      avisar('Revisá el celular del socio: característica + número, 10 dígitos');
      abrir({ tipo: 'socio', id: socioId });
      return;
    }
    abrir({ tipo: 'whatsapp', sid: socioId });
  }

  return {
    vista,
    tab,
    mensaje: error instanceof Error ? error.message : 'Cargando socio…',
    volver: () => navegar('socios'),
    cobrar: () => abrir({ tipo: 'cobro', sid: socioId }),
    editar: () => abrir({ tipo: 'socio', id: socioId }),
    pdf: () => void pdfSocio(socioId, false),
    cambiarTab: (id: TabSocio) => elegirTabSocio(id),
    whatsapp,
  };
}
