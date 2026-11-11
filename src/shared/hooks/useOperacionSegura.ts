import { useEffect, useRef, useState } from 'react';
import { agencia, type DatosAgencia } from '../lib/supabase.service';

type Revision = { p_revision: number; p_operacion: string };
export type PuenteOperacion<R> = {
  obtenerRevision: () => number;
  bloquear: () => void;
  desbloquear: () => void;
  sincronizar: (datos: DatosAgencia, resultado: R) => void;
};

// Reintenta el mismo UUID y contenido si no se pudo confirmar una operación.
export function useOperacionSegura<E extends object, R>(puente: PuenteOperacion<R>, ejecutar: (entrada: E & Revision) => Promise<R>) {
  const pendiente = useRef<(E & Revision) | null>(null);
  const enCurso = useRef(false);
  const resultadoIncierto = useRef(false);
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
        const revision = puente.obtenerRevision();
        puente.bloquear();
        pendiente.current = { ...entrada, p_revision: revision, p_operacion: crypto.randomUUID() };
      }
      setBloqueado(true);
      const resultado = await ejecutar(pendiente.current);
      confirmada = true;
      if (!agencia) throw new Error('No se pudo actualizar la pantalla.');
      const datos = await agencia.leer();
      puente.sincronizar(datos, resultado);
      pendiente.current = null;
      resultadoIncierto.current = false;
      setBloqueado(false);
      puente.desbloquear();
      return true;
    } catch (e) {
      const codigo = (e as { code?: string })?.code;
      if (!confirmada && !resultadoIncierto.current && (codigo === '22023' || codigo === '40001' || codigo === '42501')) {
        pendiente.current = null;
        setBloqueado(false);
        puente.desbloquear();
      } else if (!pendiente.current) { setBloqueado(false); puente.desbloquear(); }
      else resultadoIncierto.current = true;
      setError(e instanceof Error ? e.message : 'No se pudo confirmar la operación.');
      return false;
    } finally { enCurso.current = false; setProcesando(false); }
  }
  return { enviar, bloqueado, error, procesando };
}
