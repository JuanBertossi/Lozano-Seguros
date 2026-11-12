import { rpc } from '../../../shared/lib/supabase.service';
import type { SeguroInput } from '../seguro.schema';

export interface OpcionSocio { id: string; nombre: string; nro: string }
export interface FormularioSeguroServidor {
  socios: OpcionSocio[];
  seguro: { sid: string; ingreso: string; venc: string; desc: string; valor: number; plan: SeguroInput['plan'] } | null;
}

export const leerFormularioSeguro = (revision: number, id: string | null, sid: string | null) =>
  rpc<FormularioSeguroServidor>('agencia_seguro_formulario', { p_revision: revision, p_id: id, p_sid: sid });
