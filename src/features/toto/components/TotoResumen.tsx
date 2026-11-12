import type { ListadoPresentado } from '../lib/totoVista';

interface Props {
  datos: ListadoPresentado & { porcentaje: number };
  bajo: string;
}

// Misma tarjeta que `.kpi` de la maqueta: el número se achica con el ancho de la propia tarjeta (cqi) y a ≤820 px cambia el rango.
const kpiBase = 'min-w-0 rounded-[14px] border border-solid px-4 py-3.5 [container-type:inline-size]';
const kpiNormal = `${kpiBase} border-[var(--ln)] bg-[var(--sf)]`;
const kpiMala = `${kpiBase} border-[#F1C7C3] bg-[var(--bad-row)]`;
const titulo = 'block overflow-hidden text-[13px] text-ellipsis whitespace-nowrap text-[var(--mu)]';
const cifra = 'mt-0.5 block overflow-hidden text-[clamp(15px,10.5cqi,22px)] leading-[1.2] font-bold tracking-[-.01em] whitespace-nowrap max-[820px]:text-[clamp(14px,10cqi,18px)]';
const nota = 'mt-0.5 block text-[13px] text-[var(--mu)]';
const grilla = 'mb-4 grid gap-3';

export function TotoResumen({ datos, bajo }: Props) {
  const contra = datos.signoGral < 0;
  return (
    <>
      <div className={grilla} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {datos.resumen.map(([nombre, monto, notaTexto], i) => (
          <div key={nombre} className={i === 4 && contra ? kpiMala : kpiNormal}>
            <small className={titulo}>{nombre}</small>
            <b className={`${cifra} ${i === 4 ? (contra ? 'text-[var(--bad)]' : 'text-[var(--ok)]') : ''}`}>{monto}</b>
            {i === 4 && <span className={nota}>{notaTexto}</span>}
          </div>
        ))}
      </div>
      <div className={grilla} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        <div className={kpiNormal}><small className={titulo}>Me pagó · {bajo}</small><b className={`${cifra} text-[var(--ok)]`}>{datos.pagado}</b></div>
        <div className={datos.hayDeuda ? kpiMala : kpiNormal}>
          <small className={titulo}>Me debe · {bajo}</small>
          <b className={`${cifra} ${datos.hayDeuda ? 'text-[var(--bad)]' : ''}`}>{datos.deuda}</b>
          <span className={nota}>{datos.hayDeuda ? `Del total − ${datos.porcentaje}%, lo que le falta pagar` : 'Al día'}</span>
        </div>
      </div>
    </>
  );
}
