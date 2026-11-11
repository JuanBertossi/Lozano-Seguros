import { z } from 'zod';
export const socioRapidoSchema=z.object({nombre:z.string().trim().min(1,'Poné el nombre del socio.'),telefono:z.string().trim()});
export type SocioRapidoInput=z.infer<typeof socioRapidoSchema>;
