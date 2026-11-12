import type { ReactNode } from 'react';
import { NavegacionPanel } from '../components/NavegacionPanel';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useAuth } from '../../../shared/stores/auth.store';
import { AvisosPanel } from '../components/AvisosPanel';

export function DashboardPage({ children, encabezado }: { children: ReactNode; encabezado?: ReactNode }) {
  const bloqueado = useNavegacion((estado) => estado.bloqueado);
  const oculto = !useAuth((estado) => estado.ingresado) ? 'invisible ' : '';
  return (
    <>
      <aside id="side" inert={bloqueado} className={`${oculto}sticky top-0 z-[5] flex h-dvh w-[224px] shrink-0 flex-col gap-0.5 self-start overflow-y-auto border-0 border-r border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-4 max-[820px]:top-[env(safe-area-inset-top,0px)] max-[820px]:h-auto max-[820px]:w-full max-[820px]:flex-row max-[820px]:gap-1 max-[820px]:overflow-x-auto max-[820px]:border-r-0 max-[820px]:border-b max-[820px]:px-2.5 max-[820px]:py-2`}><NavegacionPanel /></aside>
      <main id="main" className={`${oculto}mx-auto min-w-0 max-w-[1680px] flex-1 px-[clamp(20px,3vw,48px)] pt-7 pb-14 [container:main/inline-size] max-[820px]:w-full max-[820px]:self-stretch max-[820px]:px-3.5 max-[820px]:pt-4 max-[820px]:pb-10`}>
        <div id="panel-topbar" />
        {encabezado}
        {children}
      </main>
      <AvisosPanel />
    </>
  );
}
