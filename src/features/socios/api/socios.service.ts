import { rpc } from '../../../shared/lib/supabase.service';
import type { MovimientoServidor } from '../../../shared/hooks/useMovimientosSocio';
import type { SeguroListado } from '../../../shared/lib/seguros.service';
import type { mapearFilaRifa } from '../../../shared/lib/rifaVista';

export * from '../../../shared/lib/socios.service';

export interface SocioListadoServidor {
  socio: { id: string; nro: string; nombre: string; tel?: string; activo: boolean };
  cuenta: { debe: number; aFavor: number; favor: number };
  productos: ('seg' | 'q6' | 'lot' | 'qui' | 'rifa')[];
}

export const listarSocios = (revision: number) =>
  rpc<SocioListadoServidor[]>('agencia_socios_listar', { p_revision: revision });

/** Datos del socio y lo que hace falta para mostrarlo: nombres de usuarios, preferencia de WhatsApp y firma. */
export interface FichaSocio {
  socio: { id: string; nombre: string; nro: string | number; tel?: string; dir?: string; activo: boolean; favor?: number; por?: string; modPor?: string; modTs?: string };
  usuarios: Record<string, string>;
  wsp: 'app' | 'web';
  firma: string;
}
/** Devuelve `null` si el socio ya no existe. */
export const leerFicha = (revision: number, socioId: string) =>
  rpc<FichaSocio | null>('agencia_socio_ficha', { p_revision: revision, p_socio_id: socioId });

export interface DatosPdfSocio {
  socio: { nombre: string; nro: string; tel?: string; dir?: string };
  nombreAgencia: string;
  hoy: string;
  cuenta: { debe: number; favor: number };
  movimientos: MovimientoServidor[];
  futuros: MovimientoServidor[];
}
export const leerPdfSocio = (revision: number, socioId: string) =>
  rpc<DatosPdfSocio>('agencia_socio_pdf', { p_revision: revision, p_socio_id: socioId });

export const listarSegurosSocio = (revision: number, socioId: string) =>
  rpc<SeguroListado[]>('agencia_seguros_listar', { p_revision: revision, p_socio_id: socioId });

export type FilaRifaSocio = Parameters<typeof mapearFilaRifa>[0];
export const listarRifasSocio = (revision: number, socioId: string) =>
  rpc<{ filas: FilaRifaSocio[] }>('agencia_rifa_listar', { p_revision: revision, p_anio: null, p_socio_id: socioId });

export interface LoteriaSocio {
  fijos: { numero: string | number; frac: number }[];
  filas: { venta: { id: string; numero: string | number; frac: number; pagado: boolean; abono?: number }; sorteo: string; fraccionesSorteo: number | null; importe: number; restante: number }[];
}
export const listarLoteriaSocio = (revision: number, socioId: string) =>
  rpc<LoteriaSocio>('agencia_loteria_socio_listar', { p_revision: revision, p_socio_id: socioId });

type Revision = { p_revision: number; p_operacion: string };

export type EntradaNumeroFijo = { p_socio_id: string; p_accion: 'agregar'; p_numero: string; p_fracciones: number; p_indice: null }
  | { p_socio_id: string; p_accion: 'quitar'; p_numero: null; p_fracciones: null; p_indice: number };
export const operarNumeroFijo = (solicitud: EntradaNumeroFijo & Revision) =>
  rpc<{ revision: number }>('agencia_loteria_numero_fijo', solicitud);

/** Anulaciones desde el historial del socio. Cada tipo lo resuelve su procedimiento. */
export type EntradaAnulacion =
  | { tipo: 'seg' | 'rifa'; id: string; indice: number; pago: boolean }
  | { tipo: 'lot' | 'q6' | 'quiniela'; id: string; pago: boolean }
  | { tipo: 'cobro'; id: string };
export interface ResultadoAnulacion { revision: number; liberado: number }

export async function anularMovimiento(entrada: EntradaAnulacion & Revision): Promise<ResultadoAnulacion> {
  const { p_revision, p_operacion } = entrada;
  const comunes = { p_revision, p_operacion };
  if (entrada.tipo === 'cobro') {
    return { revision: await rpc<number>('agencia_anular_cobro', { ...comunes, p_cobro_id: entrada.id }), liberado: 0 };
  }
  if (entrada.tipo === 'seg') {
    return rpc<ResultadoAnulacion>('agencia_seguro_operar', { ...comunes, p_accion: entrada.pago ? 'quitar_pago' : 'anular_cuota', p_id: entrada.id, p_datos: { indice: entrada.indice } });
  }
  if (entrada.tipo === 'rifa') {
    return rpc<ResultadoAnulacion>('agencia_rifa_operar', { ...comunes, p_accion: entrada.pago ? 'anular_pago' : 'anular_cuota', p_id: entrada.id, p_datos: { indice: entrada.indice } });
  }
  const accion = entrada.pago ? 'anular_pago' : 'anular';
  if (entrada.tipo === 'quiniela') {
    return rpc<ResultadoAnulacion>('agencia_quiniela_operar', { ...comunes, p_accion: accion, p_id: entrada.id, p_datos: {} });
  }
  return rpc<ResultadoAnulacion>(entrada.tipo === 'lot' ? 'agencia_loteria_pago' : 'agencia_quini_pago', { ...comunes, p_id: entrada.id, p_accion: accion, p_datos: {} });
}
