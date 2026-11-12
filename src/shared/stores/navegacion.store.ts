import { create } from 'zustand';
import { hoy } from '../lib/fechas';

export type Pagina = 'inicio' | 'socios' | 'socio' | 'seguros' | 'juegos' | 'cheques' | 'toto' | 'actividad' | 'ajustes';
export type Juego = 'q6' | 'lot' | 'qui' | 'rifa';
export type TabSocio = 'det' | 'seg' | 'q6' | 'lot' | 'qui' | 'rifa';
export type FiltroPago = 'todos' | 'deben' | 'pagados';
export type VistaToto = 'dia' | 'mes' | 'todo';

interface Navegacion {
  pagina: Pagina;
  juego: Juego;
  socioId: string | null;
  tabSocio: TabSocio;
  /** Filtro de pagos compartido por Quini, Lotería, Quiniela y Rifa (`F.gf` de la maqueta). */
  filtro: FiltroPago;
  fechaQuini: string | null;
  sorteoId: string | null;
  fechaQuiniela: string;
  anioRifa: number;
  vistaToto: VistaToto | null;
  mesToto: string | null;
  diaToto: string | null;
  /** Mientras una operación está en curso la barra lateral no responde. */
  bloqueado: boolean;
  /** Acepta las claves de la barra lateral: 'inicio', 'socios', 'juegos:q6', etc. */
  navegar: (clave: string) => void;
  verSocio: (id: string) => void;
  /** Vuelve al listado si el socio abierto ya no existe. */
  volverASocios: () => void;
  elegirTabSocio: (tab: TabSocio) => void;
  elegirFiltro: (filtro: FiltroPago) => void;
  elegirFechaQuini: (fecha: string | null) => void;
  elegirSorteo: (id: string | null) => void;
  elegirFechaQuiniela: (fecha: string) => void;
  elegirAnioRifa: (anio: number) => void;
  elegirVistaToto: (vista: VistaToto) => void;
  elegirMesToto: (mes: string) => void;
  elegirDiaToto: (dia: string) => void;
  bloquear: (valor: boolean) => void;
}

export const useNavegacion = create<Navegacion>((set, get) => ({
  pagina: 'inicio',
  juego: 'q6',
  socioId: null,
  tabSocio: 'det',
  filtro: 'todos',
  fechaQuini: null,
  sorteoId: null,
  fechaQuiniela: hoy(),
  anioRifa: new Date().getFullYear(),
  vistaToto: null,
  mesToto: null,
  diaToto: null,
  bloqueado: false,
  navegar: (clave) => {
    if (clave.startsWith('juegos:')) set({ pagina: 'juegos', juego: clave.split(':')[1] as Juego });
    else set({ pagina: clave as Pagina });
    window.scrollTo(0, 0);
  },
  verSocio: (id) => {
    set({ pagina: 'socio', socioId: id, tabSocio: id === get().socioId ? get().tabSocio : 'det' });
    window.scrollTo(0, 0);
  },
  volverASocios: () => set({ pagina: 'socios', socioId: null }),
  elegirTabSocio: (tabSocio) => set({ tabSocio }),
  elegirFiltro: (filtro) => set({ filtro }),
  elegirFechaQuini: (fechaQuini) => set({ fechaQuini }),
  elegirSorteo: (sorteoId) => set({ sorteoId }),
  elegirFechaQuiniela: (fechaQuiniela) => set({ fechaQuiniela }),
  elegirAnioRifa: (anioRifa) => set({ anioRifa }),
  elegirVistaToto: (vistaToto) => set({ vistaToto }),
  elegirMesToto: (mesToto) => set({ mesToto }),
  elegirDiaToto: (diaToto) => set({ diaToto }),
  bloquear: (bloqueado) => set({ bloqueado }),
}));

/** Lo que hace la maqueta al cerrar sesión: vuelve a Inicio con los filtros en su valor inicial. */
export function reiniciarNavegacion() {
  useNavegacion.setState(useNavegacion.getInitialState(), true);
}
