// Fechas en hora de Argentina, como en la maqueta. Todas trabajan con 'YYYY-MM-DD'.
const ZONA = 'America/Argentina/Buenos_Aires';
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const dos = (n: number) => String(n).padStart(2, '0');
const aISO = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

export function hoy() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return aISO(new Date());
  }
}

export function leerFecha(texto: string) {
  const [anio, mes, dia] = String(texto).split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

export function sumarDias(texto: string, cantidad: number) {
  const fecha = leerFecha(texto);
  fecha.setDate(fecha.getDate() + cantidad);
  return aISO(fecha);
}

export function sumarMeses(texto: string, cantidad: number) {
  const fecha = leerFecha(texto);
  const dia = fecha.getDate();
  fecha.setDate(1);
  fecha.setMonth(fecha.getMonth() + cantidad);
  fecha.setDate(Math.min(dia, new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate()));
  return aISO(fecha);
}

export function diasHasta(texto: string) {
  return Math.round((leerFecha(texto).getTime() - leerFecha(hoy()).getTime()) / 86400000);
}

export function nombreDia(texto: string) {
  return DIAS[leerFecha(texto).getDay()];
}

// Igual que `fd` de la maqueta: 2026-11-12 → 12/11/2026.
export function fechaCorta(texto?: string | null) {
  return texto ? texto.split('-').reverse().join('/') : '—';
}

// Igual que `fdl` de la maqueta: 2026-11-12 → jueves 12/11.
export function fechaLarga(texto?: string | null) {
  return texto ? `${nombreDia(texto)} ${fechaCorta(texto).slice(0, 5)}` : '—';
}

export function horaArgentina(marca?: string) {
  if (!marca) return '';
  try {
    return new Date(marca).toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}
