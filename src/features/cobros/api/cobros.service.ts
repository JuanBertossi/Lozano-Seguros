import { rpc } from '../../../shared/lib/supabase.service';

export interface SolicitudCobroServidor {
  p_revision: number;
  p_socio_id: string;
  p_seleccion: string[];
  p_prioridad: string;
  p_usar_favor: boolean;
  p_monto: number | null;
}

export interface RegistrarCobroServidor extends SolicitudCobroServidor {
  p_operacion: string;
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

export const cobrosService = {
  prever: (solicitud: SolicitudCobroServidor) =>
    rpc<VistaPreviaServidor>('agencia_prever_cobro', solicitud),
  registrar: (solicitud: RegistrarCobroServidor) =>
    rpc<number>('agencia_registrar_cobro', solicitud),
};
