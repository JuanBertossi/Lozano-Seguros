import type { CSSProperties } from 'react';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useListadoSociosPagina } from '../hooks/useListadoSociosPagina';
import { btnP, btnSmG, chip, mono, tabla, tag, td, tdR, tarjeta, th, thR, vacio } from '../components/estilos';

export function SociosPage() {
  const pagina = useNavegacion((estado) => estado.pagina);
  return pagina === 'socios' ? <ListadoSocios /> : null;
}

function ListadoSocios() {
  const vista = useListadoSociosPagina();
  const filas = vista.filas;

  if (!filas) return <section aria-live="polite">{vista.mensaje}{vista.hayError && <button type="button" onClick={vista.reintentar}>Reintentar</button>}</section>;

  return (
    <section aria-labelledby="titulo-socios">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 id="titulo-socios" className="m-0 text-2xl font-semibold tracking-[-.01em]">Socios</h1>
          <p className="mt-[3px] text-sm text-[var(--mu)]">{filas.filter((socio) => socio.activo).length} activos. Tocá uno para ver todo lo que tiene.</p>
        </div>
        <button className={btnP} onClick={() => vista.editar()}>+ Socio</button>
      </div>
      <div className={`${tarjeta} overflow-x-auto`}>
        {filas.length ? (
          <table className={tabla}>
            <thead><tr><th className={th}>N°</th><th className={th}>Socio</th><th className={th}>Teléfono</th><th className={th}>Tiene</th><th className={thR}>Saldo</th><th className={th} /></tr></thead>
            <tbody>
              {filas.map((socio) => (
                <tr key={socio.id} className={socio.activo ? undefined : 'opacity-[0.55]'} onClick={() => vista.abrir(socio.id)}>
                  <td className={`${td} ${mono}`}>{socio.numero}</td>
                  <td className={td}>
                    <button className="cursor-pointer border-0 bg-transparent p-0 hover:underline" onClick={(event) => {
                      event.stopPropagation();
                      vista.abrir(socio.id);
                    }}>{socio.nombre}</button>
                    {!socio.activo && <> <span className={tag}>archivado</span></>}
                  </td>
                  <td className={`${td} text-[var(--mu)]`}>{socio.telefono}</td>
                  <td className={td}>
                    {socio.productos.map((producto) => (
                      <span key={producto.clave} className={chip} style={{ '--producto': producto.color } as CSSProperties}>{producto.nombre}</span>
                    ))}
                  </td>
                  <td className={`${tdR} ${socio.deuda ? 'text-[var(--bad)]' : socio.saldo ? 'text-[var(--ok)]' : 'text-[var(--mu)]'}`}>{socio.saldo || '—'}</td>
                  <td className={td}><button className={btnSmG} onClick={(event) => {
                    event.stopPropagation();
                    vista.editar(socio.id);
                  }}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className={vacio}>Todavía no cargaste socios.</p>}
      </div>
    </section>
  );
}
