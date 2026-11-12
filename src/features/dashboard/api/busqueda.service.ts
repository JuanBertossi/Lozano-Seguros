import { rpc } from '../../../shared/lib/supabase.service';

export interface ResultadoBusqueda { id: string; principal: string; secundario: string }
export const buscar = (revision: number, consulta: string) =>
  rpc<ResultadoBusqueda[]>('agencia_buscar', { p_revision: revision, p_consulta: consulta });
