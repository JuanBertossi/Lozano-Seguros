import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';

type Fila={id:string;sid:string;socio:string;fecha:string;hora:string;numeros:string;autor:string;monto:string;pagado:boolean;abono:string;restante:string};
type Vista={fecha:string;titulo:string;hoy:boolean;cantidad:number;total:string;cobrado:string;falta:string;deuda:boolean;filtro:string;filas:Fila[];otros:Fila[];otrosTotal:string;fechaCambiar:(d:string)=>void;ir:(n:number)=>void;irHoy:()=>void;filtrar:(n:string)=>void;cargar:()=>void;editar:(id:string)=>void;verSocio:(id:string)=>void;cobrar:(sid:string,id:string)=>void;editarPago:(id:string)=>void};
const card='mb-4 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-5 py-[18px]';
const btn='cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-2 text-sm font-medium hover:bg-[var(--sf2)]';
const link='cursor-pointer border-0 bg-transparent p-0 text-[var(--ac)] underline';
const fechaSchema=z.object({fecha:z.iso.date()});

function Fecha({fecha,cambiar}:{fecha:string;cambiar:(fecha:string)=>void}){
 const {register,handleSubmit,setValue}=useForm<z.infer<typeof fechaSchema>>({resolver:zodResolver(fechaSchema),defaultValues:{fecha}});
 useEffect(()=>{setValue('fecha',fecha)},[fecha,setValue]);
 const campo=register('fecha');
 return <form onChange={()=>{void handleSubmit(x=>cambiar(x.fecha))()}}><input {...campo} type="date" aria-label="Elegir otra fecha" className="border-0 bg-transparent text-sm text-[var(--mu)]"/></form>;
}
function Tabla({filas,v,otros=false}:{filas:Fila[];v:Vista;otros?:boolean}){
 return <div className="overflow-x-auto"><table className="w-full border-collapse text-sm">{!otros&&<thead><tr>{['Hora','Socio','Números','Cargó','Monto','Estado',''].map((h,i)=><th key={i} className="whitespace-nowrap border-b border-solid border-[var(--ln2)] px-2 py-2 text-left text-[13px] font-medium text-[var(--mu)]">{h}</th>)}</tr></thead>}<tbody>{filas.map(j=><tr key={j.id} className={j.pagado?'bg-[var(--ok-row)]':j.abono?'':'bg-[var(--bad-row)]'}><td className="px-2 py-2.5 text-[var(--mu)]">{otros?j.fecha:j.hora}</td><td className="px-2 py-2.5"><button className={link} onClick={()=>v.verSocio(j.sid)}>{j.socio}</button></td><td className="px-2 py-2.5 font-mono">{j.numeros}</td>{!otros&&<td className="px-2 py-2.5 text-[var(--mu)]">{j.autor}</td>}<td className="px-2 py-2.5 text-right font-semibold">{j.monto}</td><td className="whitespace-nowrap px-2 py-2.5"><button className={btn} onClick={()=>j.pagado?v.editarPago(j.id):v.cobrar(j.sid,j.id)}>{j.pagado?'✓ Pagado · editar':j.abono?`Cobrar ${j.restante}`:'Cobrar'}</button>{j.abono&&<span className="ml-2 text-xs text-[var(--mu)]">Pagó {j.abono} de {j.monto}</span>}</td><td className="px-2 py-2.5 text-right"><button className={btn} onClick={()=>v.editar(j.id)}>Editar</button></td></tr>)}</tbody></table></div>;
}
export function QuinielaPage(){
 const v=usePanelEvent<Vista>('agencia:quiniela');if(!v)return null;
 return <section aria-labelledby="titulo-quiniela"><header className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5"><div><h1 id="titulo-quiniela" className="text-2xl font-semibold text-[var(--qui)]">Quiniela</h1><p className="mt-1 text-sm text-[var(--mu)]">Jugadas del día. Navegá los días con las flechas.</p></div><button className={`${btn} !border-[var(--ac)] !bg-[var(--ac)] text-white`} onClick={v.cargar}>+ Cargar jugadas</button></header>
 <div className={`${card} flex flex-wrap items-center gap-3`}><button className={btn} aria-label="Día anterior" onClick={()=>v.ir(-1)}>‹</button><div className="min-w-40 flex-1 text-center"><b className="block">{v.titulo}</b><Fecha fecha={v.fecha} cambiar={v.fechaCambiar}/></div><button className={btn} aria-label="Día siguiente" onClick={()=>v.ir(1)}>›</button>{!v.hoy&&<button className={btn} onClick={v.irHoy}>Volver a hoy</button>}</div>
 <div className="mb-4 grid grid-cols-1 gap-3 min-[600px]:grid-cols-3">{[['Jugado en el día',v.total,`${v.cantidad} jugada${v.cantidad===1?'':'s'}`],['Cobrado',v.cobrado,''],['Falta cobrar',v.falta,'']].map(([titulo,valor,sub],i)=><div key={titulo} className={`${card} !mb-0 !px-4 !py-3.5`}><small className="block text-[13px] text-[var(--mu)]">{titulo}</small><b className={`mt-0.5 block text-[22px] ${i===1?'text-[var(--ok)]':i===2&&v.deuda?'text-[var(--bad)]':''}`}>{valor}</b>{sub&&<span className="text-sm text-[var(--mu)]">{sub}</span>}</div>)}</div>
 <div className={card}><div className="mb-2.5 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Jugadas del día</h2>{v.cantidad>0&&<div className="flex rounded-lg bg-[var(--sf2)] p-1">{([['todos','Todos'],['deben','Deben'],['pagados','Pagados']] as const).map(([id,n])=><button key={id} aria-pressed={v.filtro===id} className={`cursor-pointer rounded-md border-0 px-3 py-2 text-sm ${v.filtro===id?'bg-[var(--sf)] text-[var(--ink)] shadow-sm':'bg-transparent text-[var(--mu)]'}`} onClick={()=>v.filtrar(id)}>{n}</button>)}</div>}</div>{v.cantidad?(v.filas.length?<Tabla filas={v.filas} v={v}/>:<p className="px-1 py-3.5 text-sm text-[var(--mu)]">Nada en este filtro.</p>):<div className="py-6 text-center text-sm text-[var(--mu)]"><p>No hay jugadas el {v.titulo}.</p><button className={`${btn} mt-3`} onClick={v.cargar}>+ Cargar jugadas</button></div>}</div>
 {v.otros.length>0&&<div className={card}><div className="mb-2.5 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Deben de otros días</h2><p className="text-sm text-[var(--mu)]">Quinielas sin cobrar de días anteriores.</p></div><b className="text-[var(--bad)]">{v.otrosTotal}</b></div><Tabla filas={v.otros} v={v} otros/></div>}</section>;
}
