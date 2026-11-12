import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useVistaQuiniela } from '../hooks/useVistaQuiniela';
import type { FilaQuiniela } from '../lib/quinielaVista';

type Vista=NonNullable<ReturnType<typeof useVistaQuiniela>['vista']>;
// Estilos de la maqueta (.card, .btn, .kpi, .seg, .pay, .lnk…) expresados con utilidades.
const card='mb-4 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-5 py-[18px]';
const btn='inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-[13px] py-2 text-sm font-medium transition-colors duration-100 hover:bg-[var(--sf2)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ac)] disabled:cursor-default disabled:opacity-40';
const primario=`${btn} !border-[var(--ac)] !bg-[var(--ac)] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] hover:brightness-[1.08] [[data-theme=dark]_&]:text-[#0b1f17]`;
const chico='!px-[9px] !py-[5px] !text-[13px]';
const fantasma='!border-transparent !bg-transparent hover:!bg-[var(--sf2)]';
const link='cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-[var(--ink)] hover:text-[var(--ac)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--ac)]';
const pago='inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-solid px-3 py-[5px] text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--ac)]';
const base='[&>td]:border-b-2 [&>td]:border-[var(--sf)]';
const fila={ok:`${base} [&>td]:bg-[var(--ok-row)] [&>td:first-child]:shadow-[inset_4px_0_0_var(--okb)]`,par:`${base} [&>td]:bg-[color-mix(in_srgb,var(--warn-s)_60%,var(--sf))] [&>td:first-child]:shadow-[inset_4px_0_0_var(--warn)]`,mal:`${base} [&>td]:bg-[var(--bad-row)] [&>td:first-child]:shadow-[inset_4px_0_0_var(--badb)]`};
const celda='border-b border-solid border-[var(--ln2)] px-2 py-2.5 align-middle';
const celdaNum='whitespace-nowrap text-right text-[16.5px] font-semibold max-[820px]:text-base';
const celdaMono="font-['IBM_Plex_Mono',ui-monospace,Menlo,monospace] text-[1.08em] font-semibold tracking-[.02em] max-[820px]:text-base";
const fechaSchema=z.object({fecha:z.iso.date()});

function Fecha({fecha,cambiar}:{fecha:string;cambiar:(fecha:string)=>void}){
 const {register,handleSubmit}=useForm<z.infer<typeof fechaSchema>>({resolver:zodResolver(fechaSchema),values:{fecha}});
 const campo=register('fecha');
 // Imita el botón «Elegir otra fecha» de la maqueta: el campo nativo queda encima, transparente, y abre su selector al hacer clic.
 return <form className="relative inline-block" onChange={()=>{void handleSubmit(x=>cambiar(x.fecha))()}}><input {...campo} type="date" aria-label="Elegir otra fecha" className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" onClick={event=>{try{event.currentTarget.showPicker()}catch{/* el navegador no lo permite */}}}/><span className="flex items-center gap-2 rounded-lg border border-solid border-transparent px-1.5 py-0.5 text-[13px] text-[var(--mu)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-[var(--ac)]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-none text-[var(--ac)]"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><span>Elegir otra fecha</span></span></form>;
}
function Estado({j,v}:{j:FilaQuiniela;v:Vista}){
 return j.pagado
  ?<button className={`${pago} border-[#BFE3CF] bg-[var(--ok-s)] text-[var(--ok)]`} onClick={()=>v.editarPago(j.id)}>✓ Pagado · editar</button>
  :<><button className={`${pago} border-[var(--badb)] bg-[var(--badb)] text-white hover:brightness-[1.08]`} onClick={()=>v.cobrar(j.sid,j.id)}>{j.abono?`Cobrar ${j.restante}`:'Cobrar'}</button>{j.abono&&<span className="mt-[3px] block whitespace-nowrap text-[11.5px] text-[var(--warn)]">Pagó {j.abono} de {j.monto}</span>}</>;
}
function Tabla({filas,v,otros=false}:{filas:FilaQuiniela[];v:Vista;otros?:boolean}){
 return <div className="overflow-x-auto"><table className="w-full border-collapse text-[15px]">{!otros&&<thead><tr>{['Hora','Socio','Números','Cargó','Monto','Estado',''].map((h,i)=><th key={i} className={`whitespace-nowrap border-b border-solid border-[var(--ln)] px-2 py-[7px] text-[13px] font-medium text-[var(--mu)] ${h==='Monto'?'text-right':'text-left'}`}>{h}</th>)}</tr></thead>}<tbody>{filas.map(j=><tr key={j.id} className={otros?fila.mal:j.pagado?fila.ok:j.abono?fila.par:fila.mal}>
  {otros?<td className={`${celda} w-[110px]`}>{j.fecha}</td>:<td className={`${celda} text-[var(--mu)]`}>{j.hora}</td>}
  <td className={celda}><button className={link} onClick={()=>v.verSocio(j.sid)}>{j.socio}</button></td>
  <td className={`${celda} ${celdaMono}`}>{j.numeros}</td>
  {!otros&&<td className={`${celda} whitespace-nowrap text-xs italic text-[var(--mu)]`}>{j.autor||'—'}</td>}
  <td className={`${celda} ${celdaNum} ${j.pagado?'text-[var(--ok)]':j.abono&&!otros?'':'text-[var(--bad)]'}`}>{j.monto}</td>
  <td className={`${celda} ${otros?'w-[110px]':''}`}><Estado j={j} v={v}/></td>
  <td className={`${celda} ${otros?'':celdaNum}`}><button className={`${btn} ${chico} ${fantasma}`} onClick={()=>v.editar(j.id)}>Editar</button></td></tr>)}</tbody></table></div>;
}
export function QuinielaPage(){
 const visible=useNavegacion(e=>e.pagina==='juegos'&&e.juego==='qui');
 return visible?<Contenido/>:null;
}
function Contenido(){
 const {vista:v,mensaje}=useVistaQuiniela();
 if(!v)return <section className={card} aria-live="polite">{mensaje}</section>;
 const kpis=[['Jugado en el día',v.total,`${v.cantidad} jugada${v.cantidad===1?'':'s'}`],['Cobrado',v.cobrado,''],['Falta cobrar',v.falta,'']];
 return <section aria-labelledby="titulo-quiniela"><header className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5"><div><h1 id="titulo-quiniela" className="border-l-[5px] border-solid border-[var(--qui)] pl-3 text-2xl font-semibold tracking-[-.01em]">Quiniela</h1><p className="mt-[3px] text-sm text-[var(--mu)]">Jugadas del día. Navegá los días con las flechas.</p></div><button className={primario} onClick={v.cargar}>+ Cargar jugadas</button></header>
 <div className={`${card} flex flex-wrap items-center gap-2.5`}><button className={btn} aria-label="Día anterior" onClick={()=>v.ir(-1)}>‹</button><div className="min-w-[220px] max-w-[460px] flex-1 rounded-[10px] border border-solid border-[var(--ln)] bg-[var(--sf2)] px-3.5 py-[7px] text-center"><b className="block text-lg first-letter:uppercase">{v.titulo}</b><span className="flex flex-wrap items-center justify-center gap-1.5 text-[13px] text-[var(--mu)]"><Fecha fecha={v.fecha} cambiar={v.cambiarFecha}/></span></div><button className={btn} aria-label="Día siguiente" onClick={()=>v.ir(1)}>›</button>{!v.hoy&&<button className={`${btn} ${fantasma}`} onClick={v.irHoy}>Volver a hoy</button>}</div>
 <div className="mb-4 grid grid-cols-3 gap-3">{kpis.map(([titulo,valor,sub],i)=><div key={titulo} className={`min-w-0 rounded-[14px] border border-solid px-4 py-3.5 [container-type:inline-size] ${i===2&&v.deuda?'border-[#F1C7C3] bg-[var(--bad-row)]':'border-[var(--ln)] bg-[var(--sf)]'}`}><small className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[var(--mu)]">{titulo}</small><b className={`mt-0.5 block overflow-hidden whitespace-nowrap text-[clamp(15px,10.5cqi,22px)] leading-[1.2] tracking-[-.01em] max-[820px]:text-[clamp(14px,10cqi,18px)] ${i===1?'text-[var(--ok)]':i===2&&v.deuda?'text-[var(--bad)]':''}`}>{valor}</b>{sub&&<span className="mt-0.5 block text-[13px] text-[var(--mu)]">{sub}</span>}</div>)}</div>
 <div className={card}><div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5"><h2 className="text-[17px] font-semibold tracking-[-.01em]">Jugadas del día</h2>{v.cantidad>0&&<div className="inline-flex flex-wrap overflow-hidden rounded-[9px] border border-solid border-[var(--ln)]">{([['todos','Todos'],['deben','Deben'],['pagados','Pagados']] as const).map(([id,n])=><button key={id} aria-pressed={v.filtro===id} className={`cursor-pointer border-0 border-solid border-[var(--ln)] px-3 py-1.5 text-[13.5px] focus-visible:outline-2 focus-visible:outline-[var(--ac)] [&:not(:last-child)]:border-r ${v.filtro===id?'bg-[var(--ac-s)] font-semibold text-[var(--ink)]':'bg-transparent'}`} onClick={()=>v.filtrar(id)}>{n}</button>)}</div>}</div>{v.cantidad?(v.filas.length?<Tabla filas={v.filas} v={v}/>:<p className="px-1 py-3.5 text-sm text-[var(--mu)]">Nada en este filtro.</p>):<div className="px-3 py-[26px] text-center text-[var(--mu)]"><p className="mx-auto mb-3 max-w-[520px]">No hay jugadas el {v.titulo.replace(/^(Hoy|Ayer) · /,'')}.</p><button className={btn} onClick={v.cargar}>+ Cargar jugadas</button></div>}</div>
 {v.otros.length>0&&<div className={card}><div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5"><div><h2 className="text-[17px] font-semibold tracking-[-.01em]">Deben de otros días</h2><div className="text-[13px] text-[var(--mu)]">Quinielas sin cobrar de días anteriores.</div></div><b className="text-[var(--bad)]">{v.otrosTotal}</b></div><Tabla filas={v.otros} v={v} otros/></div>}</section>;
}
