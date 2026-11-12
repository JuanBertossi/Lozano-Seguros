import { rpc } from '../../../shared/lib/supabase.service';
export interface ResultadoQuiniela { revision:number; ids:string[]; liberado:number }
export interface SolicitudQuiniela { p_revision:number; p_operacion:string; p_accion:'crear'|'editar'|'editar_pago'|'anular_pago'|'anular'|'eliminar'|'marcar'|'desmarcar'; p_id:string|null; p_datos:Record<string,unknown> }
export interface FilaQuinielaServidor { jugada:{id:string;sid:string;fecha:string;numeros:string;monto:number;pagado:boolean;abono?:number;ts?:string;por?:string;modPor?:string;modTs?:string};socio:string;restante:number;nombreAutor:string;nombreEditor:string }
export interface ListadoQuiniela { fecha:string;dias:number;cantidad:number;total:number;cobrado:number;falta:number;otrosTotal:number;filas:FilaQuinielaServidor[];otros:FilaQuinielaServidor[] }
export interface SocioOpcion { id:string; nombre:string; nro:string }
export interface FormularioQuiniela { jugada:{id:string;sid:string;fecha:string;numeros:string;monto:number}|null; socios:SocioOpcion[] }
export const quinielaService={
 operar:(solicitud:SolicitudQuiniela)=>rpc<ResultadoQuiniela>('agencia_quiniela_operar',solicitud),
 listar:(revision:number,fecha:string)=>rpc<ListadoQuiniela>('agencia_quiniela_listar',{p_revision:revision,p_fecha:fecha}),
 formulario:(revision:number,id:string|null,socioId:string|null)=>rpc<FormularioQuiniela>('agencia_quiniela_formulario',{p_revision:revision,p_id:id,p_socio_id:socioId}),
};
