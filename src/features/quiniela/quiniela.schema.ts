import { z } from 'zod';
export const quinielaSchema=z.object({sid:z.string().min(1,'Elegí el socio.'),fecha:z.iso.date('Elegí la fecha.'),jugadas:z.array(z.object({numeros:z.string(),monto:z.string().refine(x=>!x||/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(x),'Ingresá un monto válido.')})).min(1).max(5)}).refine(x=>x.jugadas.some(j=>j.numeros.trim()||j.monto.trim()),{path:['jugadas'],message:'Cargá al menos una jugada.'});
export type QuinielaInput=z.infer<typeof quinielaSchema>;
