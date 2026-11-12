import { PagoFormulario } from './PagoFormulario';
import { useAccionCobro } from '../hooks/useAccionCobro';
import { useOperacionPago, type JuegoPago } from '../hooks/useOperacionPago';
import { useOperacionRifa } from '../hooks/useOperacionRifa';
import { useCobroExistente, usePagoExistente } from '../hooks/usePagoExistente';
import { useOperacionSeguro } from '../hooks/useSeguroOperacion';
import { fechaCorta } from '../lib/fechas';
import { leerMonto, moneda, numeroEditable } from '../lib/moneda';
import { prepararDetallePago, valoresPago } from '../lib/detallePago';
import type { PagoInput } from '../schemas/pago.schema';
import { avisar } from '../stores/avisos.store';
import { useDialogo, useDialogos } from '../stores/dialogos.store';
import { DialogoCarga } from './DialogoCarga';

/**
 * Único diálogo de pago. Se monta con `useDialogo('editarPago')` (jugada de Quini, Lotería o Quiniela), `useDialogo('editarCobro')` (cobro existente),
 * `useDialogo('pagoRifa')` (cuota de rifa) o `useDialogo('pagoSeguro')` (cuota de seguro).
 */
export function PagoDialog() {
  const editar = useDialogo('editarPago');
  const cobro = useDialogo('editarCobro');
  const rifa = useDialogo('pagoRifa');
  const seguro = useDialogo('pagoSeguro');
  if (editar) return <EditarPagoJugada key={`${editar.juego}|${editar.id}`} juego={editar.juego} id={editar.id} />;
  if (cobro) return <EditarCobro key={cobro.id} id={cobro.id} />;
  if (rifa) return <PagoCuotaRifa key={`${rifa.id}|${rifa.cuota}`} id={rifa.id} indice={rifa.cuota} />;
  if (seguro) return <PagoCuotaSeguro key={`${seguro.id}|${seguro.cuota}`} id={seguro.id} indice={seguro.cuota} />;
  return null;
}

function useCerrar() {
  return useDialogos((estado) => estado.cerrar);
}

function EditarPagoJugada({ juego, id }: { juego: JuegoPago; id: string }) {
  const cerrar = useCerrar();
  const consulta = usePagoExistente(juego, id);
  const operacion = useOperacionPago(juego, id, (aviso) => { cerrar(); avisar(aviso); });
  const pago = consulta.data;
  if (!pago) return consulta.error ? <DialogoCarga error={consulta.error.message} cerrar={cerrar} /> : null;
  return (
    <PagoFormulario titulo="Editar pago" textoGuardar="Guardar" valores={valoresPago(pago)}
      operacion={operacion} guardar={operacion.guardar} anular={{ texto: 'Anular pago', ejecutar: operacion.anular }} cerrar={cerrar} />
  );
}

function EditarCobro({ id }: { id: string }) {
  const cerrar = useCerrar();
  const consulta = useCobroExistente(id);
  const operacion = useAccionCobro({ alExito: () => { cerrar(); avisar('Cobro actualizado'); } });
  const cobro = consulta.data;
  if (!cobro) return consulta.error ? <DialogoCarga error={consulta.error.message} cerrar={cerrar} /> : null;
  function guardar(datos: PagoInput) {
    void operacion.enviar({
      tipo: 'editar', p_cobro_id: id, p_monto: leerMonto(datos.monto ?? '0'),
      p_fecha: datos.fecha, p_medio: datos.medio, p_detalle: prepararDetallePago(datos),
    });
  }
  return (
    <PagoFormulario titulo="Editar cobro" textoGuardar="Guardar" conMonto valores={valoresPago({ ...cobro, monto: numeroEditable(cobro.monto) })}
      nota="El importe ya aplicado a los conceptos se conserva; el cambio ajusta el saldo a favor."
      operacion={{ ...operacion, reintentar: () => { void operacion.enviar(); } }} guardar={guardar} cerrar={cerrar} />
  );
}

function PagoCuotaRifa({ id, indice }: { id: string; indice: number }) {
  const cerrar = useCerrar();
  const consulta = usePagoExistente('rifa', id, indice);
  // Sin `alExito`, la operación cierra el diálogo y avisa como la maqueta.
  const operacion = useOperacionRifa();
  const pago = consulta.data;
  if (!pago) return consulta.error ? <DialogoCarga error={consulta.error.message} cerrar={cerrar} /> : null;
  function guardar(datos: PagoInput) {
    void operacion.enviar({
      tipo: 'operar', p_accion: 'pagar_cuota', p_id: id,
      p_datos: { indice, fecha: datos.fecha, medio: datos.medio, detalle: prepararDetallePago(datos) },
    });
  }
  function quitar() {
    void operacion.enviar({ tipo: 'operar', p_accion: 'quitar_pago', p_id: id, p_datos: { indice } });
  }
  return (
    <PagoFormulario titulo={`${pago.fecha ? 'Editar pago' : 'Registrar pago'} · ${pago.modo === 'contado' ? 'rifa' : `cuota ${indice + 1}`}`}
      resumen={<>Rifa N° {pago.nro}{pago.importe !== undefined && <> · <b className="text-[var(--ink)]">{moneda(pago.importe)}</b></>}</>}
      textoGuardar="Guardar" valores={valoresPago(pago)}
      operacion={{ ...operacion, reintentar: () => { void operacion.enviar(); } }} guardar={guardar}
      anular={pago.fecha ? { texto: 'Quitar pago', ejecutar: quitar } : undefined} cerrar={cerrar} />
  );
}

function PagoCuotaSeguro({ id, indice }: { id: string; indice: number }) {
  const cerrar = useCerrar();
  const consulta = usePagoExistente('seg', id, indice);
  const operacion = useOperacionSeguro();
  const pago = consulta.data;
  if (!pago) return consulta.error ? <DialogoCarga error={consulta.error.message} cerrar={cerrar} /> : null;
  function guardar(datos: PagoInput) {
    void operacion.enviar({
      p_accion: 'pagar_cuota', p_id: id,
      p_datos: { indice, fecha: datos.fecha, medio: datos.medio, detalle: prepararDetallePago(datos) },
    });
  }
  function desmarcar() {
    void operacion.enviar({ p_accion: 'quitar_pago', p_id: id, p_datos: { indice } });
  }
  return (
    <PagoFormulario titulo={(pago.total ?? 1) > 1 ? `Pago de la cuota ${pago.numero} de ${pago.total}` : 'Pago del seguro'}
      resumen={<>{pago.socio} · {pago.descripcion}<br />Vence {fechaCorta(pago.vencimiento)} · <b className="text-[var(--ink)]">{moneda(pago.importe ?? 0)}</b></>}
      textoGuardar={pago.fecha ? 'Guardar' : 'Marcar pagada'} valores={valoresPago(pago)}
      operacion={{ ...operacion, reintentar: () => { void operacion.enviar(); } }} guardar={guardar}
      anular={pago.fecha ? { texto: 'No pagó (desmarcar)', ejecutar: desmarcar } : undefined} cerrar={cerrar} />
  );
}
