import { useJugadasSocio } from '../../../shared/hooks/useJugadasSocio';
import { fechaLarga } from '../../../shared/lib/fechas';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { moneda } from '../../../shared/lib/moneda';

/** Jugadas de Quini 6 (`quini`) o de Quiniela del socio. */
export function useJugadasDeSocio(socioId: string, quini: boolean) {
  const listado = useJugadasSocio(socioId, quini ? 'q6' : 'quiniela');
  const abrir = useDialogos((estado) => estado.abrir);
  const juego = quini ? 'q6' : 'quiniela';

  const filas = listado.data?.map(({ jugada: j, especial, restante }) => ({
    id: j.id, fecha: fechaLarga(j.fecha), numeros: j.numeros || '', especial, automatica: !!j.auto, monto: moneda(j.monto),
    pagado: j.pagado, abono: j.abono ? moneda(j.abono) : '', restante: moneda(restante),
  }));

  return {
    filas,
    mensaje: listado.error instanceof Error ? listado.error.message : 'Cargando jugadas…',
    plan: () => abrir({ tipo: 'planQuini', sid: socioId }),
    agregar: () => abrir({ tipo: quini ? 'quini' : 'quiniela', sid: socioId }),
    editar: (id: string) => abrir({ tipo: quini ? 'quini' : 'quiniela', id }),
    pago: (id: string) => abrir({ tipo: 'editarPago', juego, id }),
    cobrar: (id: string) => abrir({ tipo: 'cobro', sid: socioId, solo: `${juego}|${id}` }),
  };
}
