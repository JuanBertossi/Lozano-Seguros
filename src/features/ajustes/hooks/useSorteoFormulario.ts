import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSorteoOperacion } from '../../../shared/hooks/useSorteoOperacion';
import { avisar } from '../../../shared/stores/avisos.store';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { sorteoSchema, type SorteoInput } from '../ajustes.schema';
import { leerMonto } from '../../../shared/lib/moneda';

/** Formulario de sorteo de lotería: `openSorteo`, `saveSorteo` y `delSorteo` de la maqueta. */
export function useSorteoFormulario(id: string | undefined, inicial: SorteoInput, ventas: number) {
  const cerrar = useDialogos((estado) => estado.cerrar);
  const eliminando = useRef(false);
  const operacion = useSorteoOperacion({
    alExito: () => {
      if (eliminando.current && useNavegacion.getState().sorteoId === id) useNavegacion.getState().elegirSorteo(null);
      avisar(eliminando.current ? 'Sorteo eliminado' : 'Sorteo guardado');
      cerrar();
    },
  });
  const { register, handleSubmit, formState: { errors } } = useForm<SorteoInput>({ resolver: zodResolver(sorteoSchema), defaultValues: inicial });

  return {
    register, operacion, cerrar,
    esEdicion: id !== undefined,
    mensajes: Object.values(errors).flatMap((error) => (error?.message ? [error.message] : [])),
    guardar: handleSubmit((datos) => {
      eliminando.current = false;
      void operacion.enviar({ p_accion: id ? 'editar' : 'crear', p_id: id ?? null, p_datos: { ...datos, frac: Number(datos.frac), precio: leerMonto(datos.precio) } });
    }),
    eliminar: () => {
      if (!id) return;
      const mensaje = ventas ? `Este sorteo tiene ${ventas} ventas. ¿Eliminarlo igual con sus ventas?` : '¿Eliminar este sorteo?';
      if (!confirm(mensaje)) return;
      eliminando.current = true;
      void operacion.enviar({ p_accion: 'eliminar', p_id: id, p_datos: {} });
    },
  };
}
