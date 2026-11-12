import type { CuotaSeguro, SeguroListado } from './seguros.service';
import { fechaCorta as fecha } from './fechas';

export const monedaSeguro=(n:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:Number.isInteger(n)?0:2}).format(n);
const medios:Record<string,string>={efectivo:'Efectivo',transferencia:'Transferencia',echeq:'E-cheq',cheque:'Cheque físico',mp:'Mercado Pago'};
const planes:Record<string,string>={contado:'Contado','3':'3 cuotas','6':'6 cuotas','12':'12 cuotas'};
function medioTexto(c:CuotaSeguro){
  if(!c.medio)return '';
  const d=c.det;const nombre=medios[c.medio]||'';
  if(!d)return nombre;
  return nombre+[d.banco,d.nro?'N° '+d.nro:'',d.librador,d.fcobro?(c.medio==='echeq'?'paga ':'cobro ')+fecha(d.fcobro):'',d.dep?'depositado':''].filter(Boolean).map(x=>' · '+x).join('');
}
/** Igual que `vtag` de la maqueta: vencido o hoy en rojo, dentro de 7 días en ámbar, el resto neutro. */
export type TonoVencimiento='malo'|'aviso'|'';
export function presentarSeguro(s:SeguroListado,incluirMedio=true){
  const vencimiento=s.dias<0?'Venció hace '+Math.abs(s.dias)+' d':s.dias===0?'Vence hoy':s.dias<=7?'Vence en '+s.dias+' d':'Vence '+fecha(s.venc);
  const tono:TonoVencimiento=s.dias<=0?'malo':s.dias<=7?'aviso':'';
  return { ...s,ingreso:fecha(s.ingreso),vencimiento,tono,plan:planes[s.plan]||'',valor:monedaSeguro(s.valor),
    etiquetaCobro:s.pagado?'':s.vencido?'Cobrar '+monedaSeguro(s.totalVencido):'Cobrar',
    cuotas:s.cuotas.map(c=>({numero:s.cuotas.length>1?String(c.n):'$',pagada:!!c.pago,vencida:!!c.vencida,
      titulo:(s.cuotas.length>1?'Cuota '+c.n:'Pago')+' · vence '+fecha(c.venc)+' · '+monedaSeguro(c.imp)+(c.pago?' · pagada '+fecha(c.pago)+(incluirMedio&&c.medio?' ('+medioTexto(c)+')':''):'')})),
  };
}
