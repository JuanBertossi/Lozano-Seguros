import { hoy as fechaHoy,sumarDias } from '../../../shared/lib/fechas';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion,type FiltroPago } from '../../../shared/stores/navegacion.store';
import { presentarQuiniela } from '../lib/quinielaVista';
import { useListadoQuiniela } from './useQuiniela';

/** Todo lo que muestra la página de Quiniela y las acciones de sus botones (`publicarQuiniela` de la maqueta). */
export function useVistaQuiniela() {
  const fecha = useNavegacion((estado) => estado.fechaQuiniela);
  const elegirFecha = useNavegacion((estado) => estado.elegirFechaQuiniela);
  const filtro = useNavegacion((estado) => estado.filtro);
  const filtrar = useNavegacion((estado) => estado.elegirFiltro);
  const verSocio = useNavegacion((estado) => estado.verSocio);
  const abrir = useDialogos((estado) => estado.abrir);
  const listado = useListadoQuiniela(fecha);
  // Si todavía llegan los datos del día recién elegido, no se muestran los del anterior.
  const datos = listado.data?.fecha === fecha ? listado.data : undefined;
  const mensaje = listado.error instanceof Error ? listado.error.message : 'Cargando Quiniela…';
  if (!datos) return { vista: null, mensaje };
  return {
    mensaje,
    vista: {
      ...presentarQuiniela(datos, filtro),
      fecha,
      filtro,
      cambiarFecha: elegirFecha,
      ir: (dias: number) => elegirFecha(sumarDias(fecha, dias)),
      irHoy: () => elegirFecha(fechaHoy()),
      filtrar: (nuevo: FiltroPago) => filtrar(nuevo),
      cargar: () => abrir({ tipo: 'quiniela' }),
      editar: (id: string) => abrir({ tipo: 'quiniela', id }),
      verSocio,
      cobrar: (sid: string, id: string) => abrir({ tipo: 'cobro', sid, solo: `quiniela|${id}` }),
      editarPago: (id: string) => abrir({ tipo: 'editarPago', juego: 'quiniela', id }),
    },
  };
}
