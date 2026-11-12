import { useNavegacion,type FiltroPago } from '../../../shared/stores/navegacion.store';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { descargarQuiniPdf } from '../../../shared/lib/pdfListado';
import { moneda } from '../../../shared/lib/moneda';
import { presentarQuini,tituloSorteo } from '../lib/quiniVista';
import { useFechaQuini } from './useFechaQuini';
import { useListadoQuini } from './useQuini';

/** Todo lo que muestra la página de Quini 6 y las acciones de sus botones (`publicarQuini` de la maqueta). */
export function useVistaQuini() {
  const sorteo = useFechaQuini();
  const filtro = useNavegacion((estado) => estado.filtro);
  const filtrar = useNavegacion((estado) => estado.elegirFiltro);
  const verSocio = useNavegacion((estado) => estado.verSocio);
  const abrir = useDialogos((estado) => estado.abrir);
  const listado = useListadoQuini(sorteo.fecha, filtro);
  const fecha = sorteo.fecha;
  // Si todavía llegan los datos del sorteo recién elegido, no se muestran los del anterior.
  const datos = fecha !== null && listado.data?.fecha === fecha ? listado.data : undefined;
  const error = sorteo.error ?? listado.error;
  const mensaje = error instanceof Error ? error.message : 'Cargando Quini…';
  if (!datos || fecha === null) return { vista: null, mensaje };
  const lista = presentarQuini(datos, filtro);
  const texto = (valor: string) => valor.replace(/ /g, ' ');
  return {
    mensaje,
    vista: {
      ...lista,
      fecha: tituloSorteo(fecha),
      anterior: sorteo.anterior,
      siguiente: sorteo.siguiente,
      proximo: sorteo.hayProximo,
      filtro,
      cambiarFecha: sorteo.cambiar,
      irProximo: sorteo.irProximo,
      filtrar: (nuevo: FiltroPago) => filtrar(nuevo),
      cargar: () => abrir({ tipo: 'quini', fecha }),
      editar: (id: string) => abrir({ tipo: 'quini', id }),
      verSocio,
      cobrar: (sid: string, id: string) => abrir({ tipo: 'cobro', sid, solo: `q6|${id}` }),
      editarPago: (id: string) => abrir({ tipo: 'editarPago', juego: 'q6', id }),
      editarEspecial: (id?: string) => abrir({ tipo: 'especialQuini', id }),
      pdf: () => {
        void descargarQuiniPdf({
          filtro, fecha: datos.fecha,
          filas: lista.filas.map((f) => [f.socio, f.tipo, texto(f.monto), f.pagado ? 'Pagado' : f.abono ? `Debe ${texto(f.restante)} (pagó ${texto(f.abono)})` : 'Debe']),
          cobrado: texto(moneda(datos.cobradoFiltrado)),
          falta: texto(moneda(datos.faltaFiltrado)),
        });
      },
    },
  };
}
