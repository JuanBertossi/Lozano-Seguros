import { useRef, useState, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { obtenerRevision, useRevision } from '../../../shared/hooks/useSesion';
import { queryClient } from '../../../shared/lib/supabase.service';
import { avisar } from '../../../shared/stores/avisos.store';
import { useDialogos, type Dialogo } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { loteriaService, type FormularioVenta, type SocioOpcion } from '../api/loteria.service';
import { moneda } from '../../../shared/lib/moneda';
import { ventaSchema, type VentaInput } from '../loteria.schema';
import { useEliminarVenta, useFijoSocio, useGuardarVenta, usePreviaVenta } from './useVenta';

export type ParametrosVenta = Extract<Dialogo, { tipo: 'venta' }>;
type Inicial = NonNullable<FormularioVenta['inicial']>;

// Si el pago se invalidó al editar, el diálogo de cobro tiene que ofrecer la venta de nuevo.
async function ventaACobrar(id: string, existente: boolean) {
  const pendiente = 'lot|' + id;
  if (!existente) return pendiente;
  const revision = obtenerRevision();
  if (revision === null) return pendiente;
  try {
    const datos = await queryClient.fetchQuery({ queryKey: ['loteria', 'formulario', revision, id, null, null], queryFn: () => loteriaService.formulario(revision, id, null, null) });
    return datos.venta?.pagado ? undefined : pendiente;
  } catch {
    return pendiente;
  }
}

function avisarLiberado(liberado: number) {
  if (liberado > 0) setTimeout(() => avisar(`Lo que ya había pagado (${moneda(liberado)}) quedó como saldo a favor`), 2500);
}

/** Formulario de venta de lotería: `openVenta` y `saveVenta` de la maqueta. */
export function useVentaFormulario(params: ParametrosVenta, datos: FormularioVenta, inicial: Inicial) {
  const revision = useRevision();
  const pagina = useNavegacion((estado) => estado.pagina);
  const abrir = useDialogos((estado) => estado.abrir);
  const cerrar = useDialogos((estado) => estado.cerrar);
  const [extras, setExtras] = useState<SocioOpcion[]>([]);
  const [nuevo, setNuevo] = useState(false);
  const cobrar = useRef(false);
  const buscarFijo = useFijoSocio();
  const { register, handleSubmit, setValue, getValues, control, formState: { errors } } = useForm<VentaInput>({
    resolver: zodResolver(ventaSchema),
    defaultValues: { sid: inicial.sid, soId: inicial.soId, numero: inicial.numero, frac: String(inicial.frac), fijo: false },
  });
  const soId = useWatch({ control, name: 'soId' });
  const frac = useWatch({ control, name: 'frac' });
  const sorteo = datos.sorteos.find((x) => x.id === soId);
  const socios = [...datos.socios, ...extras.filter((x) => !datos.socios.some((s) => s.id === x.id))];
  const socioFijo = pagina === 'socio' && !!inicial.sid && socios.some((s) => s.id === inicial.sid);

  const previa = usePreviaVenta(revision !== null && soId && /^\d+$/.test(frac) && Number(frac) > 0 && Number(frac) <= (sorteo?.frac ?? 0)
    ? { p_revision: revision, p_sorteo_id: soId, p_fracciones: Number(frac), p_venta_id: params.id ?? null }
    : null);
  const resumen = previa.data ? `${previa.data.entero ? 'Entero · ' : ''}${previa.data.fracciones} × ${moneda(previa.data.precio)} = ${moneda(previa.data.total)}` : '';

  const guardado = useGuardarVenta({
    alExito: (resultado) => {
      avisar('Venta guardada');
      avisarLiberado(resultado.liberado);
      if (!cobrar.current) { cerrar(); return; }
      const sid = getValues('sid');
      void ventaACobrar(resultado.id, params.id !== undefined).then((solo) => abrir({ tipo: 'cobro', sid, solo }));
    },
  });
  const eliminacion = useEliminarVenta({
    alExito: (resultado) => { avisar('Eliminado'); avisarLiberado(resultado.liberado); cerrar(); },
  });

  async function aplicarFijo(sid: string) {
    if (getValues('numero')) return;
    const fijo = await buscarFijo(sid);
    const actual = datos.sorteos.find((x) => x.id === getValues('soId'));
    if (!fijo || !actual || getValues('numero')) return;
    setValue('numero', String(fijo.numero));
    setValue('frac', String(fijo.frac ? Math.min(fijo.frac, actual.frac) : actual.frac));
  }
  function elegir(socio: SocioOpcion) {
    setExtras((anteriores) => (anteriores.some((x) => x.id === socio.id) ? anteriores : [...anteriores, socio]));
    setValue('sid', socio.id, { shouldValidate: true });
    void aplicarFijo(socio.id);
    setNuevo(false);
  }

  const socioCampo = register('sid');
  const sorteoCampo = register('soId');
  const campos = {
    socio: {
      ...socioCampo,
      onChange: (evento: ChangeEvent<HTMLSelectElement>) => {
        if (evento.target.value === '__new') { setNuevo(true); setValue('sid', ''); return; }
        void socioCampo.onChange(evento);
        void aplicarFijo(evento.target.value);
      },
    },
    sorteo: {
      ...sorteoCampo,
      onChange: (evento: ChangeEvent<HTMLSelectElement>) => {
        void sorteoCampo.onChange(evento);
        const elegido = datos.sorteos.find((x) => x.id === evento.target.value);
        if (elegido) setValue('frac', String(Math.min(Number(getValues('frac')) || elegido.frac, elegido.frac)));
      },
    },
    numero: register('numero'),
    frac: register('frac'),
    fijo: register('fijo'),
  };

  const enviar = (cobrando: boolean) => handleSubmit((valores) => {
    cobrar.current = cobrando;
    void guardado.enviar({ p_id: params.id ?? null, p_datos: { ...valores, frac: Number(valores.frac) } });
  });

  return {
    campos, socios, socioFijo, sorteo, nuevo, setNuevo, elegir, resumen, guardado, eliminacion, cerrar,
    esEdicion: params.id !== undefined,
    socioInicial: socios.find((x) => x.id === inicial.sid),
    errorPrevia: previa.error instanceof Error ? previa.error.message : '',
    mensajes: Object.values(errors).flatMap((error) => (error?.message ? [error.message] : [])),
    bloqueado: guardado.bloqueado || eliminacion.bloqueado,
    guardar: enviar(false),
    guardarYCobrar: () => void enviar(true)(),
    eliminar: () => { if (params.id && confirm('¿Eliminar?')) void eliminacion.enviar({ p_id: params.id }); },
  };
}
