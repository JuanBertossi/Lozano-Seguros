import type { PeriodoToto } from '../api/toto.service';
import type { PeriodoElegido } from '../lib/totoVista';
import { boton, botonSegmento, enlace, segmento, tarjeta } from '../../../shared/lib/clases';

interface Props {
  periodo: PeriodoElegido;
  subtitulo: string;
  irHoy: boolean;
  anteriorDeshabilitado: boolean;
  siguienteDeshabilitado: boolean;
  onIr: (direccion: number) => void;
  onHoy: () => void;
  onCambiar: (vista: PeriodoToto) => void;
}

const vistas = [['dia', 'Por día'], ['mes', 'Por mes'], ['todo', 'Todo']] as const;

export function TotoPeriodo({ periodo, subtitulo, irHoy, anteriorDeshabilitado, siguienteDeshabilitado, onIr, onHoy, onCambiar }: Props) {
  const unidad = periodo.vista === 'dia' ? 'Día' : 'Mes';
  return (
    <div className={`${tarjeta} flex flex-wrap items-center gap-2.5`}>
      <div className="flex items-center gap-2.5 max-[760px]:justify-center">
        {periodo.vista !== 'todo' && <button type="button" className={boton()} disabled={anteriorDeshabilitado} aria-label={`${unidad} anterior`} onClick={() => onIr(-1)}>‹</button>}
        <div className="max-w-[460px] min-w-[280px] flex-1 rounded-[10px] border border-solid border-[var(--ln)] bg-[var(--sf2)] px-3.5 py-[7px] text-center max-[760px]:min-w-0">
          <b className="block text-lg first-letter:uppercase">{periodo.titulo}</b>
          <span className="flex flex-wrap items-center justify-center gap-1.5 text-[13px] text-[var(--mu)]">{subtitulo}{irHoy && <> · <button type="button" className={enlace} onClick={onHoy}>Ir a hoy</button></>}</span>
        </div>
        {periodo.vista !== 'todo' && <button type="button" className={boton()} disabled={siguienteDeshabilitado} aria-label={`${unidad} siguiente`} onClick={() => onIr(1)}>›</button>}
      </div>
      <div className={`${segmento}`}>
        {vistas.map(([id, nombre]) => (
          <button key={id} type="button" className={botonSegmento(periodo.vista === id)} aria-pressed={periodo.vista === id} onClick={() => onCambiar(id)}>{nombre}</button>
        ))}
      </div>
    </div>
  );
}
