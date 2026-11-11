import { z } from 'zod';
export const planQuiniSchema=z.object({dias:z.array(z.string()),cantidad:z.string().regex(/^[1-9]\d*$/,'Ingresá una cantidad válida.')});
export type PlanQuiniInput=z.infer<typeof planQuiniSchema>;
