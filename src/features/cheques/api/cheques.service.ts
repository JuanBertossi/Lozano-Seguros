import { rpc } from '../../../shared/lib/supabase.service';

export interface EntradaCheque {
  p_referencia: string;
  p_estado: 'pendiente' | 'aprobado' | 'rechazado';
}

export interface ChequeServidor {
  id: string;
  numero: string;
  banco: string;
  socio: string;
  medio: string;
  fecha: string | null;
  monto: number;
  estado: EntradaCheque['p_estado'];
  anulado: boolean;
  rechazoAplicado: boolean;
  depositado: boolean;
}

export const chequesService = {
  listar: (revision: number) => rpc<ChequeServidor[]>('agencia_cheques_listar', { p_revision: revision }),
  actualizar: (solicitud: EntradaCheque & { p_revision: number; p_operacion: string }) =>
    rpc<number>('agencia_estado_cheque', solicitud),
};
