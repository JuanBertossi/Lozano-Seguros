import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useActividad } from '../hooks/useActividad';
import { avatar, boton, botonSegmento, cabecera, etiqueta, segmento, subtitulo, tabla, tarjeta, titulo, vacio } from '../../../shared/lib/clases';

// Color de cada acción (`ACOL` de la maqueta).
const colorAccion: Record<string, Parameters<typeof etiqueta>[0]> = {
  'Creó': 'ok', 'Cobró': 'ok', 'Modificó': 'aviso', 'Anuló pago': 'mala', 'Eliminó': 'mala',
};

export function ActividadPage() {
  const pagina = useNavegacion((estado) => estado.pagina);
  return pagina === 'actividad' ? <Historial /> : null;
}

function Historial() {
  const { consulta, usuario, elegirUsuario } = useActividad();
  const datos = consulta.data;
  if (!datos) {
    return (
      <section aria-live="polite">
        {consulta.error instanceof Error ? consulta.error.message : 'Cargando actividad…'}
        {consulta.isError && <button type="button" className={boton()} onClick={() => void consulta.refetch()}>Reintentar</button>}
      </section>
    );
  }
  const { movimientos } = datos;

  return (
    <section aria-labelledby="titulo-actividad">
      <header className={cabecera}>
        <div>
          <h1 id="titulo-actividad" className={titulo}>Actividad</h1>
          <div className={subtitulo}>Quién hizo cada cosa, con fecha y hora de Argentina.</div>
        </div>
      </header>
      <div className={`${segmento} mb-3`} role="group" aria-label="Filtrar actividad por usuario">
        {[{ id: 'todos', nombre: 'Todos' }, ...datos.usuarios].map((item) => (
          <button key={item.id} type="button" aria-pressed={usuario === item.id} className={botonSegmento(usuario === item.id)}
            onClick={() => elegirUsuario(item.id)}>{item.nombre}</button>
        ))}
      </div>
      <div className={`${tarjeta} overflow-x-auto`}>
        {movimientos.length ? (
          <table className={tabla}>
            <thead><tr><th>Fecha</th><th>Hora</th><th>Usuario</th><th>Acción</th><th>Qué</th></tr></thead>
            <tbody>{movimientos.map((item) => (
              <tr key={item.id}>
                <td className="whitespace-nowrap">{item.fecha}</td>
                <td className="text-[var(--mu)]">{item.hora}</td>
                <td><span className={avatar(true)}>{(item.nombre || '?')[0].toUpperCase()}</span> {item.nombre || '—'}</td>
                <td><span className={etiqueta(colorAccion[item.accion])}>{item.accion}</span></td>
                <td><span className="text-[13px] text-[var(--mu)]">{item.tipo}</span><br />{item.detalle}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <div className={vacio}>Todavía no hay actividad registrada.</div>}
      </div>
    </section>
  );
}
