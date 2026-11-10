import { useState } from 'react';
import { usePanelEvent } from '../../../shared/hooks/usePanelEvent';

const estados = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' } as const;
type Estado = keyof typeof estados;

interface Cheque {
  id: string;
  numero: string;
  banco: string;
  socio: string;
  medio: string;
  fecha: string;
  monto: string;
  estado: Estado;
  anulado: boolean;
  rechazoAplicado: boolean;
  depositado: boolean;
}

interface VistaCheques {
  cheques: Cheque[];
  actualizar: (id: string, estado: Estado) => void;
}

const campo = 'rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[var(--ac)]';

export function ChequesPage() {
  const vista = usePanelEvent<VistaCheques>('agencia:cheques');
  return vista && <Historial vista={vista} />;
}

function Historial({ vista }: { vista: VistaCheques }) {
  const [numero, setNumero] = useState('');
  const [banco, setBanco] = useState('');
  const cheques = vista.cheques.filter((cheque) =>
    cheque.numero.toLowerCase().includes(numero.trim().toLowerCase()) &&
    cheque.banco.toLowerCase().includes(banco.trim().toLowerCase()),
  );

  return (
    <section aria-labelledby="titulo-cheques">
      <header className="mb-[18px]">
        <h1 id="titulo-cheques" className="text-2xl font-semibold">Cheques y e-cheq</h1>
        <p className="text-[var(--mu)]">Buscá por número o banco para saber quién entregó cada cheque.</p>
      </header>
      <div className="mb-4 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-5 py-[18px]">
        <div className="mb-3 grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
          <label className="grid gap-1 text-sm font-medium">
            Número
            <input className={campo} placeholder="Número de cheque" value={numero} onChange={(event) => setNumero(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Banco
            <input className={campo} placeholder="Banco" value={banco} onChange={(event) => setBanco(event.target.value)} />
          </label>
        </div>
        {cheques.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[15px] [&_td]:border-b [&_td]:border-solid [&_td]:border-[var(--ln2)] [&_td]:px-2 [&_td]:py-2.5 [&_th]:px-2 [&_th]:py-[7px] [&_th]:text-left [&_th]:text-[13px] [&_th]:text-[var(--mu)]">
              <thead><tr>{['Número', 'Banco', 'Entregado por', 'Tipo', 'Recibido', 'Importe', 'Estado'].map((titulo) => <th key={titulo} scope="col">{titulo}</th>)}</tr></thead>
              <tbody>
                {cheques.map((cheque) => (
                  <tr key={cheque.id}>
                    <td>{cheque.numero || 'Sin registrar'}</td>
                    <td>{cheque.banco || 'Sin registrar'}</td>
                    <td>{cheque.socio}</td>
                    <td>{cheque.medio}</td>
                    <td>{cheque.fecha}</td>
                    <td className="whitespace-nowrap">{cheque.monto}</td>
                    <td>
                      {cheque.anulado ? (
                        <span className={cheque.rechazoAplicado ? 'text-[var(--bad)]' : 'text-[var(--mu)]'}>
                          {cheque.rechazoAplicado ? 'Rechazado · cobro revertido' : 'Cobro anulado'}
                        </span>
                      ) : (
                        <div className="grid gap-1">
                          <label className="grid gap-1 text-[13px] text-[var(--mu)]">
                            Estado del cheque
                            <select className={campo} aria-label={`Estado del cheque ${cheque.numero || 'sin número'}`} value={cheque.estado}
                              onChange={(event) => vista.actualizar(cheque.id, event.target.value as Estado)}>
                              {Object.entries(estados).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                            </select>
                          </label>
                          {cheque.estado === 'rechazado' && <button type="button" className={campo + ' cursor-pointer hover:bg-[var(--sf2)]'} onClick={() => vista.actualizar(cheque.id, 'rechazado')}>Revertir cobro rechazado</button>}
                          {cheque.depositado && <span className="text-xs text-[var(--mu)]">Depositado</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-1 py-3.5 text-sm text-[var(--mu)]">No se encontraron cheques.</p>}
      </div>
      <p className="text-sm text-[var(--mu)]">Al marcar un cheque como rechazado, se revierte su cobro y los conceptos vuelven a quedar pendientes. Si el socio paga de otra forma, registrá un nuevo cobro. El cheque rechazado permanece en el historial.</p>
    </section>
  );
}
