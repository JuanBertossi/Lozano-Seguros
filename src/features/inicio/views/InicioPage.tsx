import type { CSSProperties } from 'react';
import { useDepositarCheque, useInicio } from '../hooks/useInicio';
import { useSesion } from '../../../shared/hooks/useSesion';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
const card = 'mb-4 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-5 py-[18px]';
const smallButton = 'cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-[9px] py-[5px] text-[13px] font-medium hover:bg-[var(--sf2)]';
const list = '[&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:gap-2.5 [&>div]:border-b [&>div]:border-solid [&>div]:border-[var(--ln2)] [&>div]:py-2 [&>div:last-child]:border-0';
const empty = 'text-sm text-[var(--mu)]';
const tagMalo = 'inline-block whitespace-nowrap rounded-full bg-[var(--bad-s)] px-2 py-0.5 text-xs font-medium text-[var(--bad)]';
const tagAviso = 'inline-block whitespace-nowrap rounded-full bg-[var(--warn-s)] px-2 py-0.5 text-xs font-medium text-[var(--warn)]';
const kpiNum = 'block overflow-hidden whitespace-nowrap leading-[1.2] tracking-[-.01em]';
const tag = 'inline-block whitespace-nowrap rounded-full bg-[var(--sf2)] px-2 py-0.5 text-xs font-medium text-[var(--mu)]';

export function InicioPage() {
  const pagina = useNavegacion((estado) => estado.pagina);
  return pagina === 'inicio' ? <Contenido /> : null;
}

function Contenido() {
  const consulta = useInicio();
  const operacion = useDepositarCheque();
  const navegar = useNavegacion((estado) => estado.navegar);
  const verSocio = useNavegacion((estado) => estado.verSocio);
  const nombre = useSesion().data?.perfil.nombre.split(' ')[0] ?? '';
  const vista = consulta.data;
  if (!vista) return <section aria-live="polite">{consulta.error instanceof Error ? consulta.error.message : 'Cargando inicio…'}{consulta.isError && <button type="button" onClick={() => void consulta.refetch()}>Reintentar</button>}</section>;
  return <section aria-labelledby="titulo-inicio">
    {operacion.error && <p role="alert">{operacion.error}</p>}
    {operacion.bloqueado && <button className={smallButton} disabled={operacion.procesando} onClick={() => void operacion.enviar()}>Reintentar operación</button>}
    <header className="mb-[18px]"><h1 id="titulo-inicio" className="text-2xl font-semibold tracking-[-.01em]">Hola{nombre ? `, ${nombre}` : ''}</h1><p className="mt-[3px] text-sm text-[var(--mu)]">{vista.fecha}</p></header>
    <div className="mb-4 grid gap-3 @min-[1200px]/main:grid-cols-[minmax(200px,0.9fr)_minmax(0,4fr)]">
      <div className="@container min-w-0 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-3.5"><small className="block truncate text-[13px] text-[var(--mu)]">Te deben en total</small><b className={`mt-0.5 ${kpiNum} text-[clamp(18px,9.5cqi,30px)] ${vista.debe ? 'text-[var(--bad)]' : ''}`}>{vista.total}</b>{vista.tieneFavor && <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-0.5 border-t border-solid border-[var(--ln2)] pt-2" title="Plata que te dieron de más"><small className="whitespace-nowrap text-[13px] text-[var(--mu)]">A favor de socios</small><b className={`${kpiNum} text-[clamp(14px,8cqi,17px)] text-[var(--ok)]`}>{vista.favor}</b></div>}</div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-3 @min-[900px]/main:grid-cols-5">{vista.productos.map(p=><div key={p.nombre} className="@container min-w-0 rounded-[14px] border border-solid border-[var(--ln)] border-t-[3px] bg-[var(--sf)] px-3.5 py-3 @min-[1200px]/main:flex @min-[1200px]/main:flex-col @min-[1200px]/main:justify-between" style={{ borderTopColor:p.color }}><small className="block truncate text-[13px] text-[var(--mu)]">{p.nombre}</small><b className={`mt-0.5 ${kpiNum} text-[clamp(15px,10.5cqi,22px)]`}>{p.monto}</b></div>)}</div>
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 *:min-w-0 @max-[760px]/main:grid-cols-[minmax(0,1fr)]">
      <div className={`${card} border-l-4 border-l-[var(--lot)]`}><div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5"><div><h2 className="text-[17px] font-semibold tracking-[-.01em]">{vista.sorteo.nombre}</h2><p className="text-[13px] text-[var(--mu)]">{vista.sorteo.resumen}</p></div><button className={smallButton} onClick={() => navegar('juegos:lot')}>Ir a Lotería</button></div><p className="mb-1 text-[13px] text-[var(--mu)]">Sin ofrecer todavía ({vista.sinOf.length})</p><div className={list}>{vista.sinOf.length ? <div><span className="text-[13px]">{vista.sinOf.slice(0,12).join(', ')}{vista.sinOf.length>12 ? ` y ${vista.sinOf.length-12} más` : ''}</span></div>:<div className={empty}>Ya le ofreciste a todos.</div>}</div>{vista.noCompr.length>0 && <><p className="mb-1 mt-3 text-[13px] text-[var(--mu)]">Le ofreciste y no compró ({vista.noCompr.length})</p><p className="text-[13px]">{vista.noCompr.join(', ')}</p></>}</div>
      <div>{vista.cheques.length>0 && <div className={`${card} border-l-4 border-l-[var(--ok)]`}><div className="mb-2.5"><h2 className="text-[17px] font-semibold tracking-[-.01em]">Cheques a cobrar</h2><p className="text-[13px] text-[var(--mu)]">Cheques y e-cheqs con fecha de cobro cargada.</p></div><div className={list}>{vista.cheques.map(c=><div key={c.id}><button className="cursor-pointer border-0 bg-transparent p-0 text-left" onClick={()=>verSocio(c.sid)}>{c.nombre} · <b className="text-[17px]">{c.monto}</b><br/><span className="text-[13px] text-[var(--mu)]">{c.medio}</span></button><span className="flex items-center gap-2"><span className={/^(Para depositar|Se cobra hoy)/.test(c.fecha) ? tagAviso : tag}>{c.fecha}</span><button className={smallButton} disabled={operacion.bloqueado} onClick={()=>void operacion.enviar({p_referencia:c.id})}>Depositado</button></span></div>)}</div></div>}
      <div className={`${card} border-l-4 border-l-[var(--seg)]`}><h2 className="mb-2.5 text-[17px] font-semibold tracking-[-.01em]">Seguros por vencer</h2><div className={list}>{vista.vencimientos.length ? vista.vencimientos.map(x=><div key={x.id}><button className="cursor-pointer border-0 bg-transparent p-0 text-left" onClick={()=>verSocio(x.sid)}>{x.nombre}<br/><span className="text-[13px] text-[var(--mu)]">{x.descripcion}</span></button><span className={x.dias<=0 ? tagMalo : x.dias<=7 ? tagAviso : tag}>{x.fecha}</span></div>):<div className={empty}>Nada vence en los próximos 30 días.</div>}</div></div></div>
    </div>
    <div className={card}><h2 className="mb-2.5 text-[17px] font-semibold tracking-[-.01em]">Quién te debe</h2><div className={list}>{vista.deudores.length ? vista.deudores.map(d=><div key={d.sid}><button className="cursor-pointer border-0 bg-transparent p-0 text-left" onClick={()=>verSocio(d.sid)}>{d.nombre} <span className="text-[13px] text-[var(--mu)]">{d.productos.map(p=><span key={p.nombre} className="my-px mr-0.5 inline-flex items-center gap-[5px] rounded-md border border-solid border-[var(--ln)] px-2 py-0.5 text-xs font-medium before:size-[7px] before:rounded-[2px] before:bg-[var(--producto)] before:content-['']" style={{'--producto':p.color} as CSSProperties}>{p.nombre}</span>)}</span></button><b className="text-[17px] text-[var(--bad)]">{d.monto}</b></div>):<div className={empty}>Nadie te debe nada. 🎉</div>}</div></div>
  </section>;
}
