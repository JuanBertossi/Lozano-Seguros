import { useEffect, useRef, useState } from 'react';

/** Devuelve `valor` recién cuando dejó de cambiar durante `espera` ms. `listo` indica que ya alcanzó al valor actual. */
export function useValorEstable<T>(valor: T, espera: number) {
  const huella = JSON.stringify(valor);
  const ultimo = useRef(valor);
  ultimo.current = valor;
  const [estable, setEstable] = useState({ huella, valor });
  useEffect(() => {
    const temporizador = window.setTimeout(() => setEstable({ huella, valor: ultimo.current }), espera);
    return () => window.clearTimeout(temporizador);
  }, [huella, espera]);
  return { valor: estable.valor, listo: estable.huella === huella };
}
