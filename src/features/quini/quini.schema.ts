import { z } from 'zod';
export const quiniSchema=z.object({sid:z.string().min(1,'Elegí el socio'),fecha:z.string().min(1,'Elegí el sorteo'),cantidad:z.string().regex(/^[1-9]\d*$/,'Ingresá una cantidad válida'),automatico:z.boolean(),dias:z.array(z.string())}).refine(x=>!x.automatico||x.dias.length>0,{path:['dias'],message:'Elegí al menos un día para jugar todas las semanas'});
export type QuiniInput=z.infer<typeof quiniSchema>;
