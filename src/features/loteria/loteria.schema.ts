import { z } from 'zod';
export const ventaSchema=z.object({sid:z.string().min(1,'Elegí el socio.'),soId:z.string().min(1,'Elegí el sorteo.'),numero:z.string().trim().min(1,'Ingresá el número.'),progresion:z.string().trim().max(10,'La progresión admite hasta 10 dígitos.').regex(/^\d*$/,'Ingresá solo números en la progresión.'),frac:z.string().regex(/^[1-9]\d*$/,'Elegí las fracciones.'),fijo:z.boolean()});
export type VentaInput=z.infer<typeof ventaSchema>;
