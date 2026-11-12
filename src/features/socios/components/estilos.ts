/* Clases de presentación compartidas por la lista y la ficha del socio (equivalen a .btn, .pay, .tag, .chip, .seg, tablas y filas de la maqueta). */
const foco = 'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ac)]';
const base = `inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-solid font-medium disabled:cursor-default disabled:opacity-40 ${foco}`;
const normal = 'border-[var(--ln)] bg-[var(--sf)] hover:bg-[var(--sf2)]';
const primario = 'border-[var(--ac)] bg-[var(--ac)] text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] hover:brightness-[1.08] [[data-theme=dark]_&]:text-[#0b1f17]';
const fantasma = 'border-transparent bg-transparent hover:bg-[var(--sf2)]';
const grande = 'px-[13px] py-2 text-sm';
const chico = 'px-[9px] py-[5px] text-[13px]';

export const btn = `${base} ${normal} ${grande}`;
export const btnP = `${base} ${primario} ${grande}`;
export const btnG = `${base} ${fantasma} ${grande}`;
export const btnSm = `${base} ${normal} ${chico}`;
export const btnSmP = `${base} ${primario} ${chico}`;
export const btnSmG = `${base} ${fantasma} ${chico}`;
export const btnSmGD = `${btnSmG} text-[var(--bad)]`;

const pago = 'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-solid px-3 py-[5px] text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--ac)]';
export const pagoSi = `${pago} border-[#bfe3cf] bg-[var(--ok-s)] text-[var(--ok)]`;
export const pagoNo = `${pago} border-[var(--badb)] bg-[var(--badb)] text-white hover:brightness-[1.08]`;
export const parcial = 'mt-[3px] block whitespace-nowrap text-[11.5px] text-[var(--warn)]';

export const tag = 'inline-block whitespace-nowrap rounded-full bg-[var(--sf2)] px-2 py-0.5 text-xs font-medium text-[var(--mu)]';
export const tagOk = 'inline-block whitespace-nowrap rounded-full bg-[var(--ok-s)] px-2 py-0.5 text-xs font-medium text-[var(--ok)]';
export const tagMalo = 'inline-block whitespace-nowrap rounded-full bg-[var(--bad-s)] px-2 py-0.5 text-xs font-medium text-[var(--bad)]';
export const tagAviso = 'inline-block whitespace-nowrap rounded-full bg-[var(--warn-s)] px-2 py-0.5 text-xs font-medium text-[var(--warn)]';
export const chip = "my-px mr-0.5 inline-flex items-center gap-[5px] rounded-md border border-solid border-[var(--ln)] px-2 py-0.5 text-xs font-medium before:size-[7px] before:rounded-[2px] before:bg-[var(--producto)] before:content-['']";
export const mono = 'font-mono text-[1.08em] font-semibold tracking-[.02em]';
export const autor = 'text-xs italic text-[var(--mu)]';

export const tarjeta = 'mb-4 rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)] px-5 py-[18px]';
export const tarjetaCab = 'mb-2.5 flex flex-wrap items-center justify-between gap-2.5';
export const vacio = 'px-1 py-3.5 text-sm text-[var(--mu)]';

export const tabla = 'w-full border-collapse text-[15px]';
export const th = 'whitespace-nowrap border-b border-solid border-[var(--ln)] px-2 py-[7px] text-left text-[13px] font-medium text-[var(--mu)]';
export const thR = `${th} !text-right`;
export const td = 'border-b border-solid border-[var(--ln2)] px-2 py-2.5 align-middle';
export const tdR = `${td} whitespace-nowrap text-right text-[16.5px] font-semibold`;

const filaBase = '[&>td]:border-b-2 [&>td]:border-[var(--sf)] [&>td:first-child]:shadow-[inset_4px_0_0_var(--barra)]';
export const filaOk = `${filaBase} [--barra:var(--okb)] [&>td]:bg-[var(--ok-row)]`;
export const filaMal = `${filaBase} [--barra:var(--badb)] [&>td]:bg-[var(--bad-row)]`;
export const filaPar = `${filaBase} [--barra:var(--warn)] [&>td]:bg-[color-mix(in_srgb,var(--warn-s)_60%,var(--sf))]`;
export const filaClic = 'cursor-pointer [&:hover>td]:bg-[var(--sf2)]';
export const filaOkClic = `${filaClic} [&:hover>td]:!bg-[#e2f2e9]`;
export const filaMalClic = `${filaClic} [&:hover>td]:!bg-[#fae3e1]`;

export const seg = 'inline-flex flex-wrap overflow-hidden rounded-[9px] border border-solid border-[var(--ln)]';
export const segBtn = (activo: boolean) => `cursor-pointer border-0 border-r border-solid border-[var(--ln)] px-3 py-1.5 text-[13.5px] last:border-r-0 ${activo ? 'bg-[var(--ac-s)] font-semibold text-[var(--ink)]' : 'bg-transparent'}`;

export const cuota = (pagada: boolean, vencida: boolean) => `grid size-[30px] cursor-default place-items-center rounded-md border border-solid text-[13px] font-semibold ${pagada ? 'border-[var(--ok)] bg-[var(--ok)] text-[var(--sf)]' : vencida ? 'border-[var(--bad)] bg-transparent text-[var(--bad)]' : 'border-[var(--ln)] bg-transparent text-[var(--mu)]'}`;

/* Diálogos (equivalen a .modal, .mbody, .merr, label.f, .row, .opts, .note y .mfoot de la maqueta). */
export const dialogo = 'm-auto block max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-[0_20px_50px_rgba(0,0,0,0.25)] backdrop:bg-[rgba(10,12,15,0.45)] focus:outline-none focus-visible:outline-none';
export const cuerpo = 'px-6 pt-[22px] max-[820px]:px-4';
export const errores = 'mx-6 pt-3.5 empty:hidden max-[820px]:mx-4';
export const titulo = 'mb-3.5 text-[22px] font-semibold tracking-[-.01em]';
export const etiquetaF = 'mb-3.5 block text-[14.5px] text-[var(--mu)]';
export const campoF = 'mt-1 block w-full rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] text-[var(--ink)]';
export const fila = 'grid grid-cols-2 gap-3 max-[820px]:grid-cols-1';
export const notaF = 'mb-3 rounded-lg bg-[var(--sf2)] px-[11px] py-[9px] text-[14.5px] text-[var(--mu)]';
export const opcionesF = 'mb-3 mt-1 flex flex-wrap gap-1.5';
export const opcionF = 'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-[var(--ln)] px-[13px] py-[9px] text-[15.5px] text-[var(--ink)] has-[:checked]:border-[var(--ac)] has-[:checked]:bg-[var(--ac-s)] [&>input]:m-0 [&>input]:accent-[var(--ac)]';
export const pie = 'sticky bottom-0 mt-3.5 flex flex-wrap justify-between gap-2 border-t border-solid border-[var(--ln2)] bg-[var(--sf)] px-6 py-3.5 max-[820px]:px-4';
const btnM = `${base} px-4 py-2.5 text-[15.5px]`;
export const btnMd = `${btnM} ${normal}`;
export const btnMdP = `${btnM} ${primario}`;
export const btnMdD = `${btnMd} text-[var(--bad)]`;

export const h2 = 'text-[17px] font-semibold tracking-[-.01em]';
export const h1 = 'text-2xl font-semibold tracking-[-.01em]';
