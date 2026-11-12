import { useState, type ChangeEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leerFormularioRifa, type FormularioRifaServidor, type OpcionSocio } from '../api/rifa.service';
import { rifaSchema, type RifaInput } from '../rifa.schema';
import { useContextoRifa, useListadoRifa, useOperacionRifa } from '../../../shared/hooks/useOperacionRifa';
import { useRevision } from '../../../shared/hooks/useSesion';
import { leerMonto, numeroEditable } from '../../../shared/lib/moneda';
import { descargarRifaPdf } from '../../../shared/lib/pdfListado';
import { mapearFilaRifa, monedaRifa } from '../../../shared/lib/rifaVista';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';

// `Intl` separa el símbolo con un espacio duro, que el PDF no dibuja.
const textoPdf = (valor: string) => valor.replace(/ /g, ' ');

/** Pantalla Rifa Devoto: solo se consulta mientras se muestra. */
export function useRifa() {
  const visible = useNavegacion((estado) => estado.pagina === 'juegos' && estado.juego === 'rifa');
  const anio = useNavegacion((estado) => estado.anioRifa);
  const filtro = useNavegacion((estado) => estado.filtro);
  const cambiarAnio = useNavegacion((estado) => estado.elegirAnioRifa);
  const filtrar = useNavegacion((estado) => estado.elegirFiltro);
  const verSocio = useNavegacion((estado) => estado.verSocio);
  const abrir = useDialogos((estado) => estado.abrir);
  const revision = useRevision();
  const listado = useListadoRifa(visible ? revision : null, anio, null, filtro);
  const contexto = useContextoRifa(visible ? revision : null);
  const datos = listado.data;
  const autores = contexto.data?.autores ?? {};
  const filas = (datos?.filas ?? []).filter((fila) => filtro === 'todos' || (filtro === 'pagados' ? fila.saldada : !fila.saldada));

  function exportarPdf() {
    if (!datos || listado.isPlaceholderData) return;
    void descargarRifaPdf({
      filtro, anio,
      filas: filas.map((fila) => [
        fila.socio, String(fila.rifa.nro), fila.rifa.modo === 'contado' ? 'Contado' : `${fila.rifa.ncuotas} cuotas`,
        textoPdf(monedaRifa(fila.rifa.importe)), textoPdf(monedaRifa(fila.pagado)), textoPdf(monedaRifa(fila.saldo > 0 ? fila.saldo : 0)),
        fila.saldada ? 'Pagada' : 'Debe',
      ]),
      cobrado: textoPdf(monedaRifa(datos.cobradoFiltrado)),
      falta: textoPdf(monedaRifa(datos.faltaFiltrado)),
    });
  }

  return {
    visible, anio, filtro, cambiarAnio, filtrar, verSocio, exportarPdf,
    anios: contexto.data?.anios ?? [anio],
    cargando: !datos,
    error: listado.error instanceof Error ? listado.error.message : '',
    resumen: datos && {
      precio: monedaRifa(datos.precio), ncuotas: datos.ncuotas, cuota: monedaRifa(datos.cuota), cantidad: datos.cantidad,
      total: monedaRifa(datos.total), cobrado: monedaRifa(datos.cobrado), falta: monedaRifa(datos.falta), deuda: datos.falta > 0,
    },
    filas: filas.map((fila) => mapearFilaRifa(fila, autores[fila.rifa.id] ?? '')),
    vender: () => abrir({ tipo: 'rifa' }),
    editar: (id: string) => abrir({ tipo: 'rifa', id }),
    cuotaPago: (id: string, cuota: number) => abrir({ tipo: 'pagoRifa', id, cuota }),
    cobrar: (sid: string, id: string, cuota: number) => abrir({ tipo: 'cobro', sid, solo: `rifa|${id}|${cuota}` }),
  };
}

/** Datos del servidor para el diálogo: socios elegibles, precio vigente y la rifa a editar. */
export function useFormularioRifa(id: string | null, sid: string | null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['rifa', 'formulario', revision, id, sid],
    queryFn: () => leerFormularioRifa(revision!, id, sid),
    placeholderData: keepPreviousData, enabled: revision !== null, retry: false,
  });
}

export function useEdicionRifa(id: string | null, sid: string | null, datos: FormularioRifaServidor) {
  const anioRifa = useNavegacion((estado) => estado.anioRifa);
  const enSocio = useNavegacion((estado) => estado.pagina === 'socio');
  const cerrar = useDialogos((estado) => estado.cerrar);
  const [nuevo, setNuevo] = useState(false);
  const [agregados, setAgregados] = useState<OpcionSocio[]>([]);
  const inicial: RifaInput = datos.rifa
    ? { sid: datos.rifa.sid, numero: datos.rifa.nro, anio: String(datos.rifa.anio), importe: numeroEditable(datos.rifa.importe), modo: datos.rifa.modo }
    : { sid: sid ?? '', numero: '', anio: String(anioRifa), importe: numeroEditable(datos.precio), modo: 'contado' };
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<RifaInput>({ resolver: zodResolver(rifaSchema), defaultValues: inicial });
  const operacion = useOperacionRifa();
  const socios = [...datos.socios, ...agregados.filter((agregado) => !datos.socios.some((socio) => socio.id === agregado.id))];
  const socioFijo = enSocio && !!inicial.sid;
  const socio = socios.find((opcion) => opcion.id === inicial.sid);

  function elegirSocio(elegido: OpcionSocio) {
    setAgregados((actuales) => [...actuales, elegido]);
    setValue('sid', elegido.id, { shouldValidate: true });
    setNuevo(false);
  }
  const campoSocio = register('sid');
  function cambiarSocio(evento: ChangeEvent<HTMLSelectElement>) {
    if (evento.target.value === '__new') { setNuevo(true); setValue('sid', ''); return; }
    void campoSocio.onChange(evento);
  }
  function guardar(valores: RifaInput) {
    void operacion.enviar({ tipo: 'guardar', p_id: id, p_datos: { ...valores, anio: Number(valores.anio), importe: leerMonto(valores.importe) } });
  }
  function eliminar() {
    if (id && confirm('¿Eliminar?')) void operacion.enviar({ tipo: 'operar', p_accion: 'eliminar', p_id: id, p_datos: {} });
  }
  return {
    register, errores: Object.values(errors), operacion, socios, socio, socioFijo, nuevo, cerrar, elegirSocio, eliminar,
    campoSocio: { ...campoSocio, onChange: cambiarSocio },
    cancelarNuevo: () => setNuevo(false),
    enviar: handleSubmit(guardar),
  };
}
