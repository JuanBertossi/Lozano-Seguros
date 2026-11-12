import { moneda, numeroEditable } from '../../../shared/lib/moneda';
import type { ConceptoCobro, DatosCobro, VistaPreviaServidor } from '../api/cobros.service';

export interface VistaPreviaCobro {
  sugerido: string;
  recibido: string;
  usado: string;
  estado: string;
  color: 'ok' | 'bad';
  sobrante: string;
  habilitado: boolean;
  accion: string;
  aplicaciones: Record<string, { texto: string; estado: 'ok' | 'warn' | 'mu' }>;
}

export const previaVacia: VistaPreviaCobro = {
  sugerido: '', recibido: '—', usado: '—', estado: 'Calculando…', color: 'ok', sobrante: '',
  habilitado: false, accion: 'Calculando…', aplicaciones: {},
};

/** `previaCobro` de la maqueta: textos de la simulación que calculó el servidor. */
export function presentarPrevia(resultado: VistaPreviaServidor, usarFavor: boolean): VistaPreviaCobro {
  const saldo = resultado.estadoFinal;
  return {
    sugerido: numeroEditable(resultado.sugerido),
    recibido: moneda(resultado.A),
    usado: usarFavor ? moneda(resultado.usado) : '—',
    estado: saldo > 0 ? `Debe ${moneda(saldo)}` : saldo < 0 ? `Tiene a favor ${moneda(-saldo)}` : 'Queda al día',
    color: saldo > 0 ? 'bad' : 'ok',
    sobrante: resultado.quedo > 0 ? moneda(resultado.quedo) : '',
    habilitado: resultado.habilitado,
    accion: resultado.A > 0 ? `Registrar cobro de ${moneda(resultado.A)}` : resultado.habilitado ? 'Aplicar saldo a favor' : 'Ingresá el monto',
    aplicaciones: Object.fromEntries(Object.entries(resultado.aplicacionesDetalle).map(([clave, dato]) => [clave, {
      estado: dato.estado,
      texto: dato.estado === 'ok' ? 'Se salda' : dato.estado === 'warn' ? `Abona ${moneda(dato.aplicado)} · queda ${moneda(dato.restante)}` : 'Queda pendiente',
    }])),
  };
}

/** `cbOrden` de la maqueta: el producto elegido primero y, dentro de cada grupo, lo más viejo. */
export function ordenarVencidas(conceptos: ConceptoCobro[], prioridad: string) {
  const grupo = (concepto: ConceptoCobro) => (prioridad !== 'todo' && prioridad !== 'viejo' && concepto.tipo === prioridad ? 0 : 1);
  return conceptos.filter((concepto) => !concepto.futuro)
    .sort((a, b) => grupo(a) - grupo(b) || a.fecha.localeCompare(b.fecha));
}

/** Resumen de las tres cifras del encabezado del diálogo. */
export function resumenCuenta(resumen: DatosCobro['resumen']) {
  return [
    { titulo: 'Deuda vencida', texto: moneda(resumen.deuda), color: resumen.deuda ? 'bad' as const : undefined },
    { titulo: 'Saldo a favor', texto: moneda(resumen.favor), color: resumen.favor ? 'ok' as const : undefined },
    {
      titulo: resumen.debe ? 'Debe' : resumen.aFavor ? 'Tiene a favor' : 'Estado',
      texto: resumen.debe ? moneda(resumen.debe) : resumen.aFavor ? moneda(resumen.aFavor) : 'Al día',
      color: resumen.debe ? 'bad' as const : 'ok' as const,
    },
  ];
}

/** Aviso al registrar: igual que `saveCobro` de la maqueta. */
export function mensajeCobro(resultado: VistaPreviaServidor) {
  return 'Cobro registrado' + (resultado.A ? `: ${moneda(resultado.A)}` : ' con saldo a favor')
    + (resultado.quedo ? ` · a favor ${moneda(resultado.quedo)}` : '')
    + (resultado.falta ? ` · sigue debiendo ${moneda(resultado.falta)}` : '');
}
