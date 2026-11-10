import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';
import { seguroSchema, socioRapidoSchema, type SeguroInput, type SocioRapidoInput } from '../seguro.schema';

interface EdicionSeguro {
  id: string | null;
  inicial: SeguroInput;
  socios: { id: string; nombre: string; nro: string }[];
  socioFijo: boolean;
  guardar: (datos: SeguroInput) => void;
  eliminar: () => void;
  crearSocio: (nombre: string, telefono: string) => { id: string; nombre: string; nro: string } | null;
  cerrar: () => void;
}
const campo = 'w-full min-w-0 rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] focus-visible:outline-2 focus-visible:outline-[var(--ac)]';
const etiqueta = 'grid gap-1.5 text-[14.5px] font-medium';
const boton = 'cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15.5px] hover:bg-[var(--sf2)]';

function sumarAnio(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (!anio || !mes || !dia) return '';
  const ultimoDia = new Date(Date.UTC(anio + 1, mes, 0)).getUTCDate();
  return [String(anio + 1), String(mes).padStart(2, '0'), String(Math.min(dia, ultimoDia)).padStart(2, '0')].join('-');
}

export function SeguroDialog() {
  const edicion = usePanelEvent<EdicionSeguro>('agencia:editar-seguro');
  return edicion && <Formulario key={edicion.id ?? 'nuevo'} edicion={edicion} />;
}

function Formulario({ edicion }: { edicion: EdicionSeguro }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [socios, setSocios] = useState(edicion.socios);
  const [nuevo, setNuevo] = useState(false);
  const socioRapido = useForm<SocioRapidoInput>({
    resolver: zodResolver(socioRapidoSchema),
    defaultValues: { nombre: '', telefono: '' },
  });
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<SeguroInput>({
    resolver: zodResolver(seguroSchema), defaultValues: edicion.inicial,
  });
  const ingreso = register('ingreso');
  const seleccion = register('sid');

  useEffect(() => { dialogo.current?.showModal(); }, []);

  function crearSocio({ nombre, telefono }: SocioRapidoInput) {
    const socio = edicion.crearSocio(nombre, telefono);
    if (!socio) return;
    setSocios((actuales) => actuales.some((item) => item.id === socio.id) ? actuales : [...actuales, socio]);
    setValue('sid', socio.id, { shouldValidate: true });
    socioRapido.reset();
    setNuevo(false);
  }

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-seguro" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[#0a0c0f73]"
      onCancel={(event) => { event.preventDefault(); edicion.cerrar(); }}>
      <form onSubmit={handleSubmit(edicion.guardar)} noValidate>
        <div className="grid gap-3.5 px-6 pt-[22px] pb-5 max-[820px]:px-4">
          <h2 id="titulo-seguro" className="text-[22px] font-semibold">{edicion.id ? 'Editar seguro' : 'Nuevo seguro'}</h2>
          {edicion.socioFijo ? <p className="text-sm">Socio: <b>{socios.find((socio) => socio.id === edicion.inicial.sid)?.nombre}</b></p> :
            <label className={etiqueta}>Socio
              <select className={campo} {...seleccion} onChange={(event) => {
                if (event.target.value === '__new') { setNuevo(true); setValue('sid', ''); return; }
                void seleccion.onChange(event);
              }}>
                <option value="">Elegí un socio</option>
                {socios.map((socio) => <option key={socio.id} value={socio.id}>{socio.nombre} · {socio.nro}</option>)}
                <option value="__new">+ Nuevo socio</option>
              </select>
            </label>}
          {nuevo && <div className="grid gap-2 rounded-lg border border-solid border-[var(--ln)] p-3">
            <label className={etiqueta}>Nombre y apellido<input className={campo} {...socioRapido.register('nombre')} /></label>
            <label className={etiqueta}>Celular<input className={campo} {...socioRapido.register('telefono')} /></label>
            {socioRapido.formState.errors.nombre && <p role="alert" className="text-sm text-[var(--bad)]">{socioRapido.formState.errors.nombre.message}</p>}
            <div className="flex gap-2"><button type="button" className={boton} onClick={() => setNuevo(false)}>Cancelar</button><button type="button" className={boton} onClick={() => void socioRapido.handleSubmit(crearSocio)()}>Crear socio</button></div>
          </div>}
          <div className="grid gap-3 min-[560px]:grid-cols-2">
            <label className={etiqueta}>Fecha de ingreso<input className={campo} type="date" {...ingreso} onChange={(event) => { void ingreso.onChange(event); if (event.target.value) setValue('venc', sumarAnio(event.target.value)); }} /></label>
            <label className={etiqueta}>Vencimiento<input className={campo} type="date" {...register('venc')} /></label>
          </div>
          <label className={etiqueta}>Descripción<input className={campo} placeholder="Ej: Auto Ford Ka · AB 123 CD · San Cristóbal" {...register('desc')} /></label>
          <label className={etiqueta}>Valor total<input className={campo} inputMode="decimal" {...register('valor')} /></label>
          <fieldset className="m-0 border-0 p-0">
            <legend className="text-sm font-medium">Cómo lo va a pagar</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">{[['contado','Contado'],['3','3 cuotas'],['6','6 cuotas'],['12','12 cuotas']].map(([id,nombrePlan]) => <label key={id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-[var(--ln)] px-[11px] py-[7px] text-sm"><input type="radio" value={id} className="accent-[var(--ac)]" {...register('plan')} />{nombrePlan}</label>)}</div>
          </fieldset>
          {edicion.id && <p className="text-sm text-[var(--mu)]">Los pagos se marcan con “Registrar pago” o tocando cada cuota. Si cambiás valor, plan o fecha de ingreso, se rearman las cuotas (las pagadas quedan).</p>}
          {Object.values(errors).map((error, indice) => <p key={indice} role="alert" className="text-sm text-[var(--bad)]">{error.message}</p>)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-solid border-[var(--ln)] px-6 py-3 max-[820px]:px-4">
          <div>{edicion.id && <button type="button" className={boton + ' text-[var(--bad)]'} onClick={edicion.eliminar}>Eliminar</button>}</div>
          <div className="flex gap-2"><button type="button" className={boton} onClick={edicion.cerrar}>Cancelar</button><button type="submit" className="cursor-pointer rounded-[9px] border border-solid border-[var(--ac)] bg-[var(--ac)] px-4 py-2.5 text-[15.5px] font-medium text-white hover:brightness-110">Guardar</button></div>
        </div>
      </form>
    </dialog>
  );
}
