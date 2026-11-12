import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { avisar } from '../../../shared/stores/avisos.store';
import { fechaCorta, hoy } from '../../../shared/lib/fechas';
import type { DatosToto, PlanillaToto } from '../api/toto.service';
import { totoSchema, type TotoInput } from '../toto.schema';
import { filasVistaPrevia, jugadasEditables, JUEGOS, leerNumero, numeroEditable } from '../lib/totoVista';
import { useOperacionToto, usePeriodosToto, useVistaToto } from './useToto';

type DatosVista = Omit<DatosToto, 'conc'>;

const datosVista = (d: TotoInput): DatosVista => ({
  fecha: d.fecha, premios: leerNumero(d.premios), premiosAg: leerNumero(d.premiosAg),
  ...Object.fromEntries(JUEGOS.map(({ id }) => [id, leerNumero(d.jugadas[id] ?? '')])),
} as DatosVista);

interface Entrada {
  id: string | null;
  /** Fecha con la que se abre un día nuevo (la que se está viendo en la planilla). */
  fecha?: string;
  planilla?: PlanillaToto;
}

/** Cargar o editar un día de Toto Ortega (`openToto`, `saveToto` y `delToto` de la maqueta). */
export function useTotoFormulario({ id, fecha, planilla }: Entrada) {
  const cerrar = useDialogos((estado) => estado.cerrar);
  const elegirMesToto = useNavegacion((estado) => estado.elegirMesToto);
  const elegirDiaToto = useNavegacion((estado) => estado.elegirDiaToto);
  const inicial: TotoInput = {
    fecha: planilla?.datos.fecha ?? fecha ?? hoy(),
    jugadas: planilla ? jugadasEditables(planilla.datos) : Object.fromEntries(JUEGOS.map(({ id: juego }) => [juego, ''])),
    // Vacío = «sin tocar»: el campo muestra el número que sugiere el servidor.
    concursos: {},
    premios: numeroEditable(planilla?.datos.premios),
    premiosAg: numeroEditable(planilla?.datos.premiosAg),
  };
  const formulario = useForm<TotoInput>({ resolver: zodResolver(totoSchema), defaultValues: inicial });
  const observados = useWatch({ control: formulario.control }) as TotoInput;
  const valores: TotoInput = {
    ...inicial, ...observados,
    jugadas: { ...inicial.jugadas, ...observados.jugadas },
    concursos: { ...inicial.concursos, ...observados.concursos },
  };
  const periodos = usePeriodosToto();
  const vista = useVistaToto(totoSchema.safeParse(valores).success ? { p_fecha: valores.fecha, p_datos: datosVista(valores), p_id: id } : null);
  const sugeridos = vista.data?.concursosActuales;
  const operacion = useOperacionToto(({ accion, fecha: guardada }) => {
    cerrar();
    avisar(accion === 'eliminar' ? 'Eliminado' : 'Día guardado');
    if (guardada) { elegirMesToto(guardada.slice(0, 7)); elegirDiaToto(guardada); }
  });

  // Lo escrito a mano manda; si no se tocó, se guarda el número sugerido (como el campo que se completa solo en la maqueta).
  const guardar = formulario.handleSubmit((d) => {
    const conc = Object.fromEntries(JUEGOS.map(({ id: juego }) => {
      const escrito = d.concursos[juego];
      const numero = escrito !== undefined ? parseInt(escrito, 10) : sugeridos?.[juego];
      return [juego, numero && numero > 0 ? numero : null];
    }));
    void operacion.enviar({ p_accion: id ? 'editar' : 'crear', p_id: id, p_datos: { ...datosVista(d), conc } });
  });

  function eliminar() {
    if (id && confirm('¿Eliminar este día de la planilla?')) void operacion.enviar({ p_accion: 'eliminar', p_id: id, p_datos: {} });
  }

  return {
    register: formulario.register,
    control: formulario.control,
    errores: formulario.formState.errors,
    sugeridos,
    filas: vista.data && periodos.data ? filasVistaPrevia(vista.data.calculo, periodos.data.porcentaje) : [],
    duplicado: vista.data?.duplicado ? `Ojo: ya hay un día cargado el ${fechaCorta(valores.fecha)}. Si guardás, queda otra fila con esa fecha.` : '',
    errorConsulta: vista.error instanceof Error ? vista.error.message : '',
    reintentarConsulta: () => { void vista.refetch(); },
    puedeGuardar: !operacion.bloqueado && Boolean(vista.data) && !vista.isFetching,
    operacion,
    guardar,
    eliminar,
    cerrar,
  };
}
