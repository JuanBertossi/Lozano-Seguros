import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';

interface Estado {
  mensaje?: string;
  conflicto: boolean;
  reintentar: () => void;
  recargar: () => void;
}

export function EstadoGuardado() {
  const estado = usePanelEvent<Estado>('agencia:estado-guardado');
  if (!estado) return null;
  return (
    <div role="status" className="fixed right-4 bottom-4 z-[90] rounded-xl border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-3 shadow-lg">
      {estado.mensaje ? <>
        <p className="mb-2 text-[var(--bad)]">Cambios sin confirmar. {estado.mensaje}</p>
        <div className="flex gap-2">
          <button type="button" className="cursor-pointer rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-1.5 text-sm" onClick={estado.recargar}>Volver a cargar</button>
          {!estado.conflicto && <button type="button" className="cursor-pointer rounded-lg border border-solid border-[var(--ac)] bg-[var(--ac)] px-3 py-1.5 text-sm text-white" onClick={estado.reintentar}>Reintentar</button>}
        </div>
      </> : 'Guardando en Supabase…'}
    </div>
  );
}
