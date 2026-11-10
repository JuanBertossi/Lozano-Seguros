import { z } from 'zod';

export const pagoSchema = z.object({
  monto: z.string().trim().refine(
    (valor) => /^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(valor),
    'Ingresá un monto válido.',
  ).optional(),
  fecha: z.iso.date('Elegí la fecha del pago.'),
  medio: z.enum(['', 'efectivo', 'transferencia', 'echeq', 'cheque', 'mp']),
  cargarDetalle: z.boolean(),
  banco: z.string().trim(),
  nro: z.string().trim(),
  librador: z.string().trim(),
  fcobro: z.string().trim().refine((valor) => !valor || /^\d{4}-\d{2}-\d{2}$/.test(valor), 'Ingresá una fecha válida.'),
});

export type PagoInput = z.infer<typeof pagoSchema>;
