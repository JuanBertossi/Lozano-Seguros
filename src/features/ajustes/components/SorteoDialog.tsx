import { useEffect, useRef } from 'react';
import * as e from '../../../shared/lib/estilosJuegos';
import { useDialogo, type Dialogo } from '../../../shared/stores/dialogos.store';
import type { SorteoInput } from '../ajustes.schema';
import { useAjustes } from '../hooks/useConfiguracion';
import { useSorteoFormulario } from '../hooks/useSorteoFormulario';
import { sorteoInicial } from '../lib/ajustesVista';
import { abrirModal } from '../../../shared/lib/dialogo';

export function SorteoDialog() {
  const parametros = useDialogo('sorteo');
  return parametros && <Cargador key={parametros.id ?? 'nuevo'} parametros={parametros} />;
}

function Cargador({ parametros }: { parametros: Extract<Dialogo, { tipo: 'sorteo' }> }) {
  const ajustes = useAjustes();
  const sorteo = ajustes.data ? sorteoInicial(ajustes.data, parametros.id) : null;
  return sorteo && <Formulario id={parametros.id} inicial={sorteo.inicial} ventas={sorteo.ventas} />;
}

function Formulario({ id, inicial, ventas }: { id?: string; inicial: SorteoInput; ventas: number }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const f = useSorteoFormulario(id, inicial, ventas);
  useEffect(() => { abrirModal(dialogo.current);}, []);

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-sorteo"
      className={e.marco}
      onCancel={(event) => { event.preventDefault(); if (!f.operacion.bloqueado) f.cerrar(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || f.operacion.bloqueado) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) f.cerrar();
      }}>
      {f.operacion.bloqueado && <div className={e.franja}><button type="button" className={e.btn} disabled={f.operacion.procesando} onClick={() => void f.operacion.enviar()}>Reintentar operación</button></div>}
      <form inert={f.operacion.bloqueado} onSubmit={f.guardar} noValidate>
        <div className={e.cuerpo}>
          <h2 id="titulo-sorteo" className={e.tituloDialogo}>{f.esEdicion ? 'Editar sorteo' : 'Nuevo sorteo'}</h2>
          {f.operacion.error && <p role="alert" className={e.aviso}>{f.operacion.error}</p>}

          <label className={e.campo}>Nombre<input autoFocus placeholder="Ej: Gordo de Navidad 2026" {...f.register('nombre')} /></label>
          <div className={e.fila3}>
            <label className={e.campo}>Fecha<input type="date" {...f.register('fecha')} /></label>
            <label className={e.campo}>Fracciones<input className={e.entradaNegrita} type="number" min="1" {...f.register('frac')} /></label>
            <label className={e.campo}>Precio fracción<input className={e.entradaNegrita} inputMode="decimal" {...f.register('precio')} /></label>
          </div>
          {f.mensajes.map((mensaje, indice) => <p key={indice} role="alert" className={e.aviso}>{mensaje}</p>)}
        </div>
        <div className={e.pie}>
          {f.esEdicion ? <button type="button" className={e.btnMD} onClick={f.eliminar} disabled={f.operacion.bloqueado}>Eliminar</button> : <span></span>}
          <div className={e.acciones}>
            <button type="button" className={e.btnM} onClick={f.cerrar} disabled={f.operacion.bloqueado}>Cancelar</button>
            <button type="submit" disabled={f.operacion.bloqueado} className={e.btnMP}>Guardar</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
