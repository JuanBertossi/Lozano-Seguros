import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { ajustesSchema, type AjustesInput } from '../ajustes.schema';
import { useAjustesPagina } from '../hooks/useAjustesPagina';
import { dias, semana } from '../lib/ajustesVista';
import {
  avatar, boton, cabecera, campo, campoDinero, dosColumnas, entradaOpcion, etiqueta, fila2, lista, margenNativo, opcion, opciones,
  rotulo, rotuloSuelto, subtitulo, tarjeta, tarjetaCabecera, titulo, titulo2,
} from '../../../shared/lib/clases';

const error = 'text-[13px] text-[var(--bad)]';
const textoChico = 'text-[13px] text-[var(--mu)]';
// Tabla de días (`table.tdias`): celdas de 6px 8px; el centrado va en cada celda.
const tablaDias = 'w-full border-collapse text-[15px] [&_th]:border-b [&_th]:border-solid [&_th]:border-[var(--ln)] [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-[13px] [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-[var(--mu)] [&_td]:border-b [&_td]:border-solid [&_td]:border-[var(--ln2)] [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-middle';

export function AjustesPage() {
  const visible = useNavegacion((estado) => estado.pagina === 'ajustes');
  return visible && <Contenido />;
}

function Contenido() {
  const a = useAjustesPagina();
  if (!a.config || !a.perfil) return <section aria-live="polite" className={tarjeta}>{a.error || 'Cargando Ajustes…'}</section>;
  const { configuracion, reinicio, restauracion, anio } = a;
  const trabajando = restauracion.bloqueado || reinicio.bloqueado || configuracion.bloqueado;
  return (
    <section aria-labelledby="titulo-ajustes">
      {configuracion.error && <p role="alert" className={error}>{configuracion.error}</p>}
      {configuracion.bloqueado && <button className={boton()} disabled={configuracion.procesando} onClick={() => void configuracion.enviar()}>Reintentar operación</button>}
      {reinicio.error && <p role="alert" className={error}>{reinicio.error}</p>}
      {reinicio.bloqueado && <button className={boton()} disabled={reinicio.procesando} onClick={() => void reinicio.enviar()}>Reintentar reinicio</button>}
      {restauracion.error && <p role="alert" className={error}>{restauracion.error}</p>}
      {restauracion.bloqueado && <button className={boton()} disabled={restauracion.procesando} onClick={() => void restauracion.enviar()}>Reintentar restauración</button>}
      <div inert={restauracion.bloqueado}>
        <header className={cabecera}>
          <div>
            <h1 id="titulo-ajustes" className={titulo}>Ajustes</h1>
            <div className={subtitulo}>Precios y sorteos. Lo que cambies acá se usa en las ventas nuevas; lo ya cargado no se toca.</div>
          </div>
        </header>
        <div className={dosColumnas}>
          <fieldset disabled={configuracion.bloqueado} className="contents"><Precios key={JSON.stringify(a.config)} inicial={a.config} guardar={a.guardarPrecios} /></fieldset>
          <div className={tarjeta}>
            <div className={tarjetaCabecera}>
              <h2 className={titulo2}>Sorteos de lotería</h2>
              <div className="flex flex-wrap gap-2">
                <button className={boton('normal', 'sm')} disabled={anio.bloqueado} onClick={a.agregarAnio}>+ Los 3 Gordos del año que viene</button>
                <button className={boton('normal', 'sm')} onClick={() => a.abrirSorteo()}>+ Sorteo</button>
              </div>
            </div>
            {anio.error && <p role="alert" className={error}>{anio.error}</p>}
            {anio.bloqueado && <button className={boton()} disabled={anio.procesando} onClick={() => void anio.enviar()}>Reintentar operación</button>}
            <div className={lista}>
              {a.sorteos.map((sorteo) => (
                <div key={sorteo.id}>
                  <span>{sorteo.nombre}<br /><span className={textoChico}>{sorteo.resumen}</span></span>
                  <button className={boton('fantasma', 'sm')} onClick={() => a.abrirSorteo(sorteo.id)}>Editar</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <fieldset disabled={configuracion.bloqueado} className="contents"><CalendarioToto key={JSON.stringify(a.juegos)} juegos={a.juegos} iniciales={a.diasToto} guardar={a.guardarDias} restablecer={a.restablecerDias} /></fieldset>
        <div className={tarjeta}>
          <div className={tarjetaCabecera}>
            <div><h2 className={titulo2}>Usuarios</h2><div className={textoChico}>Las cuentas se habilitan desde Supabase Auth.</div></div>
            <div className="flex flex-wrap gap-2"><button className={boton('fantasma', 'sm')} disabled={a.sesionBloqueada} onClick={a.salir}>Cerrar sesión</button></div>
          </div>
          <div className={lista}>
            {a.usuarios.map((usuario) => (
              <div key={usuario.id}>
                <span>
                  <span className={avatar(true)}>{usuario.nombre[0]?.toUpperCase()}</span> {usuario.nombre} <span className={etiqueta()}>{usuario.rol.charAt(0).toUpperCase() + usuario.rol.slice(1)}</span>
                  {usuario.id === a.perfil?.id && <> <span className={etiqueta('ok')}>Vos</span></>}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={tarjeta}>
          <h2 className={`${titulo2} mb-2`}>Respaldo</h2>
          <p className={`${textoChico} mb-2.5`}>Descargá una copia de los datos guardados en Supabase.</p>
          <div className="flex flex-wrap gap-2">
            <button className={boton()} disabled={a.descarga.isPending} onClick={a.descargar}>Descargar respaldo</button>
            {a.esAdministrador && <>
              <label className={`${boton()} focus-within:outline-2 focus-within:outline-[var(--ac)]`}>Cargar respaldo
                <input className="sr-only" type="file" accept=".json,application/json" disabled={trabajando} onChange={(event) => {
                  const archivo = event.target.files?.[0];
                  if (archivo) void a.restaurar(archivo);
                  event.target.value = '';
                }} />
              </label>
              <button className={boton('peligro')} disabled={reinicio.bloqueado || configuracion.bloqueado} onClick={a.borrarTodo}>Borrar todo</button>
            </>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Precios({ inicial, guardar }: { inicial: AjustesInput; guardar: (datos: AjustesInput) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<AjustesInput>({
    resolver: zodResolver(ajustesSchema),
    defaultValues: inicial,
  });

  return (
    <form className={tarjeta} onSubmit={handleSubmit(guardar)}>
      <h2 className={`${titulo2} mb-3`}>Precios</h2>
      <label className={rotulo}>Tu nombre<input className={campo} {...register('nombre')} /></label>
      <div className={fila2}>
        <label className={rotulo}>Quini 6 · precio por jugada<input className={campoDinero} inputMode="decimal" {...register('q6Precio')} /></label>
        <label className={rotulo}>Lotería · precio por fracción<input className={campoDinero} inputMode="decimal" {...register('fracPrecio')} /></label>
      </div>
      <span className={rotuloSuelto}>Días de sorteo del Quini 6</span>
      <div className={opciones}>
        {semana.map((dia) => <label key={dia} className={opcion}><input type="checkbox" className={entradaOpcion} value={String(dia)} {...register('q6Dias')} />{dias[dia].slice(0, 3).toLowerCase()}</label>)}
      </div>
      <div className={fila2}>
        <label className={rotulo}>Rifa Devoto · importe<input className={campoDinero} inputMode="decimal" {...register('rifaImporte')} /></label>
        <label className={rotulo}>Rifa · cantidad de cuotas<input className={campoDinero} type="number" min="1" {...register('rifaCuotas')} /></label>
      </div>
      <span className={rotuloSuelto}>WhatsApp en la compu (Mac o Windows)</span>
      <div className={opciones}>
        <label className={opcion}><input type="radio" className={entradaOpcion} value="app" {...register('wsp')} />App de WhatsApp</label>
        <label className={opcion}><input type="radio" className={entradaOpcion} value="web" {...register('wsp')} />WhatsApp Web</label>
      </div>
      {Object.values(errors).map((fallo, indice) => <p key={indice} role="alert" className={`${error} mb-2`}>{fallo.message}</p>)}
      <button type="submit" className={boton('primario')}>Guardar</button>
    </form>
  );
}

type PropsCalendario = {
  juegos: { id: string; nombre: string }[];
  iniciales: Record<string, string[]>;
  guardar: (dias: Record<string, string[]>) => void;
  restablecer: () => void;
};

function CalendarioToto({ juegos, iniciales, guardar, restablecer }: PropsCalendario) {
  const { register, handleSubmit } = useForm<Record<string, string[]>>({ defaultValues: iniciales });

  return (
    <form className={tarjeta} onSubmit={handleSubmit(guardar)}>
      <div className={tarjetaCabecera}>
        <div>
          <h2 className={titulo2}>Toto Ortega · días de sorteo</h2>
          <div className={textoChico}>Los días en que cada juego cambia su N° de concurso. Solo afecta a la planilla de Toto Ortega.</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className={tablaDias}>
          <thead><tr><th className="text-left">Juego</th>{semana.map((dia) => <th key={dia} scope="col" className="text-center">{dias[dia].slice(0, 3).toLowerCase()}</th>)}</tr></thead>
          <tbody>{juegos.map((juego) => (
            <tr key={juego.id}>
              <td>{juego.nombre}</td>
              {semana.map((dia) => <td key={dia} className="text-center"><input className={`size-[18px] cursor-pointer accent-[var(--ac)] ${margenNativo}`} type="checkbox" value={String(dia)} aria-label={juego.nombre + ' ' + dias[dia]} {...register(juego.id)} /></td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className={boton('primario')}>Guardar días</button>
        <button type="button" className={boton('fantasma')} onClick={restablecer}>Volver a lo de siempre</button>
      </div>
    </form>
  );
}
