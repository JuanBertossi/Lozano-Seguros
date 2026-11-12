import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useCalendarioQuini } from './useQuini';

/**
 * Sorteo que se está viendo. Por defecto el próximo, o el último disponible si no hay próximo
 * (misma regla que `publicarQuini` de la maqueta). Anterior, siguiente y próximo recorren la lista de sorteos.
 */
export function useFechaQuini() {
  const calendario = useCalendarioQuini();
  const elegida = useNavegacion((estado) => estado.fechaQuini);
  const elegirFecha = useNavegacion((estado) => estado.elegirFechaQuini);
  const datos = calendario.data;
  const fechas = datos?.fechas ?? [];
  const proximo = datos?.proximo ?? null;
  const fecha = datos ? (elegida && fechas.includes(elegida) ? elegida : (proximo ?? fechas.at(-1) ?? datos.hoy)) : null;
  const indice = fecha ? fechas.indexOf(fecha) : -1;
  return {
    fecha,
    error: calendario.error,
    anterior: indice <= 0,
    siguiente: indice >= fechas.length - 1,
    hayProximo: proximo !== null && fecha !== proximo,
    cambiar: (paso: number) => elegirFecha(fechas[indice + paso] ?? fecha),
    irProximo: () => elegirFecha(proximo),
  };
}
