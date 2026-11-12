import { rpc } from '../../../shared/lib/supabase.service';
import type { LoteriaSocioListado } from '../../../shared/hooks/useNumeroFijo';

export interface SorteoLoteria { id: string; nombre: string; fecha: string; frac: number; precio: number }
export interface ListaSorteos { sorteos: SorteoLoteria[]; actual: string | null }
export interface SocioOpcion { id: string; nombre: string; nro: string }
export interface FormularioVenta {
  sorteos: SorteoLoteria[];
  socios: SocioOpcion[];
  venta: { id: string; pagado?: boolean } | null;
  inicial: { sid: string; soId: string; numero: string; frac: number } | null;
}
export interface ResultadoVenta { revision: number; id: string; liberado: number }
export interface SolicitudVenta { p_revision: number; p_operacion: string; p_id: string | null; p_datos: { sid: string; soId: string; numero: string; frac: number; fijo: boolean } }
export interface SolicitudEliminarVenta { p_revision: number; p_operacion: string; p_id: string }
export interface ResultadoEliminarVenta { revision: number; liberado: number }
export interface SolicitudPreviaVenta { p_revision: number; p_sorteo_id: string; p_fracciones: number; p_venta_id: string | null }
export interface PreviaVenta { precio: number; fracciones: number; entero: boolean; total: number }
export type AccionLoteria = { tipo: 'fijos'; sorteoId: string } | { tipo: 'oferta'; sorteoId: string; socioId: string; noQuiso: boolean };
export interface SolicitudAccionLoteria { p_revision: number; p_operacion: string; accion: AccionLoteria }
export interface ResultadoAccionLoteria { revision: number; cantidad?: number }
export interface VentaListado {
  venta: { id: string; sid: string; soId: string; numero: string; frac: number; precio: number; pagado: boolean; abono?: number; por?: string; modPor?: string; modTs?: string };
  socio: string; nombreAutor: string; nombreEditor: string; importe: number; restante: number;
}
export interface ListadoLoteria {
  sorteo: SorteoLoteria; dias: number; importeEntero: number; cantidad: number; fraccionesVendidas: number; cobrado: number; falta: number; cobradoFiltrado: number; faltaFiltrado: number; fijosPend: number;
  filas: VentaListado[]; sinOf: { id: string; nombre: string }[]; noQ: { id: string; nombre: string }[];
}

export const loteriaService = {
  sorteos: (revision: number) => rpc<ListaSorteos>('agencia_loteria_sorteos', { p_revision: revision }),
  formulario: (revision: number, ventaId: string | null, socioId: string | null, sorteoId: string | null) =>
    rpc<FormularioVenta>('agencia_loteria_formulario', { p_revision: revision, p_venta_id: ventaId, p_socio_id: socioId, p_sorteo_id: sorteoId }),
  fijosSocio: (revision: number, socioId: string) => rpc<LoteriaSocioListado>('agencia_loteria_socio_listar', { p_revision: revision, p_socio_id: socioId }),
  guardarVenta: (solicitud: SolicitudVenta) => rpc<ResultadoVenta>('agencia_loteria_venta', solicitud),
  eliminarVenta: (solicitud: SolicitudEliminarVenta) => rpc<ResultadoEliminarVenta>('agencia_loteria_eliminar_venta', solicitud),
  preverVenta: (solicitud: SolicitudPreviaVenta) => rpc<PreviaVenta>('agencia_loteria_prever', solicitud),
  listar: (revision: number, sorteoId: string, filtro: string) => rpc<ListadoLoteria>('agencia_loteria_listar', { p_revision: revision, p_sorteo_id: sorteoId, p_filtro: filtro }),
  ejecutar: async ({ p_revision, p_operacion, accion }: SolicitudAccionLoteria): Promise<ResultadoAccionLoteria> => {
    if (accion.tipo === 'fijos') return rpc<ResultadoAccionLoteria>('agencia_loteria_cargar_fijos', { p_revision, p_operacion, p_sorteo_id: accion.sorteoId });
    const revision = await rpc<number>('agencia_loteria_oferta', { p_revision, p_operacion, p_sorteo_id: accion.sorteoId, p_socio_id: accion.socioId, p_no_quiso: accion.noQuiso });
    return { revision };
  },
};
