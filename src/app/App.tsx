import { useEffect, useState } from 'react';
import { LoginPage } from '../features/auth/views/LoginPage';
import type { LoginInput } from '../features/auth/login.schema';
import { DashboardPage } from '../features/dashboard/views/DashboardPage';
import { InicioPage } from '../features/inicio/views/InicioPage';
import { TotoPage } from '../features/toto/views/TotoPage';
import { TotoDialog } from '../features/toto/components/TotoDialog';
import { TotoPagoDialog } from '../features/toto/components/TotoPagoDialog';
import { QuiniPage } from '../features/quini/views/QuiniPage';
import { QuiniDialog } from '../features/quini/components/QuiniDialog';
import { PlanQuiniDialog } from '../features/quini/components/PlanQuiniDialog';
import { EspecialQuiniDialog } from '../features/quini/components/EspecialQuiniDialog';
import { LoteriaPage } from '../features/loteria/views/LoteriaPage';
import { VentaDialog } from '../features/loteria/components/VentaDialog';
import { QuinielaPage } from '../features/quiniela/views/QuinielaPage';
import { QuinielaDialog } from '../features/quiniela/components/QuinielaDialog';
import { RifaPage } from '../features/rifa/views/RifaPage';
import { RifaDialog } from '../features/rifa/components/RifaDialog';
import { SocioCabecera } from '../features/socios/components/SocioCabecera';
import { SocioDetalle } from '../features/socios/components/SocioDetalle';
import { SocioJugadas } from '../features/socios/components/SocioJugadas';
import { SocioSeguros } from '../features/socios/components/SocioSeguros';
import { SocioRifas } from '../features/socios/components/SocioRifas';
import { SocioLoteria } from '../features/socios/components/SocioLoteria';
import { WhatsAppDialog } from '../features/socios/components/WhatsAppDialog';
import { SociosPage } from '../features/socios/views/SociosPage';
import { SocioDialog } from '../features/socios/components/SocioDialog';
import { ChequesPage } from '../features/cheques/views/ChequesPage';
import { AjustesPage } from '../features/ajustes/views/AjustesPage';
import { ActividadPage } from '../features/actividad/views/ActividadPage';
import { SegurosPage } from '../features/seguros/views/SegurosPage';
import { SeguroDialog } from '../features/seguros/components/SeguroDialog';
import { PagoDialog } from '../shared/components/PagoDialog';
import { CobroDialog } from '../features/cobros/components/CobroDialog';
import { SorteoDialog } from '../features/ajustes/components/SorteoDialog';
import { agencia, type DatosAgencia } from '../shared/lib/supabase.service';
import { buscarSocioPorNombre, numeroWhatsApp, proximoNumeroSocio } from '../features/socios/lib/socios.helpers';
import { abrirChatWhatsApp, esMovil } from '../features/socios/lib/whatsapp';

type VentanaAgencia = Window & {
  agencia?: typeof agencia;
  cargarAgencia?: (datos: DatosAgencia) => void;
  sociosHelpers?: { buscarSocioPorNombre: typeof buscarSocioPorNombre; proximoNumeroSocio: typeof proximoNumeroSocio; numeroWhatsApp: typeof numeroWhatsApp; abrirChatWhatsApp: typeof abrirChatWhatsApp; esMovil: typeof esMovil };
};

const ventana = window as VentanaAgencia;
ventana.sociosHelpers = { buscarSocioPorNombre, proximoNumeroSocio, numeroWhatsApp, abrirChatWhatsApp, esMovil };
let cargaPanel: Promise<void> | undefined;

function cargarPanel() {
  if (!cargaPanel) {
    cargaPanel = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = import.meta.env.BASE_URL + 'dashboard-runtime.js';
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error('No se pudo cargar el panel. Volvé a intentar.'));
      };
      document.head.append(script);
    }).catch((error: unknown) => {
      cargaPanel = undefined;
      throw error;
    });
  }
  return cargaPanel;
}

export function App() {
  const [ingresado, setIngresado] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    function alSalir(event: Event) {
      setIngresado(false);
      setMensaje((event as CustomEvent<string>).detail);
    }
    window.addEventListener('agencia:salir', alSalir);
    return () => window.removeEventListener('agencia:salir', alSalir);
  }, []);

  async function ingresar({ usuario, password }: LoginInput) {
    if (!agencia) return;
    setMensaje('');
    try {
      await agencia.ingresar(usuario, password);
      const datos = await agencia.leer();
      ventana.agencia = agencia;
      await cargarPanel();
      if (!ventana.cargarAgencia) throw new Error('No se pudo inicializar el panel.');
      ventana.cargarAgencia(datos);
      setIngresado(true);
    } catch (error) {
      await agencia.salir().catch(() => {});
      setMensaje(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    }
  }

  return (
    <>
      <DashboardPage encabezado={<SocioCabecera />}><SocioDetalle /><SocioJugadas /><SocioSeguros /><SocioRifas /><SocioLoteria /><InicioPage /><TotoPage /><QuiniPage /><LoteriaPage /><QuinielaPage /><RifaPage /><SociosPage /><ChequesPage /><AjustesPage /><ActividadPage /><SegurosPage /></DashboardPage>
      {ingresado && <><SocioDialog /><SorteoDialog /><SeguroDialog /><QuiniDialog /><PlanQuiniDialog /><EspecialQuiniDialog /><QuinielaDialog /><VentaDialog /><RifaDialog /><TotoDialog /><TotoPagoDialog /><WhatsAppDialog /><PagoDialog /><CobroDialog /></>}
      {!ingresado && <LoginPage configurado={Boolean(agencia)} mensaje={mensaje} ingresar={ingresar} />}
    </>
  );
}
