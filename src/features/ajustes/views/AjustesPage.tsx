import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';
import { ajustesSchema, type AjustesInput } from '../ajustes.schema';

const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const semana = [1, 2, 3, 4, 5, 6, 0];

interface VistaAjustes {
  config: AjustesInput;
  sorteos: { id: string; nombre: string; resumen: string }[];
  juegos: { id: string; nombre: string; dias: string[] }[];
  usuarios: { id: string; nombre: string; rol: string }[];
  perfil: { id: string; rol: string };
  guardar: (datos: AjustesInput) => void;
  guardarDias: (dias: Record<string, string[]>) => void;
  resetDias: () => void;
  agregarAnio: () => void;
  abrirSorteo: (id?: string) => void;
  descargar: () => void;
  restaurar: (file: File) => void;
  borrar: () => void;
  salir: () => void;
}

const card = 'mb-4 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-5 py-[18px]';
const boton = 'inline-flex cursor-pointer items-center rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-[13px] py-2 text-sm font-medium hover:bg-[var(--sf2)]';
const principal = 'inline-flex cursor-pointer items-center rounded-[9px] border border-solid border-[var(--ac)] bg-[var(--ac)] px-[13px] py-2 text-sm font-medium text-white hover:brightness-110';
const campo = 'min-w-0 rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--ac)]';
const etiqueta = 'grid gap-1 text-sm font-medium';

export function AjustesPage() {
  const vista = usePanelEvent<VistaAjustes>('agencia:ajustes');
  if (!vista) return null;
  return (
    <section aria-labelledby="titulo-ajustes">
      <header className="mb-[18px]">
        <h1 id="titulo-ajustes" className="text-2xl font-semibold">Ajustes</h1>
        <p className="mt-[3px] text-sm text-[var(--mu)]">Precios y sorteos. Lo que cambies acá se usa en las ventas nuevas; lo ya cargado no se toca.</p>
      </header>
      <div className="grid gap-4 min-[821px]:grid-cols-2">
        <Precios key={JSON.stringify(vista.config)} vista={vista} />
        <div className={card}>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <h2>Sorteos de lotería</h2>
            <div className="flex flex-wrap gap-2">
              <button className={boton} onClick={vista.agregarAnio}>+ Los 3 Gordos del año que viene</button>
              <button className={boton} onClick={() => vista.abrirSorteo()}>+ Sorteo</button>
            </div>
          </div>
          {vista.sorteos.map((sorteo) => (
            <div key={sorteo.id} className="flex items-center justify-between gap-2 border-b border-solid border-[var(--ln2)] py-2">
              <div>{sorteo.nombre}<div className="text-[13px] text-[var(--mu)]">{sorteo.resumen}</div></div>
              <button className={boton} onClick={() => vista.abrirSorteo(sorteo.id)}>Editar</button>
            </div>
          ))}
        </div>
      </div>
      <CalendarioToto key={JSON.stringify(vista.juegos)} vista={vista} />
      <div className={card}>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div><h2>Usuarios</h2><p className="text-[13px] text-[var(--mu)]">Las cuentas se habilitan desde Supabase Auth.</p></div>
          <button className={boton} onClick={vista.salir}>Cerrar sesión</button>
        </div>
        {vista.usuarios.map((usuario) => (
          <div key={usuario.id} className="flex flex-wrap items-center gap-2 border-b border-solid border-[var(--ln2)] py-2">
            <span className="grid size-7 place-items-center rounded-full bg-[var(--ac-s)] font-semibold text-[var(--ac)]">{usuario.nombre[0]?.toUpperCase()}</span>
            {usuario.nombre}
            <span className="rounded-full bg-[var(--sf2)] px-2 py-0.5 text-xs text-[var(--mu)]">{usuario.rol}</span>
            {usuario.id === vista.perfil.id && <span className="rounded-full bg-[var(--ac-s)] px-2 py-0.5 text-xs text-[var(--ac)]">Vos</span>}
          </div>
        ))}
      </div>
      <div className={card}>
        <h2>Respaldo</h2>
        <p className="mt-2 mb-2.5 text-[13px] text-[var(--mu)]">Descargá una copia de los datos guardados en Supabase.</p>
        <div className="flex flex-wrap gap-2">
          <button className={boton} onClick={vista.descargar}>Descargar respaldo</button>
          {vista.perfil.rol === 'administrador' && <>
            <label className={boton + ' focus-within:outline-2 focus-within:outline-[var(--ac)]'}>Cargar respaldo
              <input className="sr-only" type="file" accept=".json,application/json" onChange={(event) => {
                const archivo = event.target.files?.[0];
                if (archivo) vista.restaurar(archivo);
                event.target.value = '';
              }} />
            </label>
            <button className={boton + ' text-[var(--bad)]'} onClick={vista.borrar}>Borrar todo</button>
          </>}
        </div>
      </div>
    </section>
  );
}

function Precios({ vista }: { vista: VistaAjustes }) {
  const { register, handleSubmit, formState: { errors } } = useForm<AjustesInput>({
    resolver: zodResolver(ajustesSchema),
    defaultValues: vista.config,
  });

  return (
    <form className={card + ' grid gap-3'} onSubmit={handleSubmit(vista.guardar)}>
      <h2>Precios</h2>
      <label className={etiqueta}>Tu nombre<input className={campo} {...register('nombre')} /></label>
      <div className="grid gap-3 min-[560px]:grid-cols-2">
        <label className={etiqueta}>Quini 6 · precio por jugada<input className={campo} inputMode="decimal" {...register('q6Precio')} /></label>
        <label className={etiqueta}>Lotería · precio por fracción<input className={campo} inputMode="decimal" {...register('fracPrecio')} /></label>
      </div>
      <fieldset className="m-0 border-0 p-0">
        <legend className="text-sm font-medium">Días de sorteo del Quini 6</legend>
        <div className="flex flex-wrap gap-2">
          {semana.map((dia) => <label key={dia} className="flex items-center gap-1 text-sm"><input type="checkbox" value={String(dia)} className="accent-[var(--ac)]" {...register('q6Dias')} />{dias[dia].slice(0, 3)}</label>)}
        </div>
      </fieldset>
      <div className="grid gap-3 min-[560px]:grid-cols-2">
        <label className={etiqueta}>Rifa Devoto · importe<input className={campo} inputMode="decimal" {...register('rifaImporte')} /></label>
        <label className={etiqueta}>Rifa · cantidad de cuotas<input className={campo} type="number" min="1" {...register('rifaCuotas')} /></label>
      </div>
      <fieldset className="m-0 border-0 p-0">
        <legend className="text-sm font-medium">WhatsApp en la compu (Mac o Windows)</legend>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1 text-sm"><input className="accent-[var(--ac)]" type="radio" value="app" {...register('wsp')} />App de WhatsApp</label>
          <label className="flex items-center gap-1 text-sm"><input className="accent-[var(--ac)]" type="radio" value="web" {...register('wsp')} />WhatsApp Web</label>
        </div>
      </fieldset>
      {Object.values(errors).map((error, indice) => <p key={indice} role="alert" className="text-sm text-[var(--bad)]">{error.message}</p>)}
      <button type="submit" className={principal + ' justify-self-start'}>Guardar</button>
    </form>
  );
}

function CalendarioToto({ vista }: { vista: VistaAjustes }) {
  const { register, handleSubmit } = useForm<Record<string, string[]>>({
    defaultValues: Object.fromEntries(vista.juegos.map((juego) => [juego.id, juego.dias])),
  });

  return (
    <form className={card} onSubmit={handleSubmit(vista.guardarDias)}>
      <h2>Toto Ortega · días de sorteo</h2>
      <p className="text-[13px] text-[var(--mu)]">Los días en que cada juego cambia su N° de concurso. Solo afecta a la planilla de Toto Ortega.</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm [&_td]:px-2 [&_td]:py-1.5">
          <thead><tr><th>Juego</th>{semana.map((dia) => <th key={dia} scope="col" className="text-center">{dias[dia].slice(0, 3)}</th>)}</tr></thead>
          <tbody>{vista.juegos.map((juego) => (
            <tr key={juego.id}>
              <td>{juego.nombre}</td>
              {semana.map((dia) => <td key={dia} className="text-center"><input className="size-[18px] cursor-pointer accent-[var(--ac)]" type="checkbox" value={String(dia)} aria-label={juego.nombre + ' ' + dias[dia]} {...register(juego.id)} /></td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className={principal}>Guardar días</button>
        <button type="button" className={boton} onClick={vista.resetDias}>Volver a lo de siempre</button>
      </div>
    </form>
  );
}
