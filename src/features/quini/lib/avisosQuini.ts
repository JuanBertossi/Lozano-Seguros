import { avisar } from '../../../shared/stores/avisos.store';
import { moneda } from '../../../shared/lib/moneda';

/** `done(...)` de la maqueta: el aviso de lo guardado y, si se liberó plata ya cobrada, el de saldo a favor 2,5 s después. */
export function avisarGuardado(texto: string, liberado = 0) {
  avisar(texto);
  if (liberado > 0) setTimeout(() => avisar(`Lo que ya había pagado (${moneda(liberado)}) quedó como saldo a favor`), 2500);
}
