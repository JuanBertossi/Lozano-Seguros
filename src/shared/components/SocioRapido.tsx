import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useEffect, useRef } from 'react';
import { socioRapidoSchema, type SocioRapidoInput } from '../schemas/socioRapido.schema';
import { useOperacionSocioSegura } from '../hooks/useSociosOperacion';
import type { PuenteOperacion } from '../hooks/useOperacionSegura';
import type { ResultadoSocio } from '../lib/socios.service';

const usarSql = import.meta.env.VITE_SOCIOS_SQL === 'true';

type Props = {
  crear: (datos: SocioRapidoInput) => void;
  cancelar: () => void;
  campo: string;
  etiqueta: string;
  boton: string;
  textoCrear?: string;
  puente?: PuenteOperacion<ResultadoSocio>;
  elegir: (socio: ResultadoSocio) => void;
};

// Se usa dentro de otro formulario: los botones nunca lo envían directamente.
export function SocioRapido({ crear, cancelar, campo, etiqueta, boton, textoCrear = 'Crear y elegir', puente, elegir }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const operacion = useOperacionSocioSegura({
    obtenerRevision: () => { if (!puente) throw new Error('La conexión de socios todavía no está disponible.'); return puente.obtenerRevision(); },
    bloquear: () => { if (!puente) throw new Error('La conexión de socios todavía no está disponible.'); puente.bloquear(); },
    desbloquear: () => puente?.desbloquear(),
    sincronizar: (datos, resultado) => { if (!puente) throw new Error('No se pudo actualizar la pantalla.'); puente.sincronizar(datos, resultado); elegir(resultado); },
  });
  const { register, handleSubmit, formState: { errors } } = useForm<SocioRapidoInput>({
    resolver: zodResolver(socioRapidoSchema), defaultValues: { nombre: '', telefono: '' },
  });
  useEffect(() => {
    if (!usarSql || !operacion.bloqueado) return;
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
    if (!usarSql) crear(datos);
    else if (puente) void operacion.enviar({ p_accion: 'rapido', p_id: null, p_datos: { nombre: datos.nombre, tel: datos.telefono } });
  }
  return <div ref={contenedor} className="grid gap-2 rounded-lg border border-solid border-[var(--ln)] p-3">
    <label className={etiqueta}>Nombre y apellido<input disabled={usarSql && operacion.bloqueado} className={campo} {...register('nombre')} /></label>
    <label className={etiqueta}>Celular<input disabled={usarSql && operacion.bloqueado} className={campo} {...register('telefono')} /></label>
    {errors.nombre && <p role="alert" className="text-sm text-[var(--bad)]">{errors.nombre.message}</p>}
    {usarSql && !puente && <p role="alert" className="text-sm text-[var(--bad)]">La conexión de socios todavía no está disponible.</p>}
    {usarSql && operacion.error && <p role="alert" className="text-sm text-[var(--bad)]">{operacion.error}</p>}
    {usarSql && operacion.bloqueado && !operacion.procesando && <button data-reintentar-socio type="button" className={boton} onClick={() => void operacion.enviar()}>Reintentar operación</button>}
    <div className="flex gap-2"><button type="button" disabled={usarSql && operacion.bloqueado} className={boton} onClick={cancelar}>Cancelar</button><button type="button" disabled={usarSql && (!puente || operacion.bloqueado)} className={boton} onClick={() => void handleSubmit(enviar)()}>{textoCrear}</button></div>
  </div>;
}
