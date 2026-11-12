import { create } from 'zustand';

/**
 * Un único diálogo abierto a la vez (como `close_()` de la maqueta, que cerraba todos antes de abrir otro).
 * Solo lleva datos simples: cada diálogo lee del servidor lo que necesita a partir del id.
 */
export type Dialogo =
  | { tipo: 'socio'; id?: string }
  | { tipo: 'sorteo'; id?: string }
  | { tipo: 'seguro'; id?: string; sid?: string }
  | { tipo: 'quini'; id?: string; sid?: string; fecha?: string }
  | { tipo: 'planQuini'; sid: string }
  | { tipo: 'especialQuini'; id?: string }
  | { tipo: 'quiniela'; id?: string; sid?: string }
  | { tipo: 'venta'; id?: string; sid?: string; soId?: string }
  | { tipo: 'rifa'; id?: string; sid?: string }
  | { tipo: 'pagoRifa'; id: string; cuota: number }
  | { tipo: 'pagoSeguro'; id: string; cuota: number }
  | { tipo: 'toto'; id?: string; fecha?: string }
  | { tipo: 'pagoToto'; id: string }
  | { tipo: 'whatsapp'; sid: string }
  | { tipo: 'editarPago'; juego: 'q6' | 'lot' | 'quiniela'; id: string }
  | { tipo: 'cobro'; sid: string; solo?: string }
  | { tipo: 'editarCobro'; id: string };

interface Dialogos {
  dialogo: Dialogo | null;
  abrir: (dialogo: Dialogo) => void;
  cerrar: () => void;
}

export const useDialogos = create<Dialogos>((set) => ({
  dialogo: null,
  abrir: (dialogo) => set({ dialogo }),
  cerrar: () => set({ dialogo: null }),
}));

/** Tipo del diálogo abierto, o null. Un diálogo se monta solo cuando le corresponde. */
export function useDialogo<T extends Dialogo['tipo']>(tipo: T) {
  return useDialogos((estado) => (estado.dialogo?.tipo === tipo ? (estado.dialogo as Extract<Dialogo, { tipo: T }>) : null));
}
