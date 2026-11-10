import type { CSSProperties } from 'react';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';

interface FilaSocio {
  id: string;
  numero: string;
  nombre: string;
  telefono: string;
  activo: boolean;
  productos: { clave: string; nombre: string; color: string }[];
  saldo: string;
  deuda: boolean;
}

interface VistaSocios {
  filas: FilaSocio[];
  abrir: (id: string) => void;
  editar: (id?: string) => void;
}

export function SociosPage() {
  const vista = usePanelEvent<VistaSocios>('agencia:socios');

  if (!vista) return null;

  return (
    <section aria-labelledby="titulo-socios">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 id="titulo-socios" className="m-0 text-2xl font-semibold">Socios</h1>
          <p className="mt-[3px] text-sm text-[var(--mu)]">{vista.filas.filter((socio) => socio.activo).length} activos. Tocá uno para ver todo lo que tiene.</p>
        </div>
        <button className="cursor-pointer rounded-[9px] border border-solid border-[var(--ac)] bg-[var(--ac)] px-[13px] py-2 text-sm font-medium text-white hover:brightness-110" onClick={() => vista.editar()}>+ Socio</button>
      </div>
      <div className="mb-4 overflow-x-auto rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-5 py-[18px]">
        {vista.filas.length ? (
          <table className="w-full border-collapse text-[15px] [&_td]:border-b [&_td]:border-solid [&_td]:border-[var(--ln2)] [&_td]:px-2 [&_td]:py-2.5 [&_th]:border-b [&_th]:border-solid [&_th]:border-[var(--ln)] [&_th]:px-2 [&_th]:py-[7px] [&_th]:text-[13px] [&_th]:font-medium [&_th]:text-[var(--mu)]">
            <thead><tr><th>N°</th><th>Socio</th><th>Teléfono</th><th>Tiene</th><th className="text-right whitespace-nowrap">Saldo</th><th /></tr></thead>
            <tbody>
              {vista.filas.map((socio) => (
                <tr key={socio.id} className={socio.activo ? undefined : 'opacity-[0.55]'} onClick={() => vista.abrir(socio.id)}>
                  <td className="font-mono text-[1.08em] font-semibold tracking-[.02em]">{socio.numero}</td>
                  <td>
                    <button className="cursor-pointer border-0 bg-transparent p-0 hover:underline" onClick={(event) => {
                      event.stopPropagation();
                      vista.abrir(socio.id);
                    }}>{socio.nombre}</button>
                    {!socio.activo && <> <span className="inline-block rounded-full bg-[var(--sf2)] px-2 py-0.5 text-xs font-medium text-[var(--mu)]">archivado</span></>}
                  </td>
                  <td className="text-[var(--mu)]">{socio.telefono}</td>
                  <td>
                    {socio.productos.map((producto) => (
                      <span key={producto.clave} className="my-px mr-0.5 inline-flex items-center gap-[5px] rounded-md border border-solid border-[var(--ln)] px-2 py-0.5 text-xs font-medium before:size-[7px] before:rounded-[2px] before:bg-[var(--producto)] before:content-['']" style={{ '--producto': producto.color } as CSSProperties}>{producto.nombre}</span>
                    ))}
                  </td>
                  <td className={`text-right text-[16.5px] font-semibold whitespace-nowrap ${socio.deuda ? 'text-[var(--bad)]' : socio.saldo ? 'text-[var(--ok)]' : 'text-[var(--mu)]'}`}>{socio.saldo || '—'}</td>
                  <td><button className="cursor-pointer rounded-[9px] border border-solid border-transparent bg-transparent px-[9px] py-[5px] text-[13px] font-medium hover:bg-[var(--sf2)]" onClick={(event) => {
                    event.stopPropagation();
                    vista.editar(socio.id);
                  }}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="px-1 py-3.5 text-sm text-[var(--mu)]">Todavía no cargaste socios.</p>}
      </div>
    </section>
  );
}
