import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';

interface AvisoAccion {
  texto: string;
  boton: string;
  ejecutar: () => void;
  cerrar: () => void;
}

export function AvisosPanel() {
  const mensaje = usePanelEvent<string>('agencia:aviso');
  const aviso = usePanelEvent<AvisoAccion>('agencia:aviso-accion');
  return <>
    {mensaje && <div role="status" className="pointer-events-none fixed bottom-[calc(20px+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] -translate-x-1/2 rounded-[10px] bg-[var(--ink)] px-4 py-2.5 text-sm text-[var(--bg)]">{mensaje}</div>}
    {aviso && <div role="status" className="fixed bottom-[calc(20px+env(safe-area-inset-bottom,0px))] left-1/2 z-[61] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2.5 rounded-xl border border-solid border-[var(--ln)] bg-[var(--sf)] py-2.5 pr-3 pl-4 text-sm text-[var(--ink)] shadow-lg">
      <span>{aviso.texto}</span>
      <button type="button" className="cursor-pointer rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-2 py-1 text-sm" onClick={aviso.ejecutar}>{aviso.boton}</button>
      <button type="button" aria-label="Cerrar" className="cursor-pointer border-0 bg-transparent px-2 py-1" onClick={aviso.cerrar}>✕</button>
    </div>}
  </>;
}
