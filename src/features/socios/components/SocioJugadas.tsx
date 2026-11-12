import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useJugadasDeSocio } from '../hooks/useJugadasDeSocio';
import { btnSm, btnSmG, btnSmP, filaMal, filaMalClic, filaOk, filaOkClic, filaPar, mono, pagoNo, pagoSi, parcial, tabla, tag, tagAviso, td, tdR, tarjeta, tarjetaCab, th, thR, vacio, h2 } from './estilos';

export function SocioJugadas(){
 const pagina=useNavegacion(e=>e.pagina),tab=useNavegacion(e=>e.tabSocio),socioId=useNavegacion(e=>e.socioId);
 return pagina==='socio'&&(tab==='q6'||tab==='qui')&&socioId?<Contenido key={`${socioId}|${tab}`} socioId={socioId} quini={tab==='q6'}/>:null;
}
function Contenido({socioId,quini}:{socioId:string;quini:boolean}){
 const a=useJugadasDeSocio(socioId,quini),filas=a.filas;
 if(!filas)return <section aria-live="polite">{a.mensaje}</section>;
 return <section className={tarjeta}><div className={tarjetaCab}><h2 className={h2}>{quini?'Jugadas':'Quiniela'}</h2><div className="flex flex-wrap gap-2">{quini&&<button className={btnSm} onClick={a.plan}>Administrar días</button>}<button className={btnSmP} onClick={a.agregar}>+ Jugada</button></div></div>{filas.length?<div className="overflow-x-auto"><table className={tabla}><thead><tr><th className={th}>{quini?'Sorteo':'Fecha'}</th>{!quini&&<th className={th}>Números</th>}<th className={thR}>Monto</th><th className={th}>Pago</th><th className={th}/></tr></thead><tbody>{filas.map(x=><tr key={x.id} className={`${x.pagado?filaOk:quini&&x.abono?filaPar:filaMal} ${quini?'':x.pagado?filaOkClic:filaMalClic}`} onClick={quini?undefined:()=>a.editar(x.id)}><td className={td}>{x.fecha}{x.especial&&<> <span className={tagAviso}>★ especial</span></>}{x.automatica&&<> <span className={tag}>automática</span></>}</td>{!quini&&<td className={`${td} ${mono}`}>{x.numeros}</td>}<td className={tdR}>{x.monto}</td><td className={td}><button className={x.pagado?pagoSi:pagoNo} onClick={e=>{e.stopPropagation();if(x.pagado)a.pago(x.id);else a.cobrar(x.id)}}>{x.pagado?'✓ Pagado · editar':x.abono?`Cobrar ${x.restante}`:'Cobrar'}</button>{x.abono&&!x.pagado&&<span className={parcial}>Pagó {x.abono} de {x.monto}</span>}</td><td className={quini?tdR:td}><button className={btnSmG} onClick={e=>{e.stopPropagation();a.editar(x.id)}}>Editar</button></td></tr>)}</tbody></table></div>:<p className={vacio}>Sin jugadas.</p>}</section>;
}
