import { useEffect,useRef,useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';
import type { SocioRapidoInput } from '../../../shared/schemas/socioRapido.schema';
import { SocioRapido } from '../../../shared/components/SocioRapido';
import type { PuenteOperacion } from '../../../shared/hooks/useOperacionSegura';
import type { ResultadoSocio } from '../../../shared/lib/socios.service';
import { rifaSchema,type RifaInput } from '../rifa.schema';
import { useOperacionRifa,type ResultadoRifa } from '../../../shared/hooks/useOperacionRifa';
const usarSql=import.meta.env.VITE_RIFA_SQL==='true';
type Socio={id:string;nombre:string;nro:string};
type Edicion={puenteRifa?:PuenteOperacion<ResultadoRifa>;id:string|null;inicial:RifaInput;socios:Socio[];socioFijo:boolean;ncuotas:number;guardar:(datos:RifaInput)=>void;eliminar:()=>void;crearSocio:(nombre:string,telefono:string)=>Socio|null;puenteSocio?:PuenteOperacion<ResultadoSocio>;cerrar:()=>void};
const campo='w-full min-w-0 rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16px] focus-visible:outline-2 focus-visible:outline-[var(--ac)]';
const etiqueta='grid gap-1.5 text-[14.5px] font-medium';
const btn='cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15px] hover:bg-[var(--sf2)]';
export function RifaDialog(){const e=usePanelEvent<Edicion>('agencia:editar-rifa');return e&&<Formulario key={e.id??'nuevo'} edicion={e}/>}
function Formulario({edicion:e}:{edicion:Edicion}){
 const dialogo=useRef<HTMLDialogElement>(null),[socios,setSocios]=useState(e.socios),[nuevo,setNuevo]=useState(false);
 const operacion=useOperacionRifa({obtenerRevision:()=>{if(!e.puenteRifa)throw new Error('Conexión de Rifa no disponible.');return e.puenteRifa.obtenerRevision()},bloquear:()=>{if(!e.puenteRifa)throw new Error('Conexión de Rifa no disponible.');e.puenteRifa.bloquear()},desbloquear:()=>e.puenteRifa?.desbloquear(),sincronizar:(datos,resultado)=>{if(!e.puenteRifa)throw new Error('Conexión de Rifa no disponible.');e.puenteRifa.sincronizar(datos,resultado)}});
 const {register,handleSubmit,setValue,formState:{errors}}=useForm<RifaInput>({resolver:zodResolver(rifaSchema),defaultValues:e.inicial});const seleccion=register('sid');
 useEffect(()=>{dialogo.current?.showModal()},[]);
 function elegir(socio:Socio){setSocios(a=>a.some(x=>x.id===socio.id)?a:[...a,socio]);setValue('sid',socio.id,{shouldValidate:true});setNuevo(false)}
 function guardar(datos:RifaInput){if(!usarSql){e.guardar(datos);return}void operacion.enviar({tipo:'guardar',p_id:e.id,p_datos:{...datos,anio:Number(datos.anio),importe:datos.importe?Number(datos.importe.replace(/\./g,'').replace(',','.')):0}})}
 function eliminar(){if(!usarSql){e.eliminar();return}if(e.id&&confirm('¿Eliminar?'))void operacion.enviar({tipo:'operar',p_accion:'eliminar',p_id:e.id,p_datos:{}})}
 function crear({nombre,telefono}:SocioRapidoInput){const socio=e.crearSocio(nombre,telefono);if(socio)elegir(socio)}
 return <dialog ref={dialogo} aria-labelledby="titulo-rifa-dialog" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[#0a0c0f73]" onCancel={event=>{event.preventDefault();if(!operacion.bloqueado)e.cerrar()}}>{usarSql&&operacion.bloqueado&&<button type="button" className={btn} disabled={operacion.procesando} onClick={()=>void operacion.enviar()}>Reintentar operación</button>}<form inert={operacion.bloqueado} onSubmit={handleSubmit(guardar)} noValidate><div className="grid gap-3.5 px-6 pb-5 pt-[22px] max-[820px]:px-4"><h2 id="titulo-rifa-dialog" className="text-[22px] font-semibold">{e.id?'Editar rifa':'Nueva Rifa Devoto'}</h2>
 {e.socioFijo?<p className="text-sm">Socio: <b>{socios.find(x=>x.id===e.inicial.sid)?.nombre}</b> · N° {socios.find(x=>x.id===e.inicial.sid)?.nro}</p>:<label className={etiqueta}>Socio<select className={campo} {...seleccion} onChange={event=>{if(event.target.value==='__new'){setNuevo(true);setValue('sid','');return}void seleccion.onChange(event)}}><option value="">Elegí un socio…</option><option value="__new">＋ Nuevo socio…</option>{socios.map(s=><option key={s.id} value={s.id}>{s.nombre} · {s.nro}</option>)}</select></label>}
 {nuevo&&<SocioRapido crear={crear} elegir={elegir} puente={e.puenteSocio} cancelar={()=>setNuevo(false)} campo={campo} etiqueta={etiqueta} boton={btn}/>}
 <div className="grid gap-3 min-[560px]:grid-cols-3"><label className={etiqueta}>N° de rifa<input className={`${campo} font-mono`} {...register('numero')}/></label><label className={etiqueta}>Año<input className={campo} type="number" {...register('anio')}/></label><label className={etiqueta}>Importe<input className={campo} inputMode="decimal" {...register('importe')}/></label></div><fieldset className="m-0 border-0 p-0"><legend className="text-sm font-medium">Modalidad</legend><div className="mt-1 flex gap-3"><label className="flex items-center gap-2 text-sm"><input type="radio" value="contado" {...register('modo')}/>Contado</label><label className="flex items-center gap-2 text-sm"><input type="radio" value="cuotas" {...register('modo')}/>{e.ncuotas} cuotas</label></div></fieldset>
 {usarSql&&operacion.error&&<p role="alert" className="text-sm text-[var(--bad)]">{operacion.error}</p>}{Object.values(errors).map((error,i)=>error?.message&&<p key={i} role="alert" className="text-sm text-[var(--bad)]">{error.message}</p>)}</div><div className="flex items-center justify-between border-t border-solid border-[var(--ln)] px-6 py-4"><span>{e.id&&<button type="button" className={`${btn} text-[var(--bad)]`} onClick={eliminar}>Eliminar</button>}</span><div className="flex gap-2"><button type="button" className={btn} onClick={e.cerrar}>Cancelar</button><button className={`${btn} !border-[var(--ac)] !bg-[var(--ac)] text-white`}>Guardar</button></div></div></form></dialog>;
}
