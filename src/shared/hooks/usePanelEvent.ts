import { useEffect, useState } from 'react';

export function usePanelEvent<T>(nombre: string) {
  const [valor, setValor] = useState<T | null>(null);
  useEffect(() => {
    function recibir(event: Event) {
      setValor((event as CustomEvent<T | null>).detail);
    }

    window.addEventListener(nombre, recibir);
    return () => window.removeEventListener(nombre, recibir);
  }, [nombre]);
  return valor;
}
