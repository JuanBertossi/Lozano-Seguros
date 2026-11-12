import { useEffect, useRef, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { PagoCampos } from './PagoCampos';
import { pagoSchema, type PagoInput } from '../schemas/pago.schema';
import { boton, campoDineroDlg, cuerpoDlg, dialogo, erroresDlg, notaDlg, pieDlg, rotuloDlg, tituloDlg } from '../lib/clases';
import { abrirModal } from '../lib/dialogo';

interface OperacionPago {
  bloqueado: boolean;
  procesando: boolean;
  error: string;
  reintentar: () => void;
}

interface Props {
  titulo: string;
  /** Texto de apoyo bajo el título (socio, vencimiento, importe…). */
  resumen?: ReactNode;
  /** Muestra el campo "Monto recibido" (solo para editar un cobro). */
  conMonto?: boolean;
  valores: PagoInput;
  textoGuardar: string;
  nota?: string;
  anular?: { texto: string; ejecutar: () => void };
  operacion: OperacionPago;
  guardar: (datos: PagoInput) => void;
  cerrar: () => void;
}

const error = 'text-[14.5px] text-[var(--bad)]';

/** Cuerpo común de los diálogos de pago: fecha, medio, detalle y los botones. Cada variante decide qué operación llama. */
export function PagoFormulario({ titulo, resumen, conMonto = false, valores, textoGuardar, nota, anular, operacion, guardar, cerrar }: Props) {
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const form = useForm<PagoInput>({ resolver: zodResolver(pagoSchema), defaultValues: valores });
  // El diálogo toma el foco (sin anillo) como en la maqueta; el primer campo no queda enfocado.
  useEffect(() => { abrirModal(dialogoRef.current); }, []);

  return (
    <dialog ref={dialogoRef} aria-labelledby="titulo-pago-cuota" className={dialogo} tabIndex={-1}
      onCancel={(event) => { event.preventDefault(); if (!operacion.bloqueado) cerrar(); }}>
      <div className={erroresDlg}>
        {operacion.error && <p role="alert" className={error}>{operacion.error}</p>}
        {operacion.bloqueado && !operacion.procesando && <button type="button" className={boton()} onClick={operacion.reintentar}>Reintentar operación</button>}
      </div>
      <form className="contents" inert={operacion.bloqueado} onSubmit={form.handleSubmit(guardar)} noValidate>
        <div className={cuerpoDlg}>
          <h2 id="titulo-pago-cuota" className={tituloDlg}>{titulo}</h2>
          {resumen && <p className="mb-3 text-[var(--mu)]">{resumen}</p>}
          {conMonto && <label className={rotuloDlg}>Monto recibido
            <input inputMode="decimal" className={campoDineroDlg} {...form.register('monto')} />
            {form.formState.errors.monto && <span role="alert" className={error}>{form.formState.errors.monto.message}</span>}
          </label>}
          <PagoCampos form={form} />
          {nota && <p className={notaDlg}>{nota}</p>}
          {form.formState.errors.root?.message && <p role="alert" className={error}>{form.formState.errors.root.message}</p>}
        </div>
        <div className={pieDlg}>
          {anular ? <button type="button" className={boton('peligro', 'pie')} onClick={anular.ejecutar}>{anular.texto}</button> : <span />}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={boton('normal', 'pie')} onClick={cerrar}>Cancelar</button>
            <button type="submit" disabled={operacion.procesando} className={boton('primario', 'pie')}>{textoGuardar}</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
