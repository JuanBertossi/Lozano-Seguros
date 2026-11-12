import { useEffect, useRef } from 'react';
import { Controller } from 'react-hook-form';
import { useDialogo } from '../../../shared/stores/dialogos.store';
import type { PlanillaToto } from '../api/toto.service';
import { useTotoFormulario } from '../hooks/useTotoFormulario';
import { usePlanillaToto } from '../hooks/useToto';
import { JUEGOS } from '../lib/totoVista';
import { DialogoCarga } from '../../../shared/components/DialogoCarga';
import { boton, campoDineroDlg, campoDlg, cuerpoDlg, dialogo, erroresDlg, fila2, listaDlg, pieDlg, rotuloDlg, rotuloSueltoDlg, tituloDlg } from '../../../shared/lib/clases';
import { abrirModal } from '../../../shared/lib/dialogo';

// Número de concurso de cada sorteo (`input.tcin` de la maqueta).
const concurso = 'w-[62px] rounded-[5px] border border-solid border-[var(--ln2)] bg-[var(--sf2)] px-[5px] py-0.5 text-right font-mono text-[11px] font-normal text-[var(--mu)] focus:border-[var(--ln)] focus:text-[var(--ink)] focus:outline-none';
const aclaracion = 'text-center text-[14.5px] text-[var(--mu)]';
const error = 'text-[14.5px] text-[var(--bad)]';

export function TotoDialog() {
  const parametros = useDialogo('toto');
  return parametros && <CargaToto key={parametros.id ?? 'nuevo'} id={parametros.id ?? null} fecha={parametros.fecha} />;
}

// Al editar hay que leer la planilla antes de armar el formulario: sus valores iniciales salen de ahí.
function CargaToto({ id, fecha }: { id: string | null; fecha?: string }) {
  const planilla = usePlanillaToto(id);
  if (id && !planilla.data) return planilla.error instanceof Error ? <DialogoCarga error={planilla.error.message} /> : null;
  return <Formulario id={id} fecha={fecha} planilla={planilla.data} />;
}

function Formulario({ id, fecha, planilla }: { id: string | null; fecha?: string; planilla?: PlanillaToto }) {
  const referencia = useRef<HTMLDialogElement>(null);
  const f = useTotoFormulario({ id, fecha, planilla });
  const { operacion, errores } = f;
  useEffect(() => { abrirModal(referencia.current); }, []);
  return (
    <dialog ref={referencia} aria-labelledby="titulo-toto-dialog" className={dialogo} tabIndex={-1} onCancel={(evento) => { evento.preventDefault(); if (!operacion.bloqueado) f.cerrar(); }}>
      <div className={erroresDlg}>
        {f.errorConsulta && <p role="alert" className={error}>{f.errorConsulta}</p>}
        {f.errorConsulta && <button type="button" className={boton()} onClick={f.reintentarConsulta}>Reintentar consulta</button>}
        {operacion.error && <p role="alert" className={error}>{operacion.error}</p>}
        {operacion.bloqueado && !operacion.procesando && <button type="button" className={boton()} onClick={() => void operacion.enviar()}>Reintentar operación</button>}
      </div>
      <form className="contents" inert={operacion.bloqueado} onSubmit={(evento) => void f.guardar(evento)} noValidate>
        <div className={cuerpoDlg}>
          <h2 id="titulo-toto-dialog" className={tituloDlg}>{id ? 'Editar día · Toto Ortega' : 'Cargar día · Toto Ortega'}</h2>
          <label className={rotuloDlg}>Fecha<input className={campoDlg} type="date" {...f.register('fecha')} /></label>
          <span className={rotuloSueltoDlg}>Jugado por sorteo</span>
          <div className={fila2}>
            {JUEGOS.map((j) => (
              <label key={j.id} className={rotuloDlg} htmlFor={`toto-${j.id}`}>
                <span className="flex items-center justify-between gap-1.5">
                  <span>{j.nombre}</span>
                  <span className="inline-flex items-center gap-[3px] text-[11.5px] text-[var(--mu)]">N°
                    <Controller control={f.control} name={`concursos.${j.id}`} render={({ field }) => (
                      <input ref={field.ref} name={field.name} onBlur={field.onBlur} aria-label={`N° de concurso ${j.nombre}`} title="N° de concurso" inputMode="numeric" className={concurso}
                        value={(field.value as string | undefined) ?? String(f.sugeridos?.[j.id] ?? '')}
                        onChange={(evento) => field.onChange(evento.target.value.replace(/\D/g, ''))} />
                    )} />
                  </span>
                </span>
                <input id={`toto-${j.id}`} className={campoDineroDlg} inputMode="decimal" {...f.register(`jugadas.${j.id}`)} />
              </label>
            ))}
          </div>
          <p className={aclaracion}>El N° de concurso de cada sorteo se completa solo: sube 1 en cada día de sorteo (se cambia en Ajustes). Lo podés cambiar.</p>
          <div className={fila2}>
            <label className={rotuloDlg}>Premios pagados<input className={campoDineroDlg} inputMode="decimal" {...f.register('premios')} /></label>
            <label className={rotuloDlg}>Premios pagados por agencia (Ema)<input className={campoDineroDlg} inputMode="decimal" {...f.register('premiosAg')} /></label>
          </div>
          <p className={`${aclaracion} mt-2`}>Los premios de la agencia son solo para anotar: no se restan de ninguna cuenta.</p>
          {f.duplicado && <p role="status" className="mt-2 text-center text-[14.5px] text-[var(--warn)]">{f.duplicado}</p>}
          <div className="mt-2.5 mb-4 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-3.5 py-3">
            <div className={listaDlg}>
              {f.filas.map((x, i) => {
                const conSigno = x.nombre.startsWith('Total general');
                const color = x.signo < 0 ? 'text-[var(--bad)]' : x.signo > 0 ? 'text-[var(--ok)]' : '';
                return (
                  <div key={i}>
                    {conSigno
                      ? <span><b>Total general</b> <span className="text-[14.5px] text-[var(--mu)]">{x.nombre.slice('Total general'.length).trim()}</span></span>
                      : x.nombre === 'Debe' ? <span><b>Debe</b></span> : <span>{x.nombre}</span>}
                    {conSigno || x.nombre === 'Debe'
                      ? (x.valor === '—' ? <span className="text-[var(--mu)]">{x.valor}</span> : <span className={`font-semibold ${color}`}>{x.valor}</span>)
                      : <b>{x.valor}</b>}
                  </div>
                );
              })}
            </div>
          </div>
          {(errores.fecha || errores.premios || errores.premiosAg || errores.jugadas || errores.concursos) && <p role="alert" className={error}>Revisá la fecha, los montos y los números de concurso.</p>}
        </div>
        <div className={pieDlg}>
          {id ? <button type="button" disabled={operacion.bloqueado} className={boton('peligro', 'pie')} onClick={f.eliminar}>Eliminar</button> : <span />}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={boton('normal', 'pie')} disabled={operacion.bloqueado} onClick={f.cerrar}>Cancelar</button>
            <button disabled={!f.puedeGuardar} className={boton('primario', 'pie')}>Guardar</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
