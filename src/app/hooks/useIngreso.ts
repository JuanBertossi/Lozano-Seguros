import { useMutation } from '@tanstack/react-query';
import { agencia } from '../../shared/lib/supabase.service';
import { recargarSesion } from '../../shared/hooks/useSesion';
import { useAuth } from '../../shared/stores/auth.store';
import { useGenerarQuini } from '../../features/quini/hooks/useQuini';
import type { LoginInput } from '../../features/auth/login.schema';

const codigo = (error: unknown) => (error as { code?: string })?.code;

/** Inicia sesión, valida el perfil, genera las jugadas automáticas de Quini pendientes y abre el panel. */
export function useIngreso() {
  const generarQuini = useGenerarQuini();
  const entrar = useAuth((estado) => estado.entrar);
  const salir = useAuth((estado) => estado.salir);
  const ingreso = useMutation({
    mutationFn: async ({ usuario, password }: LoginInput) => {
      if (!agencia) return;
      await agencia.ingresar(usuario, password);
      let sesion = await recargarSesion();
      try {
        await generarQuini.mutateAsync({ p_revision: sesion.revision, p_operacion: crypto.randomUUID() });
      } catch (error) {
        if (codigo(error) !== '40001') throw error;
        sesion = await recargarSesion();
        await generarQuini.mutateAsync({ p_revision: sesion.revision, p_operacion: crypto.randomUUID() });
      }
      await recargarSesion();
      entrar();
    },
    onError: (error) => salir(error instanceof Error ? error.message : 'No se pudo iniciar sesión.'),
  });
  return (entrada: LoginInput) => ingreso.mutateAsync(entrada).catch(() => undefined);
}
