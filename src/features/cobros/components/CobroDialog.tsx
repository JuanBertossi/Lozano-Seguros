import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PagoCampos } from '../../../shared/components/PagoCampos';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';
import { pagoSchema, type PagoInput } from '../../../shared/schemas/pago.schema';

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

export function CobroDialog() {
  const cobro = usePanelEvent<Cobro>('agencia:registrar-cobro');
  return cobro && <Formulario key={cobro.clave} cobro={cobro} />;
}

function Formulario({ cobro }: { cobro: Cobro }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [montoManual, setMontoManual] = useState(false);
  const [mostrarFuturas, setMostrarFuturas] = useState(cobro.mostrarFuturas);
  const seleccion = useForm<Seleccion>({ defaultValues: cobro.inicial, resolver: zodResolver(seleccionSchema) });
  const pago = useForm<PagoInput>({ defaultValues: cobro.pago, resolver: zodResolver(pagoSchema) });
  const solicitud = { ...seleccion.watch(), monto: montoManual ? pago.watch('monto') : undefined };
  const previa = cobro.calcular(solicitud);
  const vencidas = cobro.ordenar(solicitud.prioridad);
  const futuras = cobro.conceptos.filter((item) => item.futuro);
  const conceptos = new Map(cobro.conceptos.map((item) => [item.clave, item]));
  const seleccionadas = new Set(solicitud.seleccionadas);
  const faltanVencidas = vencidas.some((clave) => !seleccionadas.has(clave));
  useEffect(() => { dialogo.current?.showModal(); }, []);

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

  const guardar = pago.handleSubmit((datos) => seleccion.handleSubmit((valores) => {
    const error = cobro.guardar({ ...valores, monto: montoManual ? datos.monto : undefined }, datos);
    if (error) pago.setError('root', { message: error });
  })());

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-cobro" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[#0a0c0f73]"
      onCancel={(event) => { event.preventDefault(); cobro.cerrar(); }}>
      <form onSubmit={guardar} noValidate>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-solid border-[var(--ln)] px-6 py-4"><h2 id="titulo-cobro" className="text-[22px] font-semibold">Registrar cobro</h2><span className="text-[var(--mu)]">{cobro.socio}</span></header>
        <div className="grid gap-4 px-6 py-4 max-[820px]:px-4">
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
          {pago.formState.errors.root?.message && <p role="alert" className="text-sm text-[var(--bad)]">{pago.formState.errors.root.message}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-solid border-[var(--ln)] px-6 py-3"><button type="button" className={boton} onClick={cobro.cerrar}>Cancelar</button><button type="submit" className={principal} disabled={!previa.habilitado}>{previa.accion}</button></footer>
      </form>
    </dialog>
  );
}
