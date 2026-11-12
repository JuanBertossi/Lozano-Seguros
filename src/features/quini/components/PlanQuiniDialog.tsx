import { useEffect,useRef } from 'react';
import { Controller,useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDialogo,useDialogos } from '../../../shared/stores/dialogos.store';
import { avisar } from '../../../shared/stores/avisos.store';
import { planQuiniSchema,type PlanQuiniInput } from '../planQuini.schema';
import { useCalendarioQuini,usePlanQuini,usePlanSocioQuini } from '../hooks/useQuini';
import type { PlanSocioQuini } from '../api/quini.service';
import { diasQuini } from '../lib/quiniVista';
import { DialogoCarga } from '../../../shared/components/DialogoCarga';
import { abrirModal } from '../../../shared/lib/dialogo';
// Estilos del modal de la maqueta (.modal, label.f, .opts, .note, .mfoot) expresados con utilidades.
const btn='inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15.5px] font-medium transition-colors duration-100 hover:bg-[var(--sf2)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ac)] disabled:cursor-default disabled:opacity-40';
const primario=`${btn} !border-[var(--ac)] !bg-[var(--ac)] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] hover:brightness-[1.08] [[data-theme=dark]_&]:text-[#0b1f17]`;
const opcion='inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-[var(--ln)] px-[13px] py-[9px] text-[15.5px] text-[var(--ink)] has-[:checked]:border-[var(--ac)] has-[:checked]:bg-[var(--ac-s)] [&>input]:m-0 [&>input]:accent-[var(--ac)]';
const nota='rounded-lg bg-[var(--sf2)] px-[11px] py-[9px] text-[14.5px] text-[var(--mu)]';
export function PlanQuiniDialog(){const abierto=useDialogo('planQuini');return abierto&&<Cargador key={abierto.sid} socioId={abierto.sid}/>}
function Cargador({socioId}:{socioId:string}){
 const plan=usePlanSocioQuini(socioId),calendario=useCalendarioQuini();
 const error=plan.error??calendario.error;
 if(!plan.data||!calendario.data)return <DialogoCarga error={error instanceof Error?error.message:''}/>;
 return <Formulario socioId={socioId} plan={plan.data} dias={calendario.data.dias.map(d=>({id:String(d),nombre:diasQuini[d]}))}/>;
}
function Formulario({socioId,plan,dias}:{socioId:string;plan:PlanSocioQuini;dias:{id:string;nombre:string}[]}){
 const cerrar=useDialogos(e=>e.cerrar),operacion=usePlanQuini(()=>{cerrar();avisar('Días de juego actualizados')});
 const dialogo=useRef<HTMLDialogElement>(null),{register,handleSubmit,control,formState:{errors}}=useForm<PlanQuiniInput>({resolver:zodResolver(planQuiniSchema),defaultValues:{dias:plan.dias.map(String),cantidad:String(plan.cantidad)}});
 useEffect(()=>{abrirModal(dialogo.current);},[]);
 function guardar(datos:PlanQuiniInput){void operacion.enviar({p_socio_id:socioId,p_accion:'guardar',p_datos:{dias:datos.dias.map(Number),cantidad:Number(datos.cantidad)}})}
 return <dialog ref={dialogo} aria-labelledby="titulo-plan-quini" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-[0_20px_50px_rgba(0,0,0,0.25)] backdrop:bg-[#0a0c0f73]" onCancel={event=>{event.preventDefault();if(!operacion.bloqueado)cerrar()}}>{operacion.bloqueado&&<button type="button" className={btn} disabled={operacion.procesando} onClick={()=>void operacion.enviar()}>Reintentar operación</button>}<form inert={operacion.bloqueado} onSubmit={handleSubmit(guardar)} noValidate><div className="grid gap-3.5 px-6 pb-3.5 pt-[22px] max-[820px]:px-4"><h2 id="titulo-plan-quini" className="text-[22px] font-semibold tracking-[-.01em]">Días de juego habitual</h2><p className={nota}>Elegí los días para las próximas jugadas automáticas. Los sorteos ya cargados se conservan.</p><Controller control={control} name="dias" render={({field})=><div className="-my-0.5 flex flex-wrap gap-1.5">{dias.map(d=><label key={d.id} className={opcion}><input type="checkbox" checked={field.value.includes(d.id)} onBlur={field.onBlur} onChange={event=>field.onChange(event.target.checked?[...field.value,d.id]:field.value.filter(x=>x!==d.id))}/>{d.nombre}</label>)}</div>}/><label className="grid gap-1 text-[14.5px] text-[var(--mu)]">Jugadas por sorteo<input className="block w-full rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] font-semibold text-[var(--ink)]" type="number" min="1" {...register('cantidad')}/></label><p className="text-[14.5px] text-[var(--mu)]">Para detener las jugadas automáticas, dejá todos los días sin marcar.</p>{operacion.error&&<p role="alert" className="text-sm text-[var(--bad)]">{operacion.error}</p>}{errors.cantidad&&<p role="alert" className="text-sm text-[var(--bad)]">{errors.cantidad.message}</p>}</div><div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-solid border-[var(--ln2)] bg-[var(--sf)] px-6 py-3.5 max-[820px]:px-4"><span></span><div className="flex gap-2"><button type="button" className={btn} onClick={cerrar}>Cancelar</button><button className={primario}>Guardar</button></div></div></form></dialog>;
}
