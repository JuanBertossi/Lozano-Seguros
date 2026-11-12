import { useEffect, useRef } from 'react';
import { useDialogos } from '../stores/dialogos.store';
import { abrirModal } from '../lib/dialogo';

interface Props {
  /** Texto del error; si falta, el diálogo indica que está cargando. */
  error?: string;
  /** Por defecto cierra el diálogo abierto en el store. */
  cerrar?: () => void;
}

/** Se muestra mientras el servidor entrega lo que necesita el formulario de otro diálogo, o si no pudo hacerlo. */
export function DialogoCarga({ error, cerrar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const cerrarDialogo = useDialogos((estado) => estado.cerrar);
  const cierre = cerrar ?? cerrarDialogo;
  useEffect(() => { abrirModal(dialogo.current);}, []);
  return (
    <dialog ref={dialogo} aria-label={error ? 'No se pudo abrir' : 'Cargando'} className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[420px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[#0a0c0f73]"
      onCancel={(event) => { event.preventDefault(); cierre(); }}>
      <div className="grid gap-3.5 px-6 py-[22px] max-[820px]:px-4">
        {error && <h2 className="text-[22px] font-semibold">No se pudo abrir</h2>}
        <p role={error ? 'alert' : 'status'} className={`text-sm ${error ? 'text-[var(--bad)]' : 'text-[var(--mu)]'}`}>{error || 'Cargando…'}</p>
        <div className="flex justify-end"><button type="button" className="cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15px] hover:bg-[var(--sf2)]" onClick={cierre}>Cerrar</button></div>
      </div>
    </dialog>
  );
}
