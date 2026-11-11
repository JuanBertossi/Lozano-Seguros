import { z } from 'zod';
export const rifaSchema=z.object({sid:z.string().min(1,'Elegí el socio.'),numero:z.string().trim().min(1,'Ingresá el número.'),anio:z.string().regex(/^\d{1,4}$/,'Ingresá el año.'),importe:z.string().refine(x=>!x||/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(x),'Ingresá un importe válido.'),modo:z.enum(['contado','cuotas'])});
export type RifaInput=z.infer<typeof rifaSchema>;
