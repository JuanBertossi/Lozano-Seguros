import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { filtroChequeSchema, type FiltroCheque } from '../cheques.schema';
import type { ChequeVista, EstadoCheque } from '../lib/chequesVista';
import { useEstadoCheque, useListadoCheques } from './useEstadoCheque';

/** Historial de cheques con los filtros por número y banco (`filtrarCheques` y `estadoCheque` de la maqueta). */
export function useCheques() {
  const filtro = useForm<FiltroCheque>({ resolver: zodResolver(filtroChequeSchema), defaultValues: { numero: '', banco: '' } });
  const { numero, banco } = filtro.watch();
  const listado = useListadoCheques();
  const operacion = useEstadoCheque();
  const cheques = (listado.data ?? []).filter((cheque) =>
    cheque.numero.toLowerCase().includes(numero.trim().toLowerCase()) &&
    cheque.banco.toLowerCase().includes(banco.trim().toLowerCase()),
  );
  function actualizar(cheque: ChequeVista, estado: EstadoCheque) {
    if (estado === 'rechazado' && !confirm(`¿Marcar como rechazado el cheque de ${cheque.monto}? Se revertirá el pago y los conceptos asociados volverán a quedar pendientes.`)) return;
    void operacion.enviar({ p_referencia: cheque.id, p_estado: estado });
  }
  return { filtro, listado, operacion, actualizar, cheques };
}
