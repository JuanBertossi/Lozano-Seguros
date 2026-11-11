import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PagoCampos } from '../../../shared/components/PagoCampos';
import { prepararDetallePago } from '../../../shared/lib/detallePago';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';
import { pagoSchema, type PagoInput } from '../../../shared/schemas/pago.schema';
import { agencia, type DatosAgencia } from '../../../shared/lib/supabase.service';
import { useRegistrarCobro, useVistaPreviaCobro } from '../hooks/useCobros';
import type { RegistrarCobroServidor, VistaPreviaServidor } from '../api/cobros.service';

const seleccionSchema = z.object({
  seleccionadas: z.array(z.string()),
  prioridad: z.string(),
  usarFavor: z.boolean(),
});
type Seleccion = z.infer<typeof seleccionSchema>;
type Solicitud = Seleccion & { monto?: string };

interface Concepto {
  clave: string;
  titulo: string;
  producto: string;
  fecha: string;
  importe: string;
  futuro: boolean;
}
interface VistaPrevia {
  sugerido: string;
  recibido: string;
  usado: string;
  estado: string;
  color: 'ok' | 'bad';
  sobrante: string;
  habilitado: boolean;
  accion: string;
  aplicaciones: Record<string, { texto: string; estado: 'ok' | 'warn' | 'mu' }>;
}
interface Cobro {
  clave: string;
  socio: string;
  socioId: string;
  obtenerRevision: () => number;
  sincronizar: (datos: DatosAgencia) => void;
  resumen: { titulo: string; texto: string; color?: 'ok' | 'bad' }[];
  favor: string;
  inicial: Seleccion;
  mostrarFuturas: boolean;
  prioridades: { clave: string; titulo: string; importe: string }[];
  conceptos: Concepto[];
  rifasVencidas: string[];
  rifasTodas: string[];
  textoRifas: string;
  pago: PagoInput;
  ordenar: (prioridad: string) => string[];
  calcular: (solicitud: Solicitud) => VistaPrevia;
  guardar: (solicitud: Solicitud, pago: PagoInput) => string | void;
  cerrar: () => void;
}

const boton = 'cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-2 text-sm font-medium hover:bg-[var(--sf2)]';
const principal = 'cursor-pointer rounded-[9px] border border-solid border-[var(--ac)] bg-[var(--ac)] px-4 py-2.5 text-[15.5px] font-medium text-white hover:brightness-110 disabled:cursor-default disabled:opacity-40';
const color = { ok: 'text-[var(--ok)]', warn: 'text-[var(--warn)]', bad: 'text-[var(--bad)]', mu: 'text-[var(--mu)]' };
const usarSql = import.meta.env.VITE_COBROS_SQL === 'true';
const numero = (monto: string) => Number(monto.replace(/\./g, '').replace(',', '.'));
const importe = (monto: number) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: Number.isInteger(monto) ? 0 : 2,
  maximumFractionDigits: Number.isInteger(monto) ? 0 : 2,
}).format(monto);
const numeroEditable = (monto: number) => new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: Number.isInteger(monto) ? 0 : 2, maximumFractionDigits: 2,
}).format(monto);

function presentar(resultado: VistaPreviaServidor, usarFavor: boolean): VistaPrevia {
  const saldo = resultado.estadoFinal;
  return {
    sugerido: numeroEditable(resultado.sugerido), recibido: importe(resultado.A),
    usado: usarFavor ? importe(resultado.usado) : '—',
    estado: saldo > 0 ? `Debe ${importe(saldo)}` : saldo < 0 ? `Tiene a favor ${importe(Math.abs(saldo))}` : 'Queda al día',
    color: saldo > 0 ? 'bad' : 'ok', sobrante: resultado.quedo > 0 ? importe(resultado.quedo) : '',
    habilitado: resultado.habilitado,
    accion: resultado.A > 0 ? `Registrar cobro de ${importe(resultado.A)}` : resultado.habilitado ? 'Aplicar saldo a favor' : 'Ingresá el monto',
    aplicaciones: Object.fromEntries(Object.entries(resultado.aplicacionesDetalle).map(([clave, dato]) => [clave, {
      estado: dato.estado,
      texto: dato.estado === 'ok' ? 'Se salda' : dato.estado === 'warn' ? `Abona ${importe(dato.aplicado)} · queda ${importe(dato.restante)}` : 'Queda pendiente',
    }])),
  };
}

export function CobroDialog() {
  const cobro = usePanelEvent<Cobro>('agencia:registrar-cobro');
  return cobro && <Formulario key={cobro.clave} cobro={cobro} />;
}

function Formulario({ cobro }: { cobro: Cobro }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const operacion = useRef<{ huella: string; id: string } | null>(null);
  const parametrosEnviados = useRef<RegistrarCobroServidor | null>(null);
  const [revision] = useState(() => {
    if (!usarSql) return { valor: null, error: '' };
    try { return { valor: cobro.obtenerRevision(), error: '' }; }
    catch (error) { return { valor: null, error: error instanceof Error ? error.message : 'No se pudo obtener la revisión.' }; }
  });
  const [montoManual, setMontoManual] = useState(false);
  const [sincronizacionPendiente, setSincronizacionPendiente] = useState(false);
  const [confirmacionPendiente, setConfirmacionPendiente] = useState(false);
  const [mostrarFuturas, setMostrarFuturas] = useState(cobro.mostrarFuturas);
  const seleccion = useForm<Seleccion>({ defaultValues: cobro.inicial, resolver: zodResolver(seleccionSchema) });
  const pago = useForm<PagoInput>({ defaultValues: cobro.pago, resolver: zodResolver(pagoSchema) });
  const solicitud = { ...seleccion.watch(), monto: montoManual ? pago.watch('monto') : undefined };
  const montoValido = solicitud.monto === undefined || /^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(solicitud.monto);
  const entrada = usarSql && revision.valor !== null && montoValido ? {
    p_revision: revision.valor, p_socio_id: cobro.socioId, p_seleccion: solicitud.seleccionadas,
    p_prioridad: solicitud.prioridad, p_usar_favor: solicitud.usarFavor,
    p_monto: solicitud.monto === undefined ? null : numero(solicitud.monto),
  } : null;
  const huellaEntrada = JSON.stringify(entrada);
  const [entradaEstable, setEntradaEstable] = useState(huellaEntrada);
  useEffect(() => { const timeout = window.setTimeout(() => setEntradaEstable(huellaEntrada), 250); return () => window.clearTimeout(timeout); }, [huellaEntrada]);
  const previaServidor = useVistaPreviaCobro(entradaEstable === huellaEntrada ? entrada : null);
  const registrar = useRegistrarCobro();
  const vacia: VistaPrevia = { sugerido: '', recibido: '—', usado: '—', estado: 'Calculando…', color: 'ok', sobrante: '', habilitado: false, accion: 'Calculando…', aplicaciones: {} };
  const previa = usarSql ? (previaServidor.data ? presentar(previaServidor.data, solicitud.usarFavor) : vacia) : cobro.calcular(solicitud);
  const vencidas = cobro.ordenar(solicitud.prioridad);
  const futuras = cobro.conceptos.filter((item) => item.futuro);
  const conceptos = new Map(cobro.conceptos.map((item) => [item.clave, item]));
  const seleccionadas = new Set(solicitud.seleccionadas);
  const faltanVencidas = vencidas.some((clave) => !seleccionadas.has(clave));
  useEffect(() => { dialogo.current?.showModal(); }, []);
  useEffect(() => {
    if (!confirmacionPendiente && !sincronizacionPendiente && !registrar.isPending) return;
    const avisar = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [confirmacionPendiente, sincronizacionPendiente, registrar.isPending]);

  function marcarVencidas(prioridad?: string) {
    seleccion.setValue('seleccionadas', [...new Set([...solicitud.seleccionadas, ...vencidas])]);
    if (prioridad !== undefined) {
      seleccion.setValue('prioridad', prioridad);
      setMontoManual(false);
      pago.setValue('monto', '0');
    }
  }

  function marcarRifas(todas: boolean) {
    seleccion.setValue('seleccionadas', todas ? cobro.rifasTodas : cobro.rifasVencidas);
    seleccion.setValue('prioridad', 'todo');
    setMontoManual(false);
    pago.setValue('monto', '0');
    if (todas) setMostrarFuturas(true);
  }

  function renderConcepto(item: Concepto) {
    const aplicacion = previa.aplicaciones[item.clave];
    return (
      <label key={item.clave} className="flex cursor-pointer items-start gap-2 rounded-lg border border-solid border-[var(--ln)] p-2.5">
        <input type="checkbox" value={item.clave} className="mt-1 accent-[var(--ac)]" {...seleccion.register('seleccionadas')} />
        <span className="min-w-0 flex-1"><span className="mr-1 rounded bg-[var(--sf2)] px-1.5 py-0.5 text-xs">{item.producto}</span>{item.titulo}<br /><span className="text-[13px] text-[var(--mu)]">{item.futuro ? 'Vence ' : 'Venció '}{item.fecha}</span></span>
        <span className="text-right"><b>{item.importe}</b>{aplicacion && <span className={'block text-xs ' + color[aplicacion.estado]}>{aplicacion.texto}</span>}</span>
      </label>
    );
  }

  const guardar = pago.handleSubmit((datos) => seleccion.handleSubmit(async (valores) => {
    if (!usarSql) {
      const error = cobro.guardar({ ...valores, monto: montoManual ? datos.monto : undefined }, datos);
      if (error) pago.setError('root', { message: error });
      return;
    }
    try {
      if (!agencia || revision.valor === null) throw new Error(revision.error || 'No se pudo acceder a la agencia.');
      if (!sincronizacionPendiente) {
        if (!confirmacionPendiente && (!previaServidor.data || previaServidor.isFetching)) throw new Error('Esperá a que termine el cálculo.');
        if (!confirmacionPendiente && cobro.obtenerRevision() !== revision.valor) throw new Error('Los datos cambiaron. Cerrá y volvé a abrir el cobro.');
        const base = {
          p_revision: revision.valor, p_socio_id: cobro.socioId, p_seleccion: valores.seleccionadas,
          p_prioridad: valores.prioridad, p_usar_favor: valores.usarFavor,
          p_monto: montoManual && datos.monto !== undefined ? numero(datos.monto) : null,
          p_fecha: datos.fecha, p_medio: datos.medio, p_detalle: prepararDetallePago(datos),
        };
        const huella = JSON.stringify(base);
        if (operacion.current?.huella !== huella) operacion.current = { huella, id: crypto.randomUUID() };
        const parametros: RegistrarCobroServidor = confirmacionPendiente && parametrosEnviados.current
          ? parametrosEnviados.current : { ...base, p_operacion: operacion.current.id };
        parametrosEnviados.current = parametros;
        await registrar.mutateAsync(parametros);
        setConfirmacionPendiente(false);
        setSincronizacionPendiente(true);
      }
      const estado = await agencia.leer();
      cobro.sincronizar(estado);
    } catch (error) {
      const codigo = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
      const errorDefinitivo = codigo !== undefined && ['22023', '40001', '42501', '0A000', 'SIN_CONFIGURACION', 'SIN_SESION', 'PGRST202'].includes(codigo);
      const ambiguo = Boolean(parametrosEnviados.current && !sincronizacionPendiente && !errorDefinitivo);
      if (ambiguo) setConfirmacionPendiente(true);
      else if (errorDefinitivo) { setConfirmacionPendiente(false); parametrosEnviados.current = null; operacion.current = null; }
      pago.setError('root', { message: ambiguo
        ? 'No se pudo confirmar el resultado. Reintentá para verificar el mismo cobro.'
        : error instanceof Error ? error.message : 'No se pudo registrar el cobro.' });
    }
  })());

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-cobro" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[#0a0c0f73]"
      onCancel={(event) => { event.preventDefault(); if (!sincronizacionPendiente && !confirmacionPendiente) cobro.cerrar(); }}>
      <form onSubmit={guardar} noValidate>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-solid border-[var(--ln)] px-6 py-4"><h2 id="titulo-cobro" className="text-[22px] font-semibold">Registrar cobro</h2><span className="text-[var(--mu)]">{cobro.socio}</span></header>
        <fieldset disabled={confirmacionPendiente || sincronizacionPendiente || registrar.isPending} className="m-0 grid min-w-0 gap-4 border-0 px-6 py-4 max-[820px]:px-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--sf2)] p-3">{cobro.resumen.map((item) => <div key={item.titulo}><small className="block text-[var(--mu)]">{item.titulo}</small><b className={item.color && color[item.color]}>{item.texto}</b></div>)}</div>
          <section className="grid gap-2">
            <h3 className="font-semibold">1. Cuánto te da</h3>
            <label className="grid gap-1 text-sm font-medium">Monto recibido
              <Controller control={pago.control} name="monto" render={({ field }) => <input {...field} value={montoManual ? field.value ?? '' : previa.sugerido} onChange={(event) => { setMontoManual(true); field.onChange(event); }} className="w-full rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-2.5 text-2xl font-semibold" inputMode="decimal" placeholder="0,00" />} />
            </label>
            <p className="text-sm text-[var(--mu)]">Podés ingresar centavos con coma. Ejemplo: 1.484.601,50.</p>
            {pago.formState.errors.monto && <p className="text-sm text-[var(--bad)]" role="alert">{pago.formState.errors.monto.message}</p>}
          </section>
          <section className="grid gap-2">
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">2. Qué paga primero</h3><span className="text-sm text-[var(--mu)]">Si la plata no alcanza para todo</span></div>
            {cobro.prioridades.length > 2 && <div className="flex flex-wrap gap-2" role="group" aria-label="Prioridad de pago">{cobro.prioridades.map((item) => <button key={item.clave} type="button" aria-pressed={solicitud.prioridad === item.clave} className={boton + (solicitud.prioridad === item.clave ? ' !border-[var(--ac)] !bg-[var(--ac-s)]' : '')} onClick={() => marcarVencidas(item.clave)}>{item.titulo}<small className="block text-[var(--mu)]">{item.importe}</small></button>)}</div>}
            {cobro.rifasTodas.length > 0 && <><div className="flex flex-wrap gap-2"><button type="button" className={boton} onClick={() => marcarRifas(false)}>Seleccionar cuotas vencidas de rifa</button><button type="button" className={boton} onClick={() => marcarRifas(true)}>{cobro.textoRifas}</button></div><p className="text-sm text-[var(--mu)]">También podés elegir cuotas específicas, incluidas las que todavía no vencen.</p></>}
            {vencidas.length ? vencidas.map((clave) => renderConcepto(conceptos.get(clave)!)) : <p className="text-sm text-[var(--mu)]">{futuras.length ? 'No tiene nada vencido.' : 'No debe nada. Igual podés registrar un pago a cuenta: queda como saldo a favor.'}</p>}
            {futuras.length > 0 && (mostrarFuturas ? <><p className="text-sm font-medium">Todavía no vencen</p>{futuras.map(renderConcepto)}</> : <button type="button" className={boton} onClick={() => setMostrarFuturas(true)}>Adelantar cuotas que todavía no vencen ({futuras.length})</button>)}
          </section>
          <div className="grid gap-2 rounded-xl bg-[var(--sf2)] p-3">
            <div className="flex justify-between gap-2"><span>Recibís hoy</span><b>{previa.recibido}</b></div>
            {cobro.favor && <div className="flex justify-between gap-2"><label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[var(--ac)]" {...seleccion.register('usarFavor')} /> Usar saldo a favor ({cobro.favor})</label><b>{previa.usado}</b></div>}
            <div className="flex justify-between gap-2 border-t border-solid border-[var(--ln)] pt-2"><b>Después del cobro</b><b className={color[previa.color]}>{previa.estado}</b></div>
            {previa.sobrante && <p className={color.ok}>Sobran {previa.sobrante}: quedan como saldo a favor.</p>}
            {previa.sobrante && faltanVencidas && <p className={color.warn}>Hay deudas vencidas sin seleccionar. <button type="button" className="cursor-pointer border-0 bg-transparent p-0 underline" onClick={() => marcarVencidas()}>Usar lo que sobra para esa deuda</button></p>}
          </div>
          <section className="grid gap-2"><h3 className="font-semibold">3. Cómo pagó</h3><PagoCampos form={pago} /></section>
          {(pago.formState.errors.root?.message || revision.error || (usarSql && previaServidor.error?.message)) && <p role="alert" className="text-sm text-[var(--bad)]">{pago.formState.errors.root?.message || revision.error || previaServidor.error?.message}</p>}
        </fieldset>
        <footer className="flex justify-end gap-2 border-t border-solid border-[var(--ln)] px-6 py-3"><button type="button" className={boton} disabled={confirmacionPendiente || sincronizacionPendiente || registrar.isPending} onClick={cobro.cerrar}>Cancelar</button><button type="submit" className={principal} disabled={registrar.isPending || (!confirmacionPendiente && !sincronizacionPendiente && (!previa.habilitado || (usarSql && previaServidor.isFetching)))}>{sincronizacionPendiente ? 'Reintentar sincronización' : confirmacionPendiente ? 'Verificar cobro' : previa.accion}</button></footer>
      </form>
    </dialog>
  );
}
