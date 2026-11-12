import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { avisar } from '../../../shared/stores/avisos.store';
import { fechaCorta, hoy } from '../../../shared/lib/fechas';
import type { PlanillaToto } from '../api/toto.service';
import { totoPagoSchema, type TotoPagoInput } from '../toto.schema';
import { dinero, leerNumero, textoDebe } from '../lib/totoVista';
import { useOperacionToto, usePeriodosToto } from './useToto';

/** Pago parcial de un día: agregar un pago o quitar uno ya cargado (`openTotoPago`, `saveTotoPago` y `totoQuitarPago` de la maqueta). */
export function useTotoPago(id: string, planilla: PlanillaToto) {
  const cerrar = useDialogos((estado) => estado.cerrar);
  const periodos = usePeriodosToto();
  const formulario = useForm<TotoPagoInput>({ resolver: zodResolver(totoPagoSchema), defaultValues: { fecha: hoy(), monto: '' } });
  const operacion = useOperacionToto(({ accion }) => {
    if (accion === 'pagar') { cerrar(); avisar('Pago guardado'); return; }
    // Quitar un pago deja el diálogo abierto, con el formulario como recién abierto.
    avisar('Pago quitado');
    formulario.reset({ fecha: hoy(), monto: '' });
  });
  const c = planilla.calculo;
  const porcentaje = periodos.data ? ` (total − ${periodos.data.porcentaje}%)` : '';

  return {
    register: formulario.register,
    errores: Object.values(formulario.formState.errors).flatMap((error) => (error?.message ? [error.message] : [])),
    fechaDia: fechaCorta(planilla.datos.fecha),
    resumen: [
      [`Tiene que pagar${porcentaje}`, dinero(c.neto)],
      ['Ya pagó', dinero(c.pago)],
      ['Debe', textoDebe(c.debe)],
    ],
    pagos: c.P.map((pago, indice) => ({ indice, fecha: fechaCorta(pago.f), monto: dinero(pago.m) })),
    quitables: planilla.quitables,
    operacion,
    guardar: formulario.handleSubmit((d) => {
      void operacion.enviar({ p_accion: 'pagar', p_id: id, p_datos: { fecha: d.fecha, monto: leerNumero(d.monto) } });
    }),
    quitar: (indice: number) => { void operacion.enviar({ p_accion: 'quitar_pago', p_id: id, p_datos: { indice } }); },
    cerrar,
  };
}
