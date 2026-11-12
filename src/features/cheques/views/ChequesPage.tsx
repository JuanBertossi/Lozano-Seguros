import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useCheques } from '../hooks/useCheques';
import { estadosCheque, type EstadoCheque } from '../lib/chequesVista';
import { boton, cabecera, campo, etiqueta, fila2, nota, rotulo, tabla, tarjeta, titulo, vacio } from '../../../shared/lib/clases';

export function ChequesPage() {
  const pagina = useNavegacion((estado) => estado.pagina);
  return pagina === 'cheques' ? <Historial /> : null;
}

function Historial() {
  const { filtro, listado, operacion, actualizar, cheques } = useCheques();

  if (!listado.data) {
    return (
      <section aria-live="polite">
        {listado.error instanceof Error ? listado.error.message : 'Cargando cheques…'}
        {listado.isError && <button type="button" className={boton()} onClick={() => void listado.refetch()}>Reintentar</button>}
      </section>
    );
  }
  return (
    <section aria-labelledby="titulo-cheques">
      <header className={cabecera}>
        <div>
          <h1 id="titulo-cheques" className={titulo}>Cheques y e-cheq</h1>
          <p className="text-[var(--mu)]">Buscá por número o banco para saber quién entregó cada cheque.</p>
        </div>
      </header>
      <div className={tarjeta}>
        {operacion.error && <p role="alert" className="text-[13px] text-[var(--bad)]">{operacion.error}</p>}
        {operacion.bloqueado && !operacion.procesando && <button type="button" className={boton()} onClick={() => void operacion.enviar()}>Reintentar operación</button>}
        <div className={fila2}>
          <label className={rotulo}>
            Número
            <input className={campo} placeholder="Número de cheque" {...filtro.register('numero')} />
          </label>
          <label className={rotulo}>
            Banco
            <input className={campo} placeholder="Banco" {...filtro.register('banco')} />
          </label>
        </div>
        {cheques.length ? (
          <div className="overflow-x-auto">
            <table className={tabla}>
              <thead><tr>{['Número', 'Banco', 'Entregado por', 'Tipo', 'Recibido', 'Importe', 'Estado'].map((titulo) => <th key={titulo} scope="col">{titulo}</th>)}</tr></thead>
              <tbody>
                {cheques.map((cheque) => (
                  <tr key={cheque.id}>
                    <td>{cheque.numero || 'Sin registrar'}</td>
                    <td>{cheque.banco || 'Sin registrar'}</td>
                    <td>{cheque.socio}</td>
                    <td>{cheque.medio}</td>
                    <td>{cheque.fecha}</td>
                    <td>{cheque.monto}</td>
                    <td>
                      {cheque.anulado ? (
                        <span className={etiqueta(cheque.rechazoAplicado ? 'mala' : 'neutra')}>
                          {cheque.rechazoAplicado ? 'Rechazado · cobro revertido' : 'Cobro anulado'}
                        </span>
                      ) : (
                        <>
                          <label className={rotulo}>
                            <span className="text-[13px] text-[var(--mu)]">Estado del cheque</span>
                            <select className={campo} aria-label={`Estado del cheque ${cheque.numero || 'sin número'}`} value={cheque.estado}
                              disabled={operacion.bloqueado} onChange={(event) => actualizar(cheque, event.target.value as EstadoCheque)}>
                              {Object.entries(estadosCheque).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                            </select>
                          </label>
                          {cheque.estado === 'rechazado' && <button type="button" className={boton('normal', 'sm')} disabled={operacion.bloqueado} onClick={() => actualizar(cheque, 'rechazado')}>Revertir cobro rechazado</button>}
                          {cheque.depositado && <span className={etiqueta()}>Depositado</span>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className={vacio}>No se encontraron cheques.</div>}
      </div>
      <p className={nota}>Al marcar un cheque como rechazado, se revierte su cobro y los conceptos vuelven a quedar pendientes. Si el socio paga de otra forma, registrá un nuevo cobro. El cheque rechazado permanece en el historial.</p>
    </section>
  );
}
