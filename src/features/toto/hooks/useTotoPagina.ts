import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { avisar } from '../../../shared/stores/avisos.store';
import { sumarDias } from '../../../shared/lib/fechas';
import type { PeriodoToto } from '../api/toto.service';
import { armarPdfToto, elegirPeriodo, presentarListado, subtituloPeriodo } from '../lib/totoVista';
import { descargarPdfToto } from '../lib/pdfToto';
import { useListadoToto, useOperacionToto, usePeriodosToto } from './useToto';

/** Todo lo que necesita la pantalla de Toto Ortega: el período elegido, la planilla y las acciones (`publicarToto` de la maqueta). */
export function useTotoPagina() {
  const vistaToto = useNavegacion((estado) => estado.vistaToto);
  const mesToto = useNavegacion((estado) => estado.mesToto);
  const diaToto = useNavegacion((estado) => estado.diaToto);
  const elegirVistaToto = useNavegacion((estado) => estado.elegirVistaToto);
  const elegirMesToto = useNavegacion((estado) => estado.elegirMesToto);
  const elegirDiaToto = useNavegacion((estado) => estado.elegirDiaToto);
  const abrir = useDialogos((estado) => estado.abrir);
  const periodos = usePeriodosToto();
  const periodo = periodos.data ? elegirPeriodo(periodos.data, vistaToto, mesToto, diaToto) : null;
  const listado = useListadoToto(periodo ? { periodo: periodo.vista, valor: periodo.valor } : null);
  const operacion = useOperacionToto(({ accion }) => avisar(accion === 'marcar' ? 'Marcado como pagado completo' : 'Pagos de ese día quitados'));
  const datos = listado.data && periodos.data ? { ...presentarListado(listado.data, periodos.data.porcentaje), porcentaje: periodos.data.porcentaje } : null;
  const meses = periodos.data?.meses ?? [];

  function ir(direccion: number) {
    if (!periodo) return;
    if (periodo.vista === 'dia') elegirDiaToto(sumarDias(periodo.dia, direccion));
    else if (periodo.vista === 'mes') elegirMesToto(meses[periodo.indiceMes + direccion] ?? periodo.mes);
  }

  return {
    periodo,
    datos,
    subtitulo: periodo && datos ? subtituloPeriodo(periodo, datos.filas.length) : '',
    irHoy: periodo?.vista === 'dia' && !periodo.esHoy,
    anteriorDeshabilitado: periodo?.vista === 'mes' && periodo.indiceMes <= 0,
    siguienteDeshabilitado: periodo?.vista === 'mes' && periodo.indiceMes >= meses.length - 1,
    cargando: periodos.isPending || (periodos.isSuccess && listado.isPending),
    error: periodos.error ?? listado.error,
    operacion,
    ir,
    hoy: () => { if (periodos.data) elegirDiaToto(periodos.data.hoy); },
    cambiar: (vista: PeriodoToto) => elegirVistaToto(vista),
    cargar: () => abrir({ tipo: 'toto', fecha: periodo?.vista === 'dia' ? periodo.dia : undefined }),
    editar: (id: string) => abrir({ tipo: 'toto', id }),
    pagoParcial: (id: string) => abrir({ tipo: 'pagoToto', id }),
    marcarPago: (id: string, pagado: boolean) => void operacion.enviar({ p_accion: pagado ? 'marcar' : 'desmarcar', p_id: id, p_datos: {} }),
    reintentar: () => { void periodos.refetch(); void listado.refetch(); },
    pdf: () => {
      if (!listado.data || !periodos.data || !periodo) return;
      void descargarPdfToto(armarPdfToto(listado.data, periodo.titulo, periodo.valor, periodos.data.porcentaje, periodos.data.agencia));
    },
  };
}
