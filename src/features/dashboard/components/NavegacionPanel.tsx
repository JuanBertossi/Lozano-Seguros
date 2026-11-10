import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';

interface Navegacion {
  nombre: string;
  activa: string;
  entradas: { clave: string; nombre: string; color?: string }[];
  buscar: (texto: string) => { id: string; principal: string; secundario: string }[];
  abrir: (id: string) => void;
  navegar: (clave: string) => void;
  salir: () => void;
}

export function NavegacionPanel() {
  const datos = usePanelEvent<Navegacion>('agencia:navegacion');
  return datos && <Contenido datos={datos} />;
}

function Contenido({ datos }: { datos: Navegacion }) {
  const [consulta, setConsulta] = useState('');
  const [abierto, setAbierto] = useState(false);
  const buscador = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function cerrar(event: MouseEvent) {
      if (!buscador.current?.contains(event.target as Node)) setAbierto(false);
    }
    document.addEventListener('click', cerrar);
    return () => document.removeEventListener('click', cerrar);
  }, []);

  const resultados = consulta.trim() ? datos.buscar(consulta) : [];

  return (
    <>
      <div aria-label="Navegación principal" className="contents">
        <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-3.5 max-[820px]:hidden">
          <div aria-hidden="true" className="inline-grid grid-cols-[repeat(3,7px)] gap-0.5">{Array.from({ length: 6 }, (_, i) => <span key={i} className={`size-[7px] rounded-full ${i === 1 ? 'bg-[var(--ac)]' : 'bg-[var(--ink)]'}`} />)}</div>
          <div><b className="block text-[15px]">{datos.nombre}</b><span className="block text-xs text-[var(--mu)]">Socios · seguros · juegos</span></div>
        </div>
        {datos.entradas.map((entrada, indice) => entrada.clave === '_g' ? (
          <div key={indice} className="px-2.5 pt-3.5 pb-1 text-[11px] font-semibold tracking-[.06em] text-[var(--mu)] uppercase max-[820px]:hidden">{entrada.nombre}</div>
        ) : (
          <button key={entrada.clave} type="button" aria-current={datos.activa === entrada.clave ? 'page' : undefined}
            className={`flex cursor-pointer items-center gap-[9px] rounded-[9px] border-0 px-2.5 py-2 text-left text-[14.5px] font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--ac)] max-[820px]:text-[13.5px] ${datos.activa === entrada.clave ? 'bg-[var(--ac-s)] font-semibold text-[var(--ink)]' : 'bg-transparent text-[var(--mu)] hover:bg-[var(--sf2)] hover:text-[var(--ink)]'}`}
            onClick={() => { setConsulta(''); setAbierto(false); datos.navegar(entrada.clave); }}>
            {entrada.color && <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px] bg-[var(--color-producto)]" style={{ '--color-producto': entrada.color } as CSSProperties} />}
            {entrada.nombre}
          </button>
        ))}
        <div className="mt-auto px-2.5 pt-3 pb-1 text-xs text-[var(--mu)] max-[820px]:hidden">
          <div className="flex items-center gap-2.5">
            <span className="inline-grid size-8 place-items-center rounded-full bg-[var(--ac-s)] font-semibold text-[var(--ac)]">{datos.nombre[0]?.toUpperCase()}</span>
            <span><b className="text-[13.5px] text-[var(--ink)]">{datos.nombre}</b><br /><button className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[var(--mu)] hover:underline" onClick={datos.salir}>Cerrar sesión</button></span>
          </div>
        </div>
      </div>
      {createPortal(<div className="mb-[22px] flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] max-w-[460px] flex-1" ref={buscador}>
          <svg className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--mu)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input aria-label="Buscar socio, número de lotería o de rifa" className="w-full rounded-[10px] border border-solid border-[var(--ln)] bg-[var(--sf)] py-2.5 pr-3 pl-9" placeholder="Buscar socio, N° de lotería o de rifa…" autoComplete="off" value={consulta} onFocus={() => setAbierto(true)} onChange={(event) => { setConsulta(event.target.value); setAbierto(true); }} onKeyDown={(event) => { if (event.key === 'Escape') { setConsulta(''); setAbierto(false); } }} />
          {abierto && consulta.trim() && <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-20 max-h-[360px] overflow-auto rounded-[10px] border border-solid border-[var(--ln)] bg-[var(--sf)] shadow-lg">
            {resultados.length ? resultados.map((resultado, indice) => <button key={indice} type="button" className="flex w-full cursor-pointer justify-between gap-2 border-0 border-b border-solid border-[var(--ln2)] bg-transparent px-3 py-[9px] text-left hover:bg-[var(--sf2)]" onClick={() => { setConsulta(''); setAbierto(false); datos.abrir(resultado.id); }}><span>{resultado.principal}</span><span className="text-[13px] text-[var(--mu)]">{resultado.secundario}</span></button>) : <p className="px-3 py-2.5 text-sm text-[var(--mu)]">Sin resultados</p>}
          </div>}
        </div>
      </div>, document.getElementById('panel-topbar')!)}
    </>
  );
}
