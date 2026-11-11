import { z } from 'zod';
const importe=z.string().refine(v=>!v||/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(v),'Ingresá un monto válido.');
export const totoSchema=z.object({fecha:z.iso.date('Elegí la fecha.'),jugadas:z.record(z.string(),importe),concursos:z.record(z.string(),z.string().regex(/^\d*$/,'Ingresá un número de concurso.')),premios:importe,premiosAg:importe});
export type TotoInput=z.infer<typeof totoSchema>;
export const totoPagoSchema=z.object({monto:importe.refine(v=>v!==''&&Number(v.replace(/\./g,'').replace(',','.'))>0,'Poné el monto que pagó.'),fecha:z.iso.date('Elegí la fecha.')});
export type TotoPagoInput=z.infer<typeof totoPagoSchema>;
