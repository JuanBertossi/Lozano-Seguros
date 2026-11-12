import { useQuery } from '@tanstack/react-query';
import { useOperacionSegura } from '../../../shared/hooks/useOperacionSegura';
import { useRevision } from '../../../shared/hooks/useSesion';
import { avisar } from '../../../shared/stores/avisos.store';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { listarLoteriaSocio, operarNumeroFijo, type EntradaNumeroFijo } from '../api/socios.service';
import { moneda } from '../../../shared/lib/moneda';

type ResultadoFijo = { revision: number; accion: EntradaNumeroFijo['p_accion'] };
async function ejecutarFijo(entrada: EntradaNumeroFijo & { p_revision: number; p_operacion: string }): Promise<ResultadoFijo> {
  const { revision } = await operarNumeroFijo(entrada);
  return { revision, accion: entrada.p_accion };
}

export function useLoteriaDeSocio(socioId: string) {
  const revision = useRevision();
  const abrir = useDialogos((estado) => estado.abrir);
  const listado = useQuery({
    queryKey: ['socios', 'loteria', revision, socioId],
    queryFn: () => listarLoteriaSocio(revision!, socioId),
    select: ({ fijos, filas }) => ({
      fijos: fijos.map((f, indice) => ({ indice, numero: String(f.numero), detalle: f.frac ? `${f.frac} ${f.frac > 1 ? 'fracciones' : 'fracción'}` : 'Entero' })),
      filas: filas.map(({ venta, sorteo, fraccionesSorteo, importe, restante }) => ({
        id: venta.id, sorteo, numero: String(venta.numero),
        fracciones: fraccionesSorteo !== null && venta.frac >= fraccionesSorteo ? 'Entero' : `${venta.frac}${fraccionesSorteo !== null ? ' de ' + fraccionesSorteo : ''}`,
        importe: moneda(importe), pagado: venta.pagado, abono: venta.abono ? moneda(venta.abono) : '', restante: moneda(restante),
      })),
    }),
    placeholderData: (previo, consultaPrevia) => (consultaPrevia?.queryKey.includes(socioId) ? previo : undefined),
    enabled: revision !== null,
    retry: false,
  });
  const fijo = useOperacionSegura<EntradaNumeroFijo, ResultadoFijo>(ejecutarFijo, { alExito: ({ accion }) => { if (accion === 'agregar') avisar('Número fijo agregado'); } });
  const agregarFijo = (numero: string, fracciones: number) =>
    fijo.enviar({ p_socio_id: socioId, p_accion: 'agregar', p_numero: numero, p_fracciones: fracciones, p_indice: null });
  return {
    datos: listado.data,
    mensaje: listado.error instanceof Error ? listado.error.message : 'Cargando Lotería…',
    fijo,
    agregarFijo,
    quitarFijo: (indice: number) => void fijo.enviar({ p_socio_id: socioId, p_accion: 'quitar', p_numero: null, p_fracciones: null, p_indice: indice }),
    agregar: () => abrir({ tipo: 'venta', sid: socioId }),
    editar: (id: string) => abrir({ tipo: 'venta', id }),
    pago: (id: string) => abrir({ tipo: 'editarPago', juego: 'lot', id }),
    cobrar: (id: string) => abrir({ tipo: 'cobro', sid: socioId, solo: `lot|${id}` }),
  };
}
