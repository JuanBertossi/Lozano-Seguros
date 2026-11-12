import { rpc } from '../../../shared/lib/supabase.service';

export type AccionToto = 'crear' | 'editar' | 'pagar' | 'quitar_pago' | 'marcar' | 'desmarcar' | 'eliminar';
export type JuegoToto = 'previa' | 'primera' | 'matutina' | 'vespertina' | 'nocturna' | 'turista' | 'quini6' | 'loto';
export type PeriodoToto = 'dia' | 'mes' | 'todo';
export type DatosToto = { fecha: string; premios: number; premiosAg: number; conc: Record<string, number | null> } & Record<JuegoToto, number>;
/** Planilla tal como está guardada: las más antiguas pueden no traer algunos campos. */
export type PlanillaGuardada = { fecha: string; premios?: number | null; premiosAg?: number | null } & Partial<Record<JuegoToto, number | null>>;
export interface CalculoToto {
  total: number; com: number; neto: number; prem: number; gral: number;
  pago: number; debe: number; saldado: boolean; parcial: boolean;
  P: { f: string; m: number }[]; premAg: number;
}
export interface PeriodosToto {
  hoy: string;
  mesActual: string;
  /** Meses con planillas, más el actual, de menor a mayor ('YYYY-MM'). */
  meses: string[];
  porcentaje: number;
  agencia: string;
}
export interface PlanillaToto {
  id: string;
  datos: PlanillaGuardada;
  calculo: CalculoToto;
  quitables: boolean;
}
export interface VistaTotoServidor {
  calculo: CalculoToto;
  concursos: Record<JuegoToto, number | null>;
  concursosActuales: Record<JuegoToto, number | null>;
  duplicado: boolean;
}
export interface SolicitudVistaToto { p_revision: number; p_fecha: string; p_datos: Omit<DatosToto, 'conc'>; p_id: string | null }
export interface SolicitudListadoToto { p_revision: number; p_periodo: PeriodoToto; p_valor: string }
export interface ListadoTotoServidor {
  filas: { id: string; datos: PlanillaGuardada; calculo: CalculoToto; concursos: Record<JuegoToto, number | null> }[];
  totales: Pick<CalculoToto, 'total'|'com'|'neto'|'prem'|'gral'|'pago'|'debe'|'premAg'>;
  juegos: Record<JuegoToto, number>;
  cantidadPagados: number;
}
export interface OperacionToto {
  p_revision: number; p_operacion: string; p_accion: AccionToto;
  p_id: string | null; p_datos: Record<string, unknown>;
}

export const totoService = {
  periodos: (revision: number) => rpc<PeriodosToto>('agencia_toto_periodos', { p_revision: revision }),
  planilla: (revision: number, id: string) => rpc<PlanillaToto>('agencia_toto_planilla', { p_revision: revision, p_id: id }),
  prever: (solicitud: SolicitudVistaToto) => rpc<VistaTotoServidor>('agencia_toto_prever', solicitud),
  listar: (solicitud: SolicitudListadoToto) => rpc<ListadoTotoServidor>('agencia_toto_listar', solicitud),
  operar: (solicitud: OperacionToto) => rpc<number>('agencia_toto_operar', solicitud),
};
