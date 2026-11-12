import { useEffect, useRef } from 'react';
import { useDialogo } from '../../../shared/stores/dialogos.store';
import type { PlanillaToto } from '../api/toto.service';
import { usePlanillaToto } from '../hooks/useToto';
import { useTotoPago } from '../hooks/useTotoPago';
import { DialogoCarga } from '../../../shared/components/DialogoCarga';
import { boton, campoDineroDlg, campoDlg, cuerpoDlg, dialogo, erroresDlg, fila2, listaDlg, pieDlg, rotuloDlg, tituloDlg } from '../../../shared/lib/clases';

const error = 'text-[14.5px] text-[var(--bad)]';
const resumenTarjeta = 'mb-4 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-3.5 py-3';

export function TotoPagoDialog() {
  const parametros = useDialogo('pagoToto');
  return parametros && <CargaPago key={parametros.id} id={parametros.id} />;
}

function CargaPago({ id }: { id: string }) {
  const planilla = usePlanillaToto(id);
  if (!planilla.data) return planilla.error instanceof Error ? <DialogoCarga error={planilla.error.message} /> : null;
  return <Formulario id={id} planilla={planilla.data} />;
}

function Formulario({ id, planilla }: { id: string; planilla: PlanillaToto }) {
  const referencia = useRef<HTMLDialogElement>(null);
  const p = useTotoPago(id, planilla);
  const { operacion } = p;
  useEffect(() => { referencia.current?.showModal(); }, []);
  return (
    <dialog ref={referencia} aria-labelledby="titulo-toto-pago" className={dialogo} onCancel={(evento) => { evento.preventDefault(); if (!operacion.bloqueado) p.cerrar(); }}>
      <div className={erroresDlg}>
        {operacion.error && <p role="alert" className={error}>{operacion.error}</p>}
        {operacion.bloqueado && !operacion.procesando && <button type="button" className={boton()} onClick={() => void operacion.enviar()}>Reintentar operación</button>}
      </div>
      <form className="contents" inert={operacion.bloqueado} onSubmit={(evento) => void p.guardar(evento)} noValidate>
        <div className={cuerpoDlg}>
          <h2 id="titulo-toto-pago" className={tituloDlg}>Pago parcial · {p.fechaDia}</h2>
          <p className="text-[14.5px] text-[var(--mu)]">Toto Ortega</p>
          <div className={resumenTarjeta}>
            <div className={listaDlg}>
              {p.resumen.map(([nombre, valor]) => (nombre === 'Debe'
                ? <div key={nombre}><span><b>Debe</b></span>{valor === '—' ? <span className="text-[var(--mu)]">{valor}</span> : <span className={`font-semibold ${valor.startsWith('+') ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}`}>{valor}</span>}</div>
                : <div key={nombre}><span>{nombre}</span><b>{valor}</b></div>))}
            </div>
          </div>
          {p.pagos.length > 0 && (
            <>
              <span className="mt-3 block text-[14.5px] text-[var(--mu)]">Pagos de este día</span>
              <div className={listaDlg}>
                {p.pagos.map((pago) => (
                  <div key={pago.indice}>
                    <span>{pago.fecha}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <b>{pago.monto}</b>
                      {p.quitables && <button type="button" className={boton('fantasma', 'chicoDlg')} disabled={operacion.bloqueado} aria-label="Quitar pago" onClick={() => p.quitar(pago.indice)}>✕</button>}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className={`${fila2} mt-3`}>
            <label className={rotuloDlg}>Monto que paga ahora<input className={campoDineroDlg} inputMode="decimal" autoFocus {...p.register('monto')} /></label>
            <label className={rotuloDlg}>Fecha<input className={campoDlg} type="date" {...p.register('fecha')} /></label>
          </div>
          {p.errores.map((mensaje, i) => <p key={i} role="alert" className={error}>{mensaje}</p>)}
        </div>
        <div className={pieDlg}>
          <span />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={boton('normal', 'pie')} disabled={operacion.bloqueado} onClick={p.cerrar}>Cancelar</button>
            <button disabled={operacion.bloqueado} className={boton('primario', 'pie')}>Guardar</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
