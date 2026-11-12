import { useEffect, useRef } from 'react';
import { useOperacionSegura } from '../../../shared/hooks/useOperacionSegura';
import { useRevision } from '../../../shared/hooks/useSesion';
import { hoy } from '../../../shared/lib/fechas';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useGenerarQuini } from '../hooks/useQuini';

/**
 * Genera las jugadas automáticas cuando cambia el día (con el panel abierto de un día para el otro).
 * La generación al ingresar la dispara el login; acá se revisa cada minuto, al volver la conexión
 * y al volver a ver la pestaña.
 */
export function GeneracionQuini() {
  const revision = useRevision();
  const ultimaFecha = useRef(hoy());
  const enCurso = useRef(false);
  const generar = useGenerarQuini();
  const operacion = useOperacionSegura<object, number>(solicitud => generar.mutateAsync(solicitud));
  const enviar = useRef(operacion.enviar);
  enviar.current = operacion.enviar;

  useEffect(() => {
    if (revision === null) return;
    async function revisar() {
      const fecha = hoy();
      if (fecha === ultimaFecha.current || enCurso.current || operacion.bloqueado) return;
      // Con un diálogo abierto o una operación en curso se espera a la próxima revisión.
      if (useDialogos.getState().dialogo || useNavegacion.getState().bloqueado || document.querySelector('dialog[open]')) return;
      enCurso.current = true;
      try { if (await enviar.current({})) ultimaFecha.current = fecha; }
      finally { enCurso.current = false; }
    }
    const revisarVisible = () => { if (document.visibilityState === 'visible') void revisar(); };
    const temporizador = window.setInterval(revisarVisible, 60_000);
    window.addEventListener('online', revisarVisible);
    document.addEventListener('visibilitychange', revisarVisible);
    revisarVisible();
    return () => {
      window.clearInterval(temporizador);
      window.removeEventListener('online', revisarVisible);
      document.removeEventListener('visibilitychange', revisarVisible);
    };
  }, [revision, operacion.bloqueado]);

  async function reintentar() {
    if (enCurso.current) return;
    enCurso.current = true;
    try {
      // Si había una operación pendiente se reintenta con el mismo identificador; si no, se arma una nueva.
      if (await operacion.enviar(operacion.bloqueado ? undefined : {})) ultimaFecha.current = hoy();
    } finally { enCurso.current = false; }
  }

  if (!operacion.bloqueado && !operacion.error) return null;
  return <div role="status" className="fixed inset-0 z-[100] grid place-items-center bg-black/30 p-4">
    <div className="max-w-md rounded-xl bg-[var(--sf)] p-5 text-[var(--ink)] shadow-xl">
      <p>{operacion.error || 'Actualizando jugadas automáticas…'}</p>
      {operacion.error && <button type="button" disabled={operacion.procesando} className="mt-3 rounded-lg border border-solid border-[var(--ln)] px-3 py-2" onClick={() => void reintentar()}>Reintentar</button>}
    </div>
  </div>;
}
