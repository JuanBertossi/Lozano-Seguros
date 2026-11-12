import { useRef } from 'react';
import type { PagoInput } from '../schemas/pago.schema';
import { prepararDetallePago } from '../lib/detallePago';
import { moneda } from '../lib/moneda';
import { usePagoLoteria } from './usePagoLoteria';
import { usePagoQuini } from './usePagoQuini';
import { usePagoQuiniela } from './usePagoQuiniela';

export type JuegoPago = 'q6' | 'lot' | 'quiniela';

export const confirmacionAnularPago = '¿Anular este pago? Vuelve a quedar como deuda. Si se había pagado con un cobro, esa plata queda como saldo a favor del socio.';

/**
 * Editar o anular el pago de una jugada de Quini, Lotería o Quiniela.
 * Cada juego llama al procedure de su dominio; `alExito` recibe el aviso que corresponde mostrar.
 */
export function useOperacionPago(juego: JuegoPago, id: string, alExito: (aviso: string) => void) {
  const accion = useRef<'editar' | 'anular'>('editar');
  const terminar = (liberado: number) => alExito(accion.current === 'anular'
    ? (liberado ? `Pago anulado · ${moneda(liberado)} quedó a favor` : 'Pago anulado')
    : 'Pago actualizado');
  const quini = usePagoQuini({ alExito: (resultado) => terminar(resultado.liberado) });
  const loteria = usePagoLoteria({ alExito: (resultado) => terminar(resultado.liberado) });
  const quiniela = usePagoQuiniela({ alExito: (resultado) => terminar(resultado.liberado) });
  const activa = juego === 'q6' ? quini : juego === 'lot' ? loteria : quiniela;

  function enviar(p_accion: 'editar_pago' | 'anular_pago', p_datos: Record<string, unknown>) {
    const entrada = { p_id: id, p_accion, p_datos };
    if (juego === 'q6') void quini.enviar(entrada);
    else if (juego === 'lot') void loteria.enviar(entrada);
    else void quiniela.enviar(entrada);
  }

  return {
    bloqueado: activa.bloqueado,
    procesando: activa.procesando,
    error: activa.error,
    reintentar: () => { void activa.enviar(); },
    guardar(datos: PagoInput) {
      accion.current = 'editar';
      enviar('editar_pago', { fecha: datos.fecha, medio: datos.medio, detalle: prepararDetallePago(datos) });
    },
    anular() {
      if (!confirm(confirmacionAnularPago)) return;
      accion.current = 'anular';
      enviar('anular_pago', {});
    },
  };
}
