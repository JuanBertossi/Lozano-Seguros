import { rpc } from '../../../shared/lib/supabase.service';

export interface DatosAjustes {
  config: { nombre: string; q6Precio: number; q6Dias: number[]; fracPrecio: number; rifaImporte: number; rifaCuotas: number; wsp: 'app' | 'web' };
  sorteos: { id: string; nombre: string; fecha: string; frac: number; precio: number; ventas: number }[];
  juegos: { id: string; nombre: string; dias: number[] }[];
  usuarios: { id: string; nombre: string; rol: string }[];
}

export type ConfiguracionEntrada = { p_accion: 'precios' | 'toto_dias' | 'toto_restablecer'; p_datos: Record<string, unknown> };

export const leerAjustes = (revision: number) => rpc<DatosAjustes>('agencia_ajustes', { p_revision: revision });
export const leerRespaldo = () => rpc<Record<string, unknown>>('agencia_respaldo');
export const guardarConfiguracion = async (solicitud: ConfiguracionEntrada & { p_revision: number; p_operacion: string }) =>
  ({ revision: await rpc<number>('agencia_configurar', solicitud) });
export const reiniciarAgencia = async (solicitud: { p_revision: number; p_operacion: string }) =>
  ({ revision: await rpc<number>('agencia_reiniciar', solicitud) });
export const restaurarRespaldo = async (solicitud: { p_revision: number; p_operacion: string; p_estado: Record<string, unknown> }) =>
  ({ revision: await rpc<number>('agencia_restaurar_verificado', solicitud) });
