import { z } from 'zod';

export const socioSchema = z.object({
  nombre: z.string().trim().min(1, 'Poné el nombre.'),
  nro: z.string().trim(),
  tel: z.string().trim(),
  dir: z.string().trim(),
  favor: z.string().trim().refine(
    (valor) => valor === '' || /^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(valor),
    'Ingresá un importe válido.',
  ),
  archivado: z.boolean(),
});

export type SocioInput = z.infer<typeof socioSchema>;
