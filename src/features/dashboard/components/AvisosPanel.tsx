import { boton } from '../../../shared/lib/clases';
import { useAvisos } from '../../../shared/stores/avisos.store';

// `.toast` y `.snack` de la maqueta; se montan al aparecer y entran con la animación `aviso-in` (src/app/styles.css).
const posicion = 'fixed bottom-[calc(20px+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 animate-[aviso-in_.2s] text-sm motion-reduce:animate-none';

export function AvisosPanel() {
  const mensaje = useAvisos((estado) => estado.mensaje);
  const aviso = useAvisos((estado) => estado.accion);
  const cerrarAccion = useAvisos((estado) => estado.cerrarAccion);
  return <>
    {mensaje && <div role="status" className={`${posicion} pointer-events-none z-[60] rounded-[10px] bg-[var(--ink)] px-4 py-2.5 text-[var(--bg)]`}>{mensaje}</div>}
    {aviso && <div role="status" className={`${posicion} z-[61] flex max-w-[calc(100vw-24px)] items-center gap-2.5 rounded-xl border border-solid border-[var(--ln)] bg-[var(--sf)] py-2.5 pr-3 pl-4 text-[var(--ink)] shadow-[0_10px_30px_rgba(0,0,0,.15)]`}>
      <span>{aviso.texto}</span>
      <button type="button" className={boton('normal', 'sm')} onClick={aviso.ejecutar}>{aviso.boton}</button>
      <button type="button" aria-label="Cerrar" className={boton('fantasma', 'sm')} onClick={cerrarAccion}>✕</button>
    </div>}
  </>;
}
