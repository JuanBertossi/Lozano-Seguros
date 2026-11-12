import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRevision } from '../../../shared/hooks/useSesion';
import { actividadService } from '../api/actividad.service';
import { presentarActividad } from '../lib/actividadVista';

/** Movimientos de la agencia, filtrados por usuario en el servidor (los últimos 400 del elegido). */
export function useActividad() {
  const revision = useRevision();
  const [usuario, elegirUsuario] = useState('todos');
  const consulta = useQuery({
    queryKey: ['actividad', revision, usuario],
    queryFn: () => actividadService.listar(revision!, usuario),
    enabled: revision !== null,
    select: presentarActividad,
    placeholderData: keepPreviousData,
  });
  return { consulta, usuario, elegirUsuario };
}
