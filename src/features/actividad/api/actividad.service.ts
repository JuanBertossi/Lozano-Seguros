import { rpc } from '../../../shared/lib/supabase.service';

export interface ActividadServidor {
  /** Usuarios activos: alimentan el filtro. */
  usuarios: { id: string; nombre: string }[];
  movimientos: {
    id: string; usuarioId: string; nombre: string; ts: string; accion: string; tipo: string;
    detalle: string;
    /** Monto de un cobro o resultado de una planilla de Toto: se escribe a continuación del detalle. */
    importe: number | null;
  }[];
}

export const actividadService = {
  listar: (revision: number, usuario: string) => rpc<ActividadServidor>('agencia_actividad_detallada', { p_revision: revision, p_usuario: usuario }),
};
