import type { PeriodoToto } from '../api/toto.service';
import { JUEGOS, type ListadoPresentado } from '../lib/totoVista';
import { boton, tarjeta, tarjetaCabecera, titulo2, vacioCentrado } from '../../../shared/lib/clases';

interface Props {
  datos: ListadoPresentado & { porcentaje: number };
  titulo: string;
  bajo: string;
  vista: PeriodoToto;
  bloqueado: boolean;
  onCargar: () => void;
  onEditar: (id: string) => void;
  onPdf: () => void;
  onMarcar: (id: string, pagado: boolean) => void;
  onParcial: (id: string) => void;
}

const leyenda = [['var(--ok)', 'Pagó todo'], ['var(--warn)', 'Pago parcial'], ['var(--bad)', 'No pagó']];
const VACIO = '—';
const sinDato = (texto: string) => (texto === VACIO ? <span className="text-[var(--mu)]">{VACIO}</span> : texto);
const signo = (n: number) => (n < 0 ? 'text-[var(--bad)]' : n > 0 ? 'text-[var(--ok)]' : '');

// Celdas (`td`, `th`, `td.r` y `tfoot td` de la maqueta). El color de fila se aplica desde el `tr` y gana por especificidad.
const th = 'border-b border-solid border-[var(--ln)] px-2 py-[7px] text-[13px] font-medium whitespace-nowrap text-[var(--mu)]';
const celda = 'border-b border-solid border-[var(--ln2)] px-2 py-2.5 align-middle';
const numero = `${celda} text-right text-[16.5px] font-semibold whitespace-nowrap max-[820px]:text-base`;
const pie = 'border-t-2 border-solid border-[var(--ln)] px-2 py-2.5 align-middle font-semibold';
const pieNumero = `${pie} text-right text-[16.5px] whitespace-nowrap max-[820px]:text-base`;
const fila = 'cursor-pointer [&>td]:border-b-2 [&>td]:border-[var(--sf)]';
const estados = {
  'r-ok': `${fila} [&>td]:bg-[var(--ok-row)] [&>td:first-child]:shadow-[inset_4px_0_0_var(--okb)] hover:[&>td]:bg-[#e2f2e9]`,
  'r-bad': `${fila} [&>td]:bg-[var(--bad-row)] [&>td:first-child]:shadow-[inset_4px_0_0_var(--badb)] hover:[&>td]:bg-[#fae3e1]`,
  'r-par': `${fila} [&>td]:bg-[color-mix(in_srgb,var(--warn-s)_60%,var(--sf))] [&>td:first-child]:shadow-[inset_4px_0_0_var(--warn)] hover:[&>td]:bg-[var(--sf2)]`,
} as const;

export function TotoTabla({ datos, titulo, bajo, vista, bloqueado, onCargar, onEditar, onPdf, onMarcar, onParcial }: Props) {
  const { filas, total, porcentaje } = datos;
  const encabezados = [...JUEGOS.map((j) => j.nombre), 'Total', `${porcentaje}%`, `Total − ${porcentaje}%`, 'Premios', 'Premios agencia (Ema)', 'Total general', 'Pagó', 'Debe'];
  return (
    <div className={tarjeta}>
      <div className={tarjetaCabecera}>
        <h2 className={titulo2}>{titulo}</h2>
        {filas.length > 0 && <button type="button" className={boton('normal', 'sm')} onClick={onPdf}>⬇ PDF</button>}
      </div>
      {filas.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr>
                  <th className={`${th} text-left`}>Fecha</th>
                  {encabezados.map((h) => <th key={h} className={`${th} text-right`}>{h}</th>)}
                  <th className={th} />
                  <th className={`${th} text-center`}>Pago</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className={estados[f.estado]} onClick={() => onEditar(f.id)}>
                    <td className={`${celda} whitespace-nowrap`}>{f.fecha}</td>
                    {f.valores.map((x, i) => (
                      <td key={i} className={numero}>
                        {sinDato(x.monto)}
                        {x.concurso && <span className="mt-px block font-mono text-[9.5px] leading-[1.1] font-normal text-[var(--mu)] opacity-80">N° {x.concurso}</span>}
                      </td>
                    ))}
                    <td className={numero}>{f.total}</td>
                    <td className={`${numero} text-[var(--mu)]`}>{f.com}</td>
                    <td className={numero}>{f.neto}</td>
                    <td className={numero}>{sinDato(f.prem)}</td>
                    <td className={`${numero} text-[var(--toto)]`}>{sinDato(f.premAg)}</td>
                    <td className={numero}><span className={signo(f.signoGral)}>{f.gral}</span></td>
                    <td className={numero}>{sinDato(f.pago)}{f.pagos > 1 && <><br /><span className="text-[13px] font-normal text-[var(--mu)]">{f.pagos} pagos</span></>}</td>
                    <td className={numero}>{f.signoDebe === 0 ? <span className="text-[var(--mu)]">{VACIO}</span> : <span className={signo(-f.signoDebe)}>{f.debe}</span>}</td>
                    <td className={numero}><button type="button" className={boton('fantasma', 'sm')} onClick={(e) => { e.stopPropagation(); onEditar(f.id); }}>Editar</button></td>
                    <td className={`${celda} whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <label className="inline-grid cursor-pointer place-items-center p-0" title={f.saldado ? 'Pagó todo' : 'Marcar como pagado completo'}>
                          <input type="checkbox" className="m-0 size-5 cursor-pointer accent-[var(--ok)]" checked={f.saldado} disabled={bloqueado} onChange={(e) => onMarcar(f.id, e.target.checked)} aria-label="Pagó todo" />
                        </label>
                        <button type="button" className={boton('parcial', 'sm')} onClick={() => onParcial(f.id)}>Parcial</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className={pie}>Total</td>
                  {total.valores.map((x, i) => <td key={i} className={pieNumero}>{x}</td>)}
                  {[total.total, total.com, total.neto, total.prem].map((x, i) => <td key={i} className={pieNumero}>{x}</td>)}
                  <td className={`${pieNumero} text-[var(--toto)]`}>{total.premAg}</td>
                  <td className={pieNumero}><span className={signo(total.signoGral)}>{total.gral}</span></td>
                  <td className={pie} /><td className={pie} /><td className={pie} />
                  <td className={`${pie} text-center text-[13px] text-[var(--mu)]`}>{datos.cantidadPagados}/{filas.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-2.5 flex gap-3.5 text-[12.5px] text-[var(--mu)]">
            {leyenda.map(([color, nombre]) => <span key={nombre}><i className="mr-[5px] inline-block size-2.5 rounded-[3px] align-[-1px]" style={{ background: color }} />{nombre}</span>)}
          </div>
        </>
      ) : (
        <div className={vacioCentrado}>
          <p className="mx-auto mb-3 max-w-[520px]">{vista === 'todo' ? 'Todavía no cargaste ningún día.' : vista === 'dia' ? `No hay nada cargado ${bajo}.` : `No hay días cargados en ${bajo}.`}</p>
          <button type="button" className={boton()} onClick={onCargar}>+ Cargar {vista === 'dia' ? 'este día' : 'día'}</button>
        </div>
      )}
    </div>
  );
}
