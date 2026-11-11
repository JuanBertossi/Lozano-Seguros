import { rpc } from './supabase.service';

export type DatosSocioNuevo = { nombre: string; nro: string; tel: string; dir: string };
export type DatosSocioRapido = { nombre: string; tel: string };
export type DatosSocioEditado = DatosSocioNuevo & { favor: number; archivado: boolean };
export type SolicitudSocio = { p_revision: number; p_operacion: string } & (
  | { p_accion: 'crear'; p_id: null; p_datos: DatosSocioNuevo }
  | { p_accion: 'rapido'; p_id: null; p_datos: DatosSocioRapido }
  | { p_accion: 'editar'; p_id: string; p_datos: DatosSocioEditado }
  | { p_accion: 'eliminar'; p_id: string; p_datos: Record<string, never> }
);
export type ResultadoSocio = { revision: number; id: string; nombre: string; nro: string };

export const sociosService = {
  proximoNumero: (revision: number) => rpc<string>('agencia_socio_proximo_numero', { p_revision: revision }),
  guardar: (solicitud: SolicitudSocio) => rpc<ResultadoSocio>('agencia_socio_guardar', solicitud),
};
