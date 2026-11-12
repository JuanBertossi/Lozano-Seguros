import { useQuery } from '@tanstack/react-query';
import { useOperacionSegura } from './useOperacionSegura';
import { segurosService, type AccionSeguro, type ResultadoSeguro, type SolicitudSeguro } from '../lib/seguros.service';
import { monedaSeguro } from '../lib/presentarSeguro';
import { avisar } from '../stores/avisos.store';
import { useDialogos } from '../stores/dialogos.store';

export type ResultadoOperacionSeguro = ResultadoSeguro & { accion: AccionSeguro };
export type EntradaSeguro = Omit<SolicitudSeguro, 'p_revision' | 'p_operacion'>;

export function useListadoSeguros(revision:number|null,socioId:string|null) {
  return useQuery({
    queryKey:['seguros','listado',revision,socioId],
    queryFn:()=>segurosService.listar(revision!,socioId),
    // Al confirmarse una operación cambia la revisión: se muestra lo anterior hasta que llegue lo nuevo.
    placeholderData:(previo,consulta)=>consulta?.queryKey[3]===socioId?previo:undefined,
    enabled:revision!==null,retry:false,
  });
}

/** Mensajes de la maqueta: `done(...)` y el aviso de saldo a favor 2,5 s después. */
export function avisarResultadoSeguro({accion,liberado}:ResultadoOperacionSeguro) {
  avisar(accion==='pagar_cuota'?'Pago registrado':accion==='quitar_pago'?'Cuota desmarcada':accion==='anular_cuota'?'Movimiento anulado':accion==='eliminar'?'Eliminado':'Seguro guardado');
  if(liberado>0){
    const monto=monedaSeguro(liberado);
    const texto=accion==='quitar_pago'||accion==='anular_cuota'?`${monto} quedaron como saldo a favor`
      :accion==='editar'?`Lo que ya había pagado de cuotas cambiadas (${monto}) quedó como saldo a favor`
      :`Lo que ya había pagado (${monto}) quedó como saldo a favor`;
    setTimeout(()=>avisar(texto),2500);
  }
}

/**
 * Crear, editar, eliminar, pagar, desmarcar o anular una cuota de seguro.
 * Sin `alExito`: cierra el diálogo abierto y avisa como la maqueta.
 */
export function useOperacionSeguro(opciones:{alExito?:(resultado:ResultadoOperacionSeguro)=>void}={}) {
  return useOperacionSegura<EntradaSeguro,ResultadoOperacionSeguro>(
    async (solicitud)=>({...await segurosService.operar(solicitud),accion:solicitud.p_accion}),
    {alExito:opciones.alExito??((resultado)=>{useDialogos.getState().cerrar();avisarResultadoSeguro(resultado)})},
  );
}
