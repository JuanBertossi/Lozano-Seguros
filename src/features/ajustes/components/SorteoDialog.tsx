import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';
import { sorteoSchema, type SorteoInput } from '../ajustes.schema';

interface EdicionSorteo {
  id: string | null;
  inicial: SorteoInput;
  guardar: (datos: SorteoInput) => void;
  eliminar: () => void;
  cerrar: () => void;
}

const campo = 'w-full min-w-0 rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] focus-visible:outline-2 focus-visible:outline-[var(--ac)]';
const etiqueta = 'grid gap-1.5 text-[14.5px] font-medium';
const boton = 'cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15.5px] hover:bg-[var(--sf2)]';

export function SorteoDialog() {
  const edicion = usePanelEvent<EdicionSorteo>('agencia:editar-sorteo');
  return edicion && <Formulario key={edicion.id ?? 'nuevo'} edicion={edicion} />;
}

function Formulario({ edicion }: { edicion: EdicionSorteo }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<SorteoInput>({
    resolver: zodResolver(sorteoSchema),
    defaultValues: edicion.inicial,
  });
  useEffect(() => { dialogo.current?.showModal(); }, []);

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-sorteo"
      className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[#0a0c0f73]"
      onCancel={(event) => { event.preventDefault(); edicion.cerrar(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) edicion.cerrar();
      }}>
      <form onSubmit={handleSubmit(edicion.guardar)} noValidate>
        <div className="grid gap-3.5 px-6 pt-[22px] pb-5 max-[820px]:px-4">
          <h2 id="titulo-sorteo" className="text-[22px] font-semibold">{edicion.id ? 'Editar sorteo' : 'Nuevo sorteo'}</h2>
          <label className={etiqueta}>Nombre<input className={campo} autoFocus placeholder="Ej: Gordo de Navidad 2026" {...register('nombre')} /></label>
          <div className="grid gap-3 min-[560px]:grid-cols-3">
            <label className={etiqueta}>Fecha<input className={campo} type="date" {...register('fecha')} /></label>
            <label className={etiqueta}>Fracciones<input className={campo} type="number" min="1" {...register('frac')} /></label>
            <label className={etiqueta}>Precio fracción<input className={campo} inputMode="decimal" {...register('precio')} /></label>
          </div>
          {Object.values(errors).map((error, indice) => <p key={indice} role="alert" className="text-sm text-[var(--bad)]">{error.message}</p>)}
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
