import { useRef } from 'react';
import { leerMonto, numeroEditable } from '../../../shared/lib/moneda';
import { avisar } from '../../../shared/stores/avisos.store';
import { useDialogos } from '../../../shared/stores/dialogos.store';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import type { ResultadoSocio } from '../api/socios.service';
import type { SocioInput } from '../socio.schema';
import { useFichaSocio, useOperacionSocioSegura, useProximoNumeroSocio } from './useSocios';

type Accion = 'crear' | 'editar' | 'eliminar';

/** Alta, edición y baja de un socio (`id` ausente = alta). Devuelve los valores iniciales cuando ya están disponibles. */
export function useSocioFormulario(id: string | undefined) {
  const cerrar = useDialogos((estado) => estado.cerrar);
  const verSocio = useNavegacion((estado) => estado.verSocio);
  const volverASocios = useNavegacion((estado) => estado.volverASocios);
  const elegirTabSocio = useNavegacion((estado) => estado.elegirTabSocio);
  const ficha = useFichaSocio(id ?? null);
  const proximo = useProximoNumeroSocio(!id);
  const accion = useRef<Accion>('crear');

  const operacion = useOperacionSocioSegura((resultado: ResultadoSocio) => {
    cerrar();
    if (accion.current === 'eliminar') { volverASocios(); avisar('Socio eliminado'); }
    else if (accion.current === 'crear') { elegirTabSocio('det'); verSocio(resultado.id); avisar('Socio creado'); }
    else avisar('Socio actualizado');
  });

  const socio = ficha.data?.socio;
  const inicial: SocioInput | null = id
    ? socio ? { nombre: socio.nombre, nro: String(socio.nro ?? ''), tel: socio.tel || '', dir: socio.dir || '', favor: numeroEditable(socio.favor || 0), archivado: socio.activo === false } : null
    : proximo.data !== undefined ? { nombre: '', nro: proximo.data, tel: '', dir: '', favor: '', archivado: false } : null;
  const consulta = id ? ficha : proximo;

  function guardar(datos: SocioInput) {
    const comunes = { nombre: datos.nombre, nro: datos.nro, tel: datos.tel, dir: datos.dir };
    if (id) {
      accion.current = 'editar';
      void operacion.enviar({ p_accion: 'editar', p_id: id, p_datos: { ...comunes, favor: leerMonto(datos.favor), archivado: datos.archivado } });
    } else {
      accion.current = 'crear';
      void operacion.enviar({ p_accion: 'crear', p_id: null, p_datos: comunes });
    }
  }

  function eliminar() {
    if (!id || !confirm('¿Eliminar el socio y todo lo suyo (seguros, jugadas, números, rifas)? Si solo dejó de ser socio, mejor archivalo.')) return;
    accion.current = 'eliminar';
    void operacion.enviar({ p_accion: 'eliminar', p_id: id, p_datos: {} });
  }

  return {
    inicial,
    errorCarga: consulta.error instanceof Error ? consulta.error.message : '',
    cargaFallida: consulta.isError,
    reintentarCarga: () => void consulta.refetch(),
    operacion,
    guardar,
    eliminar,
    cerrar,
  };
}
