import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAgregarAnioLoteria } from '../../../shared/hooks/useAgregarAnioLoteria';
import { useSesion } from '../../../shared/hooks/useSesion';
import { hoy } from '../../../shared/lib/fechas';
import { useAuth } from '../../../shared/stores/auth.store';
import { avisar } from '../../../shared/stores/avisos.store';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { leerRespaldo } from '../api/ajustes.service';
import type { AjustesInput } from '../ajustes.schema';
import { configuracionInicial, diasTotoIniciales, resumenSorteos } from '../lib/ajustesVista';
import { leerMonto } from '../../../shared/lib/moneda';
import { useAjustes, useConfiguracion, useReiniciarAgencia, useRestaurarRespaldo } from './useConfiguracion';

function descargarJson(datos: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(datos)], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'socios-' + hoy() + '.json';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Todo lo que la página de Ajustes hacía con `publicarAjustes`, leído y guardado en el servidor. */
export function useAjustesPagina() {
  const ajustes = useAjustes();
  const perfil = useSesion().data?.perfil;
  const navegar = useNavegacion((estado) => estado.navegar);
  const bloqueadoGlobal = useNavegacion((estado) => estado.bloqueado);
  const abrir = useDialogos((estado) => estado.abrir);
  const salir = useAuth((estado) => estado.salir);
  const aviso = useRef('');

  const configuracion = useConfiguracion({ alExito: () => avisar(aviso.current) });
  const alRestaurar = () => { navegar('inicio'); avisar('Respaldo cargado'); };
  const reinicio = useReiniciarAgencia({ alExito: () => { navegar('inicio'); avisar('Listo, empezás de cero'); } });
  const restauracion = useRestaurarRespaldo({ alExito: alRestaurar });
  const anio = useAgregarAnioLoteria({ alExito: (resultado) => avisar(resultado.cantidad ? `${resultado.cantidad} sorteos agregados` : 'Ya estaban cargados') });
  const descarga = useMutation({ mutationFn: leerRespaldo, onSuccess: descargarJson, onError: (error) => avisar(error.message) });

  const datos = ajustes.data;

  function guardarPrecios(valores: AjustesInput) {
    aviso.current = 'Precios guardados';
    void configuracion.enviar({
      p_accion: 'precios',
      p_datos: { ...valores, q6Precio: leerMonto(valores.q6Precio), q6Dias: valores.q6Dias.map(Number), fracPrecio: leerMonto(valores.fracPrecio), rifaImporte: leerMonto(valores.rifaImporte), rifaCuotas: Number(valores.rifaCuotas) },
    });
  }
  function guardarDias(dias: Record<string, string[]>) {
    const juegos = datos?.juegos ?? [];
    const seleccion = Object.fromEntries(juegos.map((juego) => [juego.id, Array.isArray(dias[juego.id]) ? dias[juego.id].map(Number) : []]));
    const vacios = juegos.filter((juego) => !seleccion[juego.id].length).map((juego) => juego.nombre);
    if (vacios.length) { avisar('Marcá al menos un día para: ' + vacios.join(', ')); return; }
    aviso.current = 'Días de sorteo guardados';
    void configuracion.enviar({ p_accion: 'toto_dias', p_datos: seleccion });
  }
  function restablecerDias() {
    aviso.current = 'Días restablecidos';
    void configuracion.enviar({ p_accion: 'toto_restablecer', p_datos: {} });
  }
  async function restaurar(archivo: File) {
    let respaldo: Record<string, unknown>;
    try {
      const leido: unknown = JSON.parse(await archivo.text());
      if (!leido || typeof leido !== 'object' || Array.isArray(leido) || !Array.isArray((leido as { socios?: unknown }).socios)) throw new Error('Respaldo inválido');
      respaldo = leido as Record<string, unknown>;
    } catch {
      avisar('El archivo no es un respaldo válido');
      return;
    }
    if (confirm('Esto reemplaza todos los datos de negocio de la agencia. ¿Seguir?')) void restauracion.enviar({ p_estado: respaldo });
  }
  function borrarTodo() {
    if (confirm('¿Borrar TODOS los datos de negocio?')) void reinicio.enviar({});
  }

  return {
    cargando: datos === undefined,
    error: ajustes.error instanceof Error ? ajustes.error.message : '',
    config: datos ? configuracionInicial(datos.config) : null,
    sorteos: datos ? resumenSorteos(datos.sorteos) : [],
    juegos: datos?.juegos ?? [],
    diasToto: datos ? diasTotoIniciales(datos.juegos) : {},
    usuarios: datos?.usuarios ?? [],
    perfil,
    esAdministrador: perfil?.rol === 'administrador',
    configuracion, reinicio, restauracion, anio, descarga,
    sesionBloqueada: bloqueadoGlobal,
    guardarPrecios, guardarDias, restablecerDias, restaurar, borrarTodo,
    agregarAnio: () => void anio.enviar({}),
    abrirSorteo: (id?: string) => abrir({ tipo: 'sorteo', id }),
    descargar: () => descarga.mutate(),
    salir: () => void salir(),
  };
}
