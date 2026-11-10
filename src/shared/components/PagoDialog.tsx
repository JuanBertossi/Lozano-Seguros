import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { PagoCampos } from './PagoCampos';
import { usePanelEvent } from '../hooks/usePanelEvent';
import { pagoSchema, type PagoInput } from '../schemas/pago.schema';

interface EdicionPago {
  clave: string;
  titulo: string;
  descripcion?: string;
  vencimiento?: string;
  importe?: string;
  nota?: string;
  textoGuardar: string;
  inicial: PagoInput;
  guardar: (datos: PagoInput) => string | void;
  anular?: { texto: string; ejecutar: () => void };
  cerrar: () => void;
}

export function PagoDialog() {
  const edicion = usePanelEvent<EdicionPago>('agencia:editar-pago');
  return edicion && <Formulario key={edicion.clave} edicion={edicion} />;
}

function Formulario({ edicion }: { edicion: EdicionPago }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const form = useForm<PagoInput>({ resolver: zodResolver(pagoSchema), defaultValues: edicion.inicial });
  useEffect(() => { dialogo.current?.showModal(); }, []);
  const boton = 'cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15.5px] hover:bg-[var(--sf2)]';

  function guardar(datos: PagoInput) {
    const mensaje = edicion.guardar(datos);
    if (mensaje) form.setError('root', { message: mensaje });
  }

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-pago-cuota" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[#0a0c0f73]"
      onCancel={(event) => { event.preventDefault(); edicion.cerrar(); }}>
      <form onSubmit={form.handleSubmit(guardar)} noValidate>
        <div className="grid gap-3.5 px-6 pt-[22px] pb-5 max-[820px]:px-4">
          <h2 id="titulo-pago-cuota" className="text-[22px] font-semibold">{edicion.titulo}</h2>
          {(edicion.descripcion || edicion.importe) && <p className="text-[var(--mu)]">
            {edicion.descripcion}
            {edicion.vencimiento && <><br />Vence {edicion.vencimiento} · </>}
            {edicion.importe && <b className="text-[var(--ink)]">{edicion.importe}</b>}
          </p>}
          {edicion.inicial.monto !== undefined && <label className="grid gap-1.5 text-[14.5px] font-medium">Monto recibido
            <input inputMode="decimal" className="w-full rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] focus-visible:outline-2 focus-visible:outline-[var(--ac)]" {...form.register('monto')} />
            {form.formState.errors.monto && <span role="alert" className="text-sm text-[var(--bad)]">{form.formState.errors.monto.message}</span>}
          </label>}
          <PagoCampos form={form} />
          {edicion.nota && <p className="text-sm text-[var(--mu)]">{edicion.nota}</p>}
          {form.formState.errors.root?.message && <p role="alert" className="text-sm text-[var(--bad)]">{form.formState.errors.root.message}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-solid border-[var(--ln)] px-6 py-3 max-[820px]:px-4">
          <div>{edicion.anular && <button type="button" className={boton + ' text-[var(--bad)]'} onClick={edicion.anular.ejecutar}>{edicion.anular.texto}</button>}</div>
          <div className="flex gap-2"><button type="button" className={boton} onClick={edicion.cerrar}>Cancelar</button><button type="submit" className="cursor-pointer rounded-[9px] border border-solid border-[var(--ac)] bg-[var(--ac)] px-4 py-2.5 text-[15.5px] font-medium text-white hover:brightness-110">{edicion.textoGuardar}</button></div>
        </div>
      </form>
    </dialog>
  );
}
