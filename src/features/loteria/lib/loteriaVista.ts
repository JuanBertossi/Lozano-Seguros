import { fechaLarga } from '../../../shared/lib/fechas';
import type { FiltroPago } from '../../../shared/stores/navegacion.store';
import type { ListadoLoteria } from '../api/loteria.service';
import { moneda } from '../../../shared/lib/moneda';

export interface FilaLoteria {
  id: string; sid: string; socio: string; numero: string; fracciones: string; autor: string;
  importe: string; pagado: boolean; abono: string; restante: string;
}

export interface VistaLoteria {
  fecha: string; distancia: string; fracciones: number; precio: string; entero: string;
  cantidad: number; fraccionesVendidas: number; cobrado: string; falta: string; deuda: boolean; fijosPend: number;
  filas: FilaLoteria[]; sinOf: { id: string; nombre: string }[]; noQ: { id: string; nombre: string }[];
}

const fechaAutor = (marca?: string) => (marca ? ' ' + marca.slice(0, 10).split('-').reverse().join('/') : '');

/** Lo que la maqueta calculaba en `publicarLoteria`, ahora a partir de lo que devuelve el servidor. */
export function vistaLoteria(datos: ListadoLoteria, filtro: FiltroPago): VistaLoteria {
  return {
    fecha: fechaLarga(datos.sorteo.fecha),
    distancia: datos.dias > 0 ? `faltan ${datos.dias} días` : datos.dias === 0 ? 'hoy' : 'ya se sorteó',
    fracciones: datos.sorteo.frac,
    precio: moneda(datos.sorteo.precio),
    entero: moneda(datos.importeEntero),
    cantidad: datos.cantidad,
    fraccionesVendidas: datos.fraccionesVendidas,
    cobrado: moneda(datos.cobrado),
    falta: moneda(datos.falta),
    deuda: datos.falta > 0,
    fijosPend: datos.fijosPend,
    sinOf: datos.sinOf,
    noQ: datos.noQ,
    filas: datos.filas
      .filter(({ venta }) => filtro === 'todos' || (filtro === 'pagados' ? venta.pagado : !venta.pagado))
      .map(({ venta, socio, nombreAutor, nombreEditor, importe, restante }) => ({
        id: venta.id,
        sid: venta.sid,
        socio,
        numero: String(venta.numero),
        fracciones: venta.frac >= datos.sorteo.frac ? 'Entero' : `${venta.frac} de ${datos.sorteo.frac}`,
        autor: [
          venta.por === 'auto' ? 'Automático' : venta.por ? `Cargó ${nombreAutor}` : '',
          venta.modPor && venta.modPor !== venta.por ? `editó ${nombreEditor}${fechaAutor(venta.modTs)}` : '',
        ].filter(Boolean).join(' · ') || '—',
        importe: moneda(importe),
        pagado: venta.pagado,
        abono: venta.abono ? moneda(venta.abono) : '',
        restante: moneda(restante),
      })),
  };
}
