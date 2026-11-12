import type { CSSProperties } from 'react';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useCabeceraSocio } from '../hooks/useCabeceraSocio';
import { autor, btn, btnG, btnP, btnSmG, mono, tag } from './estilos';

const col='min-w-[170px] flex-1 px-[18px] py-3.5 max-[820px]:min-w-1/2 max-[820px]:border-b max-[820px]:border-solid max-[820px]:border-[var(--ln2)]';
const title='block text-[12.5px] font-medium text-[var(--mu)]';
const amount='mb-1.5 mt-0.5 block overflow-hidden whitespace-nowrap text-2xl font-bold tracking-[-.02em]';
const detalle='block text-[12.5px] text-[var(--mu)]';
const operador='grid place-items-center px-0.5 text-xl font-light text-[var(--mu)] max-[820px]:hidden';
const chip="mb-px mr-0.5 mt-0.5 inline-flex items-center gap-[5px] rounded-md border border-solid border-[var(--ln)] px-2 py-0.5 text-xs font-medium before:size-[7px] before:rounded-[2px] before:bg-[var(--producto)] before:content-['']";

export function SocioCabecera(){
 const pagina=useNavegacion(e=>e.pagina),socioId=useNavegacion(e=>e.socioId);
 return pagina==='socio'&&socioId?<Contenido key={socioId} socioId={socioId}/>:null;
}
function Contenido({socioId}:{socioId:string}){
 const a=useCabeceraSocio(socioId),v=a.vista;
 if(!v)return <section aria-live="polite">{a.mensaje}</section>;
 return <section aria-labelledby="socio-nombre"><header className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5"><div><button className={btnSmG} onClick={a.volver}>← Socios</button><h1 id="socio-nombre" className="mt-1.5 text-2xl font-semibold tracking-[-.01em]">{v.nombre}</h1><p className="mt-[3px] text-sm text-[var(--mu)]">Socio <span className={mono}>{v.numero}</span>{v.telefono&&` · ${v.telefono}`}{v.direccion&&` · ${v.direccion}`}{v.autor&&<> · <span className={autor}>{v.autor}</span></>}{!v.activo&&<> · <span className={tag}>archivado</span></>}</p></div><div className="flex flex-wrap items-center gap-2"><button className={btnP} onClick={a.cobrar}>Registrar cobro</button><button className={btn} onClick={a.whatsapp}>WhatsApp</button><button className={btn} onClick={a.pdf}>⬇ PDF</button><button className={btnG} onClick={a.editar}>Editar</button></div></header>
 <div className="mb-[18px] flex flex-wrap items-stretch overflow-hidden rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)]"><div className={col}><small className={title}>Deuda vencida</small><b className={`${amount} ${v.tieneDeuda?'text-[var(--bad)]':''}`}>{v.deuda}</b><span className={detalle}>{v.productos.length?v.productos.map(p=><span key={p.nombre} className={chip} style={{'--producto':p.color} as CSSProperties}>{p.nombre} {p.monto}</span>):'Sin deuda'}</span></div><div className={operador}>−</div><div className={col}><small className={title}>Saldo a favor</small><b className={`${amount} ${v.tieneFavor?'text-[var(--ok)]':''}`}>{v.favor}</b><span className={detalle}>Plata que dejó de más</span></div><div className={operador}>=</div><div className={`${col} ${v.resultadoDeuda?'bg-[var(--bad-row)]':'bg-[var(--sf2)]'}`}><small className={title}>{v.resultado}</small><b className={`${amount} ${v.resultadoDeuda?'text-[var(--bad)]':'text-[var(--ok)]'}`}>{v.resultadoMonto}</b><span className={detalle}>{v.resultadoTexto}</span></div>{v.proximo&&<div className={`${col} border-l border-dashed border-[var(--ln)]`}><small className={title}>Por vencer</small><b className={amount}>{v.proximo}</b><span className={detalle}>Cuotas futuras, no suman a la deuda</span></div>}</div>
 <nav className="mb-[18px] flex gap-0.5 overflow-x-auto border-b border-solid border-[var(--ln)]" aria-label="Secciones del socio">{v.tabs.map(t=><button key={t.id} aria-current={a.tab===t.id?'page':undefined} className={`-mb-px flex cursor-pointer items-center gap-[7px] whitespace-nowrap border-0 border-b-[3px] border-solid bg-transparent px-3.5 pb-[11px] pt-2.5 font-medium focus-visible:outline-2 focus-visible:outline-[var(--ac)] ${a.tab===t.id?'text-[var(--ink)]':'border-transparent text-[var(--mu)]'}`} style={a.tab===t.id?{borderBottomColor:t.color}:undefined} onClick={()=>a.cambiarTab(t.id)}><i className="size-2 rounded-[2px]" style={{background:t.color}}/>{t.nombre}{t.cantidad>0&&<span className="text-[13px] text-[var(--mu)]">{t.cantidad}</span>}</button>)}</nav></section>;
}
