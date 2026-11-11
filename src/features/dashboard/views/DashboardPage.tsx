import type { ReactNode } from 'react';
import { NavegacionPanel } from '../components/NavegacionPanel';
import { EstadoGuardado } from '../components/EstadoGuardado';
import { AvisosPanel } from '../components/AvisosPanel';

export function DashboardPage({ children, encabezado }: { children: ReactNode; encabezado?: ReactNode }) {
  return (
    <>
      <aside id="side"><NavegacionPanel /></aside>
      <main id="main">
        <div id="panel-topbar" />
        {encabezado}
        {children}
      </main>
      <AvisosPanel />
      <EstadoGuardado />
    </>
  );
}
