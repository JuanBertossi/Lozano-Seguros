import { LoginPage } from '../features/auth/views/LoginPage';
import { DashboardPage } from '../features/dashboard/views/DashboardPage';
import { InicioPage } from '../features/inicio/views/InicioPage';
import { TotoPage } from '../features/toto/views/TotoPage';
import { TotoDialog } from '../features/toto/components/TotoDialog';
import { TotoPagoDialog } from '../features/toto/components/TotoPagoDialog';
import { QuiniPage } from '../features/quini/views/QuiniPage';
import { QuiniDialog } from '../features/quini/components/QuiniDialog';
import { PlanQuiniDialog } from '../features/quini/components/PlanQuiniDialog';
import { EspecialQuiniDialog } from '../features/quini/components/EspecialQuiniDialog';
import { GeneracionQuini } from '../features/quini/components/GeneracionQuini';
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
import { agencia } from '../shared/lib/supabase.service';
import { useAuth } from '../shared/stores/auth.store';
import { useIngreso } from './hooks/useIngreso';

export function App() {
  const ingresado = useAuth((estado) => estado.ingresado);
  const mensaje = useAuth((estado) => estado.mensaje);
  const ingresar = useIngreso();

  return (
    <>
      <DashboardPage encabezado={<SocioCabecera />}><SocioDetalle /><SocioJugadas /><SocioSeguros /><SocioRifas /><SocioLoteria /><InicioPage /><TotoPage /><QuiniPage /><LoteriaPage /><QuinielaPage /><RifaPage /><SociosPage /><ChequesPage /><AjustesPage /><ActividadPage /><SegurosPage /></DashboardPage>
      {ingresado && <><GeneracionQuini /><SocioDialog /><SorteoDialog /><SeguroDialog /><QuiniDialog /><PlanQuiniDialog /><EspecialQuiniDialog /><QuinielaDialog /><VentaDialog /><RifaDialog /><TotoDialog /><TotoPagoDialog /><WhatsAppDialog /><PagoDialog /><CobroDialog /></>}
      {!ingresado && <LoginPage configurado={Boolean(agencia)} mensaje={mensaje} ingresar={ingresar} />}
    </>
  );
}
