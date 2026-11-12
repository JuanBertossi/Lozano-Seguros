import { useMovimientosSocio } from '../../../shared/hooks/useMovimientosSocio';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { presentarMovimientos } from '../lib/movimientosVista';
import { confirmacionAnular, confirmacionAnularCobro, entradaAnulacion } from '../lib/anulacion';
import { useFiltroMovimientos, type FiltroMovimientos } from '../stores/movimientos.store';
import { useAnularMovimiento } from './useAnularMovimiento';
import { useFichaSocio } from './useSocios';

type Referencia = (string | number)[];

export function useDetalleSocio(socioId: string) {
  const filtro = useFiltroMovimientos((estado) => estado.filtro);
  const elegirFiltro = useFiltroMovimientos((estado) => estado.elegir);
  const ficha = useFichaSocio(socioId);
  const movimientos = useMovimientosSocio(socioId, filtro);
  const anulacion = useAnularMovimiento();
  const abrir = useDialogos((estado) => estado.abrir);

  const vista = movimientos.data && ficha.data ? presentarMovimientos(movimientos.data, ficha.data.usuarios) : null;
  const error = movimientos.error ?? ficha.error;

  function anularCobro(id: string, monto: string) {
    if (confirm(confirmacionAnularCobro(monto))) void anulacion.enviar({ tipo: 'cobro', id });
  }
  function anular(ref: Referencia, pago: boolean, monto: string) {
    if (ref[0] === 'cobro') { anularCobro(String(ref[1]), monto.replace(/^\+\s*/, '')); return; }
    const entrada = entradaAnulacion(ref, pago);
    if (entrada && confirm(confirmacionAnular(pago))) void anulacion.enviar(entrada);
  }
  function editar(ref: Referencia) {
    const id = String(ref[1]);
    switch (ref[0]) {
      case 'cobro': abrir({ tipo: 'editarCobro', id }); break;
      case 'seg': abrir({ tipo: 'seguro', id }); break;
      case 'q6': abrir({ tipo: 'quini', id }); break;
      case 'lot': abrir({ tipo: 'venta', id }); break;
      case 'quiniela': abrir({ tipo: 'quiniela', id }); break;
      case 'rifa': abrir({ tipo: 'rifa', id }); break;
    }
  }

  return {
    vista,
    filtro,
    mensaje: error instanceof Error ? error.message : 'Cargando movimientos…',
    anulacion,
    filtrar: (nuevo: FiltroMovimientos) => elegirFiltro(nuevo),
    cobrar: (ref: Referencia) => abrir({ tipo: 'cobro', sid: socioId, solo: ref.join('|') }),
    editar,
    editarCobro: (id: string) => abrir({ tipo: 'editarCobro', id }),
    anular,
    anularCobro,
  };
}
