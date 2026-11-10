import { z } from 'zod';

export const seguroSchema = z.object({
  sid: z.string().min(1, 'Elegí el socio.'),
  ingreso: z.iso.date('Elegí la fecha de ingreso.'),
  venc: z.iso.date('Elegí el vencimiento.'),
  desc: z.string().trim(),
  valor: z.string().trim().refine((valor) => /^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(valor) && Number(valor.replace(/\./g, '').replace(',', '.')) > 0, 'Ingresá el valor del seguro.'),
  plan: z.enum(['contado', '3', '6', '12']),
});

export type SeguroInput = z.infer<typeof seguroSchema>;

export const socioRapidoSchema = z.object({
  nombre: z.string().trim().min(1, 'Poné el nombre del socio.'),
  telefono: z.string().trim(),
});

export type SocioRapidoInput = z.infer<typeof socioRapidoSchema>;
