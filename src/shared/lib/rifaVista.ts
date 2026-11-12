import type { RifaListado } from '../hooks/useOperacionRifa';
type Fila=RifaListado['filas'][number];
const moneda=(valor:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:Number.isInteger(valor)?0:2,maximumFractionDigits:Number.isInteger(valor)?0:2}).format(valor);
const fecha=(valor:string)=>valor.split('-').reverse().join('/');
export function mapearFilaRifa({rifa,socio,saldo,saldada,vencido,primera,pagas,cuotas}:Fila,autor='') {
 return {id:rifa.id,sid:rifa.sid,socio,autor,numero:String(rifa.nro),anio:rifa.anio,modalidad:rifa.modo==='contado'?'Contado':`${rifa.ncuotas} cuotas`,importe:moneda(rifa.importe),saldo:saldo>0?moneda(saldo):'—',pagado:saldada,vencido,primera,contador:rifa.modo==='cuotas'?`${pagas} de ${rifa.ncuotas} pagas`:'',cuotas:cuotas.map(c=>({etiqueta:rifa.modo==='contado'?'$':String(c.indice+1),pagada:c.pagada,vencida:c.vencida,titulo:`${rifa.modo==='contado'?'Pago':'Cuota '+(c.indice+1)} · ${moneda(c.importe)} · ${c.pagada?'pagada '+fecha(c.pago!):'vence '+fecha(c.vencimiento)}`}))};
}
export { moneda as monedaRifa };
