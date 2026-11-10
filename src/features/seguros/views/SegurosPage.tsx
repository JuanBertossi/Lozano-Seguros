import { useState } from 'react';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';

interface Cuota {
  numero: string;
  titulo: string;
  pagada: boolean;
  vencida: boolean;
}
interface Seguro {
  id: string;
  socio: string;
  ingreso: string;
  vencimiento: string;
  descripcion: string;
  plan: string;
  valor: string;
  vencido: boolean;
  vencePronto: boolean;
  cuotas: Cuota[];
  etiquetaCobro: string;
}
interface VistaSeguros {
  seguros: Seguro[];
  editar: (id?: string) => void;
  cuota: (id: string, indice: number) => void;
  cobrar: (id: string) => void;
}

export function SegurosPage() {
  const vista = usePanelEvent<VistaSeguros>('agencia:seguros');
  return vista && <Contenido vista={vista} />;
}

function Contenido({ vista }: { vista: VistaSeguros }) {
  const [filtro, setFiltro] = useState<'todos' | 'deben' | 'vencen'>('todos');
  const seguros = vista.seguros.filter((seguro) => filtro === 'todos' || (filtro === 'deben' ? seguro.vencido : seguro.vencePronto));
  const boton = 'cursor-pointer rounded-[9px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-2 text-sm font-medium hover:bg-[var(--sf2)]';
  return (
    <section aria-labelledby="titulo-seguros">
      <header className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div><h1 id="titulo-seguros" className="text-2xl font-semibold">Seguros</h1><p className="mt-1 text-sm text-[var(--mu)]">Para registrar un pago tocá “Cobrar”: elegís el día y el medio.</p></div>
        <button className="cursor-pointer rounded-[9px] border border-solid border-[var(--ac)] bg-[var(--ac)] px-3 py-2 text-sm font-medium text-white hover:brightness-110" onClick={() => vista.editar()}>+ Seguro</button>
      </header>
      <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-[var(--sf2)] p-1" role="group" aria-label="Filtrar seguros">
        {([['todos','Todos'],['deben','Con cuotas atrasadas'],['vencen','Vencen en 30 días']] as const).map(([id,nombre]) => (
          <button key={id} type="button" aria-pressed={filtro===id} className={`cursor-pointer rounded-md border-0 px-3 py-2 text-sm font-medium ${filtro===id?'bg-[var(--sf)] text-[var(--ink)] shadow-sm':'bg-transparent text-[var(--mu)]'}`} onClick={() => setFiltro(id)}>{nombre}</button>
        ))}
      </div>
      <div className="mb-4 overflow-x-auto rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-5 py-[18px]">
        {seguros.length ? <table className="w-full border-collapse text-[15px] [&_td]:border-b [&_td]:border-solid [&_td]:border-[var(--ln2)] [&_td]:px-2 [&_td]:py-2.5 [&_th]:px-2 [&_th]:py-[7px] [&_th]:text-left [&_th]:text-[13px] [&_th]:font-medium [&_th]:text-[var(--mu)]">
          <thead><tr>{['Socio','Ingreso','Vencimiento','Descripción','Forma de pago','Valor','Cuotas','Pago',''].map((x,i)=><th key={i}>{x}</th>)}</tr></thead>
          <tbody>{seguros.map((seguro)=>(
            <tr key={seguro.id} className={seguro.etiquetaCobro ? seguro.vencido ? 'bg-[var(--bad-row)]' : '' : 'bg-[var(--ok-row)]'} onClick={()=>vista.editar(seguro.id)}>
              <td>{seguro.socio}</td><td>{seguro.ingreso}</td><td>{seguro.vencimiento}</td><td>{seguro.descripcion}</td><td>{seguro.plan}</td><td className="whitespace-nowrap text-right font-semibold">{seguro.valor}</td>
              <td><div className="flex gap-[3px]">{seguro.cuotas.map((cuota,indice)=>(
                <button key={indice} type="button" title={cuota.titulo} className={`grid size-6 place-items-center rounded-md border border-solid text-[11px] font-semibold ${cuota.pagada?'border-[var(--ok)] bg-[var(--ok)] text-white':cuota.vencida?'border-[var(--bad)] bg-transparent text-[var(--bad)]':'border-[var(--ln)] bg-transparent text-[var(--mu)]'}`} onClick={(event)=>{event.stopPropagation();vista.cuota(seguro.id,indice);}}>{cuota.numero}</button>
              ))}</div></td>
              <td>{seguro.etiquetaCobro?<button className={boton} onClick={(event)=>{event.stopPropagation();vista.cobrar(seguro.id);}}>{seguro.etiquetaCobro}</button>:<span className="text-[var(--ok)]">✓ Pagado</span>}</td>
              <td><button className={boton} onClick={(event)=>{event.stopPropagation();vista.editar(seguro.id);}}>Editar</button></td>
            </tr>
          ))}</tbody>
        </table>:<p className="px-1 py-3.5 text-sm text-[var(--mu)]">No hay seguros en esta lista.</p>}
      </div>
    </section>
  );
}
