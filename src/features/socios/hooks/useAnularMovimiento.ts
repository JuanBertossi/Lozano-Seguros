import { useOperacionSegura } from '../../../shared/hooks/useOperacionSegura';
import { avisar } from '../../../shared/stores/avisos.store';
import { anularMovimiento, type EntradaAnulacion, type ResultadoAnulacion } from '../api/socios.service';
import { moneda } from '../../../shared/lib/moneda';

type Resultado = ResultadoAnulacion & { anulado: 'cobro' | 'pago' | 'movimiento' };

async function ejecutar(entrada: EntradaAnulacion & { p_revision: number; p_operacion: string }): Promise<Resultado> {
  const resultado = await anularMovimiento(entrada);
  return { ...resultado, anulado: entrada.tipo === 'cobro' ? 'cobro' : entrada.pago ? 'pago' : 'movimiento' };
}

function alExito({ anulado, liberado }: Resultado) {
  if (anulado === 'cobro') avisar('Cobro anulado');
  else if (anulado === 'pago') avisar(liberado ? `Pago anulado · ${moneda(liberado)} quedó a favor` : 'Pago anulado');
  else avisar('Movimiento anulado');
}

/** Anula pagos, movimientos y cobros desde el historial del socio. */
export function useAnularMovimiento() {
  return useOperacionSegura<EntradaAnulacion, Resultado>(ejecutar, { alExito });
}
