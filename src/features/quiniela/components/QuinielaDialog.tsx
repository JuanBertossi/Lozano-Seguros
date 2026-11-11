import { useEffect,useRef,useState } from 'react';
import { useFieldArray,useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';
import type { SocioRapidoInput } from '../../../shared/schemas/socioRapido.schema';
import { SocioRapido } from '../../../shared/components/SocioRapido';
import type { PuenteOperacion } from '../../../shared/hooks/useOperacionSegura';
import type { ResultadoSocio } from '../../../shared/lib/socios.service';
import { quinielaSchema,type QuinielaInput } from '../quiniela.schema';
type Socio={id:string;nombre:string;nro:string};
type Edicion={id:string|null;inicial:QuinielaInput;socios:Socio[];socioFijo:boolean;guardar:(datos:QuinielaInput)=>void;eliminar:()=>void;crearSocio:(nombre:string,telefono:string)=>Socio|null;puenteSocio?:PuenteOperacion<ResultadoSocio>;cerrar:()=>void};
const campo='w-full min-w-0 rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16px] focus-visible:outline-2 focus-visible:outline-[var(--ac)]';
const etiqueta='grid gap-1.5 text-[14.5px] font-medium';
const btn='cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15px] hover:bg-[var(--sf2)]';
export function QuinielaDialog(){const e=usePanelEvent<Edicion>('agencia:editar-quiniela');return e&&<Formulario key={e.id??'nuevo'} edicion={e}/>}
function Formulario({edicion:e}:{edicion:Edicion}){
 const dialogo=useRef<HTMLDialogElement>(null),[socios,setSocios]=useState(e.socios),[nuevo,setNuevo]=useState(false);
 const {register,handleSubmit,setValue,control,formState:{errors}}=useForm<QuinielaInput>({resolver:zodResolver(quinielaSchema),defaultValues:e.inicial});const {fields,append}=useFieldArray({control,name:'jugadas'}),seleccion=register('sid');
 useEffect(()=>{dialogo.current?.showModal()},[]);
 function elegir(socio:Socio){setSocios(a=>a.some(x=>x.id===socio.id)?a:[...a,socio]);setValue('sid',socio.id,{shouldValidate:true});setNuevo(false)}
 function crear({nombre,telefono}:SocioRapidoInput){const socio=e.crearSocio(nombre,telefono);if(socio)elegir(socio)}
 return <dialog ref={dialogo} aria-labelledby="titulo-quiniela-dialog" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[#0a0c0f73]" onCancel={event=>{event.preventDefault();e.cerrar()}}><form onSubmit={handleSubmit(e.guardar)} noValidate><div className="grid gap-3.5 px-6 pb-5 pt-[22px] max-[820px]:px-4"><h2 id="titulo-quiniela-dialog" className="text-[22px] font-semibold">{e.id?'Editar jugada':'Cargar quiniela'}</h2>
 {e.socioFijo?<p className="text-sm">Socio: <b>{socios.find(x=>x.id===e.inicial.sid)?.nombre}</b> · N° {socios.find(x=>x.id===e.inicial.sid)?.nro}</p>:<label className={etiqueta}>Socio<select className={campo} {...seleccion} onChange={event=>{if(event.target.value==='__new'){setNuevo(true);setValue('sid','');return}void seleccion.onChange(event)}}><option value="">Elegí un socio…</option><option value="__new">＋ Nuevo socio…</option>{socios.map(s=><option key={s.id} value={s.id}>{s.nombre} · {s.nro}</option>)}</select></label>}
 {nuevo&&<SocioRapido crear={crear} elegir={elegir} puente={e.puenteSocio} cancelar={()=>setNuevo(false)} campo={campo} etiqueta={etiqueta} boton={btn}/>}
 <label className={etiqueta}>Fecha<input className={campo} type="date" {...register('fecha')}/></label>{fields.map((f,i)=><div key={f.id} className="grid gap-3 min-[560px]:grid-cols-2"><label className={etiqueta}>Números {i?i+1:''}<input className={`${campo} font-mono`} placeholder="Ej: 45 · 312" {...register(`jugadas.${i}.numeros`)}/></label><label className={etiqueta}>Monto<input className={campo} inputMode="decimal" {...register(`jugadas.${i}.monto`)}/>{errors.jugadas?.[i]?.monto&&<span role="alert" className="text-sm text-[var(--bad)]">{errors.jugadas[i]?.monto?.message}</span>}</label></div>)}
 {!e.id&&<div><button type="button" className={btn} disabled={fields.length>=5} onClick={()=>append({numeros:'',monto:''})}>+ Otra jugada (hasta 5)</button></div>}{errors.sid&&<p role="alert" className="text-sm text-[var(--bad)]">{errors.sid.message}</p>}{errors.fecha&&<p role="alert" className="text-sm text-[var(--bad)]">{errors.fecha.message}</p>}{errors.jugadas?.root?.message&&<p role="alert" className="text-sm text-[var(--bad)]">{errors.jugadas.root.message}</p>}{errors.jugadas?.message&&<p role="alert" className="text-sm text-[var(--bad)]">{errors.jugadas.message}</p>}</div><div className="flex items-center justify-between border-t border-solid border-[var(--ln)] px-6 py-4"><span>{e.id&&<button type="button" className={`${btn} text-[var(--bad)]`} onClick={e.eliminar}>Eliminar</button>}</span><div className="flex gap-2"><button type="button" className={btn} onClick={e.cerrar}>Cancelar</button><button className={`${btn} !border-[var(--ac)] !bg-[var(--ac)] text-white`}>Guardar</button></div></div></form></dialog>;
}
