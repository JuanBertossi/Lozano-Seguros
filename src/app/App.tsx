import { useEffect, useState } from 'react';
import { LoginPage } from '../features/auth/views/LoginPage';
import type { LoginInput } from '../features/auth/login.schema';
import { DashboardPage } from '../features/dashboard/views/DashboardPage';
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

type VentanaAgencia = Window & {
  agencia?: typeof agencia;
  cargarAgencia?: (datos: DatosAgencia) => void;
};

const ventana = window as VentanaAgencia;
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
      <DashboardPage><SociosPage /><ChequesPage /><AjustesPage /><ActividadPage /><SegurosPage /></DashboardPage>
      {ingresado && <><SocioDialog /><SorteoDialog /><SeguroDialog /><PagoDialog /><CobroDialog /></>}
      {!ingresado && <LoginPage configurado={Boolean(agencia)} mensaje={mensaje} ingresar={ingresar} />}
    </>
  );
}
