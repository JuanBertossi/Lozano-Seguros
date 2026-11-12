/**
 * Utilidades Tailwind de los componentes visuales de la maqueta (botón, tarjeta, campos, diálogo, etiquetas…).
 * Los valores salen de `getComputedStyle` de la maqueta; los colores son los tokens `var(--…)`.
 */

const botonBase = 'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-solid font-medium transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ac)] disabled:cursor-default disabled:opacity-40';
const tamanos = {
  md: 'px-[13px] py-2 text-sm',
  sm: 'px-[9px] py-[5px] text-[13px]',
  /** Botones del pie de un diálogo (`.modal .mfoot .btn`). */
  pie: 'px-4 py-2.5 text-[15.5px]',
  /** Botón chico dentro de un diálogo (`.modal .btn.sm`). */
  chicoDlg: 'px-[9px] py-[5px] text-[14.5px]',
  /** Botón de ancho completo del login. */
  ancho: 'p-[11px] text-sm',
};
const tipos = {
  normal: 'border-[var(--ln)] bg-[var(--sf)] hover:bg-[var(--sf2)]',
  primario: 'border-[var(--ac)] bg-[var(--ac)] text-white shadow-[0_1px_0_rgba(0,0,0,.08)] hover:brightness-[1.08] [[data-theme=dark]_&]:text-[#0b1f17]',
  fantasma: 'border-transparent bg-transparent hover:bg-[var(--sf2)]',
  peligro: 'border-[var(--ln)] bg-[var(--sf)] text-[var(--bad)] hover:bg-[var(--sf2)]',
  /** «Parcial» de Toto: botón blanco con sombra (`.btn.tparc`). */
  parcial: 'm-0 border-[var(--ln)] bg-white text-[#1C1F24] shadow-[0_1px_2px_rgba(0,0,0,.06)] hover:border-[var(--mu)] [[data-theme=dark]_&]:bg-[var(--sf)] [[data-theme=dark]_&]:text-[var(--ink)]',
};

export function boton(tipo: keyof typeof tipos = 'normal', tamano: keyof typeof tamanos = 'md') {
  return `${botonBase} ${tamanos[tamano]} ${tipos[tipo]}`;
}

export const marcadorTexto = 'placeholder:text-[#757575] [[data-theme=dark]_&]:placeholder:text-[#a8a8a8]';

// Páginas
export const cabecera = 'mb-[18px] flex flex-wrap items-end justify-between gap-3.5';
export const titulo = 'text-2xl font-semibold tracking-[-.01em]';
export const subtitulo = 'mt-[3px] text-sm text-[var(--mu)]';
export const titulo2 = 'text-[17px] font-semibold tracking-[-.01em]';
export const tarjeta = 'mb-4 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-5 py-[18px]';
export const tarjetaCabecera = 'mb-2.5 flex flex-wrap items-center justify-between gap-2.5';
export const vacio = 'px-1 py-3.5 text-sm text-[var(--mu)]';
export const vacioCentrado = 'px-3 py-[26px] text-center text-[var(--mu)]';
export const nota = 'mb-3 rounded-lg bg-[var(--sf2)] px-[11px] py-[9px] text-[13px] text-[var(--mu)]';
export const fila2 = 'grid grid-cols-2 gap-3 max-[820px]:grid-cols-1';
export const dosColumnas = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 *:min-w-0 @max-[760px]/main:grid-cols-[minmax(0,1fr)]';
export const segmento = 'inline-flex flex-wrap overflow-hidden rounded-[9px] border border-solid border-[var(--ln)]';
export const botonSegmento = (activo: boolean) => `cursor-pointer border-r border-solid border-[var(--ln)] px-3 py-1.5 text-[13.5px] last:border-r-0 focus-visible:outline-2 focus-visible:outline-[var(--ac)] ${activo ? 'bg-[var(--ac-s)] font-semibold text-[var(--ink)]' : ''}`;
export const enlace = 'inline cursor-pointer font-medium text-[var(--ink)] hover:text-[var(--ac)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--ac)]';

// Listas y tablas
export const lista = 'text-[var(--ink)] [&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:gap-2.5 [&>div]:border-b [&>div]:border-solid [&>div]:border-[var(--ln2)] [&>div]:py-2 [&>div:last-child]:border-b-0 [&_b]:text-[17px]';
export const listaDlg = `${lista} [&>div]:text-[15.5px]`;
export const tabla = 'w-full border-collapse text-[15px] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-solid [&_th]:border-[var(--ln)] [&_th]:px-2 [&_th]:py-[7px] [&_th]:text-left [&_th]:text-[13px] [&_th]:font-medium [&_th]:text-[var(--mu)] [&_td]:border-b [&_td]:border-solid [&_td]:border-[var(--ln2)] [&_td]:px-2 [&_td]:py-2.5 [&_td]:align-middle';

const etiquetaBase = 'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium';
const etiquetas = {
  neutra: 'bg-[var(--sf2)] text-[var(--mu)]',
  ok: 'bg-[var(--ok-s)] text-[var(--ok)]',
  aviso: 'bg-[var(--warn-s)] text-[var(--warn)]',
  mala: 'bg-[var(--bad-s)] text-[var(--bad)]',
};
export const etiqueta = (tipo: keyof typeof etiquetas = 'neutra') => `${etiquetaBase} ${etiquetas[tipo]}`;
export const avatar = (chico = false) => `inline-grid flex-none place-items-center rounded-full bg-[var(--ac-s)] align-middle font-bold text-[var(--ac)] ${chico ? 'size-[22px] text-[11px]' : 'size-[30px] text-[13px]'}`;

// Formularios
export const rotulo = 'mb-3 block text-[13px] text-[var(--mu)]';
export const campo = `mt-1 block w-full rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-2.5 py-[9px] text-[var(--ink)] ${marcadorTexto}`;
export const campoDinero = `${campo} text-[17px] font-semibold`;
export const rotuloSuelto = 'text-[13px] text-[var(--mu)]';
export const opciones = 'mt-1 mb-3 flex flex-wrap gap-1.5';
export const opcion = 'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-[var(--ln)] px-[11px] py-[7px] text-sm text-[var(--ink)] has-[:checked]:border-[var(--ac)] has-[:checked]:bg-[var(--ac-s)]';
export const entradaOpcion = 'm-0 accent-[var(--ac)]';
/** Los checkbox y radio conservan el margen nativo de la maqueta (el preflight de Tailwind lo pone en 0). */
export const margenNativo = '[margin:3px_3px_3px_4px]';

// Diálogos (`<dialog>` nativo con la apariencia de .ov/.modal)
export const dialogo = 'm-auto max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-[0_20px_50px_rgba(0,0,0,.25)] backdrop:bg-[rgba(10,12,15,.45)] focus:outline-none';
export const cuerpoDlg = 'px-6 pt-[22px] max-[820px]:px-4';
export const cuerpoSinTopeDlg = 'px-6 max-[820px]:px-4';
export const erroresDlg = 'mx-6 pt-3.5 empty:hidden max-[820px]:mx-4';
export const tituloDlg = 'mb-3.5 text-[22px] font-semibold tracking-[-.01em]';
export const encabezadoDlg = 'sticky top-0 z-[2] mb-3.5 flex items-baseline justify-between gap-2.5 border-b border-solid border-[var(--ln2)] bg-[var(--sf)] px-6 pt-[18px] pb-3 max-[820px]:px-4';
export const pieDlg = 'sticky bottom-0 mt-3.5 flex flex-wrap justify-between gap-2 border-t border-solid border-[var(--ln2)] bg-[var(--sf)] px-6 py-3.5 max-[820px]:px-4';
export const rotuloDlg = 'mb-3.5 block text-[14.5px] text-[var(--mu)]';
export const campoDlg = `mt-1 block w-full rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] text-[var(--ink)] ${marcadorTexto}`;
export const campoDineroDlg = `${campoDlg} font-semibold`;
/** Monto recibido del cobro (`.big-in`): 20 px en lugar de 16,5 px. */
export const campoMontoDlg = `mt-1 block w-full rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-xl font-semibold text-[var(--ink)] ${marcadorTexto}`;
export const rotuloSueltoDlg = 'text-[14.5px] text-[var(--mu)]';
export const notaDlg = 'mb-3 rounded-lg bg-[var(--sf2)] px-[11px] py-[9px] text-[14.5px] text-[var(--mu)]';
export const opcionDlg = 'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-[var(--ln)] px-[13px] py-[9px] text-[15.5px] text-[var(--ink)] has-[:checked]:border-[var(--ac)] has-[:checked]:bg-[var(--ac-s)]';
export const textoChicoDlg = 'text-[14.5px]';
