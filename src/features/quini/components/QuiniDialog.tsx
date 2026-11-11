import { useEffect,useRef,useState } from 'react';
import { Controller,useForm,useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';
import type { SocioRapidoInput } from '../../../shared/schemas/socioRapido.schema';
import { SocioRapido } from '../../../shared/components/SocioRapido';
import type { PuenteOperacion } from '../../../shared/hooks/useOperacionSegura';
import type { ResultadoSocio } from '../../../shared/lib/socios.service';
import { quiniSchema,type QuiniInput } from '../quini.schema';
import { useQuiniOperacion,usePreviaQuini } from '../hooks/useQuini';
import type { ResultadoQuini } from '../api/quini.service';
const usarSql=import.meta.env.VITE_QUINI_SQL==='true';
type Socio={id:string;nombre:string;nro:string};
type Edicion={puenteQuini?:PuenteOperacion<ResultadoQuini>;id:string|null;inicial:QuiniInput;socios:Socio[];socioFijo:boolean;fechas:{id:string;nombre:string}[];dias:{id:string;nombre:string}[];guardar:(datos:QuiniInput)=>void;eliminar:()=>void;crearSocio:(nombre:string,telefono:string)=>Socio|null;puenteSocio?:PuenteOperacion<ResultadoSocio>;resumen:(fecha:string,cantidad:string)=>string;cerrar:()=>void};
const campo='w-full min-w-0 rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16px] focus-visible:outline-2 focus-visible:outline-[var(--ac)]';
const etiqueta='grid gap-1.5 text-[14.5px] font-medium';
const btn='cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15px] hover:bg-[var(--sf2)]';
export function QuiniDialog(){const e=usePanelEvent<Edicion>('agencia:editar-quini');return e&&<Formulario key={e.id??'nuevo'} edicion={e}/>}
function Formulario({edicion:e}:{edicion:Edicion}){
 const dialogo=useRef<HTMLDialogElement>(null),[socios,setSocios]=useState(e.socios),[nuevo,setNuevo]=useState(false);
 const operacion=useQuiniOperacion({obtenerRevision:()=>{if(!e.puenteQuini)throw new Error('Conexión de Quini no disponible.');return e.puenteQuini.obtenerRevision()},bloquear:()=>{if(!e.puenteQuini)throw new Error('Conexión de Quini no disponible.');e.puenteQuini.bloquear()},desbloquear:()=>e.puenteQuini?.desbloquear(),sincronizar:(datos,resultado)=>{if(!e.puenteQuini)throw new Error('Conexión de Quini no disponible.');e.puenteQuini.sincronizar(datos,resultado)}},'jugada');
 const {register,handleSubmit,setValue,control,formState:{errors}}=useForm<QuiniInput>({resolver:zodResolver(quiniSchema),defaultValues:e.inicial});
 const seleccion=register('sid'),automatico=useWatch({control,name:'automatico'}),fecha=useWatch({control,name:'fecha'}),cantidad=useWatch({control,name:'cantidad'});
 let revision:number|null=null;try{if(usarSql&&e.puenteQuini)revision=e.puenteQuini.obtenerRevision()}catch{/* Esperar guardados pendientes. */}
 const previa=usePreviaQuini(usarSql&&revision!==null&&fecha&&/^[1-9]\d*$/.test(cantidad)?{p_revision:revision,p_fecha:fecha,p_cantidad:Number(cantidad)}:null);
 const moneda=(valor:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:Number.isInteger(valor)?0:2,maximumFractionDigits:Number.isInteger(valor)?0:2}).format(valor);
 const resumen=usarSql?(previa.data?`${previa.data.cantidad} × ${moneda(previa.data.precio)} = ${moneda(previa.data.total)}`:''):e.resumen(fecha,cantidad);
 useEffect(()=>{dialogo.current?.showModal()},[]);
 function elegir(socio:Socio){setSocios(a=>a.some(x=>x.id===socio.id)?a:[...a,socio]);setValue('sid',socio.id,{shouldValidate:true});setNuevo(false)}
 function guardar(datos:QuiniInput){if(!usarSql){e.guardar(datos);return}void operacion.enviar({p_accion:e.id?'editar':'crear',p_id:e.id,p_datos:{...datos,cantidad:Number(datos.cantidad),dias:datos.dias.map(Number)}})}
 function eliminar(){if(!usarSql){e.eliminar();return}if(e.id&&confirm('¿Eliminar?'))void operacion.enviar({p_accion:'eliminar',p_id:e.id,p_datos:{}})}
 function crear({nombre,telefono}:SocioRapidoInput){const socio=e.crearSocio(nombre,telefono);if(socio)elegir(socio)}
 return <dialog ref={dialogo} aria-labelledby="titulo-quini-dialog" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[#0a0c0f73]" onCancel={event=>{event.preventDefault();if(!operacion.bloqueado)e.cerrar()}}>{usarSql&&operacion.bloqueado&&<button type="button" className={btn} disabled={operacion.procesando} onClick={()=>void operacion.enviar()}>Reintentar operación</button>}<form inert={operacion.bloqueado} onSubmit={handleSubmit(guardar)} noValidate><div className="grid gap-3.5 px-6 pb-5 pt-[22px] max-[820px]:px-4"><h2 id="titulo-quini-dialog" className="text-[22px] font-semibold">{e.id?'Editar jugada':'Jugada de Quini 6'}</h2>
 {e.socioFijo?<p className="text-sm">Socio: <b>{socios.find(x=>x.id===e.inicial.sid)?.nombre}</b> · N° {socios.find(x=>x.id===e.inicial.sid)?.nro}</p>:<label className={etiqueta}>Socio<select className={campo} {...seleccion} onChange={event=>{if(event.target.value==='__new'){setNuevo(true);setValue('sid','');return}void seleccion.onChange(event)}}><option value="">Elegí un socio…</option><option value="__new">＋ Nuevo socio…</option>{socios.map(s=><option key={s.id} value={s.id}>{s.nombre} · {s.nro}</option>)}</select></label>}
 {nuevo&&<SocioRapido crear={crear} elegir={elegir} puente={e.puenteSocio} cancelar={()=>setNuevo(false)} campo={campo} etiqueta={etiqueta} boton={btn}/>}
 <div className="grid gap-3 min-[560px]:grid-cols-2"><label className={etiqueta}>Sorteo<select className={campo} {...register('fecha')}><option value="">Elegí un sorteo</option>{e.fechas.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>)}</select></label><label className={etiqueta}>Cantidad de jugadas<input className={campo} type="number" min="1" {...register('cantidad')}/></label></div><p className="text-sm text-[var(--mu)]">{resumen}</p>
 {!e.id&&<><label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('automatico')}/>Juega todas las semanas</label>{automatico&&<fieldset className="m-0 border-0 p-0"><legend className="text-sm font-medium">Días que juega</legend><Controller control={control} name="dias" render={({field})=><div className="mt-1 flex flex-wrap gap-3">{e.dias.map(d=><label key={d.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={field.value.includes(d.id)} onBlur={field.onBlur} onChange={event=>field.onChange(event.target.checked?[...field.value,d.id]:field.value.filter(x=>x!==d.id))}/>{d.nombre}</label>)}</div>}/><p className="mt-2 text-sm text-[var(--mu)]">Marcá los días de juego habitual. El sorteo elegido arriba se carga ahora; las próximas jugadas se generan automáticamente desde esa fecha.</p></fieldset>}</>}
 {usarSql&&previa.error instanceof Error&&<p role="alert" className="text-sm text-[var(--bad)]">{previa.error.message}</p>}{usarSql&&operacion.error&&<p role="alert" className="text-sm text-[var(--bad)]">{operacion.error}</p>}{Object.values(errors).map((error,i)=>error?.message&&<p key={i} role="alert" className="text-sm text-[var(--bad)]">{error.message}</p>)}</div><div className="flex items-center justify-between border-t border-solid border-[var(--ln)] px-6 py-4"><span>{e.id&&<button type="button" className={`${btn} text-[var(--bad)]`} onClick={eliminar}>Eliminar</button>}</span><div className="flex gap-2"><button type="button" className={btn} onClick={e.cerrar}>Cancelar</button><button className={`${btn} !border-[var(--ac)] !bg-[var(--ac)] text-white`}>Guardar</button></div></div></form></dialog>;
}
