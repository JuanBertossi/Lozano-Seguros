import { useEffect,useRef,useState } from 'react';
import { Controller,useForm,useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SocioRapido } from '../../../shared/components/SocioRapido';
import { sumarDias } from '../../../shared/lib/fechas';
import { moneda } from '../../../shared/lib/moneda';
import { useDialogo,useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { quiniSchema,type QuiniInput } from '../quini.schema';
import { useCalendarioQuini,useFormularioQuini,useOperacionQuini,usePreviaQuini } from '../hooks/useQuini';
import type { CalendarioQuini,FormularioQuini,SocioOpcion } from '../api/quini.service';
import { avisarGuardado } from '../lib/avisosQuini';
import { diaDeSemana,diasQuini,etiquetaSorteo } from '../lib/quiniVista';
import { DialogoCarga } from '../../../shared/components/DialogoCarga';
import { abrirModal } from '../../../shared/lib/dialogo';
type Parametros={id:string|null;sid:string|null;fecha:string|null};
// Estilos del modal de la maqueta (.modal, label.f, .opts, .note, .mfoot) expresados con utilidades.
const campo='block w-full min-w-0 rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] text-[var(--ink)]';
const numerico='font-semibold';
const opcion='inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-[var(--ln)] px-[13px] py-[9px] text-[15.5px] text-[var(--ink)] has-[:checked]:border-[var(--ac)] has-[:checked]:bg-[var(--ac-s)] [&>input]:m-0 [&>input]:accent-[var(--ac)]';
const nota='rounded-lg bg-[var(--sf2)] px-[11px] py-[9px] text-[14.5px] text-[var(--mu)]';
const pie='sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-solid border-[var(--ln2)] bg-[var(--sf)] px-6 py-3.5 max-[820px]:px-4';
const etiqueta='grid gap-1 text-[14.5px] text-[var(--mu)]';
const btn='inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15.5px] font-medium transition-colors duration-100 hover:bg-[var(--sf2)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ac)] disabled:cursor-default disabled:opacity-40';
const primario=`${btn} !border-[var(--ac)] !bg-[var(--ac)] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] hover:brightness-[1.08] [[data-theme=dark]_&]:text-[#0b1f17]`;
export function QuiniDialog(){
 const abierto=useDialogo('quini');
 if(!abierto)return null;
 const parametros:Parametros={id:abierto.id??null,sid:abierto.sid??null,fecha:abierto.fecha??null};
 return <Cargador key={`${parametros.id??'nuevo'}|${parametros.sid??''}|${parametros.fecha??''}`} parametros={parametros}/>;
}
function Cargador({parametros}:{parametros:Parametros}){
 const formulario=useFormularioQuini(parametros.id,parametros.sid),calendario=useCalendarioQuini();
 const error=formulario.error??calendario.error;
 if(!formulario.data||!calendario.data)return <DialogoCarga error={error instanceof Error?error.message:''}/>;
 return <Formulario parametros={parametros} formulario={formulario.data} calendario={calendario.data}/>;
}
function Formulario({parametros,formulario,calendario}:{parametros:Parametros;formulario:FormularioQuini;calendario:CalendarioQuini}){
 const {id}=parametros,jugada=formulario.jugada,sid=jugada?.sid??parametros.sid??'';
 const fecha=jugada?.fecha??parametros.fecha??calendario.proximo??'';
 const dia=fecha?diaDeSemana(fecha):-1;
 const inicial:QuiniInput={sid,fecha,cantidad:String(formulario.cantidad),automatico:!id,dias:!id&&fecha&&calendario.dias.includes(dia)?[String(dia)]:[]};
 const desde=sumarDias(calendario.hoy,-14),hasta=sumarDias(calendario.hoy,45);
 const sorteos=[...new Set(calendario.fechas.filter(x=>x>=desde&&x<=hasta).concat(fecha?[fecha]:[]))].sort();
 const dias=calendario.dias.map(d=>({id:String(d),nombre:diasQuini[d]}));
 const cerrar=useDialogos(e=>e.cerrar),enFicha=useNavegacion(e=>e.pagina==='socio');
 const dialogo=useRef<HTMLDialogElement>(null),[agregados,setAgregados]=useState<SocioOpcion[]>([]),[nuevo,setNuevo]=useState(false);
 const socios=[...formulario.socios,...agregados.filter(a=>!formulario.socios.some(s=>s.id===a.id))];
 const socioFijo=enFicha&&!!sid&&socios.some(s=>s.id===sid);
 const operacion=useOperacionQuini('jugada',resultado=>{cerrar();avisarGuardado(resultado.accion==='eliminar'?'Eliminado':'Jugada guardada',resultado.liberado)});
 const {register,handleSubmit,setValue,control,formState:{errors}}=useForm<QuiniInput>({resolver:zodResolver(quiniSchema),defaultValues:inicial});
 const seleccion=register('sid'),automatico=useWatch({control,name:'automatico'}),fechaElegida=useWatch({control,name:'fecha'}),cantidad=useWatch({control,name:'cantidad'});
 const previa=usePreviaQuini(fechaElegida,cantidad);
 const resumen=previa.data&&fechaElegida&&/^[1-9]\d*$/.test(cantidad)?`${previa.data.cantidad} × ${moneda(previa.data.precio)} = ${moneda(previa.data.total)}`:'';
 useEffect(()=>{abrirModal(dialogo.current);},[]);
 function elegir(socio:SocioOpcion){setAgregados(a=>a.some(x=>x.id===socio.id)?a:[...a,socio]);setValue('sid',socio.id,{shouldValidate:true});setNuevo(false)}
 function guardar(datos:QuiniInput){void operacion.enviar({p_accion:id?'editar':'crear',p_id:id,p_datos:{...datos,cantidad:Number(datos.cantidad),dias:datos.dias.map(Number)}})}
 function eliminar(){if(id&&confirm('¿Eliminar?'))void operacion.enviar({p_accion:'eliminar',p_id:id,p_datos:{}})}
 const socioActual=socios.find(x=>x.id===sid);
 return <dialog ref={dialogo} aria-labelledby="titulo-quini-dialog" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-[0_20px_50px_rgba(0,0,0,0.25)] backdrop:bg-[#0a0c0f73]" onCancel={event=>{event.preventDefault();if(!operacion.bloqueado)cerrar()}}>{operacion.bloqueado&&<button type="button" className={btn} disabled={operacion.procesando} onClick={()=>void operacion.enviar()}>Reintentar operación</button>}<form inert={operacion.bloqueado} onSubmit={handleSubmit(guardar)} noValidate><div className="grid gap-3.5 px-6 pb-3.5 pt-[22px] max-[820px]:px-4"><h2 id="titulo-quini-dialog" className="text-[22px] font-semibold tracking-[-.01em]">{id?'Editar jugada':'Jugada de Quini 6'}</h2>
 {socioFijo?<p className={`${nota} !text-[var(--ink)]`}>Socio: <b>{socioActual?.nombre}</b> · N° <span className="font-['IBM_Plex_Mono',ui-monospace,Menlo,monospace] font-semibold tracking-[.02em]">{socioActual?.nro}</span></p>:<label className={etiqueta}>Socio<select className={campo} {...seleccion} onChange={event=>{if(event.target.value==='__new'){setNuevo(true);setValue('sid','');return}void seleccion.onChange(event)}}><option value="">Elegí un socio…</option><option value="__new">＋ Nuevo socio…</option>{socios.map(s=><option key={s.id} value={s.id}>{s.nombre} · {s.nro}</option>)}</select></label>}
 {!socioFijo&&!nuevo&&<div className="-mb-1 -mt-2.5 text-right"><button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[14.5px] font-medium text-[var(--ac)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--ac)]" onClick={()=>{setNuevo(true);setValue('sid','')}}>＋ ¿No está? Crear socio nuevo</button></div>}
 {nuevo&&<SocioRapido elegir={elegir} cancelar={()=>setNuevo(false)} campo={campo} etiqueta={etiqueta} boton={btn}/>}
 <div className="grid grid-cols-2 gap-3 max-[820px]:grid-cols-1 max-[820px]:gap-y-[26px]"><label className={etiqueta}>Sorteo<select className={campo} {...register('fecha')}><option value="">Elegí un sorteo</option>{sorteos.map(f=><option key={f} value={f}>{etiquetaSorteo(f,calendario.especiales,calendario.hoy)}</option>)}</select></label><label className={etiqueta}>Cantidad de jugadas<input className={`${campo} ${numerico}`} type="number" min="1" {...register('cantidad')}/></label></div>{resumen&&<p className={nota}>{previa.data&&<>{previa.data.cantidad} × {moneda(previa.data.precio)} = <b className="text-[var(--ink)]">{moneda(previa.data.total)}</b></>}</p>}
 {!id&&<><div className="-mt-0.5"><label className={opcion}><input type="checkbox" {...register('automatico')}/>Juega todas las semanas</label></div>{automatico&&<fieldset className="m-0 border-0 p-0"><legend className="p-0 text-[14.5px] text-[var(--mu)]">Días que juega</legend><Controller control={control} name="dias" render={({field})=><div className="mt-1 flex flex-wrap gap-1.5">{dias.map(d=><label key={d.id} className={opcion}><input type="checkbox" checked={field.value.includes(d.id)} onBlur={field.onBlur} onChange={event=>field.onChange(event.target.checked?[...field.value,d.id]:field.value.filter(x=>x!==d.id))}/>{d.nombre}</label>)}</div>}/><p className={`${nota} mt-3`}>Marcá los días de juego habitual. El sorteo elegido arriba se carga ahora; las próximas jugadas se generan automáticamente desde esa fecha.</p></fieldset>}</>}
 {previa.error instanceof Error&&<p role="alert" className="text-sm text-[var(--bad)]">{previa.error.message}</p>}{operacion.error&&<p role="alert" className="text-sm text-[var(--bad)]">{operacion.error}</p>}{Object.values(errors).map((error,i)=>error?.message&&<p key={i} role="alert" className="text-sm text-[var(--bad)]">{error.message}</p>)}</div><div className={pie}><span>{id&&<button type="button" className={`${btn} text-[var(--bad)]`} onClick={eliminar}>Eliminar</button>}</span><div className="flex gap-2"><button type="button" className={btn} onClick={cerrar}>Cancelar</button><button className={primario}>Guardar</button></div></div></form></dialog>;
}
