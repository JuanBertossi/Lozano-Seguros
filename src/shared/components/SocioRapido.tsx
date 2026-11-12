import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useEffect, useRef } from 'react';
import { socioRapidoSchema, type SocioRapidoInput } from '../schemas/socioRapido.schema';
import { useOperacionSocioSegura } from '../hooks/useSociosOperacion';
import type { ResultadoSocio } from '../lib/socios.service';

type Props = {
  campo: string;
  etiqueta: string;
  boton: string;
  textoCrear?: string;
  cancelar: () => void;
  /** El servidor reutiliza al socio si ya existe por nombre (y lo reactiva si estaba archivado). */
  elegir: (socio: ResultadoSocio) => void;
};

// Se usa dentro de otro formulario: los botones nunca lo envían directamente.
export function SocioRapido({ campo, etiqueta, boton, textoCrear = 'Crear y elegir', cancelar, elegir }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const operacion = useOperacionSocioSegura(elegir);
  const { register, handleSubmit, formState: { errors } } = useForm<SocioRapidoInput>({
    resolver: zodResolver(socioRapidoSchema), defaultValues: { nombre: '', telefono: '' },
  });
  useEffect(() => {
    if (!operacion.bloqueado) return;
    const dialogo = contenedor.current?.closest('dialog');
    if (!dialogo) return;
    const detener = (evento: Event) => {
      const destino = evento.target;
      if (destino instanceof Element && destino.closest('[data-reintentar-socio]')) return;
      evento.preventDefault(); evento.stopPropagation();
    };
    dialogo.addEventListener('click', detener, true);
    dialogo.addEventListener('keydown', detener, true);
    dialogo.addEventListener('cancel', detener, true);
    return () => { dialogo.removeEventListener('click', detener, true); dialogo.removeEventListener('keydown', detener, true); dialogo.removeEventListener('cancel', detener, true); };
  }, [operacion.bloqueado]);
  function enviar(datos: SocioRapidoInput) {
    void operacion.enviar({ p_accion: 'rapido', p_id: null, p_datos: { nombre: datos.nombre, tel: datos.telefono } });
  }
  // Equivale a .socnew de la maqueta: caja punteada con el título, dos campos en fila y los botones a la derecha.
  return <div ref={contenedor} className="mb-3 rounded-[10px] border border-dashed border-[var(--ln)] bg-[var(--sf2)] px-3 py-2.5 [&_label]:mb-3.5">
    <b className="text-[13px]">Socio nuevo</b>
    <div className="mt-1.5 grid grid-cols-2 gap-3 max-[820px]:grid-cols-1">
      <label className={etiqueta}>Nombre y apellido<input disabled={operacion.bloqueado} className={campo} {...register('nombre')} /></label>
      <label className={etiqueta}>Celular<input disabled={operacion.bloqueado} className={campo} {...register('telefono')} /></label>
    </div>
    {errors.nombre && <p role="alert" className="mb-2 text-sm text-[var(--bad)]">{errors.nombre.message}</p>}
    {operacion.error && <p role="alert" className="mb-2 text-sm text-[var(--bad)]">{operacion.error}</p>}
    {operacion.bloqueado && !operacion.procesando && <button data-reintentar-socio type="button" className={boton} onClick={() => void operacion.enviar()}>Reintentar operación</button>}
    <div className="flex justify-end gap-2"><button type="button" disabled={operacion.bloqueado} className={boton} onClick={cancelar}>Cancelar</button><button type="button" disabled={operacion.bloqueado} className={`${boton} !border-[var(--ac)] !bg-[var(--ac)] !text-white`} onClick={() => void handleSubmit(enviar)()}>{textoCrear}</button></div>
  </div>;
}
