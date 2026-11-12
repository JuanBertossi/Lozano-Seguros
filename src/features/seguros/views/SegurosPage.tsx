import * as e from '../../../shared/lib/estilosJuegos';
import { useSeguros } from '../hooks/useSeguros';

const tono = { malo: e.etiquetaMala, aviso: e.etiquetaAviso, '': e.etiqueta } as const;

export function SegurosPage() {
  const v = useSeguros();
  if (!v.visible) return null;
  if (v.cargando) return <section aria-live="polite">{v.error || 'Cargando seguros…'}</section>;
  return (
    <section aria-labelledby="titulo-seguros">
      <div className={e.cabecera}>
        <div><h1 id="titulo-seguros" className={e.titulo}>Seguros</h1><div className={e.subtitulo}>Para registrar un pago tocá “Cobrar”: elegís el día y el medio.</div></div>
        <button className={e.btnP} onClick={v.nuevo}>+ Seguro</button>
      </div>
      <div className={`${e.seg} mb-3`} role="group" aria-label="Filtrar seguros">
        {([['todos','Todos'],['deben','Con cuotas atrasadas'],['vencen','Vencen en 30 días']] as const).map(([id,nombre]) => (
          <button key={id} type="button" aria-pressed={v.filtro===id} className={e.segItem(v.filtro===id)} onClick={() => v.filtrar(id)}>{nombre}</button>
        ))}
      </div>
      <div className={`${e.tarjeta} overflow-x-auto`}>
        {v.seguros.length ? <table className={e.tabla}>
          <thead><tr><th className={e.th}>Socio</th><th className={e.th}>Ingreso</th><th className={e.th}>Vencimiento</th><th className={e.th}>Descripción</th><th className={e.th}>Forma de pago</th><th className={e.thD}>Valor</th><th className={e.th}>Cuotas</th><th className={e.th}>Pago</th><th className={e.th}></th></tr></thead>
          <tbody>{v.seguros.map((seguro)=>(
            <tr key={seguro.id} className={`${e.clicable} ${seguro.etiquetaCobro ? seguro.vencido ? e.filaMala : e.filaNormal : e.filaOk}`} onClick={()=>v.editar(seguro.id)}>
              <td className={e.td}>{seguro.socio}</td><td className={e.td}>{seguro.ingreso}</td>
              <td className={e.td}><span className={tono[seguro.tono]}>{seguro.vencimiento}</span></td>
              <td className={e.td}>{seguro.descripcion}{seguro.autor && <><br /><span className={e.autor}>{seguro.autor}</span></>}</td>
              <td className={e.td}>{seguro.plan}</td><td className={e.tdD}>{seguro.valor}</td>
              <td className={e.td}><div className={e.cuotas}>{seguro.cuotas.map((cuota,indice)=>(
                <button key={indice} type="button" title={cuota.titulo} className={e.cuota(cuota.pagada,cuota.vencida)} onClick={(event)=>{event.stopPropagation();v.cuota(seguro.id,indice);}}>{cuota.numero}</button>
              ))}</div></td>
              <td className={e.td}>{seguro.etiquetaCobro?<button className={e.cobrar} onClick={(event)=>{event.stopPropagation();if(seguro.primeraPendiente!==null)v.cobrar(seguro.sid,seguro.id,seguro.primeraPendiente);}}>{seguro.etiquetaCobro}</button>:<span className={e.pagado}>✓ Pagado</span>}</td>
              <td className={e.td}><button className={e.btnSmG} onClick={(event)=>{event.stopPropagation();v.editar(seguro.id);}}>Editar</button></td>
            </tr>
          ))}</tbody>
        </table>:<div className={e.vacio}>No hay seguros en esta lista.</div>}
      </div>
    </section>
  );
}
