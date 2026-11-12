import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSesion } from '../../../shared/hooks/useSesion';
import { useAuth } from '../../../shared/stores/auth.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useBusquedaServidor } from '../hooks/useBusquedaServidor';
import { avatar, enlace, marcadorTexto } from '../../../shared/lib/clases';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const busquedaSchema = z.object({ consulta: z.string() });

const entradas: { clave: string; nombre: string; color?: string }[] = [
  { clave: 'inicio', nombre: 'Inicio' },
  { clave: 'socios', nombre: 'Socios' },
  { clave: '_g', nombre: 'Productos' },
  { clave: 'seguros', nombre: 'Seguros', color: 'var(--seg)' },
  { clave: 'juegos:q6', nombre: 'Quini 6', color: 'var(--q6)' },
  { clave: 'juegos:lot', nombre: 'Lotería', color: 'var(--lot)' },
  { clave: 'juegos:qui', nombre: 'Quiniela', color: 'var(--qui)' },
  { clave: 'juegos:rifa', nombre: 'Rifa Devoto', color: 'var(--rifa)' },
  { clave: '_g', nombre: 'Agencia' },
  { clave: 'cheques', nombre: 'Cheques y e-cheq' },
  { clave: 'toto', nombre: 'Toto Ortega', color: 'var(--toto)' },
  { clave: '_g', nombre: '' },
  { clave: 'actividad', nombre: 'Actividad' },
  { clave: 'ajustes', nombre: 'Ajustes' },
];

export function NavegacionPanel() {
  const ingresado = useAuth((estado) => estado.ingresado);
  const sesion = useSesion().data;
  return ingresado && sesion ? <Contenido nombre={sesion.perfil.nombre} /> : null;
}

function Contenido({ nombre }: { nombre: string }) {
  const { pagina, juego, navegar, verSocio } = useNavegacion();
  const salir = useAuth((estado) => estado.salir);
  const activa = pagina === 'juegos' ? `juegos:${juego}` : pagina === 'socio' ? 'socios' : pagina;
  const { register, watch, setValue } = useForm<z.infer<typeof busquedaSchema>>({ resolver: zodResolver(busquedaSchema), defaultValues: { consulta: '' } });
  const consulta = watch('consulta');
  const campoBusqueda = register('consulta');
  const [abierto, setAbierto] = useState(false);
  const buscador = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function cerrar(event: MouseEvent) {
      if (!buscador.current?.contains(event.target as Node)) setAbierto(false);
    }
    document.addEventListener('click', cerrar);
    return () => document.removeEventListener('click', cerrar);
  }, []);

  const revision = useSesion().data?.revision ?? null;
  const remoto = useBusquedaServidor(revision, consulta);
  const resultados = remoto.data || [];

  return (
    <>
      <div aria-label="Navegación principal" className="contents">
        <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-3.5 max-[820px]:hidden">
          <div aria-hidden="true" className="inline-grid grid-cols-[repeat(3,7px)] gap-0.5">{Array.from({ length: 6 }, (_, i) => <span key={i} className={`size-[7px] rounded-full ${i === 1 ? 'bg-[var(--ac)]' : 'bg-[var(--ink)]'}`} />)}</div>
          <div><b className="block text-[15px]">{nombre}</b><span className="block text-xs text-[var(--mu)]">Socios · seguros · juegos</span></div>
        </div>
        {entradas.map((entrada, indice) => entrada.clave === '_g' ? (
          <div key={indice} className="px-2.5 pt-3.5 pb-1 text-[11px] font-semibold tracking-[.06em] text-[var(--mu)] uppercase max-[820px]:hidden">{entrada.nombre}</div>
        ) : (
          <button key={entrada.clave} type="button" aria-current={activa === entrada.clave ? 'page' : undefined}
            className={`flex cursor-pointer items-center gap-[9px] rounded-[9px] border-0 px-2.5 py-2 text-left text-[14.5px] font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ac)] max-[820px]:text-[13.5px] ${activa === entrada.clave ? 'bg-[var(--ac-s)] font-semibold text-[var(--ink)]' : 'bg-transparent text-[var(--mu)] hover:bg-[var(--sf2)] hover:text-[var(--ink)]'}`}
            onClick={() => { setValue('consulta', ''); setAbierto(false); navegar(entrada.clave); }}>
            {entrada.color && <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px] bg-[var(--color-producto)]" style={{ '--color-producto': entrada.color } as CSSProperties} />}
            {entrada.nombre}
          </button>
        ))}
        <div className="mt-auto px-2.5 pt-3 pb-1 text-xs text-[var(--mu)] max-[820px]:hidden">
          <div className="flex items-center gap-2.5">
            <span className={avatar()}>{nombre[0]?.toUpperCase()}</span>
            <span><b className="text-[13.5px] text-[var(--ink)]">{nombre}</b><br /><button type="button" className={`${enlace} text-[13px]`} onClick={() => void salir()}>Cerrar sesión</button></span>
          </div>
        </div>
      </div>
      {createPortal(<div className="mb-[22px] flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[460px] min-w-[220px] flex-1" ref={buscador}>
          <svg className="absolute top-1/2 left-[11px] -translate-y-1/2 text-[var(--mu)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input aria-label="Buscar socio, número de lotería o de rifa" className={`w-full rounded-[10px] border border-solid border-[var(--ln)] bg-[var(--sf)] py-2.5 pr-3 pl-9 ${marcadorTexto}`} placeholder="Buscar socio, N° de lotería o de rifa…" autoComplete="off" {...campoBusqueda} onFocus={() => setAbierto(true)} onChange={(event) => { void campoBusqueda.onChange(event); setAbierto(true); }} onKeyDown={(event) => { if (event.key === 'Escape') { setValue('consulta', ''); setAbierto(false); } }} />
          {abierto && consulta.trim() && <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-20 max-h-[360px] overflow-auto rounded-[10px] border border-solid border-[var(--ln)] bg-[var(--sf)] shadow-[0_8px_24px_rgba(0,0,0,.12)]">
            {remoto.isError ? <p role="alert" className="px-3 py-2.5 text-sm text-[var(--bad)]">{remoto.error instanceof Error ? remoto.error.message : 'No se pudo buscar.'}</p> : remoto.esperando ? <p className="px-3 py-2.5 text-sm text-[var(--mu)]">Buscando…</p> : resultados.length ? resultados.map((resultado, indice) => <button key={indice} type="button" className="flex w-full cursor-pointer justify-between gap-2.5 border-0 border-b border-solid border-[var(--ln2)] bg-transparent px-3 py-[9px] text-left hover:bg-[var(--sf2)] focus-visible:bg-[var(--sf2)]" onClick={() => { setValue('consulta', ''); setAbierto(false); verSocio(resultado.id); }}><span>{resultado.principal}</span><span className="text-[13px] text-[var(--mu)]">{resultado.secundario}</span></button>) : <p className="px-3 py-2.5 text-sm text-[var(--mu)]">Sin resultados</p>}
          </div>}
        </div>
      </div>, document.getElementById('panel-topbar')!)}
    </>
  );
}
