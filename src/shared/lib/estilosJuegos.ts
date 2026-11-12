// Utilidades Tailwind (sin CSS legacy) con los valores de la maqueta para Lotería, Rifa, Seguros y sus diálogos.
const foco = 'focus-visible:outline-2 focus-visible:outline-[var(--ac)]';
const monoFuente = "font-['IBM_Plex_Mono',ui-monospace,Menlo,monospace]";

// ---- botones ----
const btnBase = `inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-solid font-medium transition-colors ${foco} focus-visible:outline-offset-1 disabled:cursor-default disabled:opacity-40`;
const btnNeutro = 'border-[var(--ln)] bg-[var(--sf)] hover:bg-[var(--sf2)]';
const btnPrim = 'border-[var(--ac)] bg-[var(--ac)] text-white shadow-[0_1px_0_rgba(0,0,0,.08)] hover:brightness-110 [:root[data-theme=dark]_&]:text-[#0B1F17]';
const btnFantasma = 'border-transparent bg-transparent hover:bg-[var(--sf2)]';
export const btn = `${btnBase} px-[13px] py-2 text-sm ${btnNeutro}`;
export const btnP = `${btnBase} px-[13px] py-2 text-sm ${btnPrim}`;
export const btnSm = `${btnBase} px-[9px] py-[5px] text-[13px] ${btnNeutro}`;
export const btnSmG = `${btnBase} px-[9px] py-[5px] text-[13px] ${btnFantasma}`;
// Botones dentro del pie de los diálogos (.modal .mfoot .btn / .modal .btn.sm).
export const btnM = `${btnBase} px-4 py-2.5 text-[15.5px] ${btnNeutro}`;
export const btnMP = `${btnBase} px-4 py-2.5 text-[15.5px] ${btnPrim}`;
export const btnMD = `${btnBase} px-4 py-2.5 text-[15.5px] text-[var(--bad)] ${btnNeutro}`;
export const btnMSm = `${btnBase} px-[9px] py-[5px] text-[14.5px] ${btnNeutro}`;

// ---- estructura de página ----
export const cabecera = 'mb-[18px] flex flex-wrap items-end justify-between gap-3.5';
export const titulo = 'text-2xl font-semibold tracking-[-.01em]';
export const subtitulo = 'mt-[3px] text-sm text-[var(--mu)]';
export const acciones = 'flex flex-wrap gap-2';
const tarjetaBase = 'rounded-[14px] border border-solid border-[var(--ln)] bg-[var(--sf)]';
export const tarjeta = `mb-4 ${tarjetaBase} px-5 py-[18px]`;
export const tarjetaBarra = `mb-4 ${tarjetaBase} flex flex-wrap items-center gap-2.5 px-5 py-[18px]`;
export const tarjetaCab = 'mb-2.5 flex flex-wrap items-center justify-between gap-2.5';
export const h2 = 'text-[17px] font-semibold tracking-[-.01em]';
export const etiquetaChica = 'text-[13px] text-[var(--mu)]';
export const gris = 'text-[var(--mu)]';
export const grillaKpi = 'mb-4 grid grid-cols-3 gap-3';
const kpiBase = 'min-w-0 [container-type:inline-size] rounded-[14px] border border-solid px-4 py-3.5';
export const kpi = `${kpiBase} border-[var(--ln)] bg-[var(--sf)]`;
export const kpiMalo = `${kpiBase} border-[#F1C7C3] bg-[var(--bad-row)]`;
export const kpiTit = 'block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[var(--mu)]';
export const kpiValor = 'mt-0.5 block overflow-hidden whitespace-nowrap text-[length:clamp(15px,10.5cqi,22px)] leading-[1.2] font-bold tracking-[-.01em] max-[820px]:text-[length:clamp(14px,10cqi,18px)]';
export const kpiSub = 'mt-0.5 block text-[13px] text-[var(--mu)]';

// ---- selector segmentado ----
export const seg = 'inline-flex flex-wrap overflow-hidden rounded-[9px] border border-solid border-[var(--ln)]';
export const segAncho = seg.replace('inline-flex', 'flex');
const segBtn = `cursor-pointer border-0 border-r border-solid border-[var(--ln)] px-3 py-1.5 text-[13.5px] last:border-r-0 ${foco}`;
export const segItem = (activo: boolean) => `${segBtn} ${activo ? 'bg-[var(--ac-s)] font-semibold' : ''}`;

// ---- tablas ----
export const tabla = 'w-full border-collapse text-[15px]';
export const th = 'whitespace-nowrap border-b border-solid border-[var(--ln)] px-2 py-[7px] text-left text-[13px] font-medium text-[var(--mu)]';
export const thD = 'whitespace-nowrap border-b border-solid border-[var(--ln)] px-2 py-[7px] text-right text-[13px] font-medium text-[var(--mu)]';
export const td = 'px-2 py-2.5 align-middle';
export const tdD = `${td} whitespace-nowrap text-right text-[16.5px] font-semibold max-[820px]:text-base`;
export const tdMono = `${td} ${monoFuente} text-[16.5px] font-semibold tracking-[.02em] max-[820px]:text-base`;
export const mono = `${monoFuente} text-[1.08em] font-semibold tracking-[.02em]`;
export const tdAutor = `${td} whitespace-nowrap text-xs italic text-[var(--mu)]`;
export const autor = 'text-xs italic text-[var(--mu)]';
const celdas = '[&>td]:border-b-2 [&>td]:border-solid [&>td]:border-[var(--sf)]';
export const filaNormal = '[&>td]:border-b [&>td]:border-solid [&>td]:border-[var(--ln2)]';
export const filaOk = `${celdas} [&>td]:bg-[var(--ok-row)] [&>td:first-child]:shadow-[inset_4px_0_0_var(--okb)]`;
export const filaMala = `${celdas} [&>td]:bg-[var(--bad-row)] [&>td:first-child]:shadow-[inset_4px_0_0_var(--badb)]`;
export const filaParcial = `${celdas} [&>td]:bg-[color-mix(in_srgb,var(--warn-s)_60%,var(--sf))] [&>td:first-child]:shadow-[inset_4px_0_0_var(--warn)]`;
export const clicable = 'cursor-pointer';
export const montoOk = 'text-[var(--ok)]';
export const montoMalo = 'text-[var(--bad)]';
export const enlace = `inline appearance-none cursor-pointer text-left font-medium text-[var(--ink)] hover:text-[var(--ac)] hover:underline ${foco}`;
export const etiqueta = 'inline-block whitespace-nowrap rounded-full bg-[var(--sf2)] px-2 py-0.5 text-xs font-medium text-[var(--mu)]';
export const etiquetaMala = 'inline-block whitespace-nowrap rounded-full bg-[var(--bad-s)] px-2 py-0.5 text-xs font-medium text-[var(--bad)]';
export const etiquetaAviso = 'inline-block whitespace-nowrap rounded-full bg-[var(--warn-s)] px-2 py-0.5 text-xs font-medium text-[var(--warn)]';

// ---- píldoras de pago y cuotas ----
const pagoBase = `inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-solid px-3 py-[5px] text-sm font-semibold ${foco}`;
export const pagado = `${pagoBase} border-[#BFE3CF] bg-[var(--ok-s)] text-[var(--ok)]`;
export const cobrar = `${pagoBase} border-[var(--badb)] bg-[var(--badb)] text-white hover:brightness-110`;
export const parcial = 'mt-[3px] block whitespace-nowrap text-[11.5px] text-[var(--warn)]';
export const cuotas = 'flex flex-nowrap gap-[3px]';
export const cuota = (pagada: boolean, vencida: boolean) => `grid size-[30px] cursor-default place-items-center rounded-md border border-solid text-[13px] font-semibold ${foco} ${pagada ? 'border-[var(--ok)] bg-[var(--ok)] text-[var(--sf)]' : vencida ? 'border-[var(--bad)] text-[var(--bad)]' : 'border-[var(--ln)] text-[var(--mu)]'}`;

// ---- listas y vacíos ----
export const lista = '[&>div]:flex [&>div]:items-center [&>div]:justify-between [&>div]:gap-2.5 [&>div]:border-b [&>div]:border-solid [&>div]:border-[var(--ln2)] [&>div]:py-2 [&>div:last-child]:border-b-0';
export const dos = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 *:min-w-0 @max-[760px]/main:grid-cols-[minmax(0,1fr)]';
export const vacio = 'px-1 py-3.5 text-sm text-[var(--mu)]';
export const vacioCaja = 'px-3 py-[26px] text-center text-[var(--mu)]';
export const vacioTexto = 'mx-auto mb-3 max-w-[520px]';

// ---- diálogos ----
export const marco = 'm-auto block max-h-[90vh] w-[calc(100%-28px)] max-w-[700px] overflow-auto rounded-2xl border-0 bg-[var(--sf)] p-0 text-[var(--ink)] shadow-[0_20px_50px_rgba(0,0,0,.25)] backdrop:bg-[#0a0c0f73]';
export const cuerpo = 'px-6 pt-[22px] max-[820px]:px-4';
export const franja = 'flex gap-2 px-6 pt-4 max-[820px]:px-4';
export const tituloDialogo = 'mb-3.5 text-[22px] font-semibold tracking-[-.01em]';
const campoHijos = '[&>:is(input,select)]:mt-1 [&>:is(input,select)]:block [&>:is(input,select)]:w-full [&>:is(input,select)]:rounded-lg [&>:is(input,select)]:border [&>:is(input,select)]:border-solid [&>:is(input,select)]:border-[var(--ln)] [&>:is(input,select)]:bg-[var(--sf)] [&>:is(input,select)]:px-3 [&>:is(input,select)]:py-[11px] [&>:is(input,select)]:text-[16.5px] [&>:is(input,select)]:text-[var(--ink)] [&>select]:appearance-auto';
export const campo = `mb-3.5 block text-[14.5px] text-[var(--mu)] ${campoHijos}`;
export const campoSeguido = `mb-1 block text-[14.5px] text-[var(--mu)] ${campoHijos}`;
// Para SocioRapido (compartido): el estilo del input va en el label; el margen lo da su contenedor.
export const campoAnidado = `block text-[14.5px] text-[var(--mu)] ${campoHijos}`;
export const entradaNegrita = 'font-semibold';
export const entradaMono = `${monoFuente} font-semibold tracking-[.02em]`;
export const fila2 = 'grid grid-cols-2 gap-3 max-[820px]:grid-cols-1';
export const fila3 = 'grid grid-cols-3 gap-3 max-[820px]:grid-cols-1';
export const nota = 'mb-3 rounded-lg bg-[var(--sf2)] px-[11px] py-[9px] text-[14.5px] text-[var(--mu)]';
export const notaTinta = 'mb-3 rounded-lg bg-[var(--sf2)] px-[11px] py-[9px] text-[14.5px] text-[var(--ink)]';
export const rotulo = 'text-[14.5px] text-[var(--mu)]';
export const opciones = 'mb-3 mt-1 flex flex-wrap gap-1.5';
export const opcion = 'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-[var(--ln)] px-[13px] py-[9px] text-[15.5px] text-[var(--ink)] has-[:checked]:border-[var(--ac)] has-[:checked]:bg-[var(--ac-s)] [&>input]:m-0 [&>input]:accent-[var(--ac)]';
export const agregarSocio = 'mb-2.5 text-right';
export const agregarSocioLink = `inline appearance-none cursor-pointer text-[14.5px] font-medium text-[var(--ac)] hover:underline ${foco}`;
export const pie = 'sticky bottom-0 mt-3.5 flex flex-wrap justify-between gap-2 border-t border-solid border-[var(--ln2)] bg-[var(--sf)] px-6 py-3.5 max-[820px]:px-4';
export const aviso = 'mb-3 text-sm text-[var(--bad)]';
