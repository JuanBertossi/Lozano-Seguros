import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buscar } from '../api/busqueda.service';

export function useBusquedaServidor(revision: number | null, consulta: string) {
  const [texto, setTexto] = useState(consulta);
  useEffect(() => {
    const temporizador = window.setTimeout(() => setTexto(consulta), 200);
    return () => window.clearTimeout(temporizador);
  }, [consulta]);
  const busqueda = useQuery({
    queryKey: ['busqueda', revision, texto],
    queryFn: () => buscar(revision!, texto),
    enabled: revision !== null && texto.trim().length > 0,
    retry: false,
  });
  return { ...busqueda, data: texto === consulta ? busqueda.data : undefined, esperando: texto !== consulta || busqueda.isFetching };
}
