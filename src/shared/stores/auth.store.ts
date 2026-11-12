import { create } from 'zustand';
import { agencia, queryClient } from '../lib/supabase.service';
import { reiniciarNavegacion } from './navegacion.store';
import { useDialogos } from './dialogos.store';

interface Auth {
  ingresado: boolean;
  mensaje: string;
  entrar: () => void;
  /** Cierra la sesión de Supabase, limpia la caché y vuelve a la pantalla de ingreso. */
  salir: (mensaje?: string) => Promise<void>;
}

export const useAuth = create<Auth>((set) => ({
  ingresado: false,
  mensaje: '',
  entrar: () => set({ ingresado: true, mensaje: '' }),
  salir: async (mensaje = '') => {
    await agencia?.salir().catch(() => {});
    queryClient.clear();
    reiniciarNavegacion();
    useDialogos.getState().cerrar();
    set({ ingresado: false, mensaje });
  },
}));
