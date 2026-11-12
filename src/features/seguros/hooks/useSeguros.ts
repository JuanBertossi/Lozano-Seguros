import { useState, type ChangeEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leerFormularioSeguro, type FormularioSeguroServidor, type OpcionSocio } from '../api/seguros.service';
import { seguroSchema, type SeguroInput } from '../seguro.schema';
import { useListadoSeguros, useOperacionSeguro } from '../../../shared/hooks/useSeguroOperacion';
import { useRevision } from '../../../shared/hooks/useSesion';
import { hoy, sumarMeses } from '../../../shared/lib/fechas';
import { leerMonto, numeroEditable } from '../../../shared/lib/moneda';
import { presentarSeguro } from '../../../shared/lib/presentarSeguro';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';

export type FiltroSeguros = 'todos' | 'deben' | 'vencen';

/** Pantalla Seguros: solo se consulta mientras se muestra. */
export function useSeguros() {
  const visible = useNavegacion((estado) => estado.pagina === 'seguros');
  const abrir = useDialogos((estado) => estado.abrir);
  const revision = useRevision();
  const [filtro, filtrar] = useState<FiltroSeguros>('todos');
  const listado = useListadoSeguros(visible ? revision : null, null);
  const seguros = (listado.data ?? [])
    .filter((seguro) => filtro === 'todos' || (filtro === 'deben' ? seguro.vencido : seguro.vencePronto))
    .map((seguro) => presentarSeguro(seguro, false));
  return {
    visible, filtro, filtrar, seguros,
    cargando: !listado.data,
    error: listado.error instanceof Error ? listado.error.message : '',
    nuevo: () => abrir({ tipo: 'seguro' }),
    editar: (id: string) => abrir({ tipo: 'seguro', id }),
    cuota: (id: string, cuota: number) => abrir({ tipo: 'pagoSeguro', id, cuota }),
    cobrar: (sid: string, id: string, cuota: number) => abrir({ tipo: 'cobro', sid, solo: `seg|${id}|${cuota}` }),
  };
}

/** Datos del servidor para el diálogo: socios elegibles y el seguro a editar. */
export function useFormularioSeguro(id: string | null, sid: string | null) {
  const revision = useRevision();
  return useQuery({
    queryKey: ['seguros', 'formulario', revision, id, sid],
    queryFn: () => leerFormularioSeguro(revision!, id, sid),
    placeholderData: keepPreviousData, enabled: revision !== null, retry: false,
  });
}

export function useEdicionSeguro(id: string | null, sid: string | null, datos: FormularioSeguroServidor) {
  const enSocio = useNavegacion((estado) => estado.pagina === 'socio');
  const cerrar = useDialogos((estado) => estado.cerrar);
  const [nuevo, setNuevo] = useState(false);
  const [agregados, setAgregados] = useState<OpcionSocio[]>([]);
  const inicial: SeguroInput = datos.seguro
    ? { sid: datos.seguro.sid, ingreso: datos.seguro.ingreso, venc: datos.seguro.venc, desc: datos.seguro.desc, valor: numeroEditable(datos.seguro.valor), plan: datos.seguro.plan }
    : { sid: sid ?? '', ingreso: hoy(), venc: sumarMeses(hoy(), 12), desc: '', valor: '', plan: 'contado' };
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<SeguroInput>({ resolver: zodResolver(seguroSchema), defaultValues: inicial });
  const operacion = useOperacionSeguro();
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
  // Al cambiar la fecha de ingreso el vencimiento se sugiere a 12 meses, como en la maqueta.
  const campoIngreso = register('ingreso');
  function cambiarIngreso(evento: ChangeEvent<HTMLInputElement>) {
    void campoIngreso.onChange(evento);
    if (evento.target.value) setValue('venc', sumarMeses(evento.target.value, 12));
  }
  function guardar(valores: SeguroInput) {
    void operacion.enviar({ p_accion: id ? 'editar' : 'crear', p_id: id, p_datos: { ...valores, valor: leerMonto(valores.valor) } });
  }
  function eliminar() {
    if (id && confirm('¿Eliminar?')) void operacion.enviar({ p_accion: 'eliminar', p_id: id, p_datos: {} });
  }
  return {
    register, errores: Object.values(errors), operacion, socios, socio, socioFijo, nuevo, cerrar, elegirSocio, eliminar,
    campoSocio: { ...campoSocio, onChange: cambiarSocio },
    campoIngreso: { ...campoIngreso, onChange: cambiarIngreso },
    cancelarNuevo: () => setNuevo(false),
    enviar: handleSubmit(guardar),
  };
}
