import { rpc } from '../../../shared/lib/supabase.service';

export type AccionToto = 'crear' | 'editar' | 'pagar' | 'quitar_pago' | 'marcar' | 'desmarcar' | 'eliminar';
export type JuegoToto = 'previa' | 'primera' | 'matutina' | 'vespertina' | 'nocturna' | 'turista' | 'quini6' | 'loto';
export type DatosToto = { fecha: string; premios: number; premiosAg: number; conc: Record<string, number | null> } & Record<JuegoToto, number>;
export interface CalculoToto {
  total: number; com: number; neto: number; prem: number; gral: number;
  pago: number; debe: number; saldado: boolean; parcial: boolean;
  P: { f: string; m: number }[]; premAg: number;
}
export interface VistaTotoServidor {
  calculo: CalculoToto;
  concursos: Record<JuegoToto, number | null>;
  concursosActuales: Record<JuegoToto, number | null>;
  duplicado: boolean;
}
export interface SolicitudVistaToto { p_revision: number; p_fecha: string; p_datos: DatosToto; p_id: string | null }
export interface SolicitudListadoToto { p_revision: number; p_periodo: 'dia' | 'mes' | 'todo'; p_valor: string }
export interface ListadoTotoServidor {
  filas: { id: string; datos: DatosToto; calculo: CalculoToto; concursos: Record<JuegoToto, number | null> }[];
  totales: Pick<CalculoToto, 'total'|'com'|'neto'|'prem'|'gral'|'pago'|'debe'|'premAg'>;
  juegos: Record<JuegoToto, number>;
  cantidadPagados: number;
}
export interface OperacionToto {
  p_revision: number; p_operacion: string; p_accion: AccionToto;
  p_id: string | null; p_datos: Record<string, unknown>;
}

export const totoService = {
  prever: (solicitud: SolicitudVistaToto) => rpc<VistaTotoServidor>('agencia_toto_prever', solicitud),
  listar: (solicitud: SolicitudListadoToto) => rpc<ListadoTotoServidor>('agencia_toto_listar', solicitud),
  operar: (solicitud: OperacionToto) => rpc<number>('agencia_toto_operar', solicitud),
};
