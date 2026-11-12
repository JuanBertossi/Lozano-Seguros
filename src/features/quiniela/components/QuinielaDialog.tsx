import { useEffect,useRef,useState } from 'react';
import { useFieldArray,useForm,useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SocioRapido } from '../../../shared/components/SocioRapido';
import { fechaCorta,nombreDia } from '../../../shared/lib/fechas';
import { leerMonto,numeroEditable } from '../../../shared/lib/moneda';
import { useDialogo,useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { quinielaSchema,type QuinielaInput } from '../quiniela.schema';
import { useFormularioQuiniela,useQuinielaOperacion } from '../hooks/useQuiniela';
import type { FormularioQuiniela,SocioOpcion } from '../api/quiniela.service';
import { avisarGuardado } from '../lib/quinielaVista';
import { DialogoCarga } from '../../../shared/components/DialogoCarga';
import { abrirModal } from '../../../shared/lib/dialogo';
type Parametros={id:string|null;sid:string|null};
// Estilos del modal de la maqueta (.modal, label.f, .opts, .note, .mfoot) expresados con utilidades.
const campo='block w-full min-w-0 rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] text-[var(--ink)]';
const numerico='font-semibold';
const opcion='inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-[var(--ln)] px-[13px] py-[9px] text-[15.5px] text-[var(--ink)] has-[:checked]:border-[var(--ac)] has-[:checked]:bg-[var(--ac-s)] [&>input]:m-0 [&>input]:accent-[var(--ac)]';
const nota='rounded-lg bg-[var(--sf2)] px-[11px] py-[9px] text-[14.5px] text-[var(--mu)]';
const pie='sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-solid border-[var(--ln2)] bg-[var(--sf)] px-6 py-3.5 max-[820px]:px-4';
const etiqueta='grid gap-1 text-[14.5px] text-[var(--mu)]';
const btn='inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15.5px] font-medium transition-colors duration-100 hover:bg-[var(--sf2)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ac)] disabled:cursor-default disabled:opacity-40';
const primario=`${btn} !border-[var(--ac)] !bg-[var(--ac)] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] hover:brightness-[1.08] [[data-theme=dark]_&]:text-[#0b1f17]`;
export function QuinielaDialog(){
 const abierto=useDialogo('quiniela');
 if(!abierto)return null;
 const parametros:Parametros={id:abierto.id??null,sid:abierto.sid??null};
 return <Cargador key={`${parametros.id??'nuevo'}|${parametros.sid??''}`} parametros={parametros}/>;
}
function Cargador({parametros}:{parametros:Parametros}){
 const formulario=useFormularioQuiniela(parametros.id,parametros.sid);
 if(!formulario.data)return <DialogoCarga error={formulario.error instanceof Error?formulario.error.message:''}/>;
 return <Formulario parametros={parametros} formulario={formulario.data}/>;
}
function Formulario({parametros,formulario}:{parametros:Parametros;formulario:FormularioQuiniela}){
 const {id}=parametros,jugada=formulario.jugada,sid=jugada?.sid??parametros.sid??'';
 const fechaActual=useNavegacion(e=>e.fechaQuiniela),elegirFecha=useNavegacion(e=>e.elegirFechaQuiniela),enFicha=useNavegacion(e=>e.pagina==='socio');
 const inicial:QuinielaInput={sid,fecha:jugada?.fecha??fechaActual,jugadas:[{numeros:jugada?.numeros??'',monto:jugada?numeroEditable(jugada.monto):''}]};
 const cerrar=useDialogos(e=>e.cerrar);
 const dialogo=useRef<HTMLDialogElement>(null),[agregados,setAgregados]=useState<SocioOpcion[]>([]),[nuevo,setNuevo]=useState(false);
 const socios=[...formulario.socios,...agregados.filter(a=>!formulario.socios.some(s=>s.id===a.id))];
 const socioFijo=enFicha&&!!sid&&socios.some(s=>s.id===sid);
 const operacion=useQuinielaOperacion(resultado=>{
  const eliminada=resultado.accion==='eliminar';
  if(!eliminada&&resultado.fecha)elegirFecha(resultado.fecha);
  cerrar();
  avisarGuardado(eliminada?'Eliminado':resultado.ids.length>1?`${resultado.ids.length} jugadas guardadas`:'Jugada guardada',resultado.liberado);
 });
 const {register,handleSubmit,setValue,control,formState:{errors}}=useForm<QuinielaInput>({resolver:zodResolver(quinielaSchema),defaultValues:inicial});const {fields,append}=useFieldArray({control,name:'jugadas'}),seleccion=register('sid'),fechaElegida=useWatch({control,name:'fecha'});
 useEffect(()=>{abrirModal(dialogo.current);},[]);
 function elegir(socio:SocioOpcion){setAgregados(a=>a.some(x=>x.id===socio.id)?a:[...a,socio]);setValue('sid',socio.id,{shouldValidate:true});setNuevo(false)}
 function guardar(datos:QuinielaInput){void operacion.enviar({p_accion:id?'editar':'crear',p_id:id,p_datos:{...datos,jugadas:datos.jugadas.map(j=>({...j,monto:j.monto?leerMonto(j.monto):0}))}})}
 function eliminar(){if(id&&confirm('¿Eliminar?'))void operacion.enviar({p_accion:'eliminar',p_id:id,p_datos:{}})}
 const socioActual=socios.find(x=>x.id===sid);
 return <dialog ref={dialogo} aria-labelledby="titulo-quiniela-dialog" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-[0_20px_50px_rgba(0,0,0,0.25)] backdrop:bg-[#0a0c0f73]" onCancel={event=>{event.preventDefault();if(!operacion.bloqueado)cerrar()}}>{operacion.bloqueado&&<button type="button" className={btn} disabled={operacion.procesando} onClick={()=>void operacion.enviar()}>Reintentar operación</button>}<form inert={operacion.bloqueado} onSubmit={handleSubmit(guardar)} noValidate><div className="grid gap-3.5 px-6 pb-3.5 pt-[22px] max-[820px]:px-4"><h2 id="titulo-quiniela-dialog" className="text-[22px] font-semibold tracking-[-.01em]">{id?'Editar jugada':'Cargar quiniela'}</h2>
 {socioFijo?<p className={`${nota} !text-[var(--ink)]`}>Socio: <b>{socioActual?.nombre}</b> · N° <span className="font-['IBM_Plex_Mono',ui-monospace,Menlo,monospace] font-semibold tracking-[.02em]">{socioActual?.nro}</span></p>:<label className={etiqueta}>Socio<select className={campo} {...seleccion} onChange={event=>{if(event.target.value==='__new'){setNuevo(true);setValue('sid','');return}void seleccion.onChange(event)}}><option value="">Elegí un socio…</option><option value="__new">＋ Nuevo socio…</option>{socios.map(s=><option key={s.id} value={s.id}>{s.nombre} · {s.nro}</option>)}</select></label>}
 {!socioFijo&&!nuevo&&<div className="-mb-1 -mt-2.5 text-right"><button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[14.5px] font-medium text-[var(--ac)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--ac)]" onClick={()=>{setNuevo(true);setValue('sid','')}}>＋ ¿No está? Crear socio nuevo</button></div>}
 {nuevo&&<SocioRapido elegir={elegir} cancelar={()=>setNuevo(false)} campo={campo} etiqueta={etiqueta} boton={btn}/>}
 <label className={etiqueta}>Fecha<span className="relative block"><input className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" type="date" {...register('fecha')} onClick={event=>{try{event.currentTarget.showPicker()}catch{/* el navegador no lo permite */}}}/><span className="flex items-center gap-2 rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] text-[var(--ink)] hover:border-[var(--mu)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-[var(--ac)]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-none text-[var(--ac)]"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><span className="first-letter:uppercase">{fechaElegida?`${nombreDia(fechaElegida)} ${fechaCorta(fechaElegida)}`:'Elegir fecha'}</span></span></span></label>{fields.map((f,i)=><div key={f.id} className="grid grid-cols-2 gap-3 max-[820px]:grid-cols-1 max-[820px]:gap-y-[26px]"><label className={etiqueta}>Números {i?i+1:''}<input className={`${campo} ${numerico} font-['IBM_Plex_Mono',ui-monospace,Menlo,monospace] tracking-[.02em]`} placeholder="Ej: 45 · 312" {...register(`jugadas.${i}.numeros`)}/></label><label className={etiqueta}>Monto<input className={`${campo} ${numerico}`} inputMode="decimal" {...register(`jugadas.${i}.monto`)}/>{errors.jugadas?.[i]?.monto&&<span role="alert" className="text-sm text-[var(--bad)]">{errors.jugadas[i]?.monto?.message}</span>}</label></div>)}
 {id&&<div aria-hidden="true"/>}{!id&&<div className="pb-3"><button type="button" className={`${btn} !px-[9px] !py-[5px] !text-[14.5px]`} disabled={fields.length>=5} onClick={()=>append({numeros:'',monto:''})}>+ Otra jugada (hasta 5)</button></div>}{errors.sid&&<p role="alert" className="text-sm text-[var(--bad)]">{errors.sid.message}</p>}{errors.fecha&&<p role="alert" className="text-sm text-[var(--bad)]">{errors.fecha.message}</p>}{errors.jugadas?.root?.message&&<p role="alert" className="text-sm text-[var(--bad)]">{errors.jugadas.root.message}</p>}{errors.jugadas?.message&&<p role="alert" className="text-sm text-[var(--bad)]">{errors.jugadas.message}</p>}{operacion.error&&<p role="alert" className="text-sm text-[var(--bad)]">{operacion.error}</p>}</div><div className={pie}><span>{id&&<button type="button" className={`${btn} text-[var(--bad)]`} onClick={eliminar}>Eliminar</button>}</span><div className="flex gap-2"><button type="button" className={btn} onClick={cerrar}>Cancelar</button><button className={primario}>Guardar</button></div></div></form></dialog>;
}
