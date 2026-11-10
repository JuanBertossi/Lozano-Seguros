import { z } from 'zod';

export const loginSchema = z.object({
  usuario: z.string().trim().toLowerCase().regex(
    /^[a-z0-9][a-z0-9_-]{0,31}$/,
    'Ingresá un usuario de hasta 32 caracteres con letras, números, guiones o guiones bajos.',
  ),
  password: z.string().min(1, 'Ingresá tu contraseña.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
