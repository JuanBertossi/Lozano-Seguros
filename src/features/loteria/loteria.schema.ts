import { z } from 'zod';
export const ventaSchema=z.object({sid:z.string().min(1,'Elegí el socio.'),soId:z.string().min(1,'Elegí el sorteo.'),numero:z.string().trim().min(1,'Ingresá el número.'),frac:z.string().regex(/^[1-9]\d*$/,'Elegí las fracciones.'),fijo:z.boolean()});
export type VentaInput=z.infer<typeof ventaSchema>;
