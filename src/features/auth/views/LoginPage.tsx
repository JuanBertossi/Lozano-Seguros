import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { boton, campo, rotulo, titulo2 } from '../../../shared/lib/clases';
import { loginSchema, type LoginInput } from '../login.schema';

interface LoginPageProps {
  configurado: boolean;
  mensaje: string;
  ingresar: (entrada: LoginInput) => Promise<void>;
}

// Caja de `#login` / `.lgbox` de la maqueta.
const caja = 'box-border w-full max-w-[400px] rounded-2xl border border-solid border-[var(--ln)] bg-[var(--sf)] p-7 shadow-[0_18px_50px_rgba(20,24,30,.12)]';

export function LoginPage({ configurado, mensaje, ingresar }: LoginPageProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-auto bg-[var(--sf2)] p-5 text-[15px] leading-[1.45] text-[color:var(--ink)]">
      {configurado ? (
        <form className={caja} onSubmit={handleSubmit(ingresar)} noValidate>
          <div className="flex items-center gap-2.5 pb-[18px] max-[820px]:hidden">
            <div className="inline-grid grid-cols-[repeat(3,7px)] gap-0.5" aria-hidden="true">
              {Array.from({ length: 6 }, (_, indice) => (
                <span key={indice} className={`size-[7px] rounded-full ${indice === 1 ? 'bg-[var(--ac)]' : 'bg-[var(--ink)]'}`} />
              ))}
            </div>
            <div><b className="block text-[15px]">Seguros y Lotería</b><span className="block text-xs text-[var(--mu)]">Socios · seguros · juegos</span></div>
          </div>
          <h2 className={titulo2}>Ingresar</h2>
          <p className="mt-1 mb-4 text-[13px] text-[var(--mu)]">Ingresá tu usuario y contraseña.</p>
          <label className={rotulo}>
            Nombre de usuario
            <input className={campo} type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required {...register('usuario')} />
          </label>
          <label className={rotulo}>
            Contraseña
            <input className={campo} type="password" autoComplete="current-password" required {...register('password')} />
          </label>
          <p className="min-h-[18px] text-[13px] text-[var(--bad)]" role="alert">{errors.usuario?.message || errors.password?.message || mensaje}</p>
          <button type="submit" className={`${boton('primario', 'ancho')} w-full justify-center`} disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando…' : 'Entrar'}
          </button>
          <p className="mt-4 text-center text-[13px] text-[var(--mu)]">El acceso protege el uso diario. Los datos quedan guardados en Supabase.</p>
        </form>
      ) : (
        <div className={caja}>
          <h2 className={titulo2}>Configurá Supabase</h2>
          <p>Completá VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en el .env y reiniciá Vite.</p>
        </div>
      )}
    </div>
  );
}
