import { rpc } from '../../../shared/lib/supabase.service';

export interface SolicitudCobroServidor {
  p_revision: number;
  p_socio_id: string;
  p_seleccion: string[];
  p_prioridad: string;
  p_usar_favor: boolean;
  p_monto: number | null;
}

/** Lo que se envía al registrar; el hook de operación segura agrega revisión y UUID. */
export interface RegistrarCobroServidor {
  p_socio_id: string;
  p_seleccion: string[];
  p_prioridad: string;
  p_usar_favor: boolean;
  p_monto: number | null;
  p_fecha: string;
  p_medio: string;
  p_detalle: Record<string, string> | null;
}

export interface AplicacionCobroServidor {
  m: { ref: (string | number)[]; imp: number; fut?: boolean };
  ap: number;
}

export interface VistaPreviaServidor {
  A: number;
  al: AplicacionCobroServidor[];
  apl: AplicacionCobroServidor[];
  usado: number;
  quedo: number;
  falta: number;
  favorFinal: number;
  deudaFinal: number;
  sugerido: number;
  estadoFinal: number;
  habilitado: boolean;
  aplicacionesDetalle: Record<string, { estado: 'ok' | 'warn' | 'mu'; aplicado: number; restante: number }>;
}

export interface ConceptoCobro {
  /** Referencia del concepto unida con "|": `seg|id|0`, `q6|id`, `rifa|id|2`. */
  clave: string;
  titulo: string;
  /** Tipo corto: seg, q6, lot, qui, rifa. */
  tipo: string;
  producto: string;
  /** Vencimiento o fecha del concepto (YYYY-MM-DD). */
  fecha: string;
  importe: number;
  futuro: boolean;
}

export interface DatosCobro {
  socioId: string;
  socio: string;
  resumen: { deuda: number; favor: number; debe: number; aFavor: number };
  inicial: { seleccionadas: string[]; prioridad: string; usarFavor: boolean };
  mostrarFuturas: boolean;
  prioridades: { clave: string; titulo: string; importe: number }[];
  /** Vencidos del más viejo al más nuevo y después los que todavía no vencen. */
  conceptos: ConceptoCobro[];
  rifasVencidas: string[];
  rifasTodas: string[];
  /** El cobro se abrió desde una rifa puntual: los botones de rifa se limitan a esa. */
  unaRifa: boolean;
}

export const cobrosService = {
  datos: (revision: number, socioId: string, solo: string | null) =>
    rpc<DatosCobro>('agencia_cobro_datos', { p_revision: revision, p_socio_id: socioId, p_solo: solo }),
  prever: (solicitud: SolicitudCobroServidor) =>
    rpc<VistaPreviaServidor>('agencia_prever_cobro', solicitud),
  registrar: (solicitud: RegistrarCobroServidor & { p_revision: number; p_operacion: string }) =>
    rpc<number>('agencia_registrar_cobro', solicitud),
};
