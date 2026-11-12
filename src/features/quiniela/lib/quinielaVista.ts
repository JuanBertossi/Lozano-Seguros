import { fechaCorta, horaArgentina, nombreDia } from '../../../shared/lib/fechas';
import { moneda } from '../../../shared/lib/moneda';
import { avisar } from '../../../shared/stores/avisos.store';
import type { FiltroPago } from '../../../shared/stores/navegacion.store';
import type { FilaQuinielaServidor, ListadoQuiniela } from '../api/quiniela.service';

/** `done(...)` de la maqueta: el aviso de lo guardado y, si se liberó plata ya cobrada, el de saldo a favor 2,5 s después. */
export function avisarGuardado(texto: string, liberado = 0) {
  avisar(texto);
  if (liberado > 0) setTimeout(() => avisar(`Lo que ya había pagado (${moneda(liberado)}) quedó como saldo a favor`), 2500);
}

export interface FilaQuiniela { id: string; sid: string; socio: string; fecha: string; hora: string; numeros: string; autor: string; monto: string; pagado: boolean; abono: string; restante: string }

function convertir({ jugada: j, socio, restante, nombreAutor, nombreEditor }: FilaQuinielaServidor): FilaQuiniela {
  return {
    id: j.id, sid: j.sid, socio, fecha: fechaCorta(j.fecha), hora: horaArgentina(j.ts) || '—', numeros: j.numeros,
    autor: [j.por === 'auto' ? 'Automático' : j.por ? `Cargó ${nombreAutor}` : '', j.modPor && j.modPor !== j.por ? `editó ${nombreEditor}${j.modTs ? ` ${fechaCorta(j.modTs.slice(0, 10))}` : ''}` : ''].filter(Boolean).join(' · ') || '—',
    monto: moneda(j.monto), pagado: j.pagado, abono: j.abono ? moneda(j.abono) : '', restante: moneda(restante),
  };
}

export function presentarQuiniela(datos: ListadoQuiniela, filtro: FiltroPago) {
  return {
    titulo: `${datos.dias === 0 ? 'Hoy · ' : datos.dias === -1 ? 'Ayer · ' : ''}${nombreDia(datos.fecha)} ${fechaCorta(datos.fecha)}`,
    hoy: datos.dias === 0, cantidad: datos.cantidad, total: moneda(datos.total), cobrado: moneda(datos.cobrado),
    falta: moneda(datos.falta), deuda: datos.falta > 0, otrosTotal: moneda(datos.otrosTotal),
    filas: datos.filas.filter(({ jugada: j }) => filtro === 'todos' || (filtro === 'pagados' ? j.pagado : !j.pagado)).map(convertir),
    otros: datos.otros.map(convertir),
  };
}
