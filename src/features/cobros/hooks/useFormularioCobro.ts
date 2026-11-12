import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { prepararDetallePago, valoresPago } from '../../../shared/lib/detallePago';
import { leerMonto } from '../../../shared/lib/moneda';
import { pagoSchema, type PagoInput } from '../../../shared/schemas/pago.schema';
import { avisar } from '../../../shared/stores/avisos.store';
import type { DatosCobro } from '../api/cobros.service';
import { mensajeCobro, ordenarVencidas, presentarPrevia, previaVacia } from '../lib/cobroVista';
import { useRegistrarCobro, useVistaPreviaCobro } from './useCobros';
import { useValorEstable } from './useValorEstable';

const seleccionSchema = z.object({
  seleccionadas: z.array(z.string()),
  prioridad: z.string(),
  usarFavor: z.boolean(),
});
type Seleccion = z.infer<typeof seleccionSchema>;

const montoValido = (monto: string) => /^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(monto);

/** Lógica del diálogo "Registrar cobro": selección, monto, cálculo del servidor y registro. */
export function useFormularioCobro(datos: DatosCobro, cerrar: () => void) {
  const aviso = useRef('Cobro registrado');
  const [montoManual, setMontoManual] = useState(false);
  const [mostrarFuturas, setMostrarFuturas] = useState(datos.mostrarFuturas);
  const seleccion = useForm<Seleccion>({ defaultValues: datos.inicial, resolver: zodResolver(seleccionSchema) });
  const pago = useForm<PagoInput>({ defaultValues: valoresPago({ medio: 'efectivo', monto: '0' }), resolver: zodResolver(pagoSchema) });
  const valores = seleccion.watch();
  const montoEscrito = pago.watch('monto');
  const monto = montoManual ? montoEscrito ?? '' : undefined;

  const pedido = monto === undefined || montoValido(monto) ? {
    socioId: datos.socioId, seleccion: valores.seleccionadas, prioridad: valores.prioridad,
    usarFavor: valores.usarFavor, monto: monto === undefined ? null : leerMonto(monto),
  } : null;
  const estable = useValorEstable(pedido, 250);
  const consulta = useVistaPreviaCobro(estable.valor);
  const calculando = !estable.listo || consulta.isFetching || consulta.isPlaceholderData;
  const previa = consulta.data ? presentarPrevia(consulta.data, valores.usarFavor) : previaVacia;

  const operacion = useRegistrarCobro(() => { cerrar(); avisar(aviso.current); });

  const vencidas = ordenarVencidas(datos.conceptos, valores.prioridad);
  const futuras = datos.conceptos.filter((concepto) => concepto.futuro);
  const elegidas = new Set(valores.seleccionadas);
  const sinSeleccionar = vencidas.filter((concepto) => !elegidas.has(concepto.clave)).length;

  function alternar(clave: string) {
    const actuales = seleccion.getValues('seleccionadas');
    seleccion.setValue('seleccionadas', actuales.includes(clave) ? actuales.filter((actual) => actual !== clave) : [...actuales, clave]);
  }

  function editarMonto() {
    setMontoManual(true);
  }

  /** `cbModo` / `cbMarcarTodo`: tilda todo lo vencido; con prioridad también la cambia y vuelve al monto sugerido. */
  function marcarVencidas(prioridad?: string) {
    seleccion.setValue('seleccionadas', [...new Set([...valores.seleccionadas, ...vencidas.map((concepto) => concepto.clave)])]);
    if (prioridad !== undefined) {
      seleccion.setValue('prioridad', prioridad);
      setMontoManual(false);
      pago.setValue('monto', '0');
    }
  }

  /** `cbRifa`: solo las cuotas de rifa (vencidas, o todas con las que todavía no vencen). */
  function marcarRifas(todas: boolean) {
    seleccion.setValue('seleccionadas', todas ? datos.rifasTodas : datos.rifasVencidas);
    seleccion.setValue('prioridad', 'todo');
    setMontoManual(false);
    pago.setValue('monto', '0');
    if (todas) setMostrarFuturas(true);
  }

  const guardar = pago.handleSubmit((datosPago) => seleccion.handleSubmit((elegido) => {
    if (!consulta.data || calculando) { pago.setError('root', { message: 'Esperá a que termine el cálculo.' }); return; }
    const detalle = prepararDetallePago(datosPago);
    if ((datosPago.medio === 'cheque' || datosPago.medio === 'echeq') && (!detalle?.nro || !detalle.banco)) {
      pago.setError('root', { message: 'Ingresá el número y el banco para poder rastrear el cheque.' });
      return;
    }
    aviso.current = mensajeCobro(consulta.data);
    void operacion.enviar({
      p_socio_id: datos.socioId, p_seleccion: elegido.seleccionadas, p_prioridad: elegido.prioridad,
      p_usar_favor: elegido.usarFavor, p_monto: montoManual && datosPago.monto !== undefined ? leerMonto(datosPago.monto) : null,
      p_fecha: datosPago.fecha, p_medio: datosPago.medio, p_detalle: detalle,
    });
  })());

  /** Si el resultado quedó incierto, el mismo botón verifica la misma operación en vez de crear otra. */
  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (operacion.bloqueado) { void operacion.enviar(); return; }
    void guardar();
  }

  return {
    seleccion, pago, valores, previa, calculando, operacion, vencidas, futuras, sinSeleccionar,
    montoManual, mostrarFuturas, errorPrevia: consulta.error?.message ?? '',
    mostrarMasFuturas: () => setMostrarFuturas(true),
    alternar, editarMonto, marcarVencidas, marcarRifas, enviar,
  };
}
