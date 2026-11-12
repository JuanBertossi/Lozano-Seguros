import { useRevision } from '../../../shared/hooks/useSesion';
import { descargarLoteriaPdf } from '../../../shared/lib/pdfListado';
import { avisar } from '../../../shared/stores/avisos.store';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion, type FiltroPago } from '../../../shared/stores/navegacion.store';
import { moneda } from '../../../shared/lib/moneda';
import { vistaLoteria } from '../lib/loteriaVista';
import { useAccionLoteria, useListadoLoteria, useSorteosLoteria } from './useVenta';

const sinEspacioDuro = (texto: string) => texto.replace(/ /g, ' ');

/** Todo lo que la página de Lotería mostraba con `publicarLoteria`, leído del servidor. */
export function useLoteriaPagina() {
  const revision = useRevision();
  const sorteoElegido = useNavegacion((estado) => estado.sorteoId);
  const filtro = useNavegacion((estado) => estado.filtro);
  const elegirSorteo = useNavegacion((estado) => estado.elegirSorteo);
  const elegirFiltro = useNavegacion((estado) => estado.elegirFiltro);
  const navegar = useNavegacion((estado) => estado.navegar);
  const verSocio = useNavegacion((estado) => estado.verSocio);
  const abrir = useDialogos((estado) => estado.abrir);

  const sorteos = useSorteosLoteria();
  const lista = sorteos.data?.sorteos ?? [];
  const actual = sorteos.data?.actual ?? null;
  const seleccionado = lista.find((sorteo) => sorteo.id === sorteoElegido)?.id ?? actual;
  const listado = useListadoLoteria(revision, seleccionado, filtro);
  const operacion = useAccionLoteria({
    alExito: (resultado) => { if (resultado.cantidad !== undefined) avisar(`${resultado.cantidad} números cargados`); },
  });

  const datos = listado.data;
  const vista = datos ? vistaLoteria(datos, filtro) : null;

  function exportar() {
    if (!datos || !vista) return;
    void descargarLoteriaPdf({
      filtro,
      nombre: datos.sorteo.nombre,
      fecha: datos.sorteo.fecha,
      filas: vista.filas.map((fila) => [fila.numero, fila.socio, fila.fracciones, sinEspacioDuro(fila.importe), fila.pagado ? 'Pagado' : fila.abono ? `Debe ${sinEspacioDuro(fila.restante)} (pagó ${sinEspacioDuro(fila.abono)})` : 'Debe']),
      cobrado: sinEspacioDuro(moneda(datos.cobradoFiltrado)),
      falta: sinEspacioDuro(moneda(datos.faltaFiltrado)),
    });
  }

  return {
    sinSorteos: sorteos.data !== undefined && lista.length === 0,
    cargando: sorteos.data === undefined,
    error: sorteos.error instanceof Error ? sorteos.error.message : listado.error instanceof Error ? listado.error.message : '',
    sorteos: lista.map((sorteo) => ({ id: sorteo.id, nombre: sorteo.nombre, proximo: sorteo.id === actual })),
    seleccionado,
    vista,
    filtro,
    operacion,
    elegirSorteo,
    filtrar: (id: FiltroPago) => elegirFiltro(id),
    irAAjustes: () => navegar('ajustes'),
    verSocio,
    vender: (socioId?: string) => abrir({ tipo: 'venta', sid: socioId, soId: seleccionado ?? undefined }),
    editar: (id: string) => abrir({ tipo: 'venta', id }),
    cobrar: (sid: string, id: string) => abrir({ tipo: 'cobro', sid, solo: 'lot|' + id }),
    editarPago: (id: string) => abrir({ tipo: 'editarPago', juego: 'lot', id }),
    cargarFijos: () => { if (seleccionado) void operacion.enviar({ accion: { tipo: 'fijos', sorteoId: seleccionado } }); },
    noQuiso: (socioId: string, deshacer: boolean) => { if (seleccionado) void operacion.enviar({ accion: { tipo: 'oferta', sorteoId: seleccionado, socioId, noQuiso: !deshacer } }); },
    exportar,
  };
}
