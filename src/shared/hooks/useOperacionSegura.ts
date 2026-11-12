import { useEffect, useRef, useState } from 'react';
import { obtenerRevision, recargarSesion, sincronizarRevision } from './useSesion';
import { useNavegacion } from '../stores/navegacion.store';

type Revision = { p_revision: number; p_operacion: string };

interface Opciones<R> {
  /** Se ejecuta cuando el servidor confirmó y la pantalla ya tiene los datos nuevos. */
  alExito?: (resultado: R) => void;
}

// Reintenta el mismo UUID y contenido si no se pudo confirmar una operación.
export function useOperacionSegura<E extends object, R>(ejecutar: (entrada: E & Revision) => Promise<R>, opciones: Opciones<R> = {}) {
  const pendiente = useRef<(E & Revision) | null>(null);
  const enCurso = useRef(false);
  const resultadoIncierto = useRef(false);
  const alExito = useRef(opciones.alExito);
  alExito.current = opciones.alExito;
  const bloquear = useNavegacion((estado) => estado.bloquear);
  const [bloqueado, setBloqueado] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!bloqueado) return;
    const avisar = (evento: BeforeUnloadEvent) => { evento.preventDefault(); evento.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [bloqueado]);

  async function enviar(entrada?: E) {
    if (enCurso.current) return false;
    enCurso.current = true;
    setProcesando(true);
    setError('');
    let confirmada = false;
    try {
      if (!pendiente.current) {
        if (!entrada) throw new Error('No hay una operación para reintentar.');
        const revision = obtenerRevision();
        if (revision === null) throw new Error('Esperá a que termine de cargar.');
        bloquear(true);
        pendiente.current = { ...entrada, p_revision: revision, p_operacion: crypto.randomUUID() };
      }
      setBloqueado(true);
      const resultado = await ejecutar(pendiente.current);
      confirmada = true;
      await sincronizarRevision(resultado);
      pendiente.current = null;
      resultadoIncierto.current = false;
      setBloqueado(false);
      bloquear(false);
      alExito.current?.(resultado);
      return true;
    } catch (e) {
      const codigo = (e as { code?: string })?.code;
      if (!confirmada && !resultadoIncierto.current && (codigo === '22023' || codigo === '40001' || codigo === '42501')) {
        pendiente.current = null;
        setBloqueado(false);
        bloquear(false);
        if (codigo === '40001') void recargarSesion().catch(() => {});
      } else if (!pendiente.current) { setBloqueado(false); bloquear(false); }
      else resultadoIncierto.current = true;
      setError(e instanceof Error ? e.message : 'No se pudo confirmar la operación.');
      return false;
    } finally { enCurso.current = false; setProcesando(false); }
  }
  return { enviar, bloqueado, error, procesando };
}
