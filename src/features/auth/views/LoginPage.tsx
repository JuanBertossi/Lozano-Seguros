import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput } from '../login.schema';

interface LoginPageProps {
  configurado: boolean;
  mensaje: string;
  ingresar: (entrada: LoginInput) => Promise<void>;
}

export function LoginPage({ configurado, mensaje, ingresar }: LoginPageProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const caja = 'my-auto box-border w-full max-w-[400px] shrink-0 rounded-2xl border border-solid border-[var(--ln)] bg-[var(--sf)] p-7 shadow-[0_18px_50px_rgba(20,24,30,0.12)]';
  const etiqueta = 'mb-3 block text-[13px] font-normal text-[color:var(--mu)]';
  const campo = 'mt-1 block w-full rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-2.5 py-[9px] text-[color:var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--ac)]';

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center overflow-auto bg-[var(--sf2)] p-5 text-[15px] leading-[1.45] text-[color:var(--ink)]">
      {configurado ? (
        <form className={caja} onSubmit={handleSubmit(ingresar)} noValidate>
          <div className="flex items-center gap-2.5 pb-[18px]">
            <div className="inline-grid shrink-0 grid-cols-[repeat(3,7px)] gap-0.5" aria-hidden="true">
              {Array.from({ length: 6 }, (_, indice) => (
                <span key={indice} className={`size-[7px] rounded-full ${indice === 1 ? 'bg-[var(--ac)]' : 'bg-[var(--ink)]'}`} />
              ))}
            </div>
            <div><b className="block text-[15px]">Seguros y Lotería</b><span className="block text-xs text-[color:var(--mu)]">Socios · seguros · juegos</span></div>
          </div>
          <h2 className="m-0 text-[17px] font-semibold tracking-[-0.01em]">Ingresar</h2>
          <p className="mt-1 mb-4 text-[13px] text-[color:var(--mu)]">Ingresá tu usuario y contraseña.</p>
          <label className={etiqueta}>
            Nombre de usuario
            <input className={campo} type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required {...register('usuario')} />
          </label>
          <label className={etiqueta}>
            Contraseña
            <input className={campo} type="password" autoComplete="current-password" required {...register('password')} />
          </label>
          <p className="m-0 min-h-[18px] text-[13px] text-[color:var(--bad)]" role="alert">{errors.usuario?.message || errors.password?.message || mensaje}</p>
          <button type="submit" className="inline-flex w-full cursor-pointer justify-center rounded-[9px] border border-solid border-[var(--ac)] bg-[var(--ac)] p-[11px] text-sm font-medium text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] hover:brightness-[1.08] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ac)] disabled:cursor-default disabled:opacity-40 [[data-theme=dark]_&]:text-[#0b1f17]" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando…' : 'Entrar'}
          </button>
          <p className="mt-4 text-center text-[13px] text-[color:var(--mu)]">El acceso protege el uso diario. Los datos quedan guardados en Supabase.</p>
        </form>
      ) : (
        <div className={caja}>
          <h2>Configurá Supabase</h2>
          <p>Completá VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en el .env y reiniciá Vite.</p>
        </div>
      )}
    </div>
  );
}
