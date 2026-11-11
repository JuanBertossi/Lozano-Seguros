import { z } from 'zod';
export const especialQuiniSchema=z.object({fecha:z.iso.date('Elegí la fecha.'),precio:z.string().refine(v=>/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(v)&&Number(v.replace(/\./g,'').replace(',','.'))>0,'Ingresá un precio válido.'),nombre:z.string()});
export type EspecialQuiniInput=z.infer<typeof especialQuiniSchema>;
