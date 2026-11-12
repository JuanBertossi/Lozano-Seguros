import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useRifasDeSocio } from '../hooks/useRifasDeSocio';
import { btnSmG, btnSmP, cuota, filaMal, filaOk, mono, pagoNo, pagoSi, tabla, tag, td, tdR, tarjeta, tarjetaCab, th, thR, vacio, h2 } from './estilos';

export function SocioRifas(){
 const pagina=useNavegacion(e=>e.pagina),tab=useNavegacion(e=>e.tabSocio),socioId=useNavegacion(e=>e.socioId);
 return pagina==='socio'&&tab==='rifa'&&socioId?<Contenido key={socioId} socioId={socioId}/>:null;
}
function Contenido({socioId}:{socioId:string}){
 const a=useRifasDeSocio(socioId),filas=a.filas;
 if(!filas)return <section aria-live="polite">{a.mensaje}</section>;
 return <section className={tarjeta}><div className={tarjetaCab}><h2 className={h2}>Rifa Devoto</h2><button className={btnSmP} onClick={a.agregar}>+ Rifa</button></div>{filas.length?<div className="overflow-x-auto"><table className={tabla}><thead><tr><th className={th}>Rifa</th><th className={th}>Modalidad</th><th className={thR}>Importe</th><th className={th}>Pagos</th><th className={thR}>Estado</th><th className={th}/><th className={th}/></tr></thead><tbody>{filas.map(r=><tr key={r.id} className={r.pagado?filaOk:r.vencido?filaMal:undefined}><td className={`${td} whitespace-nowrap`}>N° <span className={mono}>{r.numero}</span> <span className="text-[13px] text-[var(--mu)]">{r.anio}</span></td><td className={td}><span className={tag}>{r.modalidad}</span></td><td className={tdR}>{r.importe}</td><td className={td}><div className="flex gap-[3px]">{r.cuotas.map((c,i)=><button key={i} title={c.titulo} className={cuota(c.pagada,c.vencida)} onClick={()=>a.cuotaPago(r.id,i)}>{c.etiqueta}</button>)}</div>{r.contador&&<span className="block text-[13px] text-[var(--mu)]">{r.contador}</span>}</td><td className={`${tdR} ${r.pagado?'text-[var(--ok)]':r.vencido?'text-[var(--bad)]':''}`}>{r.saldo}</td><td className={td}>{r.pagado?<span className={pagoSi}>✓ Pagada</span>:<button className={pagoNo} onClick={()=>a.cobrar(r.id,r.primera)}>Cobrar</button>}</td><td className={`${td} text-right`}><button className={btnSmG} onClick={()=>a.editar(r.id)}>Editar</button></td></tr>)}</tbody></table></div>:<p className={vacio}>No tiene rifas.</p>}</section>;
}
