import { useEffect, useRef, type ChangeEvent } from 'react';
import { SocioRapido } from '../../../shared/components/SocioRapido';
import { useDialogo, useDialogos } from '../../../shared/stores/dialogos.store';
import type { FormularioSeguroServidor } from '../api/seguros.service';
import { useEdicionSeguro, useFormularioSeguro } from '../hooks/useSeguros';
import { DialogoCarga } from '../../../shared/components/DialogoCarga';
import * as e from '../../../shared/lib/estilosJuegos';
import { abrirModal } from '../../../shared/lib/dialogo';

// Alta rápida de socio (SocioRapido es compartido): se le pasan las clases Tailwind del formulario.
const nuevoSocio = { campo: '', etiqueta: `${e.campoAnidado} mb-0`, boton: e.btnMSm };

export function SeguroDialog() {
  const dialogo = useDialogo('seguro');
  return dialogo && <Carga key={dialogo.id ?? 'nuevo'} id={dialogo.id ?? null} sid={dialogo.sid ?? null} />;
}

function Carga({ id, sid }: { id: string | null; sid: string | null }) {
  const formulario = useFormularioSeguro(id, sid);
  const cerrar = useDialogos((estado) => estado.cerrar);
  if (formulario.data) return <Formulario id={id} sid={sid} datos={formulario.data} />;
  if (formulario.error) return <DialogoCarga error={formulario.error.message} cerrar={cerrar} />;
  return null;
}

function Formulario({ id, sid, datos }: { id: string | null; sid: string | null; datos: FormularioSeguroServidor }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const ed = useEdicionSeguro(id, sid, datos);
  useEffect(() => { abrirModal(dialogo.current);}, []);
  const abrirNuevo = () => { void ed.campoSocio.onChange({ target: { value: '__new' } } as unknown as ChangeEvent<HTMLSelectElement>); };

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-seguro" className={e.marco}
      onCancel={(evento) => { evento.preventDefault(); if (!ed.operacion.bloqueado) ed.cerrar(); }}>
      {(ed.operacion.error || (ed.operacion.bloqueado && !ed.operacion.procesando)) && <div className={`${e.franja} flex-wrap`}>
        {ed.operacion.error && <p role="alert" className={e.aviso}>{ed.operacion.error}</p>}
        {ed.operacion.bloqueado && !ed.operacion.procesando && <button type="button" className={e.btn} onClick={() => void ed.operacion.enviar()}>Reintentar operación</button>}
      </div>}
      <form inert={ed.operacion.bloqueado} onSubmit={ed.enviar} noValidate>
        <div className={e.cuerpo}>
          <h2 id="titulo-seguro" className={e.tituloDialogo}>{id ? 'Editar seguro' : 'Nuevo seguro'}</h2>
          {ed.socioFijo ? <p className={e.notaTinta}>Socio: <b>{ed.socio?.nombre}</b> · N° <span className={e.mono}>{ed.socio?.nro}</span></p> :
            <>
              <label className={e.campoSeguido}>Socio
                <select {...ed.campoSocio}>
                  <option value="">Elegí un socio…</option>
                  <option value="__new">＋ Nuevo socio…</option>
                  {ed.socios.map((socio) => <option key={socio.id} value={socio.id}>{socio.nombre} · {socio.nro}</option>)}
                </select>
              </label>
              {!ed.nuevo && <div className={e.agregarSocio}><button type="button" className={e.agregarSocioLink} onClick={abrirNuevo}>＋ ¿No está? Crear socio nuevo</button></div>}
            </>}
          {ed.nuevo && <div className="mb-3"><SocioRapido elegir={ed.elegirSocio} cancelar={ed.cancelarNuevo} {...nuevoSocio} textoCrear="Crear socio" /></div>}
          <div className={e.fila2}>
            <label className={e.campo}>Fecha de ingreso<input type="date" {...ed.campoIngreso} /></label>
            <label className={e.campo}>Vencimiento<input type="date" {...ed.register('venc')} /></label>
          </div>
          <label className={e.campo}>Descripción<input placeholder="Ej: Auto Ford Ka · AB 123 CD · San Cristóbal" {...ed.register('desc')} /></label>
          <label className={e.campo}>Valor total<input className={e.entradaNegrita} inputMode="decimal" {...ed.register('valor')} /></label>
          <span className={e.rotulo}>Cómo lo va a pagar</span>
          <div className={e.opciones}>{[['contado','Contado'],['3','3 cuotas'],['6','6 cuotas'],['12','12 cuotas']].map(([plan,nombrePlan]) => <label key={plan} className={e.opcion}><input type="radio" value={plan} {...ed.register('plan')} />{nombrePlan}</label>)}</div>
          {id && <p className={e.nota}>Los pagos se marcan con “Registrar pago” o tocando cada cuota. Si cambiás valor, plan o fecha de ingreso, se rearman las cuotas (las pagadas quedan).</p>}
          {ed.errores.map((error, indice) => error?.message && <p key={indice} role="alert" className={e.aviso}>{error.message}</p>)}
        </div>
        <div className={e.pie}>
          {id ? <button type="button" className={e.btnMD} onClick={ed.eliminar}>Eliminar</button> : <span></span>}
          <div className={e.acciones}><button type="button" className={e.btnM} onClick={ed.cerrar}>Cancelar</button><button type="submit" className={e.btnMP}>Guardar</button></div>
        </div>
      </form>
    </dialog>
  );
}
