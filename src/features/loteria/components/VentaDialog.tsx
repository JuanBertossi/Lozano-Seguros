import { useEffect, useRef, type ChangeEvent } from 'react';
import { SocioRapido } from '../../../shared/components/SocioRapido';
import { fechaCorta } from '../../../shared/lib/fechas';
import * as s from '../../../shared/lib/estilosJuegos';
import { useDialogo, useDialogos } from '../../../shared/stores/dialogos.store';
import type { FormularioVenta } from '../api/loteria.service';
import { useFormularioVenta } from '../hooks/useVenta';
import { useVentaFormulario, type ParametrosVenta } from '../hooks/useVentaFormulario';
import { abrirModal } from '../../../shared/lib/dialogo';

// Alta rápida de socio (SocioRapido es compartido): se le pasan las clases Tailwind del formulario.
const nuevoSocio={campo:'',etiqueta:`${s.campoAnidado} mb-0`,boton:s.btnMSm};
// "Entero · 20 × $ 10.000 = $ 200.000" → el total va en negrita (como la maqueta).
function Resumen({texto}:{texto:string}){
 const i=texto.lastIndexOf(' = ');
 return <p className={s.nota}>{i<0?texto:<>{texto.slice(0,i+3)}<b className="text-[var(--ink)]">{texto.slice(i+3)}</b></>}</p>;
}

export function VentaDialog(){
 const params=useDialogo('venta');
 return params&&<Cargador key={`${params.id??''}|${params.sid??''}|${params.soId??''}`} params={params}/>;
}
function Cargador({params}:{params:ParametrosVenta}){
 const formulario=useFormularioVenta(params.id??null,params.sid??null,params.soId??null);
 const datos=formulario.data;
 if(formulario.error instanceof Error&&!datos)return <Mensaje texto={formulario.error.message}/>;
 if(!datos)return null;
 if(!datos.inicial)return <Mensaje texto="Primero cargá un sorteo en Ajustes"/>;
 return <Formulario params={params} datos={datos} inicial={datos.inicial}/>;
}
function Mensaje({texto}:{texto:string}){
 const dialogo=useRef<HTMLDialogElement>(null),cerrar=useDialogos(e=>e.cerrar);
 useEffect(()=>{abrirModal(dialogo.current);},[]);
 return <dialog ref={dialogo} aria-labelledby="titulo-venta-dialog" className={s.marco} onCancel={event=>{event.preventDefault();cerrar()}}><div className={s.cuerpo}><h2 id="titulo-venta-dialog" className={s.tituloDialogo}>Vender número de lotería</h2><p role="alert" className={s.nota}>{texto}</p></div><div className={s.pie}><span></span><div className={s.acciones}><button type="button" className={s.btnM} onClick={cerrar}>Cerrar</button></div></div></dialog>;
}
function Formulario({params,datos,inicial}:{params:ParametrosVenta;datos:FormularioVenta;inicial:NonNullable<FormularioVenta['inicial']>}){
 const dialogo=useRef<HTMLDialogElement>(null);
 const f=useVentaFormulario(params,datos,inicial);
 useEffect(()=>{abrirModal(dialogo.current);},[]);
 const abrirNuevo=()=>{void f.campos.socio.onChange({target:{value:'__new'}} as unknown as ChangeEvent<HTMLSelectElement>)};
 return <dialog ref={dialogo} aria-labelledby="titulo-venta-dialog" className={s.marco} onCancel={event=>{event.preventDefault();if(!f.bloqueado)f.cerrar()}}>{(f.guardado.bloqueado||f.eliminacion.bloqueado)&&<div className={s.franja}>{f.guardado.bloqueado&&<button type="button" className={s.btn} disabled={f.guardado.procesando} onClick={()=>void f.guardado.enviar()}>Reintentar guardado</button>}{f.eliminacion.bloqueado&&<button type="button" className={s.btn} disabled={f.eliminacion.procesando} onClick={()=>void f.eliminacion.enviar()}>Reintentar eliminación</button>}</div>}<form inert={f.bloqueado} onSubmit={f.guardar} noValidate><div className={s.cuerpo}><h2 id="titulo-venta-dialog" className={s.tituloDialogo}>{f.esEdicion?'Editar venta':'Vender número de lotería'}</h2>
 {f.socioFijo?<p className={s.notaTinta}>Socio: <b>{f.socioInicial?.nombre}</b> · N° <span className={s.mono}>{f.socioInicial?.nro}</span></p>:<><label className={s.campoSeguido}>Socio<select {...f.campos.socio}><option value="">Elegí un socio…</option><option value="__new">＋ Nuevo socio…</option>{f.socios.map(o=><option key={o.id} value={o.id}>{o.nombre} · {o.nro}</option>)}</select></label>{!f.nuevo&&<div className={s.agregarSocio}><button type="button" className={s.agregarSocioLink} onClick={abrirNuevo}>＋ ¿No está? Crear socio nuevo</button></div>}</>}
 {f.nuevo&&<div className="mb-3"><SocioRapido elegir={f.elegir} cancelar={()=>f.setNuevo(false)} {...nuevoSocio}/></div>}
 <label className={s.campo}>Sorteo<select {...f.campos.sorteo}>{datos.sorteos.map(o=><option key={o.id} value={o.id}>{o.nombre} · {fechaCorta(o.fecha)} · {o.frac} fracciones</option>)}</select></label><div className={s.fila2}><label className={s.campo}>Número<input className={s.entradaMono} inputMode="numeric" {...f.campos.numero}/></label><label className={s.campo}>Fracciones<select {...f.campos.frac}>{Array.from({length:f.sorteo?.frac??0},(_,i)=>i+1).map(n=><option key={n} value={n}>{n===f.sorteo?.frac?`Entero (${n} fracciones)`:`${n} ${n>1?'fracciones':'fracción'}`}</option>)}</select></label></div><Resumen texto={f.resumen}/><div className={s.opciones}>{!f.esEdicion&&<label className={s.opcion}><input type="checkbox" {...f.campos.fijo}/>Guardar como número fijo del socio</label>}</div>
 {f.errorPrevia&&<p role="alert" className={s.aviso}>{f.errorPrevia}</p>}{(f.guardado.error||f.eliminacion.error)&&<p role="alert" className={s.aviso}>{f.guardado.error||f.eliminacion.error}</p>}{f.mensajes.map((mensaje,i)=><p key={i} role="alert" className={s.aviso}>{mensaje}</p>)}</div><div className={s.pie}>{f.esEdicion?<button type="button" className={s.btnMD} onClick={f.eliminar} disabled={f.bloqueado}>Eliminar</button>:<span></span>}<div className={s.acciones}><button type="button" className={s.btnM} onClick={f.cerrar} disabled={f.bloqueado}>Cancelar</button><button className={s.btnM} disabled={f.bloqueado}>Guardar</button><button type="button" className={s.btnMP} disabled={f.bloqueado} onClick={f.guardarYCobrar}>Guardar y cobrar</button></div></div></form></dialog>;
}
