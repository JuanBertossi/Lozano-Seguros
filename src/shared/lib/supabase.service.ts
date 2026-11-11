import { QueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import type { AxiosError } from 'axios';

interface Perfil {
  id: string;
  nombre: string;
  rol: string;
}

export interface DatosAgencia {
  revision: number;
  estado: Record<string, unknown>;
  perfil: Perfil;
}

interface Guardado {
  p_revision: number;
  p_operacion: string;
  p_estado: Record<string, unknown>;
}

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const auth = url && key?.startsWith('sb_publishable_')
  ? createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: false } }).auth
  : null;
const api = axios.create({ baseURL: url ? `${url.replace(/\/$/, '')}/rest/v1/rpc/` : undefined, timeout: 20000 });
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const estadoKey = ['estado-agencia'];

export async function rpc<T>(nombre: string, parametros = {}) {
  if (!auth) throw Object.assign(new Error('Falta configurar la conexión con Supabase.'), { code: 'SIN_CONFIGURACION' });
  const { data: { session } } = await auth!.getSession();
  if (!session) throw Object.assign(new Error('La sesión venció. Volvé a ingresar.'), { code: 'SIN_SESION' });
  try {
    const { data } = await api.post<T>(nombre, parametros, {
      headers: { apikey: key, Authorization: `Bearer ${session.access_token}` },
    });
    return data;
  } catch (error) {
    const response = (error as AxiosError<{ code?: string; message?: string }>).response;
    if (response?.data.code === '42501') {
      throw Object.assign(new Error('Esta cuenta no tiene permiso para acceder a los datos de la agencia.'), { code: '42501' });
    }
    throw Object.assign(new Error(response?.data.message || 'No se pudo conectar con Supabase.'), {
      code: response?.data.code,
    });
  }
}

export const agencia = auth && {
  async ingresar(usuario: string, password: string) {
    const email = `${usuario}@lozano.example.com`;
    const { error } = await auth.signInWithPassword({ email, password });
    if (error?.code === 'invalid_credentials') throw new Error('Usuario o contraseña incorrectos.');
    if (error?.code === 'email_not_confirmed') throw new Error('La cuenta todavía no está confirmada en Supabase.');
    if (error) throw error;
  },
  async salir() {
    try {
      await auth.signOut({ scope: 'local' });
    } finally {
      queryClient.clear();
    }
  },
  leer() {
    return queryClient.fetchQuery({ queryKey: estadoKey, queryFn: () => rpc<DatosAgencia>('agencia_leer') });
  },
  async guardar(parametros: Guardado, restaurar: boolean) {
    const revision = await queryClient.getMutationCache().build(queryClient, {
      mutationFn: (entrada: Guardado) => rpc<number>(restaurar ? 'agencia_restaurar' : 'agencia_guardar', entrada),
    }).execute(parametros);
    await queryClient.invalidateQueries({ queryKey: estadoKey });
    return revision;
  },
};

