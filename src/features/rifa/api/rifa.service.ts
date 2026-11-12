import { rpc } from '../../../shared/lib/supabase.service';

export interface OpcionSocio { id: string; nombre: string; nro: string }
export interface FormularioRifaServidor {
  socios: OpcionSocio[];
  ncuotas: number;
  precio: number;
  rifa: { sid: string; nro: string; anio: number; modo: 'contado' | 'cuotas'; importe: number } | null;
}

export const leerFormularioRifa = (revision: number, id: string | null, sid: string | null) =>
  rpc<FormularioRifaServidor>('agencia_rifa_formulario', { p_revision: revision, p_id: id, p_sid: sid });
