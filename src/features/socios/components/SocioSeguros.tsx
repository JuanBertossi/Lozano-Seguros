import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useSegurosDeSocio } from '../hooks/useSegurosDeSocio';
import { autor, btnSmG, btnSmP, cuota, filaClic, filaMal, filaMalClic, filaOk, filaOkClic, pagoNo, pagoSi, tabla, tag, tagAviso, tagMalo, td, tdR, tarjeta, tarjetaCab, th, thR, vacio, h2 } from './estilos';

const tono={malo:tagMalo,aviso:tagAviso,'':tag} as const;
export function SocioSeguros(){
 const pagina=useNavegacion(e=>e.pagina),tab=useNavegacion(e=>e.tabSocio),socioId=useNavegacion(e=>e.socioId);
 return pagina==='socio'&&tab==='seg'&&socioId?<Contenido key={socioId} socioId={socioId}/>:null;
}
function Contenido({socioId}:{socioId:string}){
 const a=useSegurosDeSocio(socioId),seguros=a.seguros;
 if(!seguros)return <section aria-live="polite">{a.mensaje}</section>;
 return <section className={tarjeta}><div className={tarjetaCab}><h2 className={h2}>Seguros</h2><button className={btnSmP} onClick={a.agregar}>+ Seguro</button></div>{seguros.length?<div className="overflow-x-auto"><table className={tabla}><thead><tr><th className={th}>Ingreso</th><th className={th}>Vence</th><th className={th}>Descripción</th><th className={th}>Forma de pago</th><th className={thR}>Valor</th><th className={th}>Cuotas</th><th className={th}>Pago</th><th className={th}/></tr></thead><tbody>{seguros.map(x=><tr key={x.id} className={x.pagado?`${filaOk} ${filaOkClic}`:x.vencido?`${filaMal} ${filaMalClic}`:filaClic} onClick={()=>a.editar(x.id)}><td className={td}>{x.ingreso}</td><td className={td}><span className={tono[x.tono]}>{x.vencimiento}</span></td><td className={td}>{x.descripcion}{x.autor&&<><br/><span className={autor}>{x.autor}</span></>}</td><td className={td}>{x.plan}</td><td className={tdR}>{x.valor}</td><td className={td}><div className="flex gap-[3px]">{x.cuotas.map((c,i)=><button key={i} title={c.titulo} className={cuota(c.pagada,c.vencida)} onClick={e=>{e.stopPropagation();a.cuota(x.id,i)}}>{c.numero}</button>)}</div></td><td className={td}>{x.pagado?<span className={pagoSi}>✓ Pagado</span>:<button className={pagoNo} onClick={e=>{e.stopPropagation();a.cobrar(x.id,x.primeraPendiente ?? undefined)}}>{x.etiquetaCobro}</button>}</td><td className={td}><button className={btnSmG} onClick={e=>{e.stopPropagation();a.editar(x.id)}}>Editar</button></td></tr>)}</tbody></table></div>:<p className={vacio}>No tiene seguros.</p>}</section>;
}
