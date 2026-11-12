import { create } from 'zustand';

export type FiltroMovimientos = 'todo' | 'debe';

interface FiltroDetalle {
  filtro: FiltroMovimientos;
  elegir: (filtro: FiltroMovimientos) => void;
}

// `F.detF` de la maqueta: el filtro del historial se conserva al cambiar de pestaña o de socio.
export const useFiltroMovimientos = create<FiltroDetalle>((set) => ({
  filtro: 'todo',
  elegir: (filtro) => set({ filtro }),
}));
