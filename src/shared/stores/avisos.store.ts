import { create } from 'zustand';

export interface AvisoAccion {
  texto: string;
  boton: string;
  ejecutar: () => void;
}

interface Avisos {
  mensaje: string | null;
  accion: AvisoAccion | null;
  avisar: (texto: string, demora?: number) => void;
  mostrarAccion: (accion: AvisoAccion, demora?: number) => void;
  cerrarAccion: () => void;
}

let temporizadorMensaje: ReturnType<typeof setTimeout> | undefined;
let temporizadorAccion: ReturnType<typeof setTimeout> | undefined;

// `toast` de la maqueta: 2,4 s. El aviso con acción (`snack`) dura 9 s y se cierra al tocar el botón.
export const useAvisos = create<Avisos>((set) => ({
  mensaje: null,
  accion: null,
  avisar: (texto, demora = 2400) => {
    clearTimeout(temporizadorMensaje);
    set({ mensaje: texto });
    temporizadorMensaje = setTimeout(() => set({ mensaje: null }), demora);
  },
  mostrarAccion: (accion, demora = 9000) => {
    clearTimeout(temporizadorAccion);
    set({ accion: { ...accion, ejecutar: () => { clearTimeout(temporizadorAccion); set({ accion: null }); accion.ejecutar(); } } });
    temporizadorAccion = setTimeout(() => set({ accion: null }), demora);
  },
  cerrarAccion: () => {
    clearTimeout(temporizadorAccion);
    set({ accion: null });
  },
}));

export const avisar = (texto: string, demora?: number) => useAvisos.getState().avisar(texto, demora);
