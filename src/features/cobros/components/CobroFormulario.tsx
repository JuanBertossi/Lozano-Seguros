import { useEffect, useRef, type CSSProperties } from 'react';
import { Controller } from 'react-hook-form';
import { PagoCampos } from '../../../shared/components/PagoCampos';
import { boton, campoMontoDlg, cuerpoSinTopeDlg, dialogo, encabezadoDlg, enlace, margenNativo, notaDlg, opciones, pieDlg, rotuloDlg } from '../../../shared/lib/clases';
import { fechaLarga } from '../../../shared/lib/fechas';
import { moneda } from '../../../shared/lib/moneda';
import type { ConceptoCobro, DatosCobro } from '../api/cobros.service';
import { useFormularioCobro } from '../hooks/useFormularioCobro';
import { resumenCuenta, type VistaPreviaCobro } from '../lib/cobroVista';
import { abrirModal } from '../../../shared/lib/dialogo';

const color = { ok: 'text-[var(--ok)]', warn: 'text-[var(--warn)]', bad: 'text-[var(--bad)]', mu: 'text-[var(--mu)]' };
const paso = 'mb-3.5';
const pasoCabecera = 'mb-2 flex flex-wrap items-center justify-between gap-2.5';
const textoChico = 'text-[14.5px]';

interface FilaProps {
  concepto: ConceptoCobro;
  marcado: boolean;
  aplicacion?: VistaPreviaCobro['aplicaciones'][string];
  alternar: (clave: string) => void;
}

function FilaConcepto({ concepto, marcado, aplicacion, alternar }: FilaProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 border-b border-solid border-[var(--ln2)] py-2.5 last-of-type:border-b-0">
      <input type="checkbox" className={`size-4 accent-[var(--ac)] ${margenNativo}`} checked={marcado} onChange={() => alternar(concepto.clave)} />
      <span className="flex-1 text-[var(--ink)]">
        <span className="my-px mr-0.5 inline-flex items-center gap-[5px] rounded-md border border-solid border-[var(--ln)] px-2 py-0.5 text-xs font-medium before:size-[7px] before:rounded-[2px] before:bg-[var(--c)] before:content-['']" style={{ '--c': `var(--${concepto.tipo})` } as CSSProperties}>{concepto.producto}</span> {concepto.titulo}
        <br /><span className={`${textoChico} text-[var(--mu)]`}>{concepto.futuro ? 'Vence ' : 'Venció '}{fechaLarga(concepto.fecha)}</span>
      </span>
      <span className="text-right whitespace-nowrap">
        <b className="block text-[var(--ink)]">{moneda(concepto.importe)}</b>
        <span className="mt-0.5 block text-xs font-medium">{aplicacion && <span className={color[aplicacion.estado]}>{aplicacion.texto}</span>}</span>
      </span>
    </label>
  );
}

export function CobroFormulario({ datos, cerrar }: { datos: DatosCobro; cerrar: () => void }) {
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const f = useFormularioCobro(datos, cerrar);
  const { previa, operacion, pago, valores } = f;
  const elegidas = new Set(valores.seleccionadas);
  const ocupado = operacion.bloqueado || operacion.procesando;
  const mensajeError = pago.formState.errors.root?.message
    || (operacion.bloqueado ? 'No se pudo confirmar el resultado. Reintentá para verificar el mismo cobro.' : operacion.error)
    || f.errorPrevia;
  const favor = datos.resumen.favor ? moneda(datos.resumen.favor) : '';
  // El diálogo toma el foco (sin anillo) como en la maqueta; el primer campo no queda enfocado.
  useEffect(() => { abrirModal(dialogoRef.current); }, []);

  return (
    <dialog ref={dialogoRef} aria-labelledby="titulo-cobro" className={dialogo} tabIndex={-1}
      onCancel={(event) => { event.preventDefault(); if (!ocupado) cerrar(); }}>
      <form className="contents" onSubmit={f.enviar} noValidate>
        <div className={encabezadoDlg}><h2 id="titulo-cobro" className="m-0 text-[17px] font-semibold tracking-[-.01em]">Registrar cobro</h2><span className="text-[var(--mu)]">{datos.socio}</span></div>
        <fieldset disabled={ocupado} className="contents">
          <div className={cuerpoSinTopeDlg}>
            <div className="mb-4 grid grid-cols-3 overflow-hidden rounded-xl border border-solid border-[var(--ln)]">
              {resumenCuenta(datos.resumen).map((item) => (
                <div key={item.titulo} className="border-r border-solid border-[var(--ln2)] px-3.5 py-2.5 last:border-r-0 last:bg-[var(--sf2)]">
                  <small className="block text-xs text-[var(--mu)]">{item.titulo}</small>
                  <b className={`block overflow-hidden text-lg whitespace-nowrap max-[820px]:text-[15px] ${item.color ? color[item.color] : ''}`}>{item.texto}</b>
                </div>
              ))}
            </div>
            <div className={paso}>
              <div className={pasoCabecera}><b className="text-sm">1. Cuánto te da</b></div>
              <label className={`${rotuloDlg} max-w-[300px]`}>Monto recibido
                <Controller control={pago.control} name="monto" render={({ field }) => <input {...field} value={f.montoManual ? field.value ?? '' : previa.sugerido} onChange={(event) => { f.editarMonto(); field.onChange(event); }} className={campoMontoDlg} inputMode="decimal" placeholder="0,00" />} />
              </label>
              <p className={notaDlg}>Podés ingresar centavos con coma. Ejemplo: 1.484.601,50.</p>
              {pago.formState.errors.monto && <p className={`${textoChico} text-[var(--bad)]`} role="alert">{pago.formState.errors.monto.message}</p>}
            </div>
            <div className={paso}>
              <div className={pasoCabecera}><b className="text-sm">2. Qué paga primero</b><span className={`${textoChico} text-[var(--mu)]`}>Si la plata no alcanza para todo</span></div>
              {datos.prioridades.length > 2 && (
                <div className="mb-2.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Prioridad de pago">
                  {datos.prioridades.map((item) => (
                    <button key={item.clave} type="button" role="radio" aria-checked={valores.prioridad === item.clave}
                      className={`flex min-w-24 cursor-pointer flex-col gap-px rounded-[10px] border border-solid px-3 py-[7px] text-sm leading-[1.25] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ac)] ${valores.prioridad === item.clave ? 'border-[var(--ac)] bg-[var(--ac-s)] font-semibold' : 'border-[var(--ln)]'}`}
                      onClick={() => f.marcarVencidas(item.clave)}><span>{item.titulo}</span><small className="text-xs text-[var(--mu)]">{moneda(item.importe)}</small></button>
                  ))}
                </div>
              )}
              <div className="max-h-[300px] overflow-auto rounded-xl border border-solid border-[var(--ln)] px-3 py-0.5">
                {datos.rifasTodas.length > 0 && <>
                  <div className={opciones}>
                    <button type="button" className={boton('normal', 'chicoDlg')} onClick={() => f.marcarRifas(false)}>Seleccionar cuotas vencidas de rifa</button>
                    <button type="button" className={boton('normal', 'chicoDlg')} onClick={() => f.marcarRifas(true)}>{datos.unaRifa ? 'Pagar esta rifa' : 'Pagar todas las rifas'}</button>
                  </div>
                  <p className={notaDlg}>También podés elegir cuotas específicas, incluidas las que todavía no vencen.</p>
                </>}
                {f.vencidas.length
                  ? <div className="flex flex-col">{f.vencidas.map((concepto) => <FilaConcepto key={concepto.clave} concepto={concepto} marcado={elegidas.has(concepto.clave)} aplicacion={previa.aplicaciones[concepto.clave]} alternar={f.alternar} />)}</div>
                  : <p className="px-1 py-3.5 text-sm text-[var(--mu)]">{f.futuras.length ? 'No tiene nada vencido.' : 'No debe nada. Igual podés registrar un pago a cuenta: queda como saldo a favor.'}</p>}
                {f.futuras.length > 0 && (f.mostrarFuturas
                  ? <div><p className={`${textoChico} mx-0 mt-2.5 mb-0.5 text-[var(--mu)]`}>Todavía no vencen</p>{f.futuras.map((concepto) => <FilaConcepto key={concepto.clave} concepto={concepto} marcado={elegidas.has(concepto.clave)} aplicacion={previa.aplicaciones[concepto.clave]} alternar={f.alternar} />)}</div>
                  : <button type="button" className={`${boton('fantasma', 'chicoDlg')} my-1.5`} onClick={f.mostrarMasFuturas}>Adelantar cuotas que todavía no vencen ({f.futuras.length})</button>)}
              </div>
            </div>
            <div className="mb-4 rounded-xl bg-[var(--sf2)] px-3.5 py-3">
              <div className="flex justify-between gap-2.5 py-[3px] text-sm"><span className="text-[var(--mu)]">Recibís hoy</span><b>{previa.recibido}</b></div>
              {favor && <div className="flex justify-between gap-2.5 py-[3px] text-sm"><label className="flex cursor-pointer items-center gap-2 text-[var(--mu)]"><input type="checkbox" className="m-0 size-4 accent-[var(--ac)]" {...f.seleccion.register('usarFavor')} /> Usar saldo a favor ({favor})</label><b>{previa.usado}</b></div>}
              <div className="mt-1.5 flex justify-between gap-2.5 border-t border-solid border-[var(--ln)] pt-2 text-[15px]"><span className="font-semibold text-[var(--ink)]">Después del cobro</span><b className={color[previa.color]}>{previa.estado}</b></div>
              {previa.sobrante && <p className={`mt-1.5 ${textoChico} text-[var(--ok)]`}>Sobran {previa.sobrante}: quedan como saldo a favor.</p>}
              {previa.sobrante && f.sinSeleccionar > 0 && <p className={`mt-1.5 ${textoChico} text-[var(--warn)]`}>Destildaste {f.sinSeleccionar > 1 ? `${f.sinSeleccionar} deudas vencidas` : 'una deuda vencida'}, así que va a quedar debiendo y con saldo a favor a la vez. <button type="button" className={enlace} onClick={() => f.marcarVencidas()}>Usar lo que sobra para esa deuda</button></p>}
            </div>
            <div className={paso}><div className={pasoCabecera}><b className="text-sm">3. Cómo pagó</b></div><PagoCampos form={pago} /></div>
            {mensajeError && <p role="alert" className={`${textoChico} text-[var(--bad)]`}>{mensajeError}</p>}
          </div>
        </fieldset>
        <div className={pieDlg}>
          <span />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={boton('normal', 'pie')} disabled={ocupado} onClick={cerrar}>Cancelar</button>
            <button type="submit" className={boton('primario', 'pie')} disabled={operacion.procesando || (!operacion.bloqueado && (!previa.habilitado || f.calculando))}>{operacion.bloqueado ? 'Verificar cobro' : previa.accion}</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
