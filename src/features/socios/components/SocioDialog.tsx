import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useDialogo } from '../../../shared/stores/dialogos.store';
import { socioSchema, type SocioInput } from '../socio.schema';
import { useSocioFormulario } from '../hooks/useSocioFormulario';
import { btnMd, btnMdD, btnMdP, campoF, cuerpo, dialogo as marco, errores, etiquetaF, fila, notaF, opcionF, opcionesF, pie, titulo } from './estilos';

const mono = ' font-mono font-semibold tracking-[.02em]';
type Formulario = ReturnType<typeof useSocioFormulario>;

function CamposSocio({ id, inicial, formulario }: { id: string | undefined; inicial: SocioInput; formulario: Formulario }) {
  const { register, handleSubmit, formState: { errors } } = useForm<SocioInput>({ resolver: zodResolver(socioSchema), defaultValues: inicial });
  return (
    <form inert={formulario.operacion.bloqueado} onSubmit={handleSubmit(formulario.guardar)} noValidate>
      <div className={cuerpo}>
        <h2 id="titulo-edicion-socio" className={titulo}>{id ? 'Editar socio' : 'Nuevo socio'}</h2>
        <div className={fila}>
          <label className={etiquetaF}>
            Nombre y apellido
            <input className={campoF} autoFocus {...register('nombre')} />
            {errors.nombre && <span className="text-sm text-[var(--bad)]" role="alert">{errors.nombre.message}</span>}
          </label>
          <label className={etiquetaF}>N° de socio<input className={campoF + mono} {...register('nro')} /></label>
        </div>
        <label className={etiquetaF}>Celular<input className={campoF} inputMode="tel" placeholder="Ej: 3544 551122 (sin 0, sin 15, sin +54)" {...register('tel')} /></label>
        <label className={etiquetaF}>Dirección<input className={campoF} {...register('dir')} /></label>
        {id ? (
          <>
            <details className="mb-3 mt-1 text-[13px] text-[var(--mu)]" open={Boolean(errors.favor) || undefined}>
              <summary className="mb-2 cursor-pointer">Corregir saldo a favor a mano</summary>
              <label className={etiquetaF}>Saldo a favor<input className={campoF + ' font-semibold'} inputMode="decimal" {...register('favor')} /></label>
              {errors.favor && <p className="mt-2 text-sm text-[var(--bad)]" role="alert">{errors.favor.message}</p>}
            </details>
            <div className={opcionesF}><label className={opcionF}><input type="checkbox" {...register('archivado')} />Archivar (ya no es socio)</label></div>
          </>
        ) : <p className={notaF}>Después de guardarlo, desde su ficha le agregás seguros, Quini 6, lotería, quiniela o rifa.</p>}
      </div>
      <div className={pie}>
        {id ? <button type="button" className={btnMdD} onClick={formulario.eliminar}>Eliminar</button> : <span />}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnMd} onClick={formulario.cerrar}>Cancelar</button>
          <button type="submit" className={btnMdP}>Guardar</button>
        </div>
      </div>
    </form>
  );
}

function DialogoSocio({ id }: { id: string | undefined }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const formulario = useSocioFormulario(id);
  const { operacion } = formulario;
  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  return (
    <dialog ref={dialogo} aria-labelledby="titulo-edicion-socio" id="socio-dialog"
      className={marco}
      onCancel={(event) => { event.preventDefault(); if (!operacion.bloqueado) formulario.cerrar(); }}
      onClick={(event) => {
        if (!operacion.bloqueado && event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) formulario.cerrar();
        }
      }}>
      <div className={errores}>
        {formulario.errorCarga && <p role="alert" className="text-sm text-[var(--bad)]">{formulario.errorCarga}</p>}
        {formulario.cargaFallida && <button type="button" className={btnMd} onClick={formulario.reintentarCarga}>Reintentar consulta</button>}
        {operacion.error && <p role="alert" className="text-sm text-[var(--bad)]">{operacion.error}</p>}
        {operacion.bloqueado && !operacion.procesando && <button type="button" className={btnMd} onClick={() => void operacion.enviar()}>Reintentar operación</button>}
      </div>
      {formulario.inicial
        ? <CamposSocio id={id} inicial={formulario.inicial} formulario={formulario} />
        : <form onSubmit={(event) => event.preventDefault()}>
          <div className={cuerpo}><p role="status" id="titulo-edicion-socio" className="text-[var(--mu)]">{formulario.cargaFallida ? 'No se pudo cargar el socio.' : 'Cargando…'}</p></div>
          <div className={pie}><span /><div className="flex flex-wrap gap-2"><button type="button" className={btnMd} onClick={formulario.cerrar}>Cancelar</button></div></div>
        </form>}
    </dialog>
  );
}

export function SocioDialog() {
  const abierto = useDialogo('socio');
  return abierto && <DialogoSocio key={abierto.id ?? 'nuevo'} id={abierto.id} />;
}
