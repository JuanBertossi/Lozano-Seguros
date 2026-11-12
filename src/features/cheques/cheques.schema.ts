import { z } from 'zod';

export const filtroChequeSchema = z.object({ numero: z.string(), banco: z.string() });
export type FiltroCheque = z.infer<typeof filtroChequeSchema>;
