import type { ReactNode } from 'react';
import { NavegacionPanel } from '../components/NavegacionPanel';

export function DashboardPage({ children }: { children: ReactNode }) {
  return (
    <>
      <aside id="side"><NavegacionPanel /></aside>
      <main id="main">
        <div id="panel-topbar" />
        <div id="panel-legacy" />
        {children}
      </main>
      <div className="ov" id="ov" hidden onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.hidden = true;
      }}>
        <div className="modal" id="modal" role="dialog" aria-modal="true" />
      </div>
      <div className="toast" id="toast" role="status" />
      <div className="snack" id="snack" role="status" />
      <div id="estado-guardado" className="lgbox fixed right-4 bottom-4 z-[90] !px-4 !py-3" role="status" hidden />
    </>
  );
}
