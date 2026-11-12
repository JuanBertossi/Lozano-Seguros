import { useEffect, useRef, type ChangeEvent } from 'react';
import { SocioRapido } from '../../../shared/components/SocioRapido';
import { useDialogo, useDialogos } from '../../../shared/stores/dialogos.store';
import type { FormularioRifaServidor } from '../api/rifa.service';
import { useEdicionRifa, useFormularioRifa } from '../hooks/useRifa';
import { DialogoCarga } from '../../../shared/components/DialogoCarga';
import * as e from '../../../shared/lib/estilosJuegos';
import { abrirModal } from '../../../shared/lib/dialogo';

// Alta rápida de socio (SocioRapido es compartido): se le pasan las clases Tailwind del formulario.
const nuevoSocio = { campo: '', etiqueta: `${e.campoAnidado} mb-0`, boton: e.btnMSm };

export function RifaDialog() {
  const dialogo = useDialogo('rifa');
  return dialogo && <Carga key={dialogo.id ?? 'nuevo'} id={dialogo.id ?? null} sid={dialogo.sid ?? null} />;
}

function Carga({ id, sid }: { id: string | null; sid: string | null }) {
  const formulario = useFormularioRifa(id, sid);
  const cerrar = useDialogos((estado) => estado.cerrar);
  if (formulario.data) return <Formulario id={id} sid={sid} datos={formulario.data} />;
  if (formulario.error) return <DialogoCarga error={formulario.error.message} cerrar={cerrar} />;
  return null;
}

function Formulario({ id, sid, datos }: { id: string | null; sid: string | null; datos: FormularioRifaServidor }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const ed = useEdicionRifa(id, sid, datos);
  useEffect(() => { abrirModal(dialogo.current);}, []);
  const abrirNuevo = () => { void ed.campoSocio.onChange({ target: { value: '__new' } } as unknown as ChangeEvent<HTMLSelectElement>); };
  return <dialog ref={dialogo} aria-labelledby="titulo-rifa-dialog" className={e.marco} onCancel={(evento) => { evento.preventDefault(); if (!ed.operacion.bloqueado) ed.cerrar(); }}>
    {ed.operacion.bloqueado && <div className={e.franja}><button type="button" className={e.btn} disabled={ed.operacion.procesando} onClick={() => void ed.operacion.enviar()}>Reintentar operación</button></div>}
    <form inert={ed.operacion.bloqueado} onSubmit={ed.enviar} noValidate><div className={e.cuerpo}><h2 id="titulo-rifa-dialog" className={e.tituloDialogo}>{id ? 'Editar rifa' : 'Nueva Rifa Devoto'}</h2>
      {ed.socioFijo ? <p className={e.notaTinta}>Socio: <b>{ed.socio?.nombre}</b> · N° <span className={e.mono}>{ed.socio?.nro}</span></p> : <><label className={e.campoSeguido}>Socio<select {...ed.campoSocio}><option value="">Elegí un socio…</option><option value="__new">＋ Nuevo socio…</option>{ed.socios.map((o) => <option key={o.id} value={o.id}>{o.nombre} · {o.nro}</option>)}</select></label>{!ed.nuevo && <div className={e.agregarSocio}><button type="button" className={e.agregarSocioLink} onClick={abrirNuevo}>＋ ¿No está? Crear socio nuevo</button></div>}</>}
      {ed.nuevo && <div className="mb-3"><SocioRapido elegir={ed.elegirSocio} cancelar={ed.cancelarNuevo} {...nuevoSocio} /></div>}
      <div className={e.fila3}><label className={e.campo}>N° de rifa<input className={e.entradaMono} {...ed.register('numero')} /></label><label className={e.campo}>Año<input className={e.entradaNegrita} type="number" {...ed.register('anio')} /></label><label className={e.campo}>Importe<input className={e.entradaNegrita} inputMode="decimal" {...ed.register('importe')} /></label></div><span className={e.rotulo}>Modalidad</span><div className={e.opciones}><label className={e.opcion}><input type="radio" value="contado" {...ed.register('modo')} />Contado</label><label className={e.opcion}><input type="radio" value="cuotas" {...ed.register('modo')} />{datos.ncuotas} cuotas</label></div>
      {ed.operacion.error && <p role="alert" className={e.aviso}>{ed.operacion.error}</p>}{ed.errores.map((error, i) => error?.message && <p key={i} role="alert" className={e.aviso}>{error.message}</p>)}</div><div className={e.pie}>{id ? <button type="button" className={e.btnMD} onClick={ed.eliminar}>Eliminar</button> : <span></span>}<div className={e.acciones}><button type="button" className={e.btnM} onClick={ed.cerrar}>Cancelar</button><button className={e.btnMP}>Guardar</button></div></div></form></dialog>;
}
