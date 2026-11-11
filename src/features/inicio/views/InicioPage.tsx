import type { CSSProperties } from 'react';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';

type Producto = { nombre: string; color: string; monto: string };
type VistaInicio = {
  nombre: string; fecha: string; migrado: boolean; total: string; debe: boolean; favor: string; tieneFavor: boolean;
  productos: Producto[]; sorteo: { nombre: string; resumen: string }; sinOf: string[]; noCompr: string[];
  cheques: { id: string; sid: string; nombre: string; monto: string; medio: string; fecha: string }[];
  vencimientos: { id: string; sid: string; nombre: string; descripcion: string; fecha: string; dias: number }[];
  deudores: { sid: string; nombre: string; monto: string; productos: Pick<Producto, 'nombre' | 'color'>[] }[];
  verSocio: (id: string) => void; depositar: (id: string) => void; loteria: () => void; cerrarAviso: () => void;
};
const card = 'mb-4 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-5 py-[18px]';
const smallButton = 'cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-[9px] py-[5px] text-[13px] font-medium hover:bg-[var(--sf2)]';
const list = '[&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:gap-2.5 [&>div]:border-b [&>div]:border-solid [&>div]:border-[var(--ln2)] [&>div]:py-2 [&>div:last-child]:border-0';
const empty = 'px-1 py-3.5 text-sm text-[var(--mu)]';
const tag = 'inline-block whitespace-nowrap rounded-full bg-[var(--sf2)] px-2 py-0.5 text-xs font-medium text-[var(--mu)]';

export function InicioPage() {
  const vista = usePanelEvent<VistaInicio>('agencia:inicio');
  if (!vista) return null;
  return <section aria-labelledby="titulo-inicio">
    {vista.migrado && <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-[var(--sf2)] p-3"><span>Se pasaron tus clientes y seguros de la versión anterior. Revisá el medio de pago de cada seguro.</span><button className={smallButton} onClick={vista.cerrarAviso}>Listo</button></div>}
    <header className="mb-[18px]"><h1 id="titulo-inicio" className="text-2xl font-semibold">Hola{vista.nombre ? `, ${vista.nombre}` : ''}</h1><p className="mt-[3px] text-sm text-[var(--mu)]">{vista.fecha}</p></header>
    <div className="mb-4 grid gap-3 min-[1100px]:grid-cols-[minmax(200px,0.9fr)_minmax(0,4fr)]">
      <div className="min-w-0 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-3.5"><small className="block truncate text-[13px] text-[var(--mu)]">Te deben en total</small><b className={`mt-0.5 block truncate text-[clamp(18px,2vw,30px)] ${vista.debe ? 'text-[var(--bad)]' : ''}`}>{vista.total}</b>{vista.tieneFavor && <div className="mt-2 flex flex-wrap items-baseline justify-between gap-1 border-t border-solid border-[var(--ln2)] pt-2"><small className="text-[13px] text-[var(--mu)]">A favor de socios</small><b className="text-[17px] text-[var(--ok)]">{vista.favor}</b></div>}</div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-3 min-[1100px]:grid-cols-5">{vista.productos.map(p=><div key={p.nombre} className="min-w-0 rounded-[14px] border border-solid border-[var(--ln)] border-t-[3px] bg-[var(--sf)] px-3.5 py-3" style={{ borderTopColor:p.color }}><small className="block truncate text-[13px] text-[var(--mu)]">{p.nombre}</small><b className="mt-0.5 block truncate text-[22px]">{p.monto}</b></div>)}</div>
    </div>
    <div className="grid grid-cols-1 gap-4 min-[820px]:grid-cols-2">
      <div className={`${card} border-l-4 border-l-[var(--lot)]`}><div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5"><div><h2 className="text-lg font-semibold">{vista.sorteo.nombre}</h2><p className="text-sm text-[var(--mu)]">{vista.sorteo.resumen}</p></div><button className={smallButton} onClick={vista.loteria}>Ir a Lotería</button></div><p className="mb-1 text-xs font-semibold text-[var(--mu)]">Sin ofrecer todavía ({vista.sinOf.length})</p>{vista.sinOf.length ? <div className="py-2 text-sm">{vista.sinOf.slice(0,12).join(', ')}{vista.sinOf.length>12 ? ` y ${vista.sinOf.length-12} más` : ''}</div>:<p className={empty}>Ya le ofreciste a todos.</p>}{vista.noCompr.length>0 && <><p className="mb-1 mt-3 text-xs font-semibold text-[var(--mu)]">Le ofreciste y no compró ({vista.noCompr.length})</p><p className="text-sm">{vista.noCompr.join(', ')}</p></>}</div>
      <div>{vista.cheques.length>0 && <div className={`${card} border-l-4 border-l-[var(--ok)]`}><div className="mb-2.5"><h2 className="text-lg font-semibold">Cheques a cobrar</h2><p className="text-sm text-[var(--mu)]">Cheques y e-cheqs con fecha de cobro cargada.</p></div><div className={list}>{vista.cheques.map(c=><div key={c.id}><button className="cursor-pointer border-0 bg-transparent p-0 text-left" onClick={()=>vista.verSocio(c.sid)}>{c.nombre} · <b className="text-[17px]">{c.monto}</b><br/><span className="text-sm text-[var(--mu)]">{c.medio}</span></button><span className="flex items-center gap-2"><span className={tag}>{c.fecha}</span><button className={smallButton} onClick={()=>vista.depositar(c.id)}>Depositado</button></span></div>)}</div></div>}
      <div className={`${card} border-l-4 border-l-[var(--seg)]`}><h2 className="mb-2.5 text-lg font-semibold">Seguros por vencer</h2><div className={list}>{vista.vencimientos.length ? vista.vencimientos.map(x=><div key={x.id}><button className="cursor-pointer border-0 bg-transparent p-0 text-left" onClick={()=>vista.verSocio(x.sid)}>{x.nombre}<br/><span className="text-sm text-[var(--mu)]">{x.descripcion}</span></button><span className={tag}>{x.fecha}</span></div>):<p className={empty}>Nada vence en los próximos 30 días.</p>}</div></div></div>
    </div>
    <div className={card}><h2 className="mb-2.5 text-lg font-semibold">Quién te debe</h2><div className={list}>{vista.deudores.length ? vista.deudores.map(d=><div key={d.sid}><button className="cursor-pointer border-0 bg-transparent p-0 text-left" onClick={()=>vista.verSocio(d.sid)}>{d.nombre} {d.productos.map(p=><span key={p.nombre} className="m-0.5 inline-flex items-center gap-[5px] rounded-md border border-solid border-[var(--ln)] px-2 py-0.5 text-xs font-medium before:size-[7px] before:rounded-[2px] before:bg-[var(--producto)] before:content-['']" style={{'--producto':p.color} as CSSProperties}>{p.nombre}</span>)}</button><b className="text-[17px] text-[var(--bad)]">{d.monto}</b></div>):<p className={empty}>Nadie te debe nada. 🎉</p>}</div></div>
  </section>;
}
