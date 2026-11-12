import { useEffect,useRef } from 'react';
import { useForm,useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { fechaCorta,nombreDia } from '../../../shared/lib/fechas';
import { leerMonto,numeroEditable } from '../../../shared/lib/moneda';
import { useDialogo,useDialogos } from '../../../shared/stores/dialogos.store';
import { especialQuiniSchema,type EspecialQuiniInput } from '../especialQuini.schema';
import { useCalendarioQuini,useOperacionQuini } from '../hooks/useQuini';
import { avisarGuardado } from '../lib/avisosQuini';
import { DialogoCarga } from '../../../shared/components/DialogoCarga';
import { abrirModal } from '../../../shared/lib/dialogo';
// Estilos del modal de la maqueta (.modal, label.f, .opts, .note, .mfoot) expresados con utilidades.
const campo='block w-full min-w-0 rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] text-[var(--ink)]';
const numerico='font-semibold';
const opcion='inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-[var(--ln)] px-[13px] py-[9px] text-[15.5px] text-[var(--ink)] has-[:checked]:border-[var(--ac)] has-[:checked]:bg-[var(--ac-s)] [&>input]:m-0 [&>input]:accent-[var(--ac)]';
const nota='rounded-lg bg-[var(--sf2)] px-[11px] py-[9px] text-[14.5px] text-[var(--mu)]';
const pie='sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-solid border-[var(--ln2)] bg-[var(--sf)] px-6 py-3.5 max-[820px]:px-4';
const etiqueta='grid gap-1 text-[14.5px] text-[var(--mu)]';
const btn='inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15.5px] font-medium transition-colors duration-100 hover:bg-[var(--sf2)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ac)] disabled:cursor-default disabled:opacity-40';
const primario=`${btn} !border-[var(--ac)] !bg-[var(--ac)] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] hover:brightness-[1.08] [[data-theme=dark]_&]:text-[#0b1f17]`;
export function EspecialQuiniDialog(){const abierto=useDialogo('especialQuini');return abierto&&<Cargador key={abierto.id??'nuevo'} id={abierto.id??null}/>}
function Cargador({id}:{id:string|null}){
 const calendario=useCalendarioQuini();
 if(!calendario.data)return <DialogoCarga error={calendario.error instanceof Error?calendario.error.message:''}/>;
 const especial=id?calendario.data.especiales.find(e=>e.id===id):undefined;
 if(id&&!especial)return <DialogoCarga error="Ese sorteo especial ya no existe."/>;
 return <Formulario id={id} inicial={especial?{fecha:especial.fecha,nombre:especial.nombre,precio:numeroEditable(especial.precio)}:{fecha:'',nombre:'Sorteo especial',precio:''}}/>;
}
function Formulario({id,inicial}:{id:string|null;inicial:EspecialQuiniInput}){
 const cerrar=useDialogos(e=>e.cerrar),operacion=useOperacionQuini('especial',resultado=>{cerrar();avisarGuardado(resultado.accion==='eliminar'?'Eliminado':'Sorteo especial guardado')});
 const dialogo=useRef<HTMLDialogElement>(null),{register,handleSubmit,control,formState:{errors}}=useForm<EspecialQuiniInput>({resolver:zodResolver(especialQuiniSchema),defaultValues:inicial}),fechaElegida=useWatch({control,name:'fecha'});
 useEffect(()=>{abrirModal(dialogo.current);},[]);
 function guardar(datos:EspecialQuiniInput){void operacion.enviar({p_accion:id?'editar':'crear',p_id:id,p_datos:{...datos,precio:leerMonto(datos.precio)}})}
 function eliminar(){if(id&&confirm('¿Eliminar?'))void operacion.enviar({p_accion:'eliminar',p_id:id,p_datos:{}})}
 return <dialog ref={dialogo} aria-labelledby="titulo-especial-quini" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-[0_20px_50px_rgba(0,0,0,0.25)] backdrop:bg-[#0a0c0f73]" onCancel={event=>{event.preventDefault();if(!operacion.bloqueado)cerrar()}}>{operacion.bloqueado&&<button type="button" className={btn} disabled={operacion.procesando} onClick={()=>void operacion.enviar()}>Reintentar operación</button>}<form inert={operacion.bloqueado} onSubmit={handleSubmit(guardar)} noValidate><div className="grid gap-3.5 px-6 pb-3.5 pt-[22px] max-[820px]:px-4"><h2 id="titulo-especial-quini" className="text-[22px] font-semibold tracking-[-.01em]">Sorteo especial de Quini 6</h2><div className="grid grid-cols-2 gap-3 max-[820px]:grid-cols-1 max-[820px]:gap-y-[26px]"><label className={etiqueta}>Fecha<span className="relative block"><input className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" type="date" {...register('fecha')} onClick={event=>{try{event.currentTarget.showPicker()}catch{/* el navegador no lo permite */}}}/><span className="flex items-center gap-2 rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] text-[var(--ink)] hover:border-[var(--mu)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-[var(--ac)]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-none text-[var(--ac)]"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><span className="first-letter:uppercase">{fechaElegida?`${nombreDia(fechaElegida)} ${fechaCorta(fechaElegida)}`:'Elegir fecha'}</span></span></span></label><label className={etiqueta}>Precio por jugada<input className={`${campo} ${numerico}`} inputMode="decimal" {...register('precio')}/></label></div><label className={etiqueta}>Nombre<input className={campo} {...register('nombre')}/></label>{operacion.error&&<p role="alert" className="text-sm text-[var(--bad)]">{operacion.error}</p>}{Object.values(errors).map((error,i)=>error?.message&&<p key={i} role="alert" className="text-sm text-[var(--bad)]">{error.message}</p>)}</div><div className={pie}><span>{id&&<button type="button" className={`${btn} text-[var(--bad)]`} onClick={eliminar}>Eliminar</button>}</span><div className="flex gap-2"><button type="button" className={btn} onClick={cerrar}>Cancelar</button><button className={primario}>Guardar</button></div></div></form></dialog>;
}
