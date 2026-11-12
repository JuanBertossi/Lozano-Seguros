/**
 * Abre un <dialog> como modal sin enfocar su primer campo (la maqueta no enfoca nada al abrir).
 * El foco queda en el propio diálogo, para que Escape y el teclado sigan funcionando.
 */
export function abrirModal(dialogo: HTMLDialogElement | null) {
  if (!dialogo) return;
  dialogo.tabIndex = -1;
  dialogo.style.outline = 'none';
  dialogo.showModal();
  dialogo.focus({ preventScroll: true });
}
