import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { PagoCampos } from './PagoCampos';
import { usePanelEvent } from '../hooks/usePanelEvent';
import { pagoSchema, type PagoInput } from '../schemas/pago.schema';
import { prepararDetallePago } from '../lib/detallePago';
import { useOperacionSeguro } from '../hooks/useSeguroOperacion';
import type { PuenteOperacion } from '../hooks/useOperacionSegura';
import type { ResultadoSeguro } from '../lib/seguros.service';
import { usePagoLoteria, type ResultadoPagoLoteria } from '../hooks/usePagoLoteria';

const usarSegurosSql=import.meta.env.VITE_SEGUROS_SQL==='true';
const usarLoteriaSql=import.meta.env.VITE_LOTERIA_SQL==='true';

interface EdicionPago {
  clave: string;
  titulo: string;
  descripcion?: string;
  vencimiento?: string;
  importe?: string;
  nota?: string;
  textoGuardar: string;
  inicial: PagoInput;
  guardar: (datos: PagoInput) => string | void;
  anular?: { texto: string; ejecutar: () => void };
  seguroOperacion?: { id:string; indice:number; puente:PuenteOperacion<ResultadoSeguro> };
  loteriaOperacion?: { id:string; puente:PuenteOperacion<ResultadoPagoLoteria> };
  cerrar: () => void;
}

export function PagoDialog() {
  const edicion = usePanelEvent<EdicionPago>('agencia:editar-pago');
  return edicion && <Formulario key={edicion.clave} edicion={edicion} />;
}

function Formulario({ edicion }: { edicion: EdicionPago }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const form = useForm<PagoInput>({ resolver: zodResolver(pagoSchema), defaultValues: edicion.inicial });
  const seguroSql=usarSegurosSql&&edicion.clave.startsWith('seg|');
  const puente=edicion.seguroOperacion?.puente;
  const loteriaSql=usarLoteriaSql&&edicion.clave.startsWith('lot|');
  const puenteLoteria=edicion.loteriaOperacion?.puente;
  const operacion=useOperacionSeguro({
    obtenerRevision:()=>{if(!puente)throw new Error('La conexión de seguros todavía no está disponible.');return puente.obtenerRevision()},
    bloquear:()=>{if(!puente)throw new Error('La conexión de seguros todavía no está disponible.');puente.bloquear()},
    desbloquear:()=>puente?.desbloquear(),
    sincronizar:(datos,resultado)=>{if(!puente)throw new Error('No se pudo actualizar la pantalla.');puente.sincronizar(datos,resultado)},
  });
  const pagoLoteria=usePagoLoteria({obtenerRevision:()=>{if(!puenteLoteria)throw new Error('Conexión de Lotería no disponible.');return puenteLoteria.obtenerRevision()},bloquear:()=>{if(!puenteLoteria)throw new Error('Conexión de Lotería no disponible.');puenteLoteria.bloquear()},desbloquear:()=>puenteLoteria?.desbloquear(),sincronizar:(datos,resultado)=>{if(!puenteLoteria)throw new Error('Conexión de Lotería no disponible.');puenteLoteria.sincronizar(datos,resultado)}});
  useEffect(() => { dialogo.current?.showModal(); }, []);
  const boton = 'cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-4 py-2.5 text-[15.5px] hover:bg-[var(--sf2)]';

  function guardar(datos: PagoInput) {
    if(loteriaSql){if(!edicion.loteriaOperacion){form.setError('root',{message:'Conexión de Lotería no disponible.'});return}void pagoLoteria.enviar({p_id:edicion.loteriaOperacion.id,p_accion:'editar_pago',p_datos:{fecha:datos.fecha,medio:datos.medio,detalle:prepararDetallePago(datos)}});return}
    if(seguroSql){
      const seguro=edicion.seguroOperacion;
      if(!seguro){form.setError('root',{message:'La conexión de seguros todavía no está disponible.'});return}
      void operacion.enviar({p_accion:'pagar_cuota',p_id:seguro.id,p_datos:{indice:seguro.indice,fecha:datos.fecha,medio:datos.medio,detalle:prepararDetallePago(datos)}});
      return;
    }
    const mensaje = edicion.guardar(datos);
    if (mensaje) form.setError('root', { message: mensaje });
  }

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-pago-cuota" className="m-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-[#0a0c0f73]"
      onCancel={(event) => { event.preventDefault(); if(!operacion.bloqueado&&!pagoLoteria.bloqueado)edicion.cerrar(); }}>
      <div className="px-6">
        {seguroSql&&!puente&&<p role="alert" className="text-sm text-[var(--bad)]">La conexión de seguros todavía no está disponible.</p>}
        {seguroSql&&operacion.error&&<p role="alert" className="text-sm text-[var(--bad)]">{operacion.error}</p>}
        {seguroSql&&operacion.bloqueado&&!operacion.procesando&&<button type="button" className={boton} onClick={()=>void operacion.enviar()}>Reintentar operación</button>}
        {loteriaSql&&pagoLoteria.error&&<p role="alert" className="text-sm text-[var(--bad)]">{pagoLoteria.error}</p>}
        {loteriaSql&&pagoLoteria.bloqueado&&!pagoLoteria.procesando&&<button type="button" className={boton} onClick={()=>void pagoLoteria.enviar()}>Reintentar operación</button>}
      </div>
      <form inert={(seguroSql&&operacion.bloqueado)||(loteriaSql&&pagoLoteria.bloqueado)} onSubmit={form.handleSubmit(guardar)} noValidate>
        <div className="grid gap-3.5 px-6 pt-[22px] pb-5 max-[820px]:px-4">
          <h2 id="titulo-pago-cuota" className="text-[22px] font-semibold">{edicion.titulo}</h2>
          {(edicion.descripcion || edicion.importe) && <p className="text-[var(--mu)]">
            {edicion.descripcion}
            {edicion.vencimiento && <><br />Vence {edicion.vencimiento} · </>}
            {edicion.importe && <b className="text-[var(--ink)]">{edicion.importe}</b>}
          </p>}
          {edicion.inicial.monto !== undefined && <label className="grid gap-1.5 text-[14.5px] font-medium">Monto recibido
            <input inputMode="decimal" className="w-full rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] focus-visible:outline-2 focus-visible:outline-[var(--ac)]" {...form.register('monto')} />
            {form.formState.errors.monto && <span role="alert" className="text-sm text-[var(--bad)]">{form.formState.errors.monto.message}</span>}
          </label>}
          <PagoCampos form={form} />
          {edicion.nota && <p className="text-sm text-[var(--mu)]">{edicion.nota}</p>}
          {form.formState.errors.root?.message && <p role="alert" className="text-sm text-[var(--bad)]">{form.formState.errors.root.message}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-solid border-[var(--ln)] px-6 py-3 max-[820px]:px-4">
          <div>{edicion.anular && <button type="button" disabled={(seguroSql&&!puente)||(loteriaSql&&!puenteLoteria)} className={boton + ' text-[var(--bad)] disabled:opacity-40'} onClick={()=>{if(loteriaSql&&edicion.loteriaOperacion){if(confirm('¿Anular este pago? Vuelve a quedar como deuda. Si se había pagado con un cobro, esa plata queda como saldo a favor del socio.'))void pagoLoteria.enviar({p_id:edicion.loteriaOperacion.id,p_accion:'anular_pago',p_datos:{}})}else if(!seguroSql)edicion.anular?.ejecutar();else if(edicion.seguroOperacion)void operacion.enviar({p_accion:'quitar_pago',p_id:edicion.seguroOperacion.id,p_datos:{indice:edicion.seguroOperacion.indice}})}}>{edicion.anular.texto}</button>}</div>
          <div className="flex gap-2"><button type="button" className={boton} onClick={edicion.cerrar}>Cancelar</button><button type="submit" disabled={(seguroSql&&!puente)||(loteriaSql&&!puenteLoteria)} className="cursor-pointer rounded-[9px] border border-solid border-[var(--ac)] bg-[var(--ac)] px-4 py-2.5 text-[15.5px] font-medium text-white hover:brightness-110 disabled:opacity-40">{edicion.textoGuardar}</button></div>
        </div>
      </form>
    </dialog>
  );
}
