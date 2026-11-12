// `redondear`, `money`, `fmtN` y `num` de la maqueta.
const redondear = (valor: number) => Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
const centavosExactos = (valor: number) => Math.round(valor * 100) % 100 === 0;

/** $ 1.500 si es entero; $ 1.500,50 si tiene centavos. */
export function moneda(valor: number) {
  const redondeado = redondear(valor);
  const decimales = centavosExactos(redondeado) ? 0 : 2;
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(redondeado);
}

/** Número para un campo de monto: 1.484.601,5 → "1.484.601,50"; entero → "1.500"; sin valor → "". */
export function numeroEditable(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return '';
  const redondeado = redondear(valor);
  return redondeado.toLocaleString('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: centavosExactos(redondeado) ? 0 : 2 });
}

/** "1.484.601,50" → 1484601.5. Un texto que no es número da 0. */
export function leerMonto(texto: string) {
  const numero = parseFloat(String(texto).replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(numero) ? 0 : numero;
}
