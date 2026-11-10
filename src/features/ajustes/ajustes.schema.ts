import { z } from 'zod';

const importe = z.string().trim().refine((valor) => /^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(valor), 'Ingresá un importe válido.');
const enteroPositivo = z.string().trim().refine((valor) => /^\d+$/.test(valor) && Number(valor) > 0, 'Ingresá una cantidad mayor a cero.');

export const ajustesSchema = z.object({
  nombre: z.string().trim(),
  q6Precio: importe,
  q6Dias: z.array(z.string()),
  fracPrecio: importe,
  rifaImporte: importe,
  rifaCuotas: enteroPositivo,
  wsp: z.enum(['app', 'web']),
});

export const sorteoSchema = z.object({
  nombre: z.string().trim().min(1, 'Ingresá el nombre del sorteo.'),
  fecha: z.iso.date('Ingresá la fecha del sorteo.'),
  frac: enteroPositivo,
  precio: importe,
});

export type AjustesInput = z.infer<typeof ajustesSchema>;
export type SorteoInput = z.infer<typeof sorteoSchema>;
