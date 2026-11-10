import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';
import { socioSchema, type SocioInput } from '../socio.schema';

interface EdicionSocio {
  id: string | null;
  inicial: SocioInput;
  guardar: (datos: SocioInput) => void;
  eliminar: () => void;
  cerrar: () => void;
}

const campo = 'w-full rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] focus-visible:outline-2 focus-visible:outline-[var(--ac)]';
const etiqueta = 'grid gap-1.5 text-[14.5px] font-medium';
const boton = 'cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15.5px] font-medium hover:bg-[var(--sf2)]';

function FormularioSocio({ edicion }: { edicion: EdicionSocio }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<SocioInput>({
    resolver: zodResolver(socioSchema),
    defaultValues: edicion.inicial,
  });

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-edicion-socio" id="socio-dialog"
      className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[#0a0c0f73]"
      onCancel={(event) => { event.preventDefault(); edicion.cerrar(); }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) edicion.cerrar();
        }
      }}>
      <form onSubmit={handleSubmit(edicion.guardar)} noValidate>
        <div className="grid gap-3.5 px-6 pt-[22px] pb-5 max-[820px]:px-4">
          <h2 id="titulo-edicion-socio" className="text-[22px] font-semibold">{edicion.id ? 'Editar socio' : 'Nuevo socio'}</h2>
          <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
            <label className={etiqueta}>
              Nombre y apellido
              <input className={campo} autoFocus {...register('nombre')} />
              {errors.nombre && <span className="text-sm text-[var(--bad)]" role="alert">{errors.nombre.message}</span>}
            </label>
            <label className={etiqueta}>N° de socio<input className={campo + ' font-mono'} {...register('nro')} /></label>
          </div>
          <label className={etiqueta}>Celular<input className={campo} inputMode="tel" placeholder="Ej: 3544 551122 (sin 0, sin 15, sin +54)" {...register('tel')} /></label>
          <label className={etiqueta}>Dirección<input className={campo} {...register('dir')} /></label>
          {edicion.id ? (
            <>
              <details className="rounded-lg border border-solid border-[var(--ln)] p-3" open={Boolean(errors.favor) || undefined}>
                <summary className="cursor-pointer">Corregir saldo a favor a mano</summary>
                <label className={etiqueta + ' mt-2'}>Saldo a favor<input className={campo} inputMode="decimal" {...register('favor')} /></label>
                {errors.favor && <p className="mt-2 text-sm text-[var(--bad)]" role="alert">{errors.favor.message}</p>}
              </details>
              <label className="flex items-center gap-2 text-[15.5px]">
                <input type="checkbox" className="accent-[var(--ac)]" {...register('archivado')} />
                Archivar (ya no es socio)
              </label>
            </>
          ) : <p className="text-[14.5px] text-[var(--mu)]">Después de guardarlo, desde su ficha le agregás seguros, Quini 6, lotería, quiniela o rifa.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-solid border-[var(--ln)] px-6 py-3 max-[820px]:px-4">
          <div>{edicion.id && <button type="button" className={boton + ' text-[var(--bad)]'} onClick={edicion.eliminar}>Eliminar</button>}</div>
          <div className="flex gap-2">
            <button type="button" className={boton} onClick={edicion.cerrar}>Cancelar</button>
            <button type="submit" className="cursor-pointer rounded-[9px] border border-solid border-[var(--ac)] bg-[var(--ac)] px-4 py-2.5 text-[15.5px] font-medium text-white hover:brightness-110">Guardar</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

export function SocioDialog() {
  const edicion = usePanelEvent<EdicionSocio>('agencia:editar-socio');
  return edicion && <FormularioSocio key={edicion.id ?? 'nuevo'} edicion={edicion} />;
}
