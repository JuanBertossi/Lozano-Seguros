import { useState } from 'react';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';

interface Actividad {
  id: string;
  usuarioId: string;
  nombre: string;
  fecha: string;
  hora: string;
  accion: string;
  tipo: string;
  detalle: string;
}

interface DatosActividad {
  usuarios: { id: string; nombre: string }[];
  movimientos: Actividad[];
}

export function ActividadPage() {
  const datos = usePanelEvent<DatosActividad>('agencia:actividad');
  return datos && <Historial datos={datos} />;
}

function Historial({ datos }: { datos: DatosActividad }) {
  const [usuario, setUsuario] = useState('todos');
  const movimientos = datos.movimientos.filter((item) => usuario === 'todos' || item.usuarioId === usuario).slice(0, 400);

  return (
    <section aria-labelledby="titulo-actividad">
      <header className="mb-[18px]">
        <h1 id="titulo-actividad" className="text-2xl font-semibold">Actividad</h1>
        <p className="mt-[3px] text-sm text-[var(--mu)]">Quién hizo cada cosa, con fecha y hora de Argentina.</p>
      </header>
      <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-[var(--sf2)] p-1" role="group" aria-label="Filtrar actividad por usuario">
        {[{ id: 'todos', nombre: 'Todos' }, ...datos.usuarios].map((item) => (
          <button key={item.id} type="button" aria-pressed={usuario === item.id}
            className={`cursor-pointer rounded-md border-0 px-3 py-2 text-sm font-medium ${usuario === item.id ? 'bg-[var(--sf)] text-[var(--ink)] shadow-sm' : 'bg-transparent text-[var(--mu)] hover:text-[var(--ink)]'}`}
            onClick={() => setUsuario(item.id)}>{item.nombre}</button>
        ))}
      </div>
      <div className="mb-4 overflow-x-auto rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-5 py-[18px]">
        {movimientos.length ? (
          <table className="w-full border-collapse text-[15px] [&_td]:border-b [&_td]:border-solid [&_td]:border-[var(--ln2)] [&_td]:px-2 [&_td]:py-2.5 [&_th]:px-2 [&_th]:py-[7px] [&_th]:text-left [&_th]:text-[13px] [&_th]:font-medium [&_th]:text-[var(--mu)]">
            <thead><tr><th>Fecha</th><th>Hora</th><th>Usuario</th><th>Acción</th><th>Qué</th></tr></thead>
            <tbody>{movimientos.map((item) => (
              <tr key={item.id}>
                <td className="whitespace-nowrap">{item.fecha}</td>
                <td className="text-[var(--mu)]">{item.hora}</td>
                <td><span className="mr-1 inline-grid size-[22px] place-items-center rounded-full bg-[var(--ac-s)] text-[11px] font-semibold text-[var(--ac)]">{(item.nombre || '?')[0].toUpperCase()}</span>{item.nombre || '—'}</td>
                <td><span className="rounded-full bg-[var(--sf2)] px-2 py-0.5 text-xs font-medium text-[var(--mu)]">{item.accion}</span></td>
                <td><span className="text-[13px] text-[var(--mu)]">{item.tipo}</span><br />{item.detalle}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="px-1 py-3.5 text-sm text-[var(--mu)]">Todavía no hay actividad registrada.</p>}
      </div>
    </section>
  );
}
