/* ============ utilidades ============ */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const pad=n=>String(n).padStart(2,'0');
const toISO=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const TZ='America/Argentina/Buenos_Aires';
const hoy=()=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(e){return toISO(new Date())}};
const horaAR=ts=>{if(!ts)return'';try{return new Date(ts).toLocaleTimeString('es-AR',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false})}catch(e){return''}};
const parse=s=>{const[y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return toISO(d)};
const addMonths=(s,n)=>{const d=parse(s);const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return toISO(d)};
const days=s=>Math.round((parse(s)-parse(hoy()))/864e5);
const fd=s=>s?s.split('-').reverse().join('/'):'—';
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const fdl=s=>s?DIAS[parse(s).getDay()]+' '+fd(s).slice(0,5):'—';
const NF=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
const redondear=n=>Math.round((Number(n||0)+Number.EPSILON)*100)/100;
const NF_DEC=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2,maximumFractionDigits:2});
const money=n=>{const v=redondear(n);return (Math.round(v*100)%100?NF_DEC:NF).format(v)};
const num=v=>{const n=parseFloat(String(v).replace(/\./g,'').replace(',','.'));return isNaN(n)?0:n};
const sum=(a,f)=>redondear(a.reduce((s,x)=>s+(f?f(x):x),0));
const val=id=>{const e=document.getElementById(id);return e?e.value.trim():''};
const radio=n=>{const e=document.querySelector(`input[name="${n}"]:checked`);return e?e.value:''};

const MEDIOS={efectivo:'Efectivo',transferencia:'Transferencia',echeq:'E-cheq',cheque:'Cheque físico',mp:'Mercado Pago'};
const PLANES={contado:'Contado',3:'3 cuotas',6:'6 cuotas',12:'12 cuotas'};
const COL={pago:'var(--ok)',det:'var(--ink)',seg:'var(--seg)',q6:'var(--q6)',lot:'var(--lot)',qui:'var(--qui)',rifa:'var(--rifa)',toto:'var(--toto)'};
const NOMBRE={pago:'Pago',det:'Detalle',seg:'Seguros',q6:'Quini 6',lot:'Lotería',qui:'Quiniela',rifa:'Rifa Devoto',toto:'Toto Ortega'};

/* ============ datos ============
  socios      persona/cliente. Tiene abono Quini 6 y números fijos de lotería.
  seguros     ingreso, vencimiento, descripción, valor, plan (contado/3/6/12), medio de pago, cuotas[{venc,imp,pago}]
  q6esp       sorteos especiales del Quini 6 {fecha,nombre,precio}; los comunes salen de la config (días + precio)
  q6          jugadas {sid,fecha,monto,pagado}
  sorteos     sorteos de lotería {nombre,fecha,frac,precio}
  lot         ventas {soId,sid,numero,frac,precio,quien,pagado}
  ofertas     socios a los que se ofreció y no compraron {soId,sid}
  quiniela    {sid,fecha,numeros,monto,pagado}
  rifas       {sid,anio,nro,modo,importe,ncuotas,desde,pagos[]}  */

function sorteosAnio(y,precio){return[
  {id:uid(),nombre:'Gordo de Reyes '+y,fecha:`${y}-01-06`,frac:10,precio},
  {id:uid(),nombre:'Gordo de Invierno '+y,fecha:`${y}-07-15`,frac:10,precio},
  {id:uid(),nombre:'Gordo de Navidad '+y,fecha:`${y}-12-23`,frac:20,precio}]}
function vacio(){const y=new Date().getFullYear();return{ver:1,conf:{nombre:'Emanuel Lozano',q6Precio:4000,q6Dias:[3,0],fracPrecio:10000,rifaImporte:17000,rifaCuotas:10},
  socios:[],seguros:[],q6esp:[],q6:[],toto:[],sorteos:sorteosAnio(y,10000).concat(sorteosAnio(y+1,10000).slice(0,1)),lot:[],ofertas:[],quiniela:[],rifas:[]}}
function norm(o){const b=vacio();o={...b,...o,conf:{...b.conf,...(o.conf||{})}};
  ['socios','seguros','q6esp','q6','q6skip','cobros','sorteos','lot','ofertas','quiniela','rifas','usuarios','log','toto'].forEach(k=>o[k]=Array.isArray(o[k])?o[k]:[]);
  ['seguros','q6','lot','quiniela','rifas','cobros'].forEach(k=>o[k].forEach(x=>{if(x.ts===undefined)x.ts=''}));o.socios.forEach(s=>{s.fijos=s.fijos||[];s.q6=s.q6||{activo:false,cant:1};if(!Array.isArray(s.q6.dias))s.q6.dias=s.q6.activo?[...o.conf.q6Dias]:[];s.q6.activo=s.q6.dias.length>0;s.q6.auto=s.q6.dias.length>0;if(s.q6.auto&&!s.q6.desde)s.q6.desde=hoy();if(s.activo===undefined)s.activo=true});return o}
function genCuotas(ingreso,plan,valor,prev){const n=plan==='contado'?1:+plan;const P=i=>prev&&prev[i]?prev[i]:null;
  const fija=i=>!!(P(i)&&(P(i).pago||P(i).anulado));            // pagadas o anuladas: su importe no se toca
  const libre=Array.from({length:n},(_,i)=>i).filter(i=>!fija(i));
  const resto=Math.max(0,valor-sum(Array.from({length:n},(_,i)=>i).filter(i=>fija(i)&&!P(i).anulado),i=>P(i).imp));
  const base=libre.length?Math.floor(resto/libre.length):0;
  return Array.from({length:n},(_,i)=>{const p=P(i);const k=libre.indexOf(i);
    const imp=redondear(fija(i)?p.imp:k===libre.length-1?resto-base*(libre.length-1):base);
    const c={n:i+1,venc:addMonths(ingreso,i),imp,pago:p?p.pago||null:null,medio:p?p.medio||'':''};
    if(p){['det','pts','anulado'].forEach(f=>{if(p[f]!==undefined&&p[f]!==null)c[f]=p[f]});if(p.abono)c.abono=p.pago?p.abono:Math.min(p.abono,imp)}
    return c})}
function migrar(old){const S=vacio();
  (old.clientes||[]).forEach((c,i)=>S.socios.push({id:c.id,nro:String(i+1),nombre:c.nombre,tel:c.tel||'',dni:c.doc||'',dir:c.dir||'',nota:c.nota||'',activo:c.activo!==false,fijos:[],q6:{activo:false,cant:1}}));
  (old.polizas||[]).filter(p=>p.estado!=='anulada').forEach(p=>{const v=sum(p.cuotas||[],c=>c.imp);const n=(p.cuotas||[]).length;const plan=n<=1?'contado':n<=3?'3':n<=6?'6':'12';
    S.seguros.push({id:p.id,sid:p.cid,ingreso:p.desde,venc:p.hasta,desc:[p.ramo,p.bien,p.cia].filter(Boolean).join(' · '),valor:v,plan,medio:'efectivo',cuotas:genCuotas(p.desde,plan,v)})});
  S._migrado=true;return S}
let S=norm(vacio());
let CUR=null;
let revision=0;
const PENDIENTES=[];
let guardando=false;
let errorGuardado=null;
const AUD=['socios','seguros','q6','lot','quiniela','rifas','cobros','sorteos','q6esp','toto'];
const AUDN={socios:'socio',seguros:'seguro',q6:'jugada de Quini 6',lot:'venta de lotería',quiniela:'jugada de quiniela',rifas:'rifa',cobros:'cobro',sorteos:'sorteo de lotería',q6esp:'sorteo especial',toto:'planilla de Toto Ortega'};
const CAMPOS={pagado:'pago',pagos:'pagos',cuotas:'cuotas / pagos',monto:'monto',valor:'valor',frac:'fracciones',numero:'número',numeros:'números',fecha:'fecha',nombre:'nombre',nro:'número',tel:'celular',dir:'dirección',q6:'días de Quini 6',fijos:'números fijos',favor:'saldo a favor',desc:'descripción',venc:'vencimiento',ingreso:'ingreso',plan:'forma de pago',activo:'activo/archivado',importe:'importe',modo:'modalidad',precio:'precio',medio:'medio de pago',det:'datos del pago',sid:'socio',soId:'sorteo',anio:'año',premiosAg:'premios agencia',concurso:'N° de concurso',conc:'N° de concurso',premios:'premios',pagos:'pagos'};
const audDesc=(k,x)=>{const sn=x.sid?sname(x.sid)+' · ':'';return k==='socios'?x.nombre:k==='seguros'?sn+x.desc:k==='q6'?sn+'sorteo '+fd(x.fecha):k==='lot'?sn+'N° '+x.numero:k==='quiniela'?sn+x.numeros:k==='rifas'?sn+'N° '+x.nro:k==='cobros'?sn+money(x.monto):k==='toto'?fd(x.fecha)+' · '+money(totoCalc(x).gral):x.nombre||''};
const audKey=x=>{const{ts,por,modPor,modTs,pts,fpago,alta,...r}=x;return JSON.stringify(r)};
let SNAP=new Map();
function snapAll(){SNAP=new Map();AUD.forEach(k=>S[k].forEach(x=>SNAP.set(k+':'+x.id,{k,j:audKey(x),x:JSON.parse(JSON.stringify(x))})))}
function auditar(){if(!CUR)return;const now=new Date().toISOString(),u=CUR.id,vivos=new Set();
  AUD.forEach(k=>S[k].forEach(x=>{const key=k+':'+x.id;vivos.add(key);const prev=SNAP.get(key);
    if(!prev){if(x.por===undefined)x.por=u;if(x.por!=='auto'&&x.por===u)S.log.push({ts:now,uid:u,acc:'Creó',k,txt:audDesc(k,x)});return}
    if(prev.j!==audKey(x)){x.modPor=u;x.modTs=now;const ch=Object.keys({...prev.x,...x}).filter(f=>CAMPOS[f]&&JSON.stringify(prev.x[f])!==JSON.stringify(x[f])).map(f=>CAMPOS[f]);
      S.log.push({ts:now,uid:u,acc:(k==='q6'||k==='lot'||k==='quiniela')&&!prev.x.pagado&&x.pagado?'Cobró':(k==='q6'||k==='lot'||k==='quiniela')&&prev.x.pagado&&!x.pagado?'Anuló pago':'Modificó',k,txt:audDesc(k,x)+(ch.length?' ('+[...new Set(ch)].join(', ')+')':'')})}}));
  SNAP.forEach((v,key)=>{if(!vivos.has(key))S.log.push({ts:now,uid:u,acc:'Eliminó',k:v.k,txt:audDesc(v.k,v.x)})});
  if(S.log.length>3000)S.log=S.log.slice(-3000)}
const COLECCIONES=['socios','seguros','q6esp','q6','q6skip','cobros','sorteos','lot','ofertas','quiniela','rifas','toto'];

function estadoNegocio(){
  return Object.fromEntries(['ver','conf',...COLECCIONES].map(k=>[k,S[k]]));
}

function estadoGuardado(){
  const pendiente=PENDIENTES.length>0;
  for(const id of ['main','side','ov'])$('#'+id).inert=pendiente;
  const panel=$('#estado-guardado');
  panel.hidden=!pendiente;
  if(!pendiente)return;
  if(!errorGuardado){
    panel.textContent='Guardando en Supabase…';
    return;
  }
  panel.innerHTML='<p class="bad"></p><div class="acts"><button class="btn sm" onclick="descartarGuardado()">Volver a cargar</button><button class="btn sm p" onclick="procesarGuardados()">Reintentar</button></div>';
  panel.querySelector('p').textContent='Cambios sin confirmar. '+errorGuardado.message;
  panel.querySelector('.p').hidden=errorGuardado.code==='40001';
}

async function procesarGuardados(){
  if(guardando||!PENDIENTES.length)return;
  guardando=true;
  errorGuardado=null;
  estadoGuardado();
  try{
    while(PENDIENTES.length){
      const pendiente=PENDIENTES[0];
      revision=await window.agencia.guardar({
        p_revision:revision,
        p_operacion:pendiente.id,
        p_estado:pendiente.estado,
      },pendiente.restaurar);
      PENDIENTES.shift();
    }
  }catch(error){
    errorGuardado=error;
  }finally{
    guardando=false;
    estadoGuardado();
  }
}

async function descartarGuardado(){
  if(guardando||!confirm('¿Volver a cargar y descartar los cambios sin confirmar?'))return;
  guardando=true;
  try{
    const datos=await window.agencia.leer();
    PENDIENTES.length=0;
    errorGuardado=null;
    close_();
    cargarAgencia(datos);
  }catch(error){
    errorGuardado=error;
  }finally{
    guardando=false;
    estadoGuardado();
    if(PENDIENTES.length&&!errorGuardado)void procesarGuardados();
  }
}

function save(restaurar=false){
  if(!CUR)return;
  const now=new Date().toISOString();
  for(const k of ['seguros','q6','lot','quiniela','rifas','cobros']){
    S[k].forEach(x=>{if(x.ts===undefined)x.ts=now});
  }
  auditar();
  snapAll();
  PENDIENTES.push({
    id:crypto.randomUUID(),
    estado:JSON.parse(JSON.stringify(estadoNegocio())),
    restaurar,
  });
  void procesarGuardados();
}

window.addEventListener('beforeunload',event=>{
  if(PENDIENTES.length)event.preventDefault();
});

const soc=id=>S.socios.find(s=>s.id===id);
const sname=id=>(soc(id)||{nombre:'(socio borrado)'}).nombre;
const socOrd=()=>S.socios.filter(s=>s.activo).sort((a,b)=>a.nombre.localeCompare(b.nombre));

/* ============ lógica ============ */
// Quini 6: próximos sorteos = días configurados + especiales
function q6Precio(f){const e=S.q6esp.find(x=>x.fecha===f);return e?e.precio:S.conf.q6Precio}
function q6Fechas(desde,hasta){const out=new Set();let f=desde;while(f<=hasta){if(S.conf.q6Dias.includes(parse(f).getDay()))out.add(f);f=addDays(f,1)}
  S.q6esp.forEach(e=>{if(e.fecha>=desde&&e.fecha<=hasta)out.add(e.fecha)});return[...out].sort()}
const juegaEn=(s,f)=>{const d=parse(f).getDay();return s.activo&&s.q6.dias.length>0&&(s.q6.dias.includes(d)||!S.conf.q6Dias.includes(d))};
const fracTxt=v=>{const s=so(v.soId);return s&&v.frac>=s.frac?'Entero':v.frac+(s?' de '+s.frac:'')};
const fracOpts=(mx,sel)=>Array.from({length:mx},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===sel?'selected':''}>${n===mx?`Entero (${mx} fracciones)`:n+(n>1?' fracciones':' fracción')}</option>`).join('');
const waNum=t=>{let n=String(t).replace(/\D/g,'').replace(/^00/,'').replace(/^54/,'').replace(/^9/,'').replace(/^0/,'');if(n.length===12)for(const k of[2,3,4])if(n.substr(k,2)==='15'){n=n.slice(0,k)+n.slice(k+2);break}return n.length===10?'549'+n:''};
function q6Auto(){const H=hoy();let n=0;S.socios.forEach(s=>{if(!s.activo||!s.q6.auto||!s.q6.dias.length)return;
  q6Fechas(s.q6.desde||H,H).forEach(f=>{if(juegaEn(s,f)&&!S.q6.some(j=>j.sid===s.id&&j.fecha===f)&&!S.q6skip.includes(s.id+'|'+f)){S.q6.push({id:uid(),sid:s.id,fecha:f,monto:q6Precio(f)*(s.q6.cant||1),pagado:false,auto:true,ts:'',por:'auto'});n++}})});if(n)save();return n}
const q6Prox=()=>q6Fechas(hoy(),addDays(hoy(),30))[0];
// Rifa: cuota i vence a los i meses de "desde"
const rifaVenc=(r,i)=>addMonths(r.desde,i);
const rifaPagado=r=>sum(r.pagos.map((p,i)=>p?cuotaRifa(r,i):Math.min(cuotaRifa(r,i),(r.abonos||[])[i]||0)));
const cuotaRifa=(r,i)=>{const n=r.ncuotas,c=Math.round(r.importe/n);if(r.importe-c*(n-1)>=0)return redondear(i===n-1?r.importe-c*(n-1):c);const total=Math.round(r.importe*100),base=Math.floor(total/n),resto=total%n;return (base+(i<resto?1:0))/100};
// Lotería
const sorteoAct=()=>{const s=[...S.sorteos].sort((a,b)=>a.fecha.localeCompare(b.fecha));return s.find(x=>x.fecha>=hoy())||s[s.length-1]};
const so=id=>S.sorteos.find(s=>s.id===id);
// Deuda pendiente por socio (solo lo ya vencido / jugado)
function pendientes(sid){const H=hoy();const P=[];
  S.seguros.filter(x=>!sid||x.sid===sid).forEach(x=>x.cuotas.forEach((c,i)=>{const imp=Math.max(0,redondear(c.imp-(c.abono||0)));if(!c.pago&&!c.anulado&&imp>0&&c.venc<=H)P.push({t:'seg',sid:x.sid,txt:`${x.desc} · cuota ${c.n}/${x.cuotas.length}`,imp,f:c.venc,ref:['seg',x.id,i]})}));
  S.q6.filter(x=>(!sid||x.sid===sid)&&!x.pagado&&!x.anulado).forEach(x=>P.push({t:'q6',sid:x.sid,txt:'Quini 6 · '+fdl(x.fecha),imp:Math.max(0,redondear(x.monto-(x.abono||0))),f:x.fecha,ref:['q6',x.id]}));
  S.lot.filter(x=>(!sid||x.sid===sid)&&!x.pagado&&!x.anulado).forEach(x=>P.push({t:'lot',sid:x.sid,txt:`${(so(x.soId)||{}).nombre||'Lotería'} · N° ${x.numero}`,imp:Math.max(0,x.frac*x.precio-(x.abono||0)),f:(so(x.soId)||{}).fecha,ref:['lot',x.id]}));
  S.quiniela.filter(x=>(!sid||x.sid===sid)&&!x.pagado&&!x.anulado).forEach(x=>P.push({t:'qui',sid:x.sid,txt:'Quiniela · '+fd(x.fecha),imp:Math.max(0,redondear(x.monto-(x.abono||0))),f:x.fecha,ref:['quiniela',x.id]}));
  S.rifas.filter(x=>!sid||x.sid===sid).forEach(r=>r.pagos.forEach((p,i)=>{const imp=Math.max(0,redondear(cuotaRifa(r,i)-((r.abonos||[])[i]||0)));if(!p&&!(r.anulados||[])[i]&&imp>0&&rifaVenc(r,i)<=H)P.push({t:'rifa',sid:r.sid,txt:`Rifa N° ${r.nro} · cuota ${i+1}/${r.ncuotas}`,imp,f:rifaVenc(r,i),ref:['rifa',r.id,i]})}));
  return P}
function productos(sid){const o=[];
  if(S.seguros.some(x=>x.sid===sid))o.push('seg');
  if((soc(sid)||{}).q6?.activo||S.q6.some(x=>x.sid===sid))o.push('q6');
  if(S.lot.some(x=>x.sid===sid)||(soc(sid)||{}).fijos?.length)o.push('lot');
  if(S.quiniela.some(x=>x.sid===sid))o.push('qui');
  if(S.rifas.some(x=>x.sid===sid))o.push('rifa');return o}
const favor=sid=>(soc(sid)||{}).favor||0;
/* Cuenta del socio: una sola fuente de verdad para todos los números.
   deuda   = lo vencido sin pagar (descontados los abonos parciales)
   favor   = plata que ya te dio y no se aplicó a nada
   neto    = deuda - favor  (>0 debe · <0 le debés vos / tiene a favor)
   proximo = cuotas que todavía no vencen (informativo, no suma a la deuda) */
function cuenta(sid){const P=pendientes(sid);const deuda=sum(P,p=>p.imp),fv=favor(sid);
  const proximo=sum(movs(sid).filter(m=>m.fut&&!m.pag),m=>m.imp);
  return{P,deuda,favor:fv,neto:deuda-fv,debe:Math.max(0,deuda-fv),aFavor:Math.max(0,fv-deuda),proximo}}
const neto=sid=>cuenta(sid).debe;
const saldoTag=sid=>{const c=cuenta(sid);return c.debe?`<span class="bad">Debe ${money(c.debe)}</span>`:c.aFavor?`<span class="ok">A favor ${money(c.aFavor)}</span>`:'<span class="ok">Al día</span>'};
const chips=a=>a.map(k=>`<span class="chip" style="--c:${COL[k]}">${NOMBRE[k]}</span>`).join('');
const pay=(on,fn)=>{const m=String(fn).match(/tg\('(\w+)','([^']+)'\)/);const x=m&&S[m[1]].find(v=>v.id===m[2]);if(on)return x?`<button class="pay si" onclick="event.stopPropagation();editPayment('${m[1]}','${m[2]}')">✓ Pagado · editar</button>`:'<span class="pay si">✓ Pagado</span>';
  const tot=x?(m[1]==='lot'?x.frac*x.precio:x.monto):0,ab=x&&x.abono>0?x.abono:0;
  return x?`<button class="pay no" onclick="event.stopPropagation();openCobro('${x.sid}','${m[1]}|${m[2]}')">${ab?'Cobrar '+money(Math.max(0,tot-ab)):'Cobrar'}</button>${ab?`<span class="parc">Pagó ${money(ab)} de ${money(tot)}</span>`:''}`:''};
/* lo cobrado y lo que falta de una jugada/venta, contando pagos parciales */
const cobr=(x,t)=>x.pagado?t:Math.min(t,x.abono||0),falt=(x,t)=>x.pagado?0:Math.max(0,redondear(t-(x.abono||0)));
const cobrarBtn=(sid,key,label)=>`<button class="pay no" onclick="event.stopPropagation();openCobro('${sid}','${key}')">${label||'Cobrar'}</button>`;

/* ============ navegación ============ */
let V='inicio',TAB='q6',SID=null;
const F={q:'',so:null,quiF:hoy(),q6F:null,rifaA:new Date().getFullYear(),segF:'todos'};
const NAV=[['inicio','Inicio'],['socios','Socios'],['_g','Productos'],['seguros','Seguros','seg'],['juegos:q6','Quini 6','q6'],['juegos:lot','Lotería','lot'],['juegos:qui','Quiniela','qui'],['juegos:rifa','Rifa Devoto','rifa'],['_g','Agencia'],['cheques','Cheques y e-cheq'],['toto','Toto Ortega','toto'],['_g',''],['actividad','Actividad'],['ajustes','Ajustes']];
function sidebar(){
  const activa=V==='juegos'?'juegos:'+TAB:V==='socio'?'socios':V;
  const detalle=CUR?{
    nombre:CUR.nombre,activa,
    entradas:NAV.map(([clave,nombre,color])=>({clave,nombre,color:color?COL[color]:undefined})),
    buscar:buscar,navegar:nav,abrir:verSocio,salir,
  }:null;
  window.dispatchEvent(new CustomEvent('agencia:navegacion',{detail:detalle}));
}
function nav(k){if(k.startsWith('juegos:')){V='juegos';TAB=k.split(':')[1]}else V=k;render()}
function verSocio(id){if(id!==SID)STAB='det';SID=id;V='socio';render()}
/* achica los montos que no entran en su tarjeta */
function fitNums(){document.querySelectorAll('.kpi b, .bal-c b, .cb-sum b').forEach(b=>{b.style.fontSize='';b.style.whiteSpace='';b.style.overflowWrap='';b.style.lineHeight='';const w=b.clientWidth;if(!w)return;const sw=b.scrollWidth;if(sw>w){const fs=parseFloat(getComputedStyle(b).fontSize);const nf=Math.floor(fs*w/sw*10)/10-.3;b.style.fontSize=Math.max(12,nf)+'px';if(nf<12){b.style.whiteSpace='normal';b.style.overflowWrap='anywhere';b.style.lineHeight='1.2'}}})}
{let t;window.addEventListener('resize',()=>{clearTimeout(t);t=setTimeout(fitNums,80)});if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitNums)}
function render(){if(!CUR)return showLogin();q6Auto();sidebar();renderContenido();enh($('#main'));fitNums();window.scrollTo(0,0)}
function rerender(){if(!CUR)return showLogin();const y=window.scrollY;q6Auto();sidebar();renderContenido();enh($('#main'));fitNums();window.scrollTo(0,y)}

/* buscador rápido: socio, N° de socio o N° de lotería / rifa */
function buscar(texto){
  const q=texto.trim().toLowerCase();
  if(!q)return [];
  const resultados=[];
  S.socios.forEach(s=>{
    if(s.nombre.toLowerCase().includes(q)||String(s.nro).toLowerCase()===q||(s.dni||'').includes(q))
      resultados.push({id:s.id,principal:s.nombre,secundario:'Socio '+s.nro});
  });
  S.lot.forEach(l=>{
    if(String(l.numero).includes(q))
      resultados.push({id:l.sid,principal:l.numero+' · '+sname(l.sid),secundario:(so(l.soId)||{}).nombre||''});
  });
  S.socios.forEach(s=>s.fijos.forEach(f=>{
    if(String(f.numero).includes(q))
      resultados.push({id:s.id,principal:f.numero+' · '+s.nombre,secundario:'Número fijo'});
  }));
  S.rifas.forEach(r=>{
    if(String(r.nro).includes(q))
      resultados.push({id:r.sid,principal:'Rifa '+r.nro+' · '+sname(r.sid),secundario:String(r.anio)});
  });
  return resultados.slice(0,12);
}
const VIEWS={};
/* ============ INICIO ============ */
VIEWS.inicio=()=>{const H=hoy();const chq=cheques();const P=pendientes();const tot=sum(S.socios,s=>neto(s.id));
  const porT=k=>sum(P.filter(p=>p.t===k),p=>p.imp);
  const venc=S.seguros.filter(x=>days(x.venc)>=-7&&days(x.venc)<=30).sort((a,b)=>a.venc.localeCompare(b.venc));
  const sa=sorteoAct();const vend=sa?S.lot.filter(l=>l.soId===sa.id):[];
  const con=new Set(vend.map(v=>v.sid)),noq=new Set(S.ofertas.filter(o=>sa&&o.soId===sa.id).map(o=>o.sid));
  const sinOf=!sa?[]:socOrd().filter(s=>!con.has(s.id)&&!noq.has(s.id)),noCompr=socOrd().filter(s=>noq.has(s.id));
  const prox=q6Prox();const ab=prox?S.socios.filter(s=>juegaEn(s,prox)):[];const cargadas=S.q6.filter(j=>j.fecha===prox&&ab.some(a=>a.id===j.sid));
  const deud={};P.forEach(p=>deud[p.sid]=(deud[p.sid]||0)+p.imp);Object.keys(deud).forEach(k=>deud[k]=Math.max(0,deud[k]-favor(k)));const dl=Object.entries(deud).filter(e=>e[1]>0).sort((a,b)=>b[1]-a[1]);
  return `
  ${S._migrado?`<div class="banner"><span>Se pasaron tus clientes y seguros de la versión anterior. Revisá el medio de pago de cada seguro.</span><button class="btn sm" onclick="delete S._migrado;save();render()">Listo</button></div>`:''}
  <div class="head"><div><h1>Hola${CUR?', '+esc(CUR.nombre.split(' ')[0]):''}</h1><div class="sub">${DIAS[parse(H).getDay()]} ${fd(H)}</div></div></div>
  <div class="kgrid">
    <div class="ksum">
      <div class="kpi kmain"><small>Te deben en total</small><b class="${tot?'bad':''}">${money(tot)}</b>
      ${(()=>{const fv=sum(S.socios,s=>cuenta(s.id).aFavor);return fv?`<div class="kfav" title="Plata que te dieron de más"><small>A favor de socios</small><b class="ok">${money(fv)}</b></div>`:''})()}</div>
    </div>
    <div class="kprod">
      ${['seg','q6','lot','qui','rifa'].map(k=>`<div class="kpi" style="border-top:3px solid ${COL[k]}"><small>${NOMBRE[k]}</small><b>${money(porT(k))}</b></div>`).join('')}
    </div>
  </div>
  <div class="two">
    <div class="card acc" style="--c:var(--lot)"><div class="ch"><div><h2>${sa?esc(sa.nombre):'Lotería'}</h2><div class="mu small">${sa?`${fd(sa.fecha)} · vendidas ${sum(vend,v=>v.frac)} fracciones a ${con.size} socios`:''}</div></div>
      <button class="btn sm" onclick="nav('juegos:lot')">Ir a Lotería</button></div>
      <p class="lbl" style="margin-bottom:4px">Sin ofrecer todavía (${sinOf.length})</p>
      <div class="list">${sinOf.length?`<div><span class="small">${sinOf.slice(0,12).map(s=>esc(s.nombre)).join(', ')}${sinOf.length>12?` y ${sinOf.length-12} más`:''}</span></div>`:'<div class="empty">Ya le ofreciste a todos.</div>'}</div>
      ${noCompr.length?`<p class="lbl" style="margin:12px 0 4px">Le ofreciste y no compró (${noCompr.length})</p><p class="small">${noCompr.map(s=>esc(s.nombre)).join(', ')}</p>`:''}
    </div>
    <div>
      ${chq.length?`<div class="card acc" style="--c:var(--ok)"><div class="ch"><div><h2>Cheques a cobrar</h2><div class="mu small">Cheques y e-cheqs con fecha de cobro cargada.</div></div></div>
        <div class="list">${chq.map(c=>`<div><span style="cursor:pointer" onclick="verSocio('${c.sid}')">${esc(sname(c.sid))} · <b>${money(c.monto)}</b><br><span class="mu small">${medioTxt(c.medio,c.det)}</span></span><span class="acts" style="align-items:center">${vtagC(c.det.fcobro)}<button class="btn sm" onclick="depositar('${c.k}')">Depositado</button></span></div>`).join('')}</div></div>`:''}
      <div class="card acc" style="--c:var(--seg)"><div class="ch"><h2>Seguros por vencer</h2></div>
        <div class="list">${venc.map(x=>`<div style="cursor:pointer" onclick="verSocio('${x.sid}')"><span>${esc(sname(x.sid))}<br><span class="mu small">${esc(x.desc)}</span></span>${vtag(x.venc)}</div>`).join('')||'<div class="empty">Nada vence en los próximos 30 días.</div>'}</div></div>
    </div>
  </div>
  <div class="card"><div class="ch"><h2>Quién te debe</h2></div>
    <div class="list">${dl.slice(0,12).map(([sid,m])=>`<div style="cursor:pointer" onclick="verSocio('${sid}')"><span>${esc(sname(sid))} <span class="mu small">${chips([...new Set(P.filter(p=>p.sid===sid).map(p=>p.t))])}</span></span><b class="bad">${money(m)}</b></div>`).join('')||'<div class="empty">Nadie te debe nada. 🎉</div>'}</div></div>`};
function vtag(v){const n=days(v);return n<0?`<span class="tag t-b">Venció hace ${-n} d</span>`:n===0?'<span class="tag t-b">Vence hoy</span>':n<=7?`<span class="tag t-w">Vence en ${n} d</span>`:`<span class="tag">Vence ${fd(v)}</span>`}

/* ============ SOCIOS ============ */
function renderContenido(){
  if(V==='socio'&&!soc(SID))V='socios';

  $('#panel-legacy').innerHTML=['socios','cheques','ajustes','actividad','seguros'].includes(V)?'':VIEWS[V]();
  const filas=V==='socios'?[...S.socios]
    .sort((a,b)=>Number(b.activo)-Number(a.activo)||a.nombre.localeCompare(b.nombre))
    .map(s=>{
      const saldo=cuenta(s.id);
      return {
        id:s.id,numero:s.nro,nombre:s.nombre,telefono:s.tel,activo:s.activo,
        productos:productos(s.id).map(clave=>({clave,nombre:NOMBRE[clave],color:COL[clave]})),
        saldo:saldo.debe?'Debe '+money(saldo.debe):saldo.aFavor?'A favor '+money(saldo.aFavor):saldo.favor?'Al día':'',
        deuda:saldo.debe>0,
      };
    }):null;
  window.dispatchEvent(new CustomEvent('agencia:socios',{detail:filas?{filas,abrir:verSocio,editar:openSocio}:null}));
  publicarCheques();
  publicarAjustes();
  publicarActividad();
  publicarSeguros();
}

let STAB='det';
function balPanel(sid){const c=cuenta(sid);const porT={};c.P.forEach(p=>porT[p.t]=(porT[p.t]||0)+p.imp);
  const fin=c.debe?['bad','Debe',c.debe,'Lo que te tiene que pagar hoy']:c.aFavor?['ok','Tiene a favor',c.aFavor,'Se descuenta en el próximo cobro']:['ok','Al día',0,'No debe nada vencido'];
  return `<div class="bal"><div class="bal-c"><small>Deuda vencida</small><b class="${c.deuda?'bad':''}">${money(c.deuda)}</b><span>${Object.keys(porT).length?Object.entries(porT).map(([k,v])=>`<span class="chip" style="--c:${COL[k]}">${NOMBRE[k]} ${money(v)}</span>`).join(''):'Sin deuda'}</span></div>
  <div class="bal-op">−</div><div class="bal-c"><small>Saldo a favor</small><b class="${c.favor?'ok':''}">${money(c.favor)}</b><span>Plata que dejó de más</span></div>
  <div class="bal-op">=</div><div class="bal-c bal-f ${fin[0]}"><small>${fin[1]}</small><b>${money(fin[2])}</b><span>${fin[3]}</span></div>
  ${c.proximo?`<div class="bal-c bal-x"><small>Por vencer</small><b>${money(c.proximo)}</b><span>Cuotas futuras, no suman a la deuda</span></div>`:''}</div>`}
VIEWS.socio=()=>{const s=soc(SID);if(!s)return '';const P=pendientes(s.id);const d=neto(s.id),fv=favor(s.id);const dk=k=>sum(P.filter(p=>p.t===k),p=>p.imp);
  const cnt={seg:S.seguros.filter(x=>x.sid===s.id).length,q6:S.q6.filter(x=>x.sid===s.id).length,lot:S.lot.filter(x=>x.sid===s.id).length,qui:S.quiniela.filter(x=>x.sid===s.id).length,rifa:S.rifas.filter(x=>x.sid===s.id).length};
  return `<div class="head"><div><button class="btn g sm" onclick="nav('socios')">← Socios</button><h1 style="margin-top:6px">${esc(s.nombre)}</h1>
    <div class="sub">Socio <span class="mono">${esc(s.nro)}</span>${s.tel?' · '+esc(s.tel):''}${s.dir?' · '+esc(s.dir):''}${porTxt(s)?' · <span class="by">'+porTxt(s)+'</span>':''}${s.activo?'':' · <span class="tag">archivado</span>'}</div></div>
    <div class="acts" style="align-items:center"><button class="btn p" onclick="openCobro('${s.id}')">Registrar cobro</button><button class="btn" onclick="wsp('${s.id}')">WhatsApp</button><button class="btn" onclick="pdfSocio('${s.id}')">⬇ PDF</button><button class="btn g" onclick="openSocio('${s.id}')">Editar</button></div></div>
  ${balPanel(s.id)}
  <div class="tabs">${['det','seg','q6','lot','qui','rifa'].map(k=>`<button class="tab ${STAB===k?'on':''}" style="--c:${COL[k]}" onclick="STAB='${k}';rerender()"><i></i>${NOMBRE[k]}${cnt[k]?` <span class="mu small">${cnt[k]}</span>`:''}</button>`).join('')}</div>
  ${({det:sDet,seg:sSeg,q6:sQ6,lot:sLot,qui:sQui,rifa:sRifa}[STAB])(s)}`};
function movs(sid){const M=[];const H=hoy();
  const pagTxt=(f,m,d)=>'Pagado el '+fd(f)+(m?' · '+medioTxt(m,d):'');
  S.seguros.filter(x=>x.sid===sid).forEach(x=>x.cuotas.forEach((c,i)=>{if(c.anulado)return;const f=c.pago&&c.venc>H?c.pago:c.venc,imp=c.pago?c.imp:Math.max(0,redondear(c.imp-(c.abono||0)));
    M.push({f,o:i===0?x:null,h:i===0?x.ts:'',t:'seg',ref:['seg',x.id,i],txt:`Seguro ${esc(x.desc)} · ${x.cuotas.length>1?'cuota '+c.n+' de '+x.cuotas.length:'contado'}`,sub:[c.abono?`Abono parcial ${money(c.abono)}`:'',c.pago?pagTxt(c.pago,c.medio,c.det):(c.venc<=H?'Venció el ':'Vence el ')+fd(c.venc)].filter(Boolean).join(' · '),imp,pag:!!c.pago,fut:!c.pago&&c.venc>H})}));
  S.q6.filter(x=>x.sid===sid&&!x.anulado).forEach(j=>M.push({f:j.fecha,o:j,h:j.ts,t:'q6',txt:'Jugó Quini 6'+(S.q6esp.some(e=>e.fecha===j.fecha)?' · sorteo especial ★':''),sub:[j.abono?`Abono parcial ${money(j.abono)}`:'',j.auto?'Sorteo '+DIAS[parse(j.fecha).getDay()]+' · automática':'',j.pagado&&j.fpago?pagTxt(j.fpago,j.medio,j.det):''].filter(Boolean).join(' · '),ref:['q6',j.id],imp:j.pagado?j.monto:Math.max(0,redondear(j.monto-(j.abono||0))),pag:j.pagado}));
  S.lot.filter(x=>x.sid===sid&&!x.anulado).forEach(l=>{const so_=so(l.soId)||{};M.push({f:l.alta||(so_.fecha&&so_.fecha<H?so_.fecha:H),o:l,h:l.ts,t:'lot',txt:`Compró el N° <span class="mono">${esc(l.numero)}</span> · ${esc(so_.nombre||'Lotería')}`,sub:[fracTxt(l),so_.fecha?'sorteo '+fd(so_.fecha):'',l.abono?`Abono parcial ${money(l.abono)}`:'',l.pagado&&l.fpago?pagTxt(l.fpago,l.medio,l.det):''].filter(Boolean).join(' · '),ref:['lot',l.id],imp:l.pagado?l.frac*l.precio:Math.max(0,l.frac*l.precio-(l.abono||0)),pag:l.pagado})});
  S.quiniela.filter(x=>x.sid===sid&&!x.anulado).forEach(q=>M.push({f:q.fecha,o:q,h:q.ts,t:'qui',txt:`Jugó quiniela · <span class="mono">${esc(q.numeros)}</span>`,sub:[q.abono?`Abono parcial ${money(q.abono)}`:'',q.pagado&&q.fpago?pagTxt(q.fpago,q.medio,q.det):''].filter(Boolean).join(' · '),ref:['quiniela',q.id],imp:q.pagado?q.monto:Math.max(0,redondear(q.monto-(q.abono||0))),pag:q.pagado}));
  S.rifas.filter(x=>x.sid===sid).forEach(r=>r.pagos.forEach((p,i)=>{if((r.anulados||[])[i])return;const v=rifaVenc(r,i),imp=p?cuotaRifa(r,i):Math.max(0,redondear(cuotaRifa(r,i)-((r.abonos||[])[i]||0)));M.push({f:p&&v>H?p:v,o:i===0?r:null,h:i===0?r.ts:'',t:'rifa',txt:`Rifa Devoto N° <span class="mono">${esc(r.nro)}</span> · ${r.modo==='contado'?'contado':'cuota '+(i+1)+' de '+r.ncuotas}`,sub:[(r.abonos||[])[i]?`Abono parcial ${money(r.abonos[i])}`:'',p?pagTxt(p,(r.medios||[])[i],(r.dets||[])[i]):(v<=H?'Venció el ':'Vence el ')+fd(v)].filter(Boolean).join(' · '),ref:['rifa',r.id,i],imp,pag:!!p,fut:!p&&v>H})}));
  S.cobros.filter(x=>x.sid===sid&&!x.anulado).forEach(c=>M.push({f:c.fecha,o:c,h:c.ts,t:'pago',txt:`Te pagó <b>${money(c.monto)}</b>${c.medio?' · '+medioTxt(c.medio,c.det):''}`,sub:cobroSub(c),imp:c.monto,pag:true,ref:['cobro',c.id]}));
  // más nuevo arriba: por fecha, después por hora (Argentina); dentro del mismo momento el pago va arriba
  return M.sort((a,b)=>b.f.localeCompare(a.f)||(b.h||'').localeCompare(a.h||'')||(b.t==='pago')-(a.t==='pago'))}
function cobroSub(c){const A=c.aplicados||[];const tot=A.filter(a=>a.completo).length,par=A.filter(a=>!a.completo).length;
  return [tot?`Saldó ${tot} ${tot>1?'conceptos':'concepto'}`:'',par?`abono parcial en ${par}`:'',c.usado?'usó '+money(c.usado)+' del saldo a favor':'',c.quedo?'dejó '+money(c.quedo)+' a favor':''].filter(Boolean).join(' · ').replace(/^./,x=>x.toUpperCase())||'Pago a cuenta'}
function diaTit(f){const H=hoy();return (f===H?'Hoy · ':f===addDays(H,-1)?'Ayer · ':'')+DIAS[parse(f).getDay()]+' '+fd(f)}
function sDet(s){const M=movs(s.id);const f=F.detF||'todo';
  // Solo se fusiona cuando un único cobro saldó por completo un único concepto.
  // Los pagos parciales, a cuenta o compartidos conservan sus movimientos individuales.
  const ocultos=new Set(), fusionados=new Map();
  S.cobros.filter(c=>c.sid===s.id&&!c.anulado&&c.monto>0&&!(c.quedo||0)&&!(c.usado||0)&&!(c.liberado||0)&&Array.isArray(c.aplicados)&&c.aplicados.length===1).forEach(c=>{
    const a=c.aplicados[0];if(!a.completo||!a.ref)return;const key=a.ref.join('|');
    const concepto=M.find(m=>m.t!=='pago'&&m.ref.join('|')===key&&m.pag&&!m.fut);
    const otros=S.cobros.filter(x=>x.sid===s.id&&!x.anulado&&Array.isArray(x.aplicados)&&(x.aplicados||[]).some(z=>z.ref&&z.ref.join('|')===key));
    if(!concepto||otros.length!==1||redondear(a.imp??c.monto)!==redondear(concepto.imp)||redondear(c.monto)!==redondear(concepto.imp))return;
    ocultos.add(c.id);fusionados.set(key,c);
  });
  const L=M.filter(m=>!m.fut&&!(m.t==='pago'&&ocultos.has(m.ref[1]))&&(f==='todo'||(f==='debe'&&!m.pag&&m.t!=='pago'))).map(m=>{const c=fusionados.get(m.ref.join('|'));return {...m,cobroUnico:c,sub:c?`Cobrado el ${fd(c.fecha)}${c.medio?' · '+medioTxt(c.medio,c.det):''}`:m.sub}});
  const est=m=>m.t==='pago'?'<span class="tag t-ok">Cobro</span>':m.cobroUnico?'<span class="pay si">✓ Pagado</span>':m.pag?`<button class="pay si" title="Tocá para anular el pago" onclick="anularPago('${m.ref.join('|')}')">✓ Pagado</button>`:cobrarBtn(s.id,m.ref.join('|'));
  const fila=m=>`<tr class="${m.pag?'r-ok':'r-bad'}"><td class="mu" style="white-space:nowrap;width:60px">${horaAR(m.h)||'—'}</td><td style="width:120px">${chips([m.t])}</td><td>${m.txt}${m.sub?`<br><span class="mu small">${m.sub}</span>`:''}${porTxt(m.o)?`<br><span class="by">${m.t==='pago'&&m.o.por&&m.o.por!=='auto'?'Cobró '+esc(uname(m.o.por)):porTxt(m.o)}</span>`:''}</td><td class="r amt">${m.t==='pago'?'+ ':''}${money(m.imp)}</td><td style="width:120px">${est(m)}</td><td><div class="acts"><button class="btn sm g" onclick="editMovement('${m.ref[0]}','${m.ref[1]}',${m.ref[2]??'null'})">Editar</button>${m.cobroUnico?`<button class="btn sm g" onclick="editCobro('${m.cobroUnico.id}')">Editar cobro</button><button class="btn sm g d" onclick="anularCobro('${m.cobroUnico.id}')">Anular cobro</button>`:`<button class="btn sm g d" onclick="anularMovimiento('${m.ref[0]}','${m.ref[1]}',${m.ref[2]??'null'})">Anular</button>`}</div></td></tr>`;
  let body='',dia=null;L.forEach(m=>{if(m.f!==dia){dia=m.f;const tot=L.filter(x=>x.f===dia);const deb=sum(tot.filter(x=>!x.pag),x=>x.imp),cob=sum(tot.filter(x=>x.t==='pago'),x=>x.imp);
    body+=`<tr class="dayh"><td colspan="6"><b>${diaTit(dia)}</b><span class="mu small" style="float:right">${cob?`<span class="ok">Cobrado ${money(cob)}</span>`:''}${cob&&deb?' · ':''}${deb?`<span class="bad">Debe ${money(deb)}</span>`:''}</span></td></tr>`}body+=fila(m)});
  return `<div class="card"><div class="ch"><div><h2>Todo lo que hizo</h2><div class="mu small">Lo más nuevo arriba · hora de Argentina</div></div><div class="seg">${[['todo','Todo'],['debe','Lo que debe']].map(([k,t])=>`<button class="${f===k?'on':''}" onclick="F.detF='${k}';rerender()">${t}</button>`).join('')}</div></div>
  ${L.length?`<div class="tw"><table><thead><tr><th>Hora</th><th>Qué</th><th>Detalle</th><th class="r">Monto</th><th>Estado</th><th></th></tr></thead><tbody>${body}</tbody>
  <tfoot><tr><td colspan="4">${L.length} movimientos${favor(s.id)?` · <span class="ok">a favor ${money(favor(s.id))}</span>`:''}</td><td>${saldoTag(s.id)}</td><td></td></tr></tfoot></table></div><div class="legend"><span><i style="background:var(--okb)"></i>Pagado / cobro</span><span><i style="background:var(--badb)"></i>Debe</span></div>`:`<div class="empty">${f==='debe'?'No debe nada.':'No hay movimientos.'}</div>`}</div>`}

function editMovement(k,id,i){if(k==='cobro')return editCobro(id);if(k==='seg')return openSeguro(id);if(k==='q6')return openQ6(id);if(k==='lot')return openVenta(id);if(k==='quiniela')return openQui(id);if(k==='rifa')return openRifa(id)}
/* Si se anula un abono parcial de algo que después otro cobro terminó de pagar, ese algo deja de estar pago:
   queda con lo que efectivamente recibió (los otros cobros pasan a ser abonos parciales). */
function revertirParcialDePagado(a,cob){const[k,id,i]=a.ref,key=a.ref.join('|');
  const comp=[],par=[];S.cobros.forEach(c=>{if(c===cob||c.anulado||!c.aplicados)return;c.aplicados.forEach(x=>{if(x.ref.join('|')===key)(x.completo?comp:par).push(x)})});
  if(!comp.length)return false;
  let paid,abono;if(k==='seg'){const q=S.seguros.find(x=>x.id===id)?.cuotas[i];if(!q)return false;paid=!!q.pago;abono=q.abono||0}else if(k==='rifa'){const r=S.rifas.find(x=>x.id===id);if(!r)return false;paid=!!r.pagos[i];abono=(r.abonos||[])[i]||0}else{const x=S[k].find(v=>v.id===id);if(!x)return false;paid=!!x.pagado;abono=x.abono||0}
  if(!paid)return false;
  const recibido=sum(par,x=>x.abono||0)+sum(comp,x=>x.imp||0);   // lo que de verdad entró por los otros cobros
  comp.forEach(x=>{x.completo=false;x.abono=x.imp});
  if(k==='seg'){const q=S.seguros.find(x=>x.id===id).cuotas[i];q.pago=null;q.medio='';q.det=null;q.abono=recibido}
  else if(k==='rifa'){const r=S.rifas.find(x=>x.id===id);r.pagos[i]=null;r.abonos=r.abonos||[];r.abonos[i]=recibido}
  else{const x=S[k].find(v=>v.id===id);x.pagado=false;delete x.fpago;delete x.medio;delete x.det;x.abono=recibido}
  return true}
function revertirAplicacion(a,cob){if(!a.completo&&revertirParcialDePagado(a,cob))return;const[k,id,i]=a.ref;if(k==='seg'){const q=S.seguros.find(x=>x.id===id)?.cuotas[i];if(!q)return;if(a.completo){q.pago=null;q.medio='';q.det=null}else q.abono=Math.max(0,(q.abono||0)-a.abono)}else if(k==='rifa'){const r=S.rifas.find(x=>x.id===id);if(!r)return;if(a.completo){r.pagos[i]=null;if(r.medios)r.medios[i]='';if(r.dets)r.dets[i]=null}else{r.abonos=r.abonos||[];r.abonos[i]=Math.max(0,(r.abonos[i]||0)-a.abono)}}else{const x=S[k].find(v=>v.id===id);if(!x)return;if(a.completo){x.pagado=false;delete x.fpago;delete x.medio;delete x.det}else x.abono=Math.max(0,(x.abono||0)-a.abono)}}
function aplicacionesAnteriores(c){if(c.aplicados)return c.aplicados;const candidatas=[];const add=(k,id,i,x,pago,medio,det)=>{if(pago===c.fecha&&medio===(c.medio||'')&&detSimilar(det,c.det))candidatas.push({ref:i===undefined?[k,id]:[k,id,i],completo:true,abono:0,pts:x.pts||''})};S.seguros.filter(x=>x.sid===c.sid).forEach(x=>x.cuotas.forEach((q,i)=>add('seg',x.id,i,q,q.pago,q.medio,q.det)));['q6','lot','quiniela'].forEach(k=>S[k].filter(x=>x.sid===c.sid).forEach(x=>add(k,x.id,undefined,x,x.fpago,x.medio,x.det)));S.rifas.filter(x=>x.sid===c.sid).forEach(r=>r.pagos.forEach((p,i)=>add('rifa',r.id,i,r,p,(r.medios||[])[i],(r.dets||[])[i])));candidatas.sort((a,b)=>Math.abs(Date.parse(a.pts||c.ts)-Date.parse(c.ts))-Math.abs(Date.parse(b.pts||c.ts)-Date.parse(c.ts)));return candidatas.slice(0,Math.max(0,+c.cubre||0))}
function detSimilar(a,b){if(!a&&!b)return true;if(!a||!b)return false;return ['banco','nro','librador','fcobro'].every(k=>(a[k]||'')===(b[k]||''))}
function anularCobro(id){const c=S.cobros.find(x=>x.id===id);if(!c)return;{const nec=(c.quedo||0)+(c.liberado||0)-(c.usado||0),fv=favor(c.sid);if(nec>fv)return alert(`No se puede anular este cobro todavía: ${money(nec-fv)} de esta plata ya se usaron como saldo a favor para pagar otras cosas. Anulá primero el cobro más nuevo que usó ese saldo a favor.`)}if(!confirm(`¿Anular el cobro de ${money(c.monto)}? Se revertirán los pagos y abonos que quedaron vinculados.`))return;const links=aplicacionesAnteriores(c);links.forEach(a=>revertirAplicacion(a,c));const s=soc(c.sid);if(s)s.favor=Math.max(0,(s.favor||0)-(c.quedo||0)-(c.liberado||0)+(c.usado||0));c.anulado=true;save();toast('Cobro anulado');rerender()}
function anularMovimiento(k,id,i){if(k==='cobro')return anularCobro(id);if(!confirm('¿Anular este movimiento? Deja de contar en la cuenta del socio. Si tenía algo pagado, esa plata queda como saldo a favor.'))return;{const ref=i===null||i===undefined?[k,id]:[k,id,i];liberarDeCobros(ref,false)}if(k==='seg'){const q=S.seguros.find(x=>x.id===id)?.cuotas[i];if(q)q.anulado=true}else if(k==='rifa'){const r=S.rifas.find(x=>x.id===id);if(r){r.anulados=r.anulados||[];r.anulados[i]=true}}else{const x=S[k].find(v=>v.id===id);if(x)x.anulado=true}save();toast('Movimiento anulado');rerender()}
function fixLegacyPartialPayments(){if(S._fixPagoParcial1)return;let changed=false;[...S.cobros].sort((a,b)=>(a.ts||'').localeCompare(b.ts||'')).forEach(c=>{if(c.anulado||c.aplicados||(+c.cubre||0)!==0||!(c.monto>0)||!(c.quedo>c.monto))return;const saldo=c.quedo,pend=movs(c.sid).filter(m=>!m.pag&&!m.fut).reverse();if(!pend.length)return;let disponible=saldo,aplicados=[];for(const m of pend){if(disponible<=0)break;const[k,id,i]=m.ref;if(disponible>=m.imp){if(k==='seg'){const q=S.seguros.find(x=>x.id===id).cuotas[i];q.pago=c.fecha;q.medio=c.medio||'';q.det=c.det||null}else if(k==='rifa'){const r=S.rifas.find(x=>x.id===id);r.pagos[i]=c.fecha;r.medios=r.medios||[];r.dets=r.dets||[];r.medios[i]=c.medio||'';r.dets[i]=c.det||null}else{const x=S[k].find(v=>v.id===id);x.pagado=true;x.fpago=c.fecha;x.medio=c.medio||'';x.det=c.det||null}aplicados.push({ref:[...m.ref],completo:true,abono:0});disponible-=m.imp}else{aplicarAbono(m.ref,disponible);aplicados.push({ref:[...m.ref],completo:false,abono:disponible});disponible=0}}if(aplicados.length){const s=soc(c.sid);if(s)s.favor=Math.max(0,(s.favor||0)-saldo);c.aplicados=aplicados;c.cubre=aplicados.length;c.usado=Math.max(c.usado||0,saldo-c.monto);c.quedo=0;changed=true}});if(changed){S._fixPagoParcial1=true;save()}}
function editCobro(id){
  const cobro=S.cobros.find(x=>x.id===id);
  if(!cobro)return;
  abrirPago({
    clave:'cobro|'+id,titulo:'Editar cobro',fecha:cobro.fecha,
    medio:cobro.medio,detalle:cobro.det,monto:fmtN(cobro.monto||0),textoGuardar:'Guardar',
    nota:'El importe ya aplicado a los conceptos se conserva; el cambio ajusta el saldo a favor.',
    guardar:(fecha,medio,detalle,monto)=>saveCobroEdit(id,fecha,medio,detalle,monto),
  });
}

function saveCobroEdit(id,fecha,medio,detalle,monto){
  const cobro=S.cobros.find(x=>x.id===id);
  if(!cobro||cobro.anulado)return 'El cobro ya no está disponible.';
  const socio=soc(cobro.sid);
  if(!socio)return 'No se encontró el socio del cobro.';
  const nuevo=num(monto);
  const sobrante=cobro.quedo||0;
  const aplicado=cobro.monto-sobrante;
  if(nuevo<aplicado)return 'El monto no puede quedar por debajo de lo ya aplicado.';
  const reduccion=cobro.monto-nuevo;
  const saldo=favor(cobro.sid);
  if(reduccion>saldo)return 'No se puede bajar tanto: '+money(reduccion-saldo)+' de este cobro ya se usaron como saldo a favor.';
  const nuevoSobrante=Math.max(0,sobrante-reduccion);
  socio.favor=Math.max(0,saldo+nuevoSobrante-sobrante);
  Object.assign(cobro,{quedo:nuevoSobrante,monto:nuevo,fecha,medio,det:detalle});
  done('Cobro actualizado');
}

function sSeg(s){const L=S.seguros.filter(x=>x.sid===s.id);
  return `<div class="card"><div class="ch"><h2>Seguros</h2><button class="btn p sm" onclick="openSeguro(null,'${s.id}')">+ Seguro</button></div>
  ${L.length?`<div class="tw"><table><thead><tr><th>Ingreso</th><th>Vence</th><th>Descripción</th><th>Forma de pago</th><th class="r">Valor</th><th>Cuotas</th><th>Pago</th><th></th></tr></thead><tbody>${L.map(x=>segRow(x)).join('')}</tbody></table></div>`:'<div class="empty">No tiene seguros.</div>'}</div>`}
function sQ6(s){const J=S.q6.filter(x=>x.sid===s.id).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return `  <div class="card"><div class="ch"><h2>Jugadas</h2><div class="acts"><button class="btn sm" onclick="openPlanQ6('${s.id}')">Administrar días</button><button class="btn p sm" onclick="openQ6(null,'${s.id}')">+ Jugada</button></div></div>
  ${J.length?`<div class="tw"><table><thead><tr><th>Sorteo</th><th class="r">Monto</th><th>Pago</th><th></th></tr></thead><tbody>${J.map(j=>`<tr class="${j.pagado?'r-ok':j.abono>0?'r-par':'r-bad'}"><td>${fdl(j.fecha)}${S.q6esp.some(e=>e.fecha===j.fecha)?' <span class="tag t-w">★ especial</span>':''}${j.auto?' <span class="tag">automática</span>':''}</td><td class="r">${money(j.monto)}</td><td>${pay(j.pagado,`tg('q6','${j.id}')`)}</td><td class="r"><button class="btn sm g" onclick="openQ6('${j.id}')">Editar</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Sin jugadas.</div>'}</div>`}
function openPlanQ6(sid){const s=soc(sid);modal(`<h2>Días de juego habitual</h2><p class="note">Elegí los días para las próximas jugadas automáticas. Los sorteos ya cargados se conservan.</p><div class="opts">${S.conf.q6Dias.map(d=>`<label><input type="checkbox" name="plan-dia" value="${d}" ${s.q6.dias.includes(d)?'checked':''}>${DIAS[d]}</label>`).join('')}</div><label class="f">Jugadas por sorteo<input id="plan-cant" type="number" min="1" value="${s.q6.cant||1}"></label><p class="mu small">Para detener las jugadas automáticas, dejá todos los días sin marcar.</p><div class="mfoot"><span></span><div class="acts"><button class="btn" onclick="close_()">Cancelar</button><button class="btn p" onclick="savePlanQ6('${sid}')">Guardar</button></div></div>`)}
function savePlanQ6(sid){const s=soc(sid);if(!s)return;const dias=[...document.querySelectorAll('[name=plan-dia]:checked')].map(e=>+e.value);q6Auto();const antes=s.q6.auto,cambiaron=[...s.q6.dias].sort().join(',')!==[...dias].sort().join(',');s.q6.dias=dias;s.q6.activo=dias.length>0;s.q6.auto=dias.length>0;s.q6.cant=Math.max(1,parseInt(val('plan-cant'))||1);if(s.q6.auto&&(!antes||cambiaron))s.q6.desde=hoy();save();q6Auto();close_();rerender();toast('Días de juego actualizados')}
function setAuto(sid,on){const s=soc(sid);s.q6.auto=on;if(on){if(!s.q6.dias.length)s.q6.dias=[...S.conf.q6Dias];s.q6.desde=hoy()}s.q6.activo=s.q6.dias.length>0;save();const n=q6Auto();rerender();toast(on?'Renovación automática activada'+(n?` · ${n} jugada${n>1?'s':''} cargada${n>1?'s':''}`:''):'Renovación automática apagada')}
function setDia(sid,d,on){const s=soc(sid);s.q6.dias=s.q6.dias.filter(x=>x!==d);if(on)s.q6.dias.push(d);s.q6.dias.sort();s.q6.activo=s.q6.dias.length>0;if(!s.q6.dias.length)s.q6.auto=false;else if(!s.q6.auto){s.q6.auto=true;s.q6.desde=hoy()}save();q6Auto();rerender()}
function setCant(sid,v){soc(sid).q6.cant=Math.max(1,parseInt(v)||1);save();rerender()}
function sLot(s){const L=S.lot.filter(x=>x.sid===s.id).sort((a,b)=>((so(b.soId)||{}).fecha||'').localeCompare((so(a.soId)||{}).fecha||''));
  return `<div class="card"><div class="ch"><div><h2>Números fijos</h2><div class="mu small">Los que compra todos los años. En Lotería, “Cargar números fijos” los pasa al sorteo.</div></div></div>
  <div class="list">${s.fijos.map((f,i)=>`<div><span><span class="mono">${esc(f.numero)}</span> · ${f.frac?f.frac+(f.frac>1?' fracciones':' fracción'):'Entero'}</span><button class="btn sm g d" onclick="delFijo('${s.id}',${i})">Quitar</button></div>`).join('')||'<div class="empty">No tiene números fijos.</div>'}</div>
  <div class="acts" style="margin-top:10px;align-items:center"><input id="fj-n" class="in mono" placeholder="Número" inputmode="numeric" style="width:130px">
  <select id="fj-f" class="in"><option value="0">Entero</option>${Array.from({length:19},(_,i)=>`<option value="${i+1}">${i+1} ${i?'fracciones':'fracción'}</option>`).join('')}</select><button class="btn sm" onclick="addFijo('${s.id}')">+ Agregar fijo</button></div></div>
  <div class="card"><div class="ch"><h2>Números comprados</h2><button class="btn p sm" onclick="openVenta(null,'${s.id}')">+ Número</button></div>
  ${L.length?`<div class="tw"><table><thead><tr><th>Sorteo</th><th>Número</th><th>Fracciones</th><th class="r">Pesos</th><th>Pago</th><th></th></tr></thead><tbody>${L.map(l=>`<tr class="ck ${l.pagado?'r-ok':'r-bad'}" onclick="openVenta('${l.id}')"><td>${esc((so(l.soId)||{}).nombre||'—')}</td><td class="mono">${esc(l.numero)}</td><td>${fracTxt(l)}</td><td class="r">${money(l.frac*l.precio)}</td><td>${pay(l.pagado,`tg('lot','${l.id}')`)}</td><td><button class="btn sm g" onclick="event.stopPropagation();openVenta('${l.id}')">Editar</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No compró números.</div>'}</div>`}
function addFijo(sid){const n=val('fj-n').replace(/\s/g,'');if(!n)return toast('Escribí el número');soc(sid).fijos.push({numero:n,frac:+val('fj-f')});save();rerender();toast('Número fijo agregado')}
function delFijo(sid,i){soc(sid).fijos.splice(i,1);save();rerender()}
function sQui(s){const Q=S.quiniela.filter(x=>x.sid===s.id).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return `<div class="card"><div class="ch"><h2>Quiniela</h2><button class="btn p sm" onclick="openQui(null,'${s.id}')">+ Jugada</button></div>
  ${Q.length?`<div class="tw"><table><thead><tr><th>Fecha</th><th>Números</th><th class="r">Monto</th><th>Pago</th><th></th></tr></thead><tbody>${Q.map(q=>`<tr class="ck ${q.pagado?'r-ok':'r-bad'}" onclick="openQui('${q.id}')"><td>${fdl(q.fecha)}</td><td class="mono">${esc(q.numeros)}</td><td class="r">${money(q.monto)}</td><td>${pay(q.pagado,`tg('quiniela','${q.id}')`)}</td><td><button class="btn sm g" onclick="event.stopPropagation();openQui('${q.id}')">Editar</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Sin jugadas.</div>'}</div>`}
function sRifa(s){const R=S.rifas.filter(x=>x.sid===s.id).sort((a,b)=>b.anio-a.anio);
  return `<div class="card"><div class="ch"><h2>Rifa Devoto</h2><button class="btn p sm" onclick="openRifa(null,'${s.id}')">+ Rifa</button></div>
  ${R.length?`<div class="tw"><table><thead><tr><th>Rifa</th><th>Modalidad</th><th class="r">Importe</th><th>Pagos</th><th class="r">Estado</th><th></th></tr></thead><tbody>${R.map(r=>rifaRow(r)).join('')}</tbody></table></div>`:'<div class="empty">No tiene rifas.</div>'}</div>`}
/* ============ SEGUROS ============ */
function segRow(x,showSoc){const imp=x.cuotas.filter(c=>!c.pago),ven=imp.filter(c=>c.venc<=hoy()),nx=x.cuotas.findIndex(c=>!c.pago);
  const pg=!imp.length?'<span class="pay si">✓ Pagado</span>':cobrarBtn(x.sid,'seg|'+x.id+'|'+nx,ven.length?'Cobrar '+money(sum(ven,c=>c.imp)):'Cobrar');
  return `<tr class="ck ${!imp.length?'r-ok':ven.length?'r-bad':''}" onclick="openSeguro('${x.id}')">${showSoc?`<td>${esc(sname(x.sid))}</td>`:''}<td>${fd(x.ingreso)}</td><td>${vtag(x.venc)}</td><td>${esc(x.desc)}${porTxt(x)?`<br><span class="by">${porTxt(x)}</span>`:''}</td><td>${PLANES[x.plan]}</td><td class="r">${money(x.valor)}</td>
  <td><div class="cuotas">${x.cuotas.map((c,i)=>`<button class="${c.pago?'si':c.venc<=hoy()?'ven':''}" title="${x.cuotas.length>1?'Cuota '+c.n:'Pago'} · vence ${fd(c.venc)} · ${money(c.imp)}${c.pago?' · pagada '+fd(c.pago)+(c.medio?' ('+medioTxt(c.medio,c.det)+')':''):''}" onclick="event.stopPropagation();cuotaSeg('${x.id}',${i})">${x.cuotas.length>1?c.n:'$'}</button>`).join('')}</div></td><td>${pg}</td><td><button class="btn sm g" onclick="event.stopPropagation();openSeguro('${x.id}')">Editar</button></td></tr>`}
function publicarSeguros(){
  const seguros=V==='seguros'&&CUR?[...S.seguros].sort((a,b)=>a.venc.localeCompare(b.venc)).map(seguro=>{
    const pendientes=seguro.cuotas.filter(c=>!c.pago);
    const vencidas=pendientes.filter(c=>c.venc<=hoy());
    const dias=days(seguro.venc);
    const vencimiento=dias<0?'Venció hace '+(-dias)+' d':dias===0?'Vence hoy':dias<=7?'Vence en '+dias+' d':'Vence '+fd(seguro.venc);
    return {
      id:seguro.id,socio:sname(seguro.sid),ingreso:fd(seguro.ingreso),vencimiento,
      descripcion:seguro.desc,plan:PLANES[seguro.plan],valor:money(seguro.valor),
      vencido:vencidas.length>0,vencePronto:dias<=30,
      etiquetaCobro:pendientes.length?(vencidas.length?'Cobrar '+money(sum(vencidas,c=>c.imp)):'Cobrar'):'',
      cuotas:seguro.cuotas.map(c=>({
        numero:seguro.cuotas.length>1?String(c.n):'$',pagada:!!c.pago,vencida:c.venc<=hoy(),
        titulo:(seguro.cuotas.length>1?'Cuota '+c.n:'Pago')+' · vence '+fd(c.venc)+' · '+money(c.imp)+(c.pago?' · pagada '+fd(c.pago):''),
      })),
    };
  }):null;
  window.dispatchEvent(new CustomEvent('agencia:seguros',{detail:seguros?{
    seguros,editar:openSeguro,cuota:cuotaSeg,
    cobrar:id=>{const seguro=S.seguros.find(x=>x.id===id);if(!seguro)return;const indice=seguro.cuotas.findIndex(c=>!c.pago);if(indice>=0)openCobro(seguro.sid,'seg|'+id+'|'+indice)},
  }:null}));
}
const DETS={cheque:[['banco','Banco'],['nro','N° de cheque'],['librador','Librador / titular'],['fcobro','Fecha de cobro','date']],
  echeq:[['banco','Banco'],['nro','N° / ID del e-cheq'],['librador','CUIT del librador'],['fcobro','Fecha de pago','date']],
  transferencia:[['banco','Banco o billetera de origen'],['nro','N° de operación / comprobante'],['librador','Titular de la cuenta']],
  mp:[['nro','N° de operación'],['librador','Titular']]};
const DETNOM={cheque:'del cheque',echeq:'del e-cheq',transferencia:'de la transferencia',mp:'del pago'};
const pagoCampos=(f,m,det)=>`<label class="f">Día que llegó el pago<input type="date" id="pg-f" value="${f}"></label><span class="lbl">Medio de pago</span><div class="opts">${Object.entries(MEDIOS).map(([k,t])=>`<label><input type="radio" name="pg-m" value="${k}" ${m===k?'checked':''} onchange="pgDet()">${t}</label>`).join('')}<label><input type="radio" name="pg-m" value="" ${!m?'checked':''} onchange="pgDet()">Sin especificar</label></div><div id="pg-dw" data-det="${esc(JSON.stringify(det||{}))}"></div>`;
function pgDet(){const w=$('#pg-dw');if(!w)return;const m=radio('pg-m');const F_=DETS[m];if(!F_){w.innerHTML='';return}
  let d={};try{d=JSON.parse(w.dataset.det||'{}')}catch(e){}const has=Object.keys(d).length>0||m==='cheque'||m==='echeq';
  w.innerHTML=`<div class="opts" style="margin-top:-4px"><label><input type="checkbox" id="pg-dc" ${has?'checked':''} onchange="$('#pg-df').hidden=!this.checked">¿Cargar los datos ${DETNOM[m]}?</label></div>
  <div id="pg-df" ${has?'':'hidden'} style="border:1px solid var(--ln);border-radius:10px;padding:12px 12px 0;margin-bottom:12px"><div class="row">${F_.map(([k,t,ty])=>`<label class="f">${t}<input id="pg-d-${k}" ${ty?`type="${ty}"`:''} value="${esc(d[k]||'')}"></label>`).join('')}</div></div>`;enh(w)}
function detallePago(medio,cargar,datos,anterior){
  if(!cargar||!DETS[medio])return null;
  const detalle={};
  for(const [clave] of DETS[medio]){
    if(datos[clave])detalle[clave]=datos[clave];
  }
  if((medio==='cheque'||medio==='echeq')&&detalle.nro&&detalle.nro===anterior.nro&&detalle.banco===anterior.banco){
    if(anterior.estado)detalle.estado=anterior.estado;
    if(anterior.dep)detalle.dep=anterior.dep;
  }
  return Object.keys(detalle).length?detalle:null;
}
function pagoDet(){
  const medio=radio('pg-m');
  if(!DETS[medio]||!$('#pg-dc')?.checked)return null;
  let anterior={};
  try{anterior=JSON.parse($('#pg-dw').dataset.det||'{}')}catch{}
  const datos=Object.fromEntries(DETS[medio].map(([clave])=>[clave,val('pg-d-'+clave)]));
  return detallePago(medio,true,datos,anterior);
}
function abrirPago({fecha,medio='',detalle,monto,guardar,...vista}){
  const anterior=detalle||{};
  const modo=Object.hasOwn(MEDIOS,medio)?medio:'';
  close_();
  window.dispatchEvent(new CustomEvent('agencia:editar-pago',{detail:{
    ...vista,cerrar:close_,
    inicial:{
      fecha:fecha||hoy(),medio:modo,monto,
      cargarDetalle:!!(DETS[modo]&&(Object.keys(anterior).length||modo==='cheque'||modo==='echeq')),
      banco:String(anterior.banco||''),nro:String(anterior.nro||''),
      librador:String(anterior.librador||''),fcobro:anterior.fcobro||'',
    },
    guardar:datos=>guardar(datos.fecha,datos.medio,detallePago(datos.medio,datos.cargarDetalle,datos,anterior),datos.monto),
  }}));
}
function medioTxt(m,d){if(!m)return'';let t=MEDIOS[m]||'';if(d){t+=[d.banco,d.nro?'N° '+d.nro:'',d.librador,d.fcobro?(m==='echeq'?'paga ':'cobro ')+fd(d.fcobro):''].filter(Boolean).map(x=>' · '+esc(x)).join('');if(d.dep)t+=' · depositado'}return t}
function crearSocioParaSeguro(nombre,tel){
  const normalizado=nombre.trim().toLowerCase();
  let socio=S.socios.find(x=>x.nombre.trim().toLowerCase()===normalizado);
  if(!socio){
    socio={id:uid(),nro:String(Math.max(0,...S.socios.map(x=>parseInt(x.nro)||0))+1),nombre,tel,dir:'',activo:true,dni:'',nota:'',fijos:[],q6:{activo:false,dias:[],cant:1}};
    S.socios.push(socio);
    save();
  }else if(!socio.activo){
    socio.activo=true;
    save();
  }
  return {id:socio.id,nombre:socio.nombre,nro:String(socio.nro||'')};
}
function openSeguro(id,sid){
  const x=id?S.seguros.find(s=>s.id===id):{sid:sid||'',ingreso:hoy(),venc:addMonths(hoy(),12),desc:'',valor:'',plan:'contado'};
  if(!x)return;
  close_();
  const socioFijo=V==='socio'&&!!x.sid&&!!soc(x.sid);
  const socios=socOrd().map(s=>({id:s.id,nombre:s.nombre,nro:String(s.nro||'')}));
  if(socioFijo&&!socios.some(s=>s.id===x.sid)){
    const socio=soc(x.sid);
    socios.push({id:socio.id,nombre:socio.nombre,nro:String(socio.nro||'')});
  }
  window.dispatchEvent(new CustomEvent('agencia:editar-seguro',{detail:{
    id:id||null,
    inicial:{sid:x.sid,ingreso:x.ingreso,venc:x.venc,desc:x.desc||'',valor:fmtN(x.valor),plan:String(x.plan)},
    socios,socioFijo,guardar:datos=>saveSeguro(id,datos),
    eliminar:()=>{if(id)del('seguros',id)},crearSocio:crearSocioParaSeguro,cerrar:close_,
  }}));
}
function saveSeguro(id,datos){const o={sid:datos.sid,ingreso:datos.ingreso,venc:datos.venc,desc:datos.desc,valor:num(datos.valor),plan:datos.plan};
  if(!o.sid||!o.ingreso)return toast('Elegí el socio y la fecha de ingreso');if(!o.valor)return toast('Poné el valor del seguro');
  if(id){const x=S.seguros.find(s=>s.id===id);const re=x.valor!==o.valor||String(x.plan)!==o.plan||x.ingreso!==o.ingreso;const n=o.plan==='contado'?1:+o.plan;let lib=0;
    if(re&&o.sid===x.sid){const keep=x.cuotas.slice(0,n),pag=sum(keep.filter(c=>c.pago&&!c.anulado),c=>c.imp),lib_=keep.filter(c=>!c.pago&&!c.anulado).length+Math.max(0,n-x.cuotas.length);
      if(o.valor<pag)return toast(`Ya pagó ${money(pag)} en cuotas, más que el valor nuevo. Anulá el pago de alguna cuota antes de bajarlo.`);
      if(!lib_&&o.valor!==pag)return toast('Todas las cuotas ya están pagas. Para cambiar el valor, anulá el pago de alguna cuota o elegí más cuotas.')}
    if(re||o.sid!==x.sid)x.cuotas.forEach((c,i)=>{const ref=['seg',id,i];
      if(c.pago&&(i>=n||o.sid!==x.sid)){lib+=liberarDeCobros(ref,true);c.pago=null;c.medio='';c.det=null}   // cuotas pagas que desaparecen o cambian de socio
      if(c.abono&&!c.pago){lib+=liberarDeCobros(ref,'parcial');c.abono=0}});                                    // los abonos parciales vuelven a favor y se reaplican abajo
    Object.assign(x,o);if(re)x.cuotas=genCuotas(o.ingreso,o.plan,o.valor,x.cuotas);
    if(lib)setTimeout(()=>toast(`Lo que ya había pagado de cuotas cambiadas (${money(lib)}) quedó como saldo a favor`),2500)}
  else{
    S.seguros.push({id:uid(),...o,cuotas:genCuotas(o.ingreso,o.plan,o.valor)});
  }
  done('Seguro guardado');
}
function cuotaSeg(id,i){
  const seguro=S.seguros.find(s=>s.id===id);
  const cuota=seguro?.cuotas[i];
  if(!cuota)return;
  abrirPago({
    clave:'seg|'+id+'|'+i,
    titulo:seguro.cuotas.length>1?'Pago de la cuota '+cuota.n+' de '+seguro.cuotas.length:'Pago del seguro',
    descripcion:sname(seguro.sid)+' · '+seguro.desc,vencimiento:fd(cuota.venc),importe:money(cuota.imp),
    fecha:cuota.pago,medio:cuota.medio,detalle:cuota.det,
    textoGuardar:cuota.pago?'Guardar':'Marcar pagada',
    guardar:(fecha,medio,detalle)=>setCuota(id,i,fecha,medio,detalle),
    anular:cuota.pago?{texto:'No pagó (desmarcar)',ejecutar:()=>setCuota(id,i,null)}:undefined,
  });
}
function setCuota(id,i,f,m,d){const c=S.seguros.find(s=>s.id===id).cuotas[i];if(!f&&c.pago){c.pago=null;const lib=liberarDeCobros(['seg',id,i],true);if(lib)setTimeout(()=>toast(`${money(lib)} quedaron como saldo a favor`),2500)}c.pago=f||null;c.medio=f?(m||''):'';c.det=f?d||null:null;done(f?'Pago registrado':'Cuota desmarcada')}
/* ============ JUEGOS (Quini 6 · Lotería · Quiniela · Rifa) ============ */
VIEWS.juegos=()=>({q6:vQ6,lot:vLot,qui:vQui,rifa:vRifa}[TAB])();
/* ---- piezas comunes de los juegos ---- */
const GDESC={q6:'Jugadas por sorteo. Los socios que juegan siempre se cargan solos el día del sorteo.',lot:'Números vendidos por sorteo y a quién falta ofrecerle.',qui:'Jugadas del día. Navegá los días con las flechas.',rifa:'Rifas vendidas por año, de contado o en cuotas.'};
function gHead(k,btn){return `<div class="head"><div><h1 class="gt" style="--c:${COL[k]}">${NOMBRE[k]}</h1><div class="sub">${GDESC[k]}</div></div>${btn||''}</div>`}
function gKpis(a,b,c){return `<div class="grid g3"><div class="kpi"><small>${a[0]}</small><b>${a[1]}</b>${a[2]?`<span class="mu small">${a[2]}</span>`:''}</div><div class="kpi"><small>Cobrado</small><b class="ok">${money(b)}</b></div><div class="kpi ${c?'kbad':''}"><small>Falta cobrar</small><b class="${c?'bad':''}">${money(c)}</b></div></div>`}
function gFilt(){const f=F.gf||'todos';return `<div class="seg">${[['todos','Todos'],['deben','Deben'],['pagados','Pagados']].map(([k,t])=>`<button class="${f===k?'on':''}" onclick="F.gf='${k}';rerender()">${t}</button>`).join('')}</div>`}
const gPass=paid=>{const f=F.gf||'todos';return f==='todos'||(f==='deben'&&!paid)||(f==='pagados'&&paid)};
const sLink=sid=>`<button class="lnk" onclick="event.stopPropagation();verSocio('${sid}')">${esc(sname(sid))}</button>`;
const byName=(a,b)=>sname(a.sid).localeCompare(sname(b.sid));
const byNum=(a,b)=>{const x=parseInt(String(a.numero).replace(/\D/g,''),10),y=parseInt(String(b.numero).replace(/\D/g,''),10);return (isNaN(x)?Infinity:x)-(isNaN(y)?Infinity:y)||String(a.numero).localeCompare(String(b.numero))||byName(a,b)};
const empt=(t,btn)=>`<div class="emptyb"><p>${t}</p>${btn||''}</div>`;

/* ---- Quini 6 ---- */
function vQ6(){const fechas=q6Fechas(addDays(hoy(),-180),addDays(hoy(),60));let f=F.q6F&&fechas.includes(F.q6F)?F.q6F:(q6Prox()||fechas[fechas.length-1]);F.q6F=f;
  const ix=fechas.indexOf(f),prox=q6Prox(),esp=S.q6esp.find(e=>e.fecha===f),dd=days(f);
  const J=S.q6.filter(j=>j.fecha===f).sort(byName),V=J.filter(j=>gPass(j.pagado));
  const juegan=S.socios.filter(s=>s.activo&&s.q6.dias.length).sort((a,b)=>a.nombre.localeCompare(b.nombre));const eseDia=juegan.filter(s=>juegaEn(s,f));
  return gHead('q6',`<button class="btn p" onclick="openQ6(null,null,'${f}')">+ Jugada suelta</button>`)+
  `<div class="card selbar"><button class="btn" ${ix<=0?'disabled':''} onclick="F.q6F='${fechas[ix-1]||f}';rerender()" aria-label="Sorteo anterior">‹</button>
    <div class="selbox"><b>Sorteo del ${DIAS[parse(f).getDay()]} ${fd(f)}</b><span>${dd===0?'Hoy':dd>0?`Falta${dd>1?'n':''} ${dd} día${dd>1?'s':''}`:`Fue hace ${-dd} día${dd<-1?'s':''}`} · ${money(q6Precio(f))} por jugada${esp?` · <span class="tag t-w">★ ${esc(esp.nombre)}</span>`:''}</span></div>
    <button class="btn" ${ix>=fechas.length-1?'disabled':''} onclick="F.q6F='${fechas[ix+1]||f}';rerender()" aria-label="Sorteo siguiente">›</button>
    ${prox&&f!==prox?`<button class="btn g" onclick="F.q6F='${prox}';rerender()">Ir al próximo</button>`:''}</div>`+
  gKpis(['Jugadas',J.length,money(sum(J,j=>j.monto))+' en total'],sum(J,j=>cobr(j,j.monto)),sum(J,j=>falt(j,j.monto)))+
  `<div class="card"><div class="ch"><h2>Jugadas de este sorteo</h2><div class="acts">${V.length?`<button class="btn sm" onclick="pdfQ6()">⬇ PDF</button>`:''}${J.length?gFilt():''}</div></div>
  ${J.length?(V.length?`<div class="tw"><table><thead><tr><th>Socio</th><th>Cómo juega</th><th>Cargó</th><th class="r">Monto</th><th>Estado</th><th></th></tr></thead><tbody>${V.map(j=>`<tr class="${j.pagado?'r-ok':j.abono>0?'r-par':'r-bad'}"><td>${sLink(j.sid)}</td><td class="mu small">${j.auto?'Juega siempre':'Jugada suelta'}</td><td class="by">${porTxt(j)||'—'}</td><td class="r amt">${money(j.monto)}</td><td>${pay(j.pagado,`tg('q6','${j.id}')`)}</td><td class="r"><button class="btn sm g" onclick="openQ6('${j.id}')">Editar</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nada en este filtro.</div>')
   :dd>0?empt(eseDia.length?`Este sorteo todavía no se jugó. El día del sorteo se cargan solos: <b>${eseDia.map(s=>esc(s.nombre)).join(', ')}</b>.`:'Este sorteo todavía no se jugó y nadie juega fijo este día.',`<button class="btn" onclick="openQ6(null,null,'${f}')">+ Jugada suelta</button>`)
   :empt('No hubo jugadas en este sorteo.')}</div>
  <div class="two"><div class="card"><div class="ch"><div><h2>Juegan siempre</h2><div class="mu small">Se cambia desde la ficha de cada socio.</div></div></div>
    <div class="list">${juegan.map(s=>`<div><span>${sLink(s.id)}<br><span class="mu small">${s.q6.dias.map(d=>DIAS[d]).join(' y ')} · ${s.q6.cant} jugada${s.q6.cant>1?'s':''}</span></span><b>${money(S.conf.q6Precio*s.q6.cant*s.q6.dias.length)}<span class="mu small"> /sem</span></b></div>`).join('')||'<div class="empty">Nadie juega fijo todavía. Entrá a un socio → pestaña Quini 6 y marcá los días.</div>'}</div></div>
  <div class="card"><div class="ch"><div><h2>Sorteos especiales</h2><div class="mu small">Fechas con otro precio. Los comunes salen ${money(S.conf.q6Precio)}.</div></div><button class="btn sm" onclick="openEsp()">+ Especial</button></div>
    <div class="list">${[...S.q6esp].sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(e=>`<div><span>${esc(e.nombre)}<br><span class="mu small">${fdl(e.fecha)}</span></span><span class="acts" style="align-items:center"><b>${money(e.precio)}</b><button class="btn sm g" onclick="openEsp('${e.id}')">Editar</button></span></div>`).join('')||'<div class="empty">No hay especiales cargados.</div>'}</div></div></div>`}

/* ---- Lotería ---- */
function vLot(){const L=[...S.sorteos].sort((a,b)=>a.fecha.localeCompare(b.fecha));const s=so(F.so)||sorteoAct();
  if(!s)return gHead('lot')+empt('No hay sorteos cargados.',`<button class="btn p" onclick="nav('ajustes')">Cargar sorteos en Ajustes</button>`);F.so=s.id;
  const Vt=S.lot.filter(l=>l.soId===s.id).sort(byNum),V=Vt.filter(v=>gPass(v.pagado));const imp=v=>v.frac*v.precio;
  const con=new Set(Vt.map(v=>v.sid)),noq=new Set(S.ofertas.filter(o=>o.soId===s.id).map(o=>o.sid));
  const sinOf=socOrd().filter(x=>!con.has(x.id)&&!noq.has(x.id)),noQ=socOrd().filter(x=>!con.has(x.id)&&noq.has(x.id));
  const fijosPend=socOrd().filter(x=>x.fijos.some(f=>!Vt.some(v=>v.sid===x.id&&v.numero===f.numero)));const dd=days(s.fecha);
  return gHead('lot',`<button class="btn p" onclick="openVenta(null,null,'${s.id}')">+ Vender número</button>`)+
  `<div class="card"><span class="lbl">Elegí el sorteo</span><div class="seg" style="margin-top:6px;display:flex">${L.map(x=>`<button class="${x.id===s.id?'on':''}" onclick="F.so='${x.id}';rerender()">${esc(x.nombre)}${x.id===(sorteoAct()||{}).id?' · próximo':''}</button>`).join('')}</div>
    <p style="margin-top:10px" class="small">Sorteo el <b>${fdl(s.fecha)}</b> (${dd>0?`faltan ${dd} días`:dd===0?'hoy':'ya se sorteó'}) · entero de <b>${s.frac}</b> fracciones · <b>${money(s.precio)}</b> la fracción · <b>${money(s.precio*s.frac)}</b> el entero</p></div>`+
  gKpis(['Vendido',`${Vt.length} número${Vt.length===1?'':'s'}`,`${sum(Vt,v=>v.frac)} fracciones`],sum(Vt,v=>cobr(v,imp(v))),sum(Vt,v=>falt(v,imp(v))))+
  `<div class="card"><div class="ch"><h2>Números vendidos</h2><div class="acts">${fijosPend.length?`<button class="btn sm" onclick="cargarFijos('${s.id}')">Cargar números fijos (${fijosPend.length})</button>`:''}${V.length?`<button class="btn sm" onclick="pdfLot()">⬇ PDF</button>`:''}${Vt.length?gFilt():''}</div></div>
    ${Vt.length?(V.length?`<div class="tw"><table><thead><tr><th>Socio</th><th>Número</th><th>Fracciones</th><th>Cargó</th><th class="r">Importe</th><th>Estado</th><th></th></tr></thead><tbody>${V.map(v=>`<tr class="${v.pagado?'r-ok':v.abono>0?'r-par':'r-bad'}"><td>${sLink(v.sid)}</td><td class="mono">${esc(v.numero)}</td><td>${fracTxt(v)}</td><td class="by">${porTxt(v)||'—'}</td><td class="r amt">${money(imp(v))}</td><td>${pay(v.pagado,`tg('lot','${v.id}')`)}</td><td class="r"><button class="btn sm g" onclick="openVenta('${v.id}')">Editar</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nada en este filtro.</div>')
      :empt('Todavía no vendiste números para este sorteo.'+(fijosPend.length?' Podés empezar cargando los números fijos de tus socios.':''))}</div>
  <div class="two"><div class="card"><div class="ch"><div><h2>Falta ofrecerle</h2><div class="mu small">Socios sin número en este sorteo.</div></div><span class="tag">${sinOf.length}</span></div>
    <div class="list">${sinOf.map(x=>`<div><span>${sLink(x.id)}</span><span class="acts"><button class="btn sm g" onclick="noQuiso('${s.id}','${x.id}')">No quiso</button><button class="btn sm" onclick="openVenta(null,'${x.id}','${s.id}')">Vender</button></span></div>`).join('')||'<div class="empty">Ya le ofreciste a todos. 👍</div>'}</div></div>
  <div class="card"><div class="ch"><div><h2>No quisieron</h2><div class="mu small">Le ofreciste y no compró.</div></div><span class="tag">${noQ.length}</span></div>
    <div class="list">${noQ.map(x=>`<div><span>${sLink(x.id)}</span><span class="acts"><button class="btn sm g" onclick="noQuiso('${s.id}','${x.id}',true)">Deshacer</button><button class="btn sm" onclick="openVenta(null,'${x.id}','${s.id}')">Vender</button></span></div>`).join('')||'<div class="empty">Nadie por ahora.</div>'}</div></div></div>`}

/* ---- Quiniela ---- */
function vQui(){const f=F.quiF,dd=days(f);const Qt=S.quiniela.filter(q=>q.fecha===f).sort(byName),Q=Qt.filter(q=>gPass(q.pagado));
  const otros=S.quiniela.filter(q=>!q.pagado&&q.fecha!==f).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  return gHead('qui',`<button class="btn p" onclick="openQui(null,null)">+ Cargar jugadas</button>`)+
  `<div class="card selbar"><button class="btn" onclick="F.quiF=addDays(F.quiF,-1);rerender()" aria-label="Día anterior">‹</button>
    <div class="selbox"><b>${f===hoy()?'Hoy · ':dd===-1?'Ayer · ':''}${DIAS[parse(f).getDay()]} ${fd(f)}</b><span><input type="date" data-label="Elegir otra fecha" value="${f}" onchange="F.quiF=this.value;rerender()"></span></div>
    <button class="btn" onclick="F.quiF=addDays(F.quiF,1);rerender()" aria-label="Día siguiente">›</button>${f!==hoy()?`<button class="btn g" onclick="F.quiF=hoy();rerender()">Volver a hoy</button>`:''}</div>`+
  gKpis(['Jugado en el día',money(sum(Qt,q=>q.monto)),`${Qt.length} jugada${Qt.length===1?'':'s'}`],sum(Qt,q=>cobr(q,q.monto)),sum(Qt,q=>falt(q,q.monto)))+
  `<div class="card"><div class="ch"><h2>Jugadas del día</h2>${Qt.length?gFilt():''}</div>
    ${Qt.length?(Q.length?`<div class="tw"><table><thead><tr><th>Hora</th><th>Socio</th><th>Números</th><th>Cargó</th><th class="r">Monto</th><th>Estado</th><th></th></tr></thead><tbody>${Q.map(q=>`<tr class="${q.pagado?'r-ok':q.abono>0?'r-par':'r-bad'}"><td class="mu">${horaAR(q.ts)||'—'}</td><td>${sLink(q.sid)}</td><td class="mono">${esc(q.numeros)}</td><td class="by">${porTxt(q)||'—'}</td><td class="r amt">${money(q.monto)}</td><td>${pay(q.pagado,`tg('quiniela','${q.id}')`)}</td><td class="r"><button class="btn sm g" onclick="openQui('${q.id}')">Editar</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nada en este filtro.</div>')
      :empt(`No hay jugadas el ${DIAS[parse(f).getDay()]} ${fd(f)}.`,`<button class="btn" onclick="openQui(null,null)">+ Cargar jugadas</button>`)}</div>
  ${otros.length?`<div class="card"><div class="ch"><div><h2>Deben de otros días</h2><div class="mu small">Quinielas sin cobrar de días anteriores.</div></div><b class="bad">${money(sum(otros,q=>falt(q,q.monto)))}</b></div>
    <div class="tw"><table><tbody>${otros.map(q=>`<tr class="r-bad"><td style="width:110px">${fd(q.fecha)}</td><td>${sLink(q.sid)}</td><td class="mono">${esc(q.numeros)}</td><td class="r amt">${money(q.monto)}</td><td style="width:110px">${pay(false,`tg('quiniela','${q.id}')`)}</td><td><button class="btn sm g" onclick="openQui('${q.id}')">Editar</button></td></tr>`).join('')}</tbody></table></div></div>`:''}`}

/* ---- Rifa Devoto ---- */
function rifaRow(r,showSoc){const pg=rifaPagado(r),sal=r.importe-pg,np=r.pagos.filter(Boolean).length,ven=r.pagos.some((p,i)=>!p&&rifaVenc(r,i)<=hoy());
  return `<tr class="${sal<=0?'r-ok':ven?'r-bad':''}">${showSoc?`<td>${sLink(r.sid)}${porTxt(r)?`<br><span class="by">${porTxt(r)}</span>`:''}</td>`:''}<td style="white-space:nowrap">N° <span class="mono">${esc(r.nro)}</span>${showSoc?'':` <span class="mu small">${r.anio}</span>`}</td><td><span class="tag">${r.modo==='contado'?'Contado':r.ncuotas+' cuotas'}</span></td><td class="r">${money(r.importe)}</td>
  <td><div class="cuotas">${r.pagos.map((p,i)=>`<button class="${p?'si':rifaVenc(r,i)<=hoy()?'ven':''}" title="${r.modo==='contado'?'Pago':'Cuota '+(i+1)} · ${money(cuotaRifa(r,i))} · ${p?'pagada '+fd(p):'vence '+fd(rifaVenc(r,i))}" onclick="openRifaPago('${r.id}',${i})">${r.modo==='contado'?'$':i+1}</button>`).join('')}</div>${r.modo==='cuotas'?`<span class="mu small">${np} de ${r.ncuotas} pagas</span>`:''}</td>
  <td class="r amt">${sal>0?money(sal):'—'}</td><td>${sal>0?cobrarBtn(r.sid,'rifa|'+r.id+'|'+r.pagos.findIndex(p=>!p)):'<span class="pay si">✓ Pagada</span>'}</td><td class="r"><button class="btn sm g" onclick="openRifa('${r.id}')">Editar</button></td></tr>`}
function vRifa(){const anios=[...new Set(S.rifas.map(r=>r.anio).concat(new Date().getFullYear()))].sort();const Rt=S.rifas.filter(r=>r.anio===F.rifaA).sort((a,b)=>byName(a,b)||String(a.nro).localeCompare(String(b.nro)));
  const R=Rt.filter(r=>gPass(rifaPagado(r)>=r.importe));
  return gHead('rifa',`<div class="acts"><button class="btn" onclick="pdfRifa()">⬇ PDF</button><button class="btn p" onclick="openRifa()">+ Vender rifa</button></div>`)+
  `<div class="card selbar"><span class="lbl">Año</span><div class="seg">${anios.map(a=>`<button class="${a===F.rifaA?'on':''}" onclick="F.rifaA=${a};rerender()">${a}</button>`).join('')}</div><span class="mu small">Precio ${money(S.conf.rifaImporte)} · contado o ${S.conf.rifaCuotas} cuotas de ${money(cuotaRifa({importe:S.conf.rifaImporte,ncuotas:S.conf.rifaCuotas},0))}</span></div>`+
  gKpis(['Rifas vendidas',Rt.length,money(sum(Rt,r=>r.importe))+' en total'],sum(Rt,rifaPagado),sum(Rt,r=>r.importe-rifaPagado(r)))+
  `<div class="card"><div class="ch"><h2>Rifas ${F.rifaA}</h2>${Rt.length?gFilt():''}</div>
    ${Rt.length?(R.length?`<div class="tw"><table><thead><tr><th>Socio</th><th>Rifa</th><th>Modalidad</th><th class="r">Importe</th><th>Cuotas</th><th class="r">Saldo</th><th>Estado</th><th></th></tr></thead><tbody>${R.map(r=>rifaRow(r,true)).join('')}</tbody></table></div>`:'<div class="empty">Nada en este filtro.</div>')
      :empt(`Todavía no vendiste rifas en ${F.rifaA}.`,`<button class="btn" onclick="openRifa()">+ Vender rifa</button>`)}</div>`}
function q6Cargar(f){S.socios.filter(s=>juegaEn(s,f)&&!S.q6.some(j=>j.fecha===f&&j.sid===s.id)).forEach(s=>S.q6.push({id:uid(),sid:s.id,fecha:f,monto:q6Precio(f)*(s.q6.cant||1),pagado:false}));save();toast('Jugadas cargadas')}
function openQ6(id,sid,f){const j=id?S.q6.find(x=>x.id===id):{sid:sid||'',fecha:f||q6Prox(),pagado:false};
  const fs=[...new Set(q6Fechas(addDays(hoy(),-14),addDays(hoy(),45)).concat(j.fecha?[j.fecha]:[]))].sort();
  const cant=id?Math.max(1,Math.round(j.monto/q6Precio(j.fecha))):((soc(j.sid)||{q6:{}}).q6.cant||1);
  modal(`<h2>${id?'Editar jugada':'Jugada de Quini 6'}</h2>${socSel('j-sid',j.sid)}
  <div class="row"><label class="f">Sorteo<select id="j-f" onchange="q6Tot()">${fs.map(x=>`<option value="${x}" ${x===j.fecha?'selected':''}>${fdl(x)}${S.q6esp.some(e=>e.fecha===x)?' ★ especial':''}${x===hoy()?' (hoy)':''}</option>`).join('')}</select></label>
  <label class="f">Cantidad de jugadas<input id="j-c" type="number" min="1" value="${cant}" oninput="q6Tot()"></label></div>
  <p class="note" id="j-tot"></p>
  <input type="checkbox" id="j-p" hidden ${j.pagado?'checked':''}>${id?'':`<div class="opts"><label><input type="checkbox" id="j-a" checked onchange="$('#j-dias').hidden=!this.checked">Juega todas las semanas</label></div><div id="j-dias"><span class="lbl">Días que juega</span><div class="opts">${S.conf.q6Dias.map(d=>`<label><input type="checkbox" name="j-dia" value="${d}" ${j.fecha&&parse(j.fecha).getDay()===d?'checked':''}>${DIAS[d]}</label>`).join('')}</div><p class="note">Marcá los días de juego habitual. El sorteo elegido arriba se carga ahora; las próximas jugadas se generan automáticamente desde esa fecha.</p></div>`}
  <div class="mfoot">${id?`<button class="btn d" onclick="del('q6','${id}')">Eliminar</button>`:'<span></span>'}<div class="acts"><button class="btn" onclick="close_()">Cancelar</button><button class="btn p" onclick="saveQ6('${id||''}')">Guardar</button></div></div>`);q6Tot()}
function q6Tot(){const c=Math.max(1,parseInt(val('j-c'))||1),p=q6Precio(val('j-f'));$('#j-tot').innerHTML=`${c} × ${money(p)} = <b style="color:var(--ink)">${money(c*p)}</b>`}
function saveQ6(id){const fecha=val('j-f');const o={sid:val('j-sid'),fecha,monto:q6Precio(fecha)*Math.max(1,parseInt(val('j-c'))||1),pagado:$('#j-p').checked};if(!o.sid||!o.fecha)return toast('Elegí el socio y el sorteo');
  if(!id&&$('#j-a').checked&&!document.querySelector('[name=j-dia]:checked'))return toast('Elegí al menos un día para jugar todas las semanas');
  if(!id&&S.q6.some(x=>x.sid===o.sid&&x.fecha===o.fecha))return toast('Ya tiene una jugada en ese sorteo; editala');
  let lib=0;if(id){lib=prepEditar('q6',id,o.monto,o.sid);if(S.q6.find(x=>x.id===id)._lib){o.pagado=false;delete S.q6.find(x=>x.id===id)._lib}Object.assign(S.q6.find(x=>x.id===id),o)}else S.q6.push({id:uid(),...o});if(lib)setTimeout(()=>toast(`Lo que ya había pagado (${money(lib)}) quedó como saldo a favor`),2500);
  if(!id&&$('#j-a').checked){const s=soc(o.sid),dias=[...document.querySelectorAll('[name=j-dia]:checked')].map(e=>+e.value);s.q6.dias=[...new Set([...s.q6.dias,...dias])].sort();if(dias.length){if(!s.q6.auto){s.q6.auto=true;s.q6.desde=o.fecha}s.q6.activo=true;s.q6.cant=Math.max(1,parseInt(val('j-c'))||1)}}
  done('Jugada guardada')}
function openEsp(id){const e=id?S.q6esp.find(x=>x.id===id):{fecha:'',nombre:'Sorteo especial',precio:''};
  modal(`<h2>Sorteo especial de Quini 6</h2><div class="row"><label class="f">Fecha<input type="date" id="e-f" value="${e.fecha}"></label><label class="f">Precio por jugada<input id="e-p" class="money" inputmode="numeric" value="${e.precio}"></label></div>
  <label class="f">Nombre<input id="e-n" value="${esc(e.nombre)}"></label>
  <div class="mfoot">${id?`<button class="btn d" onclick="del('q6esp','${id}')">Eliminar</button>`:'<span></span>'}<div class="acts"><button class="btn" onclick="close_()">Cancelar</button><button class="btn p" onclick="saveEsp('${id||''}')">Guardar</button></div></div>`)}
function saveEsp(id){const o={fecha:val('e-f'),nombre:val('e-n')||'Sorteo especial',precio:num(val('e-p'))};if(!o.fecha||!o.precio)return toast('Poné fecha y precio');
  if(id)Object.assign(S.q6esp.find(x=>x.id===id),o);else S.q6esp.push({id:uid(),...o});done('Sorteo especial guardado')}

/* ---- Lotería ---- */
function noQuiso(soId,sid,undo){S.ofertas=S.ofertas.filter(o=>!(o.soId===soId&&o.sid===sid));if(!undo)S.ofertas.push({soId,sid});save();rerender()}
function cargarFijos(soId){const s=so(soId);let n=0;socOrd().forEach(x=>x.fijos.forEach(f=>{if(!S.lot.some(v=>v.soId===soId&&v.sid===x.id&&v.numero===f.numero)){S.lot.push({id:uid(),alta:hoy(),soId,sid:x.id,numero:f.numero,frac:f.frac?Math.min(f.frac,s.frac):s.frac,precio:s.precio,quien:'',pagado:false});n++}}));
  S.ofertas=S.ofertas.filter(o=>!(o.soId===soId&&S.lot.some(v=>v.soId===soId&&v.sid===o.sid)));save();toast(`${n} números cargados`);rerender()}
function openVenta(id,sid,soId){const L=[...S.sorteos].sort((a,b)=>a.fecha.localeCompare(b.fecha));if(!L.length)return toast('Primero cargá un sorteo en Ajustes');
  const v=id?S.lot.find(x=>x.id===id):{sid:sid||'',soId:soId||(sorteoAct()||L[0]).id,numero:'',quien:'',pagado:false};const s=so(v.soId)||L[0];
  const fijo=!id&&v.sid&&soc(v.sid)?soc(v.sid).fijos.find(f=>!S.lot.some(x=>x.soId===s.id&&x.sid===v.sid&&x.numero===f.numero)):null;
  const frac=id?v.frac:fijo&&fijo.frac?Math.min(fijo.frac,s.frac):s.frac;
  modal(`<h2>${id?'Editar venta':'Vender número de lotería'}</h2>${socSel('v-sid',v.sid,"ventaFijo()")}
  <label class="f">Sorteo<select id="v-so" onchange="ventaSo()">${L.map(x=>`<option value="${x.id}" data-p="${x.precio}" data-f="${x.frac}" ${x.id===s.id?'selected':''}>${esc(x.nombre)} · ${fd(x.fecha)} · ${x.frac} fracciones</option>`).join('')}</select></label>
  <div class="row"><label class="f">Número<input id="v-n" class="mono" inputmode="numeric" value="${esc(v.numero||(fijo?fijo.numero:''))}"></label>
  <label class="f">Fracciones<select id="v-fr" onchange="ventaTot()">${fracOpts(s.frac,frac)}</select></label></div>
  <p class="note" id="v-tot"></p>
  <div class="opts"><input type="checkbox" id="v-p" hidden ${v.pagado?'checked':''}>${id?'':'<label><input type="checkbox" id="v-fj">Guardar como número fijo del socio</label>'}</div>
  <div class="mfoot">${id?`<button class="btn d" onclick="del('lot','${id}')">Eliminar</button>`:'<span></span>'}<div class="acts"><button class="btn" onclick="close_()">Cancelar</button><button class="btn" onclick="saveVenta('${id||''}')">Guardar</button><button class="btn p" onclick="guardarYCobrar('lot',()=>saveVenta('${id||''}'))">Guardar y cobrar</button></div></div>`);ventaTot()}
function ventaSo(){const mx=+$('#v-so').selectedOptions[0].dataset.f;const cur=+val('v-fr');$('#v-fr').innerHTML=fracOpts(mx,Math.min(cur,mx)||mx);ventaTot()}
function ventaFijo(){const s=soc(val('v-sid'));if(s&&s.fijos[0]&&!val('v-n')){$('#v-n').value=s.fijos[0].numero;const mx=+$('#v-so').selectedOptions[0].dataset.f;$('#v-fr').innerHTML=fracOpts(mx,s.fijos[0].frac?Math.min(s.fijos[0].frac,mx):mx);ventaTot()}}
function ventaTot(){const o=$('#v-so').selectedOptions[0];const fr=+val('v-fr'),p=+o.dataset.p;$('#v-tot').innerHTML=`${fr===+o.dataset.f?'Entero · ':''}${fr} × ${money(p)} = <b style="color:var(--ink)">${money(fr*p)}</b>`}
function saveVenta(id){const s=so(val('v-so'));const o={sid:val('v-sid'),soId:s.id,numero:val('v-n'),frac:num(val('v-fr')),precio:s.precio,pagado:$('#v-p').checked};
  if(!o.sid||!o.numero||!o.frac)return toast('Completá socio, número y fracciones');if(o.frac>s.frac)return toast(`Máximo ${s.frac} fracciones`);
  if(id){const x=S.lot.find(v=>v.id===id);if(x.soId===o.soId)o.precio=x.precio;const lib=prepEditar('lot',id,o.frac*o.precio,o.sid);if(x._lib){o.pagado=false;delete x._lib}Object.assign(x,o);if(lib)setTimeout(()=>toast(`Lo que ya había pagado (${money(lib)}) quedó como saldo a favor`),2500)}else S.lot.push({id:uid(),alta:hoy(),...o});
  if($('#v-fj')&&$('#v-fj').checked){const so_=soc(o.sid);if(!so_.fijos.some(f=>f.numero===o.numero))so_.fijos.push({numero:o.numero,frac:o.frac>=s.frac?0:o.frac})}
  S.ofertas=S.ofertas.filter(x=>!(x.soId===o.soId&&x.sid===o.sid));done('Venta guardada')}

/* ---- Quiniela ---- */
let quiRows=1;
function openQui(id,sid){const q=id?S.quiniela.find(x=>x.id===id):{sid:sid||'',fecha:F.quiF||hoy(),numeros:'',monto:'',pagado:false};quiRows=1;
  modal(`<h2>${id?'Editar jugada':'Cargar quiniela'}</h2>${socSel('q-sid',q.sid)}
  <label class="f">Fecha<input type="date" id="q-f" value="${q.fecha}"></label>
  <div id="q-rows">${quiRow(0,q)}</div>
  ${id?'':`<button class="btn sm" onclick="if(quiRows<5){$('#q-rows').insertAdjacentHTML('beforeend',quiRow(quiRows++,{}));enh($('#q-rows'))}else toast('Hasta 5 jugadas por vez')" style="margin-bottom:12px">+ Otra jugada (hasta 5)</button>`}
  <input type="checkbox" id="q-p" hidden ${q.pagado?'checked':''}>
  <div class="mfoot">${id?`<button class="btn d" onclick="del('quiniela','${id}')">Eliminar</button>`:'<span></span>'}<div class="acts"><button class="btn" onclick="close_()">Cancelar</button><button class="btn p" onclick="saveQui('${id||''}')">Guardar</button></div></div>`)}
const quiRow=(i,q)=>`<div class="row"><label class="f">Números ${i?i+1:''}<input id="q-n${i}" class="mono" value="${esc(q.numeros||'')}" placeholder="Ej: 45 · 312"></label><label class="f">Monto<input id="q-m${i}" class="money" inputmode="numeric" value="${q.monto||''}"></label></div>`;
function saveQui(id){const sid=val('q-sid'),fecha=val('q-f'),pagado=$('#q-p').checked;if(!sid||!fecha)return toast('Elegí el socio y la fecha');
  const rows=[];for(let i=0;i<quiRows;i++){const n=val('q-n'+i),m=num(val('q-m'+i));if(n||m)rows.push({numeros:n,monto:m})}if(!rows.length)return toast('Cargá al menos una jugada');
  if(id){const x=S.quiniela.find(v=>v.id===id);const lib=prepEditar('quiniela',id,rows[0].monto,sid);let pg=pagado;if(x._lib){pg=false;delete x._lib}Object.assign(x,{sid,fecha,pagado:pg,...rows[0]});if(lib)setTimeout(()=>toast(`Lo que ya había pagado (${money(lib)}) quedó como saldo a favor`),2500)}else rows.forEach(r=>S.quiniela.push({id:uid(),sid,fecha,pagado,...r}));
  F.quiF=fecha;done(rows.length>1?rows.length+' jugadas guardadas':'Jugada guardada')}

/* ---- Rifa Devoto ---- */
function openRifaPago(id,i){
  const rifa=S.rifas.find(x=>x.id===id);
  if(!rifa||i<0||i>=rifa.pagos.length)return;
  const fecha=rifa.pagos[i];
  abrirPago({
    clave:'rifa|'+id+'|'+i,
    titulo:(fecha?'Editar pago':'Registrar pago')+' · '+(rifa.modo==='contado'?'rifa':'cuota '+(i+1)),
    descripcion:'Rifa N° '+rifa.nro+' · '+money(cuotaRifa(rifa,i)),
    fecha,medio:rifa.medios?.[i],detalle:rifa.dets?.[i],textoGuardar:'Guardar',
    guardar:(dia,medio,detalle)=>saveRifaPago(id,i,dia,medio,detalle),
    anular:fecha?{texto:'Quitar pago',ejecutar:()=>saveRifaPago(id,i,null)}:undefined,
  });
}
function saveRifaPago(id,i,fecha,medio='',detalle=null){
  const rifa=S.rifas.find(x=>x.id===id);
  if(!rifa||i<0||i>=rifa.pagos.length)return;
  if(!fecha&&rifa.pagos[i]){
    rifa.pagos[i]=null;
    liberarDeCobros(['rifa',id,i],true);
  }
  rifa.pagos[i]=fecha||null;
  rifa.medios=rifa.medios||[];
  rifa.dets=rifa.dets||[];
  rifa.medios[i]=fecha?medio:'';
  rifa.dets[i]=fecha?detalle:null;
  done(fecha?'Pago guardado':'Pago quitado');
}

function openRifa(id,sid){const r=id?S.rifas.find(x=>x.id===id):{sid:sid||'',anio:F.rifaA,nro:'',modo:'contado',importe:S.conf.rifaImporte,desde:hoy()};
  modal(`<h2>${id?'Editar rifa':'Nueva Rifa Devoto'}</h2>${socSel('r-sid',r.sid)}
  <div class="row3"><label class="f">N° de rifa<input id="r-n" class="mono" value="${esc(r.nro)}"></label><label class="f">Año<input id="r-a" type="number" value="${r.anio}"></label><label class="f">Importe<input id="r-i" class="money" inputmode="numeric" value="${r.importe}"></label></div>
  <span class="lbl">Modalidad</span><div class="opts"><label><input type="radio" name="r-m" value="contado" ${r.modo==='contado'?'checked':''}>Contado</label><label><input type="radio" name="r-m" value="cuotas" ${r.modo==='cuotas'?'checked':''}>${S.conf.rifaCuotas} cuotas</label></div>
  <div class="mfoot">${id?`<button class="btn d" onclick="del('rifas','${id}')">Eliminar</button>`:'<span></span>'}<div class="acts"><button class="btn" onclick="close_()">Cancelar</button><button class="btn p" onclick="saveRifa('${id||''}')">Guardar</button></div></div>`)}
function saveRifa(id){const modo=radio('r-m');const o={sid:val('r-sid'),nro:val('r-n'),anio:+val('r-a'),importe:num(val('r-i')),modo,desde:id?S.rifas.find(x=>x.id===id).desde:hoy()};
  if(!o.sid||!o.nro)return toast('Completá socio y número');
  if(id){const r0=S.rifas.find(x=>x.id===id);if((r0.importe!==o.importe||r0.modo!==o.modo||r0.sid!==o.sid)&&(r0.pagos.some(Boolean)||(r0.abonos||[]).some(Boolean)))return toast('Ya tiene cuotas cobradas: anulá esos pagos antes de cambiar el importe, la modalidad o el socio')}const n=modo==='contado'?1:(id&&S.rifas.find(x=>x.id===id).modo==='cuotas'?S.rifas.find(x=>x.id===id).ncuotas:S.conf.rifaCuotas);
  if(id){const r=S.rifas.find(x=>x.id===id);const p=r.pagos;Object.assign(r,o,{ncuotas:n});r.pagos=Array.from({length:n},(_,i)=>p[i]||null)}
  else S.rifas.push({id:uid(),...o,ncuotas:n,pagos:Array(n).fill(null)});F.rifaA=o.anio;done('Rifa guardada')}

/* ============ SOCIO (alta/edición) ============ */
function socSel(idEl,sel,onch){if(V==='socio'&&sel&&soc(sel))return `<input type="hidden" id="${idEl}" value="${sel}"><p class="note" style="color:var(--ink)">Socio: <b>${esc(soc(sel).nombre)}</b> · N° <span class="mono">${esc(soc(sel).nro)}</span></p>`;
  return `<label class="f" style="margin-bottom:4px">Socio<select id="${idEl}" onchange="socSelCh(this);${onch||''}"><option value="">Elegí un socio…</option><option value="__new">＋ Nuevo socio…</option>${socOrd().concat(sel&&soc(sel)&&!soc(sel).activo?[soc(sel)]:[]).map(s=>`<option value="${s.id}" ${s.id===sel?'selected':''}>${esc(s.nombre)} · ${esc(s.nro)}</option>`).join('')}</select></label>
  <div class="socadd" id="${idEl}-ad"><button type="button" class="lnk small" onclick="socNewOpen('${idEl}')">＋ ¿No está? Crear socio nuevo</button></div>
  <div class="socnew" id="${idEl}-nw" hidden><b class="small">Socio nuevo</b><div class="row" style="margin-top:6px"><label class="f">Nombre y apellido<input id="${idEl}-nn" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();socNewOk('${idEl}')}"></label><label class="f">Celular<input id="${idEl}-nt" inputmode="tel" placeholder="Ej: 3544 551122" onkeydown="if(event.key==='Enter'){event.preventDefault();socNewOk('${idEl}')}"></label></div>
  <div class="acts" style="justify-content:flex-end"><button type="button" class="btn sm" onclick="socNewCancel('${idEl}')">Cancelar</button><button type="button" class="btn sm p" onclick="socNewOk('${idEl}')">Crear y elegir</button></div></div>`}
/* alta rápida de socio desde cualquier formulario (lotería, seguro, juegos…) */
function socSelCh(el){if(el.value==='__new'){el.value='';socNewOpen(el.id)}}
function socNewOpen(idEl){const p=$('#'+idEl+'-nw'),a=$('#'+idEl+'-ad');if(!p)return;p.hidden=false;if(a)a.hidden=true;setTimeout(()=>{const i=$('#'+idEl+'-nn');if(i)i.focus()},30)}
function socNewCancel(idEl){const p=$('#'+idEl+'-nw'),a=$('#'+idEl+'-ad');if(p)p.hidden=true;if(a)a.hidden=false}
function socNewOk(idEl){const nombre=val(idEl+'-nn'),tel=val(idEl+'-nt');if(!nombre)return toast('Poné el nombre del socio');const sel=$('#'+idEl);
  const ya=S.socios.find(x=>x.nombre.trim().toLowerCase()===nombre.toLowerCase());let s=ya;
  if(!ya){s={id:uid(),nro:String(Math.max(0,...S.socios.map(x=>parseInt(x.nro)||0))+1),nombre,tel,dir:'',activo:true,dni:'',nota:'',fijos:[],q6:{activo:false,dias:[],cant:1}};S.socios.push(s);save()}
  else if(!ya.activo){ya.activo=true;save()}
  if(sel&&![...sel.options].some(o=>o.value===s.id)){const o=document.createElement('option');o.value=s.id;o.textContent=`${s.nombre} · ${s.nro}`;sel.appendChild(o)}
  if(sel){sel.value=s.id;sel.dispatchEvent(new Event('change'))}socNewCancel(idEl);$('#'+idEl+'-nn').value='';$('#'+idEl+'-nt').value='';
  toast(ya?`${ya.nombre} ya estaba cargado: lo elegí`:`Socio creado: ${s.nombre} · N° ${s.nro}`)}
function openSocio(id){
  const socio=id?soc(id):null;
  if(id&&!socio)return;
  close_();
  const nro=String(Math.max(0,...S.socios.map(x=>parseInt(x.nro)||0))+1);
  window.dispatchEvent(new CustomEvent('agencia:editar-socio',{
    detail:{
      id:id||null,
      inicial:{
        nombre:socio?.nombre||'',nro:socio?String(socio.nro??''):nro,
        tel:socio?.tel||'',dir:socio?.dir||'',
        favor:fmtN(socio?.favor||0),archivado:socio?.activo===false,
      },
      guardar:datos=>saveSocio(id,datos),
      eliminar:()=>{if(id)delSocio(id)},
      cerrar:close_,
    },
  }));
}
function saveSocio(id,{nombre,nro,tel,dir,favor,archivado}){
  if(!CUR||!nombre)return;
  if(id){
    const existente=soc(id);
    if(!existente)return;
    Object.assign(existente,{nombre,nro,tel,dir,favor:num(favor),activo:!archivado});
    done('Socio guardado');
    return;
  }
  const nid=uid();
  S.socios.push({id:nid,nombre,nro,tel,dir,activo:true,dni:'',nota:'',fijos:[],q6:{activo:false,dias:[],cant:1}});
  save();
  close_();
  STAB='det';
  verSocio(nid);
  toast('Socio creado');
}
function delSocio(id){if(!confirm('¿Eliminar el socio y todo lo suyo (seguros, jugadas, números, rifas)? Si solo dejó de ser socio, mejor archivalo.'))return;
  S.socios=S.socios.filter(s=>s.id!==id);['seguros','q6','lot','quiniela','rifas','ofertas'].forEach(k=>S[k]=S[k].filter(x=>x.sid!==id));save();close_();V='socios';render();toast('Socio eliminado')}

/* ============ AJUSTES ============ */
function publicarAjustes(){
  const c=S.conf;
  const detalle=V==='ajustes'&&CUR?{
    config:{
      nombre:c.nombre||'',q6Precio:fmtN(c.q6Precio),q6Dias:c.q6Dias.map(String),
      fracPrecio:fmtN(c.fracPrecio),rifaImporte:fmtN(c.rifaImporte),rifaCuotas:String(c.rifaCuotas),
      wsp:c.wsp==='web'?'web':'app',
    },
    sorteos:[...S.sorteos].sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(s=>({
      id:s.id,nombre:s.nombre,
      resumen:fd(s.fecha)+' · '+s.frac+' fracciones · '+money(s.precio)+' c/u · '+S.lot.filter(l=>l.soId===s.id).length+' vendidos',
    })),
    juegos:TOTO_J.map(([id,nombre])=>({id,nombre,dias:totoDias(id).map(String)})),
    usuarios:S.usuarios.map(({id,nombre,rol})=>({id,nombre,rol})),
    perfil:{id:CUR.id,rol:CUR.rol},
    guardar:saveConf,guardarDias:saveTotoDias,resetDias:resetTotoDias,
    agregarAnio:addAnio,abrirSorteo:openSorteo,descargar:bkDescargar,restaurar:bkCargar,borrar:borrarTodo,salir,
  }:null;
  window.dispatchEvent(new CustomEvent('agencia:ajustes',{detail:detalle}));
}

function saveTotoDias(dias){
  const seleccion=Object.fromEntries(TOTO_J.map(([id])=>[id,Array.isArray(dias[id])?dias[id].map(Number):[]]));
  const vacios=TOTO_J.filter(([id])=>!seleccion[id].length).map(([,nombre])=>nombre);
  if(vacios.length)return toast('Marcá al menos un día para: '+vacios.join(', '));
  S.conf.totoDias=seleccion;
  save();
  toast('Días de sorteo guardados');
  rerender();
}
function resetTotoDias(){
  S.conf.totoDias=JSON.parse(JSON.stringify(TOTO_DIAS_DEF));
  save();
  toast('Días restablecidos');
  rerender();
}
function saveConf(datos){
  Object.assign(S.conf,{
    nombre:datos.nombre,wsp:datos.wsp,q6Precio:num(datos.q6Precio),
    q6Dias:datos.q6Dias.map(Number),fracPrecio:num(datos.fracPrecio),
    rifaImporte:num(datos.rifaImporte),rifaCuotas:Number(datos.rifaCuotas),
  });
  save();
  toast('Precios guardados');
  render();
}
function addAnio(){const ys=S.sorteos.map(s=>+s.fecha.slice(0,4));const y=Math.max(new Date().getFullYear(),...ys);const nuevos=sorteosAnio(S.sorteos.some(s=>s.fecha.startsWith(y+'-07'))?y+1:y,S.conf.fracPrecio).filter(n=>!S.sorteos.some(s=>s.nombre===n.nombre));
  S.sorteos.push(...nuevos);save();toast(nuevos.length?nuevos.length+' sorteos agregados':'Ya estaban cargados');render()}
function openSorteo(id){
  const sorteo=id?so(id):{nombre:'',fecha:'',frac:10,precio:S.conf.fracPrecio};
  if(!sorteo)return;
  close_();
  window.dispatchEvent(new CustomEvent('agencia:editar-sorteo',{
    detail:{
      id:id||null,
      inicial:{nombre:sorteo.nombre,fecha:sorteo.fecha,frac:String(sorteo.frac),precio:fmtN(sorteo.precio)},
      guardar:datos=>saveSorteo(id,datos),
      eliminar:()=>{if(id)delSorteo(id)},
      cerrar:close_,
    },
  }));
}
function saveSorteo(id,{nombre,fecha,frac,precio}){
  const datos={nombre,fecha,frac:Number(frac),precio:num(precio)};
  if(id){
    const sorteo=so(id);
    if(!sorteo)return;
    Object.assign(sorteo,datos);
  }else{
    S.sorteos.push({id:uid(),...datos});
  }
  done('Sorteo guardado');
}
function delSorteo(id){const n=S.lot.filter(l=>l.soId===id).length;if(!confirm(n?`Este sorteo tiene ${n} ventas. ¿Eliminarlo igual con sus ventas?`:'¿Eliminar este sorteo?'))return;
  S.sorteos=S.sorteos.filter(s=>s.id!==id);S.lot=S.lot.filter(l=>l.soId!==id);S.ofertas=S.ofertas.filter(o=>o.soId!==id);if(F.so===id)F.so=null;done('Sorteo eliminado')}
function bkDescargar(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(estadoNegocio())],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='socios-'+hoy()+'.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),0);
}
async function bkCargar(file){
  if(!file||CUR?.rol!=='administrador')return;
  try{
    const datos=JSON.parse(await file.text());
    if(!Array.isArray(datos?.socios))throw new Error('Respaldo inválido');
    if(CUR?.rol!=='administrador'||PENDIENTES.length)return;
    if(!confirm('Esto reemplaza todos los datos de negocio de la agencia. ¿Seguir?'))return;
    aplicarRespaldo(datos);
  }catch{
    toast('El archivo no es un respaldo válido');
  }
}
function aplicarRespaldo(datos){
  const respaldo=norm(datos);
  for(const clave of ['conf',...COLECCIONES])S[clave]=respaldo[clave];
  snapAll();
  save(true);
  V='inicio';
  render();
}
function borrarTodo(){
  if(CUR?.rol!=='administrador'||!confirm('¿Borrar TODOS los datos de negocio?'))return;
  aplicarRespaldo({conf:{nombre:S.conf.nombre},sorteos:[]});
}

/* ============ cobro ============
   Cómo se imputa un pago (una sola regla, fácil de explicar):
   1. Disponible = monto recibido + saldo a favor (si se usa). El saldo a favor se consume primero.
   2. Se descuenta de lo tildado (por defecto, todo lo vencido) en orden: primero el producto elegido
      en "Qué paga primero" (o lo más viejo), y dentro de cada grupo, lo más viejo primero.
      Cada concepto se salda completo o queda con un abono parcial; nunca se pasa de lo que debe.
   3. Si sobra plata, queda como saldo a favor.                                                    */

function asignar(items,disp,orden){let disponible=Math.max(0,Math.round(Number(disp)*100));const L=[...items];const cent=m=>Math.max(0,Math.round(m.imp*100));if(!L.length||!disponible)return L.map(m=>({m,ap:0}));
  if(orden==='prop'){const T=L.reduce((s,m)=>s+cent(m),0);if(disponible>=T)return L.map(m=>({m,ap:cent(m)/100}));
    const out=L.map(m=>({m,centavos:Math.floor(disponible*cent(m)/T)}));let resto=disponible-out.reduce((s,o)=>s+o.centavos,0);
    for(const o of out){if(resto<=0)break;const a=Math.min(resto,cent(o.m)-o.centavos);o.centavos+=a;resto-=a}return out.map(o=>({m:o.m,ap:o.centavos/100}))}
  L.sort(cbOrden(orden));return L.map(m=>{const ap=Math.min(disponible,cent(m));disponible-=ap;return{m,ap:ap/100}})}
const cbOrden=orden=>(a,b)=>{const pri=m=>orden&&orden!=='viejo'&&orden!=='todo'&&m.t===orden?0:1;return pri(a)-pri(b)||(a.fut-b.fut)||String(a.f||'').localeCompare(String(b.f||''))};
function conceptosCobro(sid){
  const movimientos=movs(sid).filter(m=>!m.pag&&m.t!=='pago');
  const vencidos=movimientos.filter(m=>!m.fut).reverse();
  const futuros=movimientos.filter(m=>m.fut).reverse();
  return {vencidos,futuros,todos:vencidos.concat(futuros)};
}

const claveCobro=movimiento=>movimiento.ref.join('|');

function openCobro(sid,only){
  if(!soc(sid))return;
  q6Auto();
  const {vencidos,futuros,todos}=conceptosCobro(sid);
  const elegido=todos.find(m=>claveCobro(m)===only);
  const rifaId=elegido?.t==='rifa'?elegido.ref[1]:null;
  const tipos=[...new Set(vencidos.map(m=>m.t))];
  const cuentaActual=cuenta(sid);
  const seleccionadas=vencidos.filter(m=>!elegido||m===elegido||
    (elegido.t==='seg'&&!elegido.fut&&m.t==='seg'&&m.ref[1]===elegido.ref[1])).map(claveCobro);
  if(elegido?.fut)seleccionadas.push(claveCobro(elegido));
  const prioridad=elegido&&!elegido.fut&&tipos.length>1?elegido.t:'todo';
  const rifas=todos.filter(m=>m.t==='rifa'&&(!rifaId||m.ref[1]===rifaId));
  close_();
  window.dispatchEvent(new CustomEvent('agencia:registrar-cobro',{detail:{
    clave:sid+'|'+(only||''),socio:sname(sid),
    resumen:[
      {titulo:'Deuda vencida',texto:money(cuentaActual.deuda),color:cuentaActual.deuda?'bad':undefined},
      {titulo:'Saldo a favor',texto:money(cuentaActual.favor),color:cuentaActual.favor?'ok':undefined},
      {titulo:cuentaActual.debe?'Debe':cuentaActual.aFavor?'Tiene a favor':'Estado',
       texto:cuentaActual.debe?money(cuentaActual.debe):cuentaActual.aFavor?money(cuentaActual.aFavor):'Al día',
       color:cuentaActual.debe?'bad':'ok'},
    ],
    favor:cuentaActual.favor?money(cuentaActual.favor):'',
    inicial:{seleccionadas,prioridad,usarFavor:true},mostrarFuturas:!!elegido?.fut,
    prioridades:['todo',...tipos].map(tipo=>({
      clave:tipo,titulo:tipo==='todo'?'Lo más viejo':NOMBRE[tipo],
      importe:money(sum(vencidos.filter(m=>tipo==='todo'||m.t===tipo),m=>m.imp)),
    })),
    conceptos:todos.map(m=>({
      clave:claveCobro(m),titulo:plain(m.txt),producto:NOMBRE[m.t],fecha:fdl(m.f),importe:money(m.imp),futuro:!!m.fut,
    })),
    rifasVencidas:rifas.filter(m=>!m.fut).map(claveCobro),rifasTodas:rifas.map(claveCobro),
    textoRifas:rifaId?'Pagar esta rifa':'Pagar todas las rifas',
    pago:{monto:'0',fecha:hoy(),medio:'efectivo',cargarDetalle:false,banco:'',nro:'',librador:'',fcobro:''},
    ordenar:modo=>[...vencidos].sort(cbOrden(modo)).map(claveCobro),
    calcular:solicitud=>previaCobro(cobroCalc(sid,todos,solicitud),solicitud.usarFavor),
    guardar:(solicitud,pago)=>saveCobro(sid,solicitud,pago),
    cerrar:close_,
  }}));
}

function cobroCalc(sid,conceptos,solicitud){
  const elegidos=new Set(solicitud.seleccionadas);
  const sel=conceptos.filter(m=>elegidos.has(claveCobro(m)));
  const favT=favor(sid);
  const fv=solicitud.usarFavor?favT:0;
  const orden=solicitud.prioridad==='todo'?'viejo':solicitud.prioridad;
  const base=sum(sel.filter(m=>orden==='viejo'||m.t===orden||m.fut),m=>m.imp);
  const sugerido=Math.max(0,redondear(base-fv));
  const A=solicitud.monto===undefined?sugerido:num(solicitud.monto);
  const al=asignar(sel,redondear(A+fv),orden);
  const apl=al.filter(o=>o.ap>0);
  const aplicado=sum(apl,o=>o.ap);
  const usado=Math.min(fv,aplicado);
  const quedo=Math.max(0,redondear(A-(aplicado-usado)));
  const falta=Math.max(0,redondear(sum(sel,m=>m.imp)-aplicado));
  const favorFinal=redondear(favT-usado+quedo);
  const deudaFinal=redondear(cuenta(sid).deuda-sum(apl.filter(o=>!o.m.fut),o=>o.ap));
  return {A,al,apl,usado,quedo,falta,favorFinal,deudaFinal,sugerido};
}

function previaCobro(c,usarFavor){
  const final=c.deudaFinal-c.favorFinal;
  return {
    sugerido:fmtN(c.sugerido),recibido:money(c.A),usado:usarFavor?money(c.usado):'—',
    estado:final>0?'Debe '+money(final):final<0?'Tiene a favor '+money(-final):'Queda al día',
    color:final>0?'bad':'ok',sobrante:c.quedo>0?money(c.quedo):'',
    habilitado:c.A>0||c.apl.length>0,
    accion:c.A>0?'Registrar cobro de '+money(c.A):c.apl.length?'Aplicar saldo a favor':'Ingresá el monto',
    aplicaciones:Object.fromEntries(c.al.map(({m,ap})=>[claveCobro(m),{
      texto:ap>=m.imp?'Se salda':ap>0?'Abona '+money(ap)+' · queda '+money(m.imp-ap):'Queda pendiente',
      estado:ap>=m.imp?'ok':ap>0?'warn':'mu',
    }])),
  };
}

function marcarPagado(ref,f,md,det,now){const[k,id,i]=ref;
  if(k==='seg'){const q=S.seguros.find(x=>x.id===id).cuotas[i];q.pago=f;q.medio=md;q.pts=now;q.det=det?{...det,c:1}:null}
  else if(k==='rifa'){const r=S.rifas.find(x=>x.id===id);r.pagos[i]=f;r.medios=r.medios||[];r.medios[i]=md;r.dets=r.dets||[];r.dets[i]=det;r.pts=r.pts||[];r.pts[i]=now}
  else{const x=S[k].find(v=>v.id===id);x.pagado=true;x.fpago=f;x.medio=md;x.det=det;x.pts=now}}
function saveCobro(sid,solicitud,pago){
  const socio=soc(sid);
  if(!socio)return 'No se encontró el socio.';
  const conceptos=conceptosCobro(sid).todos;
  const c=cobroCalc(sid,conceptos,solicitud);
  if(!c.A&&!c.apl.length)return 'Ingresá el monto que te pagó.';
  const {fecha,medio}=pago;
  const detalle=detallePago(medio,pago.cargarDetalle,pago,{});
  if((medio==='cheque'||medio==='echeq')&&(!detalle?.nro||!detalle.banco)){
    return 'Ingresá el número y el banco para poder rastrear el cheque.';
  }
  const ahora=new Date().toISOString();
  const aplicados=c.apl.map(({m,ap})=>{
    const completo=ap>=m.imp;
    if(completo)marcarPagado(m.ref,fecha,medio,detalle,ahora);
    else aplicarAbono(m.ref,ap);
    return {ref:[...m.ref],completo,abono:completo?0:ap,imp:ap};
  });
  socio.favor=c.favorFinal;
  const cobro={id:uid(),sid,fecha,monto:c.A,medio:c.A?medio:'',det:c.A?detalle:null,
    cubre:aplicados.length,usado:c.usado,quedo:c.quedo,aplicados};
  if(!c.A)cobro.soloFavor=true;
  S.cobros.push(cobro);
  done('Cobro registrado'+(c.A?': '+money(c.A):' con saldo a favor')+
    (c.quedo?' · a favor '+money(c.quedo):'')+(c.falta?' · sigue debiendo '+money(c.falta):''));
}
/* Si se anula un concepto que se pagó con un cobro, esa plata no se pierde: vuelve como saldo a favor. */
function liberarDeCobros(ref,soloCompletos){const key=ref.join('|');let tot=0;
  S.cobros.forEach(c=>{if(c.anulado||!c.aplicados)return;c.aplicados=c.aplicados.filter(a=>{if(a.ref.join('|')!==key||(soloCompletos===true&&!a.completo)||(soloCompletos==='parcial'&&a.completo))return true;
    let monto=a.imp;if(monto===undefined)monto=a.completo?remanente(ref):a.abono;tot+=monto||0;c.liberado=(c.liberado||0)+(monto||0);if(!a.completo)restarAbono(ref,a.abono);return false});c.cubre=c.aplicados.length});
  if(tot){const sid=refSid(ref);const s=soc(sid);if(s)s.favor=(s.favor||0)+tot}return tot}
/* Antes de editar un concepto: si cambia el importe o el socio, lo que ya se había cobrado no se pierde
   ni se duplica: vuelve como saldo a favor del socio (y el concepto queda otra vez pendiente). */
function prepEditar(k,id,nuevoTotal,nuevoSid){const x=S[k].find(v=>v.id===id);if(!x)return 0;const tot=k==='lot'?x.frac*x.precio:x.monto;let lib=0;const ref=[k,id];
  const cambiaSid=nuevoSid&&nuevoSid!==x.sid;
  if(x.pagado&&(nuevoTotal!==tot||cambiaSid)&&S.cobros.some(c=>!c.anulado&&(c.aplicados||[]).some(a=>a.completo&&a.ref.join('|')===ref.join('|')))){lib+=liberarDeCobros(ref,true);x.pagado=false;delete x.fpago;delete x.medio;delete x.det;x._lib=true}
  if(x.abono&&!x.pagado&&(nuevoTotal<=x.abono||cambiaSid)){lib+=liberarDeCobros(ref,'parcial');x.abono=0}
  return lib}
function refSid(ref){const[k,id]=ref;return(k==='seg'?S.seguros:k==='rifa'?S.rifas:S[k]).find(x=>x.id===id)?.sid}
function remanente(ref){const[k,id,i]=ref;if(k==='seg'){const q=S.seguros.find(x=>x.id===id).cuotas[i];return q.imp-(q.abono||0)}if(k==='rifa'){const r=S.rifas.find(x=>x.id===id);return cuotaRifa(r,i)-((r.abonos||[])[i]||0)}const x=S[k].find(v=>v.id===id);return(k==='lot'?x.frac*x.precio:x.monto)-(x.abono||0)}
function restarAbono(ref,m){const[k,id,i]=ref;if(k==='seg'){const q=S.seguros.find(x=>x.id===id).cuotas[i];q.abono=Math.max(0,(q.abono||0)-m)}else if(k==='rifa'){const r=S.rifas.find(x=>x.id===id);r.abonos=r.abonos||[];r.abonos[i]=Math.max(0,(r.abonos[i]||0)-m)}else{const x=S[k].find(v=>v.id===id);x.abono=Math.max(0,(x.abono||0)-m)}}
function aplicarAbono(ref,monto){const[k,id,i]=ref;if(k==='seg'){const q=S.seguros.find(x=>x.id===id).cuotas[i];q.abono=redondear((q.abono||0)+monto)}else if(k==='rifa'){const r=S.rifas.find(x=>x.id===id);r.abonos=r.abonos||[];r.abonos[i]=redondear((r.abonos[i]||0)+monto)}else{const x=S[k].find(v=>v.id===id);x.abono=redondear((x.abono||0)+monto)}}
function anularPago(key){const[k,id,i0]=key.split('|');const ref=i0===undefined?[k,id]:[k,id,+i0];
  if(!confirm('¿Anular este pago? Vuelve a quedar como deuda. Si se había pagado con un cobro, esa plata queda como saldo a favor del socio.'))return;
  if(k==='seg'){const c=S.seguros.find(x=>x.id===id).cuotas[+i0];c.pago=null;c.medio='';c.det=null}
  else if(k==='rifa'){const r=S.rifas.find(x=>x.id===id);r.pagos[+i0]=null;if(r.medios)r.medios[+i0]=''}
  else{const x=S[k].find(v=>v.id===id);x.pagado=false;delete x.fpago;delete x.medio;delete x.det}
  const fv=liberarDeCobros(ref,true);save();close_();toast(fv?`Pago anulado · ${money(fv)} quedó a favor`:'Pago anulado');rerender()}
const esMovil=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
function wspTexto(sid){const s=soc(sid);const d=neto(sid),fv=favor(sid);
  return `Hola ${s.nombre.split(' ')[0]}! `+(d?`Te paso tu estado de cuenta. Saldo pendiente: ${money(d).replace(/\u00a0/g,' ')}.`:`Te paso tu estado de cuenta. Estás al día${fv?`, con ${money(fv).replace(/\u00a0/g,' ')} a favor`:''}. ¡Gracias!`)+`\n${CUR?CUR.nombre:''}`}
function wsp(sid){const s=soc(sid);const n=waNum(s.tel||'');if(!n){toast('Revisá el celular del socio: característica + número, 10 dígitos');return openSocio(sid)}
  modal(`<h2>Enviar por WhatsApp</h2><p class="mu small" style="margin-bottom:12px">A ${esc(s.nombre)} · +${n}</p>
  <label class="f">Mensaje<textarea id="w-t" rows="4">${esc(wspTexto(sid))}</textarea></label>
  <div class="opts"><label><input type="checkbox" id="w-pdf" checked>Adjuntar estado de cuenta en PDF</label></div>
  <p class="note">${esMovil()?'Se abre el menú para compartir: elegí <b>WhatsApp</b> y el chat de '+esc(s.nombre.split(' ')[0])+'.':'El PDF se descarga en tu compu y se abre el chat con el mensaje escrito. En WhatsApp tocá el clip <b>📎 → Documento</b> y elegí el PDF de <b>Descargas</b> (o arrastralo al chat).'}</p>
  <div class="mfoot"><span></span><div class="acts"><button class="btn" onclick="close_()">Cancelar</button><button class="btn p" id="w-ok" onclick="wspEnviar('${sid}')">Enviar</button></div></div>`)}
async function wspEnviar(sid){const s=soc(sid),n=waNum(s.tel||''),txt=val('w-t'),conPdf=$('#w-pdf').checked;const b=$('#w-ok');b.textContent='Preparando…';b.disabled=true;
  let pdf=null;if(conPdf){pdf=await pdfSocio(sid,true);if(!pdf){toast('Para armar el PDF hace falta internet. Se envía solo el mensaje.')}}
  const file=pdf?new File([pdf.blob],pdf.nombre,{type:'application/pdf'}):null;
  // celular (o compu con menú compartir): manda PDF + mensaje juntos
  if(file&&esMovil()&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],text:txt});close_();toast('Listo');return}catch(e){if(e.name==='AbortError'){b.textContent='Enviar';b.disabled=false;return}}}
  if(file){const u=URL.createObjectURL(pdf.blob);const a=document.createElement('a');a.href=u;a.download=pdf.nombre;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}
  close_();abrirChat(n,txt);
  if(file)setTimeout(()=>snack(`PDF descargado: <b>${esc(pdf.nombre)}</b>. Adjuntalo en el chat con 📎`,'Descargar de nuevo',()=>{const u=URL.createObjectURL(pdf.blob);const a=document.createElement('a');a.href=u;a.download=pdf.nombre;document.body.appendChild(a);a.click();a.remove()}),900)}
function abrirChat(n,txt){const t=encodeURIComponent(txt);const web=`https://web.whatsapp.com/send?phone=${n}&text=${t}`,app=`whatsapp://send?phone=${n}&text=${t}`;
  if(esMovil()){location.href=`https://wa.me/${n}?text=${t}`;return}
  if(S.conf.wsp==='web'){const w=window.open(web,'_blank');if(!w)location.href=web;return}
  location.href=app;setTimeout(()=>{if(!$('#snack').classList.contains('on'))snack('¿No se abrió la app de WhatsApp?','Abrir WhatsApp Web',()=>{const w=window.open(web,'_blank');if(!w)location.href=web})},2500)}
let snT;function snack(t,btn,fn){const e=$('#snack');e.innerHTML=`<span>${t}</span><button class="btn sm">${btn}</button><button class="btn sm g" aria-label="Cerrar">✕</button>`;
  const[b1,b2]=e.querySelectorAll('button');b1.onclick=()=>{e.classList.remove('on');fn()};b2.onclick=()=>e.classList.remove('on');e.classList.add('on');clearTimeout(snT);snT=setTimeout(()=>e.classList.remove('on'),9000)}
function cheques(){const L=[];S.cobros.forEach(c=>{if(!c.anulado&&['cheque','echeq'].includes(c.medio)&&c.det&&c.det.fcobro&&!c.det.dep)L.push({k:'c|'+c.id,sid:c.sid,monto:c.monto,medio:c.medio,det:c.det})});
  S.seguros.forEach(x=>x.cuotas.forEach((q,i)=>{if(q.det&&q.det.fcobro&&!q.det.dep&&!q.det.c)L.push({k:'s|'+x.id+'|'+i,sid:x.sid,monto:q.imp,medio:q.medio,det:q.det})}));
  const seen=new Set();return L.filter(c=>{const key=c.medio+(c.det.nro||'')+c.det.fcobro+c.sid;if(c.det.nro&&seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>a.det.fcobro.localeCompare(b.det.fcobro))}
function vtagC(f){const n=days(f);return n<0?`<span class="tag t-w">Para depositar</span>`:n===0?'<span class="tag t-w">Se cobra hoy</span>':`<span class="tag">En ${n} d · ${fd(f)}</span>`}
function depositar(k){const[t,id,i]=k.split('|');const d=t==='c'?S.cobros.find(c=>c.id===id).det:S.seguros.find(x=>x.id===id).cuotas[+i].det;d.dep=hoy();
  S.seguros.forEach(x=>x.cuotas.forEach(q=>{if(q.det&&q.det.nro&&q.det.nro===d.nro&&q.det.banco===d.banco&&q.det.fcobro===d.fcobro)q.det.dep=d.dep}));save();toast('Marcado como depositado');rerender()}

function historialCheques(){const L=[], linked=new Set();
 S.cobros.forEach(c=>{if(!c.anulado)(c.aplicados||[]).forEach(a=>linked.add(a.ref.join('|')));if(['cheque','echeq'].includes(c.medio)&&c.det)L.push({sid:c.sid,monto:c.monto,medio:c.medio,det:c.det,fecha:c.fecha,anulado:c.anulado,cobroId:c.id,rechazoAplicado:!!c.rechazoAplicado})});
 const add=(sid,monto,medio,det,fecha,ref)=>{if(['cheque','echeq'].includes(medio)&&det&&!det.c&&!linked.has(ref.join('|')))L.push({sid,monto,medio,det,fecha,ref})};
 S.seguros.forEach(x=>x.cuotas.forEach((q,i)=>{if(q.pago)add(x.sid,q.imp,q.medio,q.det,q.pago,['seg',x.id,i])}));
 S.rifas.forEach(r=>r.pagos.forEach((f,i)=>{if(f)add(r.sid,cuotaRifa(r,i),(r.medios||[])[i],(r.dets||[])[i],f,['rifa',r.id,i])}));
 ['q6','lot','quiniela'].forEach(k=>S[k].forEach(x=>{if(x.pagado)add(x.sid,k==='lot'?x.frac*x.precio:x.monto,x.medio,x.det,x.fpago,[k,x.id])}));return L.sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||'')))}
const CH_ESTADOS={pendiente:'Pendiente',aprobado:'Aprobado',rechazado:'Rechazado'};
function estadoCheque(id,estado){if(!Object.hasOwn(CH_ESTADOS,estado))return;const x=historialCheques().find(cheque=>chequeClave(cheque)===id);if(!x||x.anulado)return;
 if(estado!=='rechazado'){if(estado==='pendiente')delete x.det.estado;else x.det.estado=estado;save();publicarCheques();toast('Estado actualizado');return}
 const c=x.cobroId?S.cobros.find(c=>c.id===x.cobroId):null;
 if(c){const nec=(c.quedo||0)+(c.liberado||0)-(c.usado||0);if(nec>favor(c.sid)){alert(`No se puede revertir este cheque todavía: ${money(nec-favor(c.sid))} de su saldo a favor ya se usaron en otros pagos. Anulá primero esos cobros más recientes y volvé a marcarlo como rechazado.`);publicarCheques();return}
   const links=aplicacionesAnteriores(c);if(!c.aplicados&&links.length<(+c.cubre||0)){alert('Este cobro antiguo no tiene suficientes datos para identificar con seguridad todos los conceptos. Revisá el historial del socio antes de modificarlo.');publicarCheques();return}
   if(!confirm(`¿Marcar como rechazado el cheque de ${money(c.monto)}? Se revertirá el cobro y los conceptos asociados volverán a quedar pendientes. El cheque quedará en el historial.`)){publicarCheques();return}
   links.forEach(a=>revertirAplicacion(a,c));const socio=soc(c.sid);if(socio)socio.favor=Math.max(0,(socio.favor||0)-(c.quedo||0)-(c.liberado||0)+(c.usado||0));c.det.estado='rechazado';c.anulado=true;c.rechazoAplicado=true;c.fechaRechazo=hoy();
 }else if(x.ref){if(!confirm(`¿Marcar como rechazado el cheque de ${money(x.monto)}? El pago volverá a quedar pendiente y el cheque se conservará en el historial.`)){publicarCheques();return}
   const det={...x.det,estado:'rechazado'};revertirAplicacion({ref:x.ref,completo:true,abono:0},null);S.cobros.push({id:uid(),sid:x.sid,fecha:x.fecha||hoy(),monto:x.monto,medio:x.medio,det,anulado:true,rechazoAplicado:true,fechaRechazo:hoy(),aplicados:[]});
 }else{alert('No se pudo identificar el cobro vinculado a este cheque.');publicarCheques();return}
 save();publicarCheques();toast('Cheque rechazado · cobro revertido');}
function chequeClave(cheque){
  return cheque.cobroId?'cobro:'+cheque.cobroId:cheque.ref.join('|');
}

function publicarCheques(){
  const cheques=V==='cheques'?historialCheques().map(cheque=>({
    id:chequeClave(cheque),numero:String(cheque.det.nro||''),banco:String(cheque.det.banco||''),
    socio:sname(cheque.sid),medio:MEDIOS[cheque.medio],fecha:fd(cheque.fecha),monto:money(cheque.monto),
    estado:Object.hasOwn(CH_ESTADOS,cheque.det.estado)?cheque.det.estado:'pendiente',
    anulado:Boolean(cheque.anulado),rechazoAplicado:Boolean(cheque.rechazoAplicado),
    depositado:Boolean(cheque.det.dep),
  })):null;
  window.dispatchEvent(new CustomEvent('agencia:cheques',{detail:cheques?{cheques,actualizar:estadoCheque}:null}));
}

function pdfRifa(){const V=S.rifas.filter(r=>r.anio===F.rifaA).sort((a,b)=>byName(a,b)||String(a.nro).localeCompare(String(b.nro))).filter(r=>gPass(rifaPagado(r)>=r.importe));pdfLista('Rifa Devoto',`Año ${F.rifaA}${FILTXT[F.gf||'todos']}`,['Socio','N° rifa','Modalidad','Importe','Pagado','Saldo','Estado'],V.map(r=>[sname(r.sid),String(r.nro),r.modo==='contado'?'Contado':`${r.ncuotas} cuotas`,pm(r.importe),pm(rifaPagado(r)),pm(Math.max(0,r.importe-rifaPagado(r))),rifaPagado(r)>=r.importe?'Pagada':'Debe']),[`${V.length} rifas`,`Cobrado ${pm(sum(V,rifaPagado))}`,`Saldo ${pm(sum(V,r=>Math.max(0,r.importe-rifaPagado(r))))}`],`Rifa_Devoto_${F.rifaA}.pdf`,[3,4,5])}

/* ============ PDF del socio ============ */
const plain=h=>String(h).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/★/g,'*').replace(/\u00a0/g,' ');
const pm=n=>money(n).replace(/\u00a0/g,' ');
function loadJs(src){return new Promise((ok,ko)=>{const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=ko;document.head.appendChild(e)})}
async function pdfSocio(sid,soloArmar){const s=soc(sid);const M=movs(sid);const pas=M.filter(m=>!m.fut),fut=[];const debe=neto(sid),fv=favor(sid);
  if(!soloArmar)toast('Armando el PDF…');
  try{if(!window.jspdf)await loadJs('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      if(!window.jspdf.jsPDF.API.autoTable)await loadJs('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')}
  catch(e){return soloArmar?null:pdfImprimir(s,pas,fut,debe)}
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'});const W=doc.internal.pageSize.getWidth();
  doc.setFillColor(14,107,79);doc.rect(0,0,W,30,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text(s.nombre,14,14);
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(`Socio N° ${s.nro}${s.tel?'  ·  '+s.tel:''}${s.dir?'  ·  '+s.dir:''}`,14,21);
  doc.text(`Estado de cuenta al ${fd(hoy())}`,W-14,14,{align:'right'});doc.text(S.conf.nombre||'',W-14,21,{align:'right'});
  doc.setTextColor(30);doc.setFontSize(12);doc.setFont('helvetica','bold');
  doc.text((debe?`Saldo pendiente: ${pm(debe)}`:'Está al día')+(fv?`   ·   A favor: ${pm(fv)}`:''),14,42);if(debe)doc.setTextColor(179,48,42);
  const row=m=>[fd(m.f)+(m.h?'\n'+horaAR(m.h):''),NOMBRE[m.t],plain(m.txt)+(m.sub?'\n'+plain(m.sub):''),(m.t==='pago'?'+ ':'')+pm(m.imp),m.t==='pago'?'Cobro':m.pag?'Pagado':'Debe'];
  const st={styles:{fontSize:9,cellPadding:2.2,textColor:30},headStyles:{fillColor:[241,240,235],textColor:80,fontStyle:'bold'},columnStyles:{0:{cellWidth:22},1:{cellWidth:24},3:{halign:'right',cellWidth:26},4:{cellWidth:18}},
    didParseCell:d=>{if(d.section==='body'&&d.column.index===4)d.cell.styles.textColor=d.cell.raw==='Debe'?[179,48,42]:d.cell.raw==='Cobro'?[14,107,79]:[14,107,79]},margin:{left:14,right:14}};
  doc.setTextColor(30);doc.setFontSize(11);doc.text('Movimientos',14,52);
  doc.autoTable({...st,startY:55,head:[['Fecha','Producto','Detalle','Monto','Estado']],body:pas.length?pas.map(row):[['','','Sin movimientos','','']],
    foot:[['','','Total pendiente',pm(debe),'']],footStyles:{fillColor:[255,255,255],textColor:30,fontStyle:'bold',halign:'right'}});
  const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(130);doc.text(`Página ${i} de ${n}`,W-14,290,{align:'right'})}
  const nombre=`${s.nombre.replace(/[^\wáéíóúñÁÉÍÓÚÑ ]+/g,'').trim().replace(/\s+/g,'_')}_${hoy()}.pdf`;
  if(soloArmar)return{blob:doc.output('blob'),nombre};doc.save(nombre);toast('PDF descargado')}
function pdfImprimir(s,pas,fut,debe){const t=L=>`<table><tr><th>Fecha</th><th>Producto</th><th>Detalle</th><th>Monto</th><th>Estado</th></tr>${L.map(m=>`<tr><td>${fd(m.f)}</td><td>${NOMBRE[m.t]}</td><td>${m.txt}${m.sub?'<br><small>'+m.sub+'</small>':''}</td><td style="text-align:right">${money(m.imp)}</td><td>${m.pag?'Pagado':'Debe'}</td></tr>`).join('')}</table>`;
  const wn=window.open('','_blank');if(!wn)return toast('Sin internet no se pudo crear el PDF. Permití ventanas emergentes para imprimirlo.');
  wn.document.write(`<html><head><title>${esc(s.nombre)}</title><style>body{font:13px system-ui,sans-serif;margin:24px;color:#1C1F24}table{width:100%;border-collapse:collapse;margin:8px 0 20px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{background:#f1f0eb}</style></head><body>
  <h2>${esc(s.nombre)}</h2><p>Socio N° ${esc(s.nro)} · Estado de cuenta al ${fd(hoy())}</p><h3>${debe?'Saldo pendiente: '+money(debe):'Está al día'}</h3>${t(pas)}
  <p style="color:#888">Elegí “Guardar como PDF” en la ventana de impresión.</p></body></html>`);wn.document.close();wn.focus();setTimeout(()=>wn.print(),300)}

/* ============ TOTO ORTEGA (planilla diaria, independiente de socios) ============ */
const TOTO_J=[['previa','Previa'],['primera','Primera'],['matutina','Matutina'],['vespertina','Vespertina'],['nocturna','Nocturna'],['turista','Turista'],['quini6','Quini 6'],['loto','Loto']];
const TOTO_PCT=12;
/* pagos de cada día: lista [{f,m}] (m en el mismo signo que el total general). Los días viejos marcados "pagado" cuentan como pagados completos */
const totoPagosDe=(x,neto)=>Array.isArray(x.pagos)?x.pagos:(x.pagado?[{f:x.fecha,m:neto}]:[]);
function totoCalc(x){const total=sum(TOTO_J,([k])=>+x[k]||0),com=redondear(total*TOTO_PCT/100),neto=redondear(total-com),prem=+x.premios||0,gral=redondear(neto-prem);
  const P=totoPagosDe(x,neto),pago=sum(P,p=>Math.abs(+p.m||0)),debe=redondear(neto-pago),premAg=+x.premiosAg||0;
  const saldado=debe<=0&&(neto===0||P.length>0),parcial=!saldado&&pago>0;
  return{total,com,neto,prem,gral,pago,debe,saldado,parcial,P,premAg}}
/* N° de concurso de cada sorteo: cada juego lleva el suyo y sube 1 en cada día de sorteo de ese juego (se configura en Ajustes) */
const TOTO_DIAS_DEF={previa:[1,2,3,4,5,6],primera:[1,2,3,4,5,6],matutina:[1,2,3,4,5,6],vespertina:[1,2,3,4,5,6],nocturna:[1,2,3,4,5,6],turista:[1,2,3,4,5,6],quini6:[0,3],loto:[0,3]};
const totoDias=k=>{const c=S.conf.totoDias;return c&&Array.isArray(c[k])?c[k]:TOTO_DIAS_DEF[k]||[1,2,3,4,5,6]};
/* cuenta los días de sorteo de ese juego entre a (sin contar) y b (contando); hacia atrás da negativo */
function totoHab(a,b,k){if(a===b)return 0;const D=totoDias(k);const fw=b>a;let n=0,d=a;
  if(fw){while(d!==b){d=addDays(d,1);if(D.includes(parse(d).getDay()))n++}}else{while(d!==b){if(D.includes(parse(d).getDay()))n--;d=addDays(d,-1)}}return n}
const concGuardado=(x,k)=>x.conc&&+x.conc[k]>0?+x.conc[k]:(k==='matutina'&&+x.concurso>0?+x.concurso:null);
function totoConc(fecha,exceptId,k){const R=S.toto.filter(x=>x.id!==exceptId&&concGuardado(x,k));if(!R.length)return null;
  const prev=R.filter(x=>x.fecha<=fecha).sort((a,b)=>b.fecha.localeCompare(a.fecha))[0],next=R.filter(x=>x.fecha>fecha).sort((a,b)=>a.fecha.localeCompare(b.fecha))[0];
  const r=prev||next;const n=concGuardado(r,k)+totoHab(r.fecha,fecha,k);return n>0?n:null}
const totoConcDe=(x,k)=>concGuardado(x,k)||totoConc(x.fecha,x.id,k);
const totoEst=c=>c.saldado?'r-ok':c.parcial?'r-par':'r-bad';
const mesTxt=m=>{const t=new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric'}).format(new Date(m+'-15T12:00:00'));return t.charAt(0).toUpperCase()+t.slice(1)};
const sgn=n=>`<span class="${n<0?'bad':n>0?'ok':''}" style="font-weight:600">${money(n)}</span>`;
const debeTxt=n=>n>0?`<span class="bad" style="font-weight:600">${money(n)}</span>`:n<0?`<span class="ok" style="font-weight:600" title="Pagó de más">+${money(-n)}</span>`:'<span class="mu">—</span>';
/* período que se está viendo en Toto Ortega: por día, por mes o todo */
function totoPer(){const mAct=hoy().slice(0,7);let v=F.totoV||(F.totoM==='todo'?'todo':'mes');F.totoV=v;
  if(v==='dia'){const d=F.totoD||hoy();F.totoD=d;const tt=DIAS[parse(d).getDay()]+' '+fd(d);return{v,d,L:S.toto.filter(x=>x.fecha===d),tit:tt.charAt(0).toUpperCase()+tt.slice(1),low:'el '+fd(d),key:d}}
  if(v==='todo')return{v,L:[...S.toto],tit:'Todos los días',low:'todos los días',key:'completo'};
  const meses=[...new Set(S.toto.map(x=>x.fecha.slice(0,7)).concat(mAct))].sort();const m=F.totoM&&meses.includes(F.totoM)?F.totoM:mAct;F.totoM=m;
  return{v,m,meses,L:S.toto.filter(x=>x.fecha.slice(0,7)===m),tit:mesTxt(m),low:mesTxt(m).toLowerCase(),key:m}}
VIEWS.toto=()=>{const P=totoPer(),v=P.v;
  const L=P.L.sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const T={total:0,com:0,neto:0,prem:0,gral:0,pago:0,debe:0,premAg:0};const J={};TOTO_J.forEach(([k])=>J[k]=sum(L,x=>+x[k]||0));L.forEach(x=>{const c=totoCalc(x);for(const k in T)T[k]+=c[k]});
  const ix=v==='mes'?P.meses.indexOf(P.m):0;
  const nav=v==='dia'?[`F.totoD='${addDays(P.d,-1)}';rerender()`,`F.totoD='${addDays(P.d,1)}';rerender()`,false,false,'Día']:v==='mes'?[`F.totoM='${P.meses[ix-1]||P.m}';rerender()`,`F.totoM='${P.meses[ix+1]||P.m}';rerender()`,ix<=0,ix>=P.meses.length-1,'Mes']:null;
  const sub=v==='dia'?(L.length?`${L.length} fila${L.length===1?'':'s'} cargada${L.length===1?'':'s'}`:'Sin cargar')+(P.d!==hoy()?` · <button class="lnk" onclick="F.totoD=hoy();rerender()">Ir a hoy</button>`:' · Hoy'):`${L.length} día${L.length===1?'':'s'} cargado${L.length===1?'':'s'}`;
  return `<div class="head"><div><h1 class="gt" style="--c:var(--toto)">Toto Ortega</h1><div class="sub">Planilla diaria: lo jugado en cada sorteo, menos el ${TOTO_PCT}% y los premios.</div></div><button class="btn p" onclick="openToto()">+ Cargar día</button></div>
  <div class="card selbar totobar"><div class="tnav">${nav?`<button class="btn" ${nav[2]?'disabled':''} onclick="${nav[0]}" aria-label="${nav[4]} anterior">‹</button>`:''}
    <div class="selbox"><b>${P.tit}</b><span>${sub}</span></div>
    ${nav?`<button class="btn" ${nav[3]?'disabled':''} onclick="${nav[1]}" aria-label="${nav[4]} siguiente">›</button>`:''}</div>
    <div class="seg tseg"><button class="${v==='dia'?'on':''}" onclick="F.totoV='dia';rerender()">Por día</button><button class="${v==='mes'?'on':''}" onclick="F.totoV='mes';rerender()">Por mes</button><button class="${v==='todo'?'on':''}" onclick="F.totoV='todo';rerender()">Todo</button></div></div>
  <div class="grid g3" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
    <div class="kpi"><small>Total jugado</small><b>${money(T.total)}</b></div>
    <div class="kpi"><small>${TOTO_PCT}%</small><b>${money(T.com)}</b></div>
    <div class="kpi"><small>Total − ${TOTO_PCT}%</small><b>${money(T.neto)}</b></div>
    <div class="kpi"><small>Premios</small><b>${money(T.prem)}</b></div>
    <div class="kpi ${T.gral<0?'kbad':''}"><small>Total general</small><b class="${T.gral<0?'bad':'ok'}">${money(T.gral)}</b><span class="mu small">${T.gral<0?'En contra':T.gral>0?'A favor':'—'}</span></div></div>
  <div class="grid g3" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
    <div class="kpi"><small>Me pagó · ${P.low}</small><b class="ok">${money(T.pago)}</b></div>
    <div class="kpi ${T.debe>0?'kbad':''}"><small>Me debe · ${P.low}</small><b class="${T.debe>0?'bad':''}">${money(Math.max(0,T.debe))}</b><span class="mu small">${T.debe>0?`Del total − ${TOTO_PCT}%, lo que le falta pagar`:'Al día'}</span></div></div>
  <div class="card"><div class="ch"><h2>${P.tit}</h2>${L.length?`<button class="btn sm" onclick="pdfToto()">⬇ PDF</button>`:''}</div>
  ${L.length?`<div class="tw"><table class="toto"><thead><tr><th>Fecha</th>${TOTO_J.map(([,t])=>`<th class="r">${t}</th>`).join('')}<th class="r">Total</th><th class="r">${TOTO_PCT}%</th><th class="r">Total − ${TOTO_PCT}%</th><th class="r">Premios</th><th class="r" title="Solo informativo, no entra en ninguna cuenta">Premios agencia (Ema)</th><th class="r">Total general</th><th class="r">Pagó</th><th class="r">Debe</th><th></th><th style="text-align:center">Pago</th></tr></thead>
    <tbody>${L.map(x=>{const c=totoCalc(x);return `<tr class="ck ${totoEst(c)}" onclick="openToto('${x.id}')"><td style="white-space:nowrap">${fd(x.fecha)}</td>${TOTO_J.map(([k])=>`<td class="r">${x[k]?money(x[k]):'<span class="mu">—</span>'}${totoConcDe(x,k)?`<span class="tconc">N° ${totoConcDe(x,k)}</span>`:''}</td>`).join('')}<td class="r" style="font-weight:600">${money(c.total)}</td><td class="r mu">${money(c.com)}</td><td class="r">${money(c.neto)}</td><td class="r">${c.prem?money(c.prem):'<span class="mu">—</span>'}</td><td class="r" style="color:var(--toto)">${c.premAg?money(c.premAg):'<span class="mu">—</span>'}</td><td class="r">${sgn(c.gral)}</td><td class="r">${c.pago?money(c.pago):'<span class="mu">—</span>'}${c.P.length>1?`<br><span class="mu small" style="font-weight:400">${c.P.length} pagos</span>`:''}</td><td class="r">${debeTxt(c.debe)}</td><td class="r"><button class="btn sm g" onclick="event.stopPropagation();openToto('${x.id}')">Editar</button></td><td style="white-space:nowrap" onclick="event.stopPropagation()"><div class="tpago"><label class="tchk" title="${c.saldado?'Pagó todo':'Marcar como pagado completo'}"><input type="checkbox" ${c.saldado?'checked':''} onchange="totoPago('${x.id}',this.checked)" aria-label="Pagó todo"></label><button class="btn sm tparc" onclick="openTotoPago('${x.id}')">Parcial</button></div></td></tr>`}).join('')}</tbody>
    <tfoot><tr><td>Total</td>${TOTO_J.map(([k])=>`<td class="r">${money(J[k])}</td>`).join('')}<td class="r">${money(T.total)}</td><td class="r">${money(T.com)}</td><td class="r">${money(T.neto)}</td><td class="r">${money(T.prem)}</td><td class="r" style="color:var(--toto)">${money(T.premAg)}</td><td class="r">${sgn(T.gral)}</td><td></td><td></td><td></td><td style="text-align:center" class="mu small">${L.filter(x=>totoCalc(x).saldado).length}/${L.length}</td></tr></tfoot></table></div>
    <div class="legend"><span><i style="background:var(--ok)"></i>Pagó todo</span><span><i style="background:var(--warn)"></i>Pago parcial</span><span><i style="background:var(--bad)"></i>No pagó</span></div>`
   :empt(v==='todo'?'Todavía no cargaste ningún día.':v==='dia'?`No hay nada cargado ${P.low}.`:`No hay días cargados en ${P.low}.`,`<button class="btn" onclick="openToto(null,'${v==='dia'?P.d:''}')">+ Cargar ${v==='dia'?'este día':'día'}</button>`)}</div>`};
function openToto(id,f){const x=id?S.toto.find(v=>v.id===id):{fecha:f||(F.totoV==='dia'&&F.totoD)||hoy(),premios:''};
  modal(`<h2>${id?'Editar día · Toto Ortega':'Cargar día · Toto Ortega'}</h2>
  <label class="f">Fecha<input type="date" id="t-f" value="${x.fecha}"></label>
  <span class="lbl">Jugado por sorteo</span>
  <div class="row">${TOTO_J.map(([k,t])=>`<label class="f" for="t-${k}"><span class="tjh"><span>${t}</span><span class="tjn">N°<input id="tc-${k}" class="tcin" inputmode="numeric" value="${(id?totoConcDe(x,k):totoConc(x.fecha,'',k))||''}" oninput="this.dataset.man=1;this.value=this.value.replace(/\D/g,'')" aria-label="N° de concurso ${t}" title="N° de concurso"></span></span><input id="t-${k}" class="money" inputmode="numeric" value="${x[k]||''}" oninput="totoPrev()"></label>`).join('')}</div>
  <p class="mu small" style="margin-top:0;text-align:center">El N° de concurso de cada sorteo se completa solo: sube 1 en cada día de sorteo (se cambia en Ajustes). Lo podés cambiar.</p>
  <div class="row"><label class="f">Premios pagados<input id="t-premios" class="money" inputmode="numeric" value="${x.premios||''}" oninput="totoPrev()"></label><label class="f">Premios pagados por agencia (Ema)<input id="t-premag" class="money" inputmode="numeric" value="${x.premiosAg||''}"></label></div><p class="mu small" style="margin-top:8px;text-align:center">Los premios de la agencia son solo para anotar: no se restan de ninguna cuenta.</p>
  <p class="warn small" id="t-dup" style="margin-top:8px;text-align:center"></p><div class="card" id="t-prev" style="margin-top:10px;padding:12px 14px"></div>
  <div class="mfoot">${id?`<button class="btn d" onclick="delToto('${id}')">Eliminar</button>`:'<span></span>'}<div class="acts"><button class="btn" onclick="close_()">Cancelar</button><button class="btn p" onclick="saveToto('${id||''}')">Guardar</button></div></div>`);TOTO_ED=id||'';const tf=$('#t-f');const rc=()=>{TOTO_J.forEach(([k])=>{const ci=$('#tc-'+k);if(ci&&!ci.dataset.man){const n=totoConc(val('t-f')||hoy(),TOTO_ED,k);ci.value=n||''}});totoPrev()};if(tf){tf.addEventListener('change',rc);tf.addEventListener('input',rc)}totoPrev()}
function totoLeer(){const o={fecha:val('t-f')||hoy(),premios:num(val('t-premios')),premiosAg:num(val('t-premag')),conc:Object.fromEntries(TOTO_J.map(([k])=>[k,parseInt(val('tc-'+k),10)||null])),concurso:null};TOTO_J.forEach(([k])=>o[k]=num(val('t-'+k)));return o}
let TOTO_ED='';function totoPrev(){const e=$('#t-prev');if(!e)return;const o=totoLeer();const x0=TOTO_ED?S.toto.find(v=>v.id===TOTO_ED):null;if(x0){o.pagos=x0.pagos;o.pagado=x0.pagado}const c=totoCalc(o);
  const du=$('#t-dup');if(du)du.textContent=S.toto.some(v=>v.fecha===o.fecha&&v.id!==TOTO_ED)?`Ojo: ya hay un día cargado el ${fd(o.fecha)}. Si guardás, queda otra fila con esa fecha.`:'';
  e.innerHTML=`<div class="list"><div><span>Total</span><b>${money(c.total)}</b></div><div><span>− ${TOTO_PCT}%</span><b>${money(c.com)}</b></div><div><span>Total − ${TOTO_PCT}%</span><b>${money(c.neto)}</b></div><div><span>− Premios</span><b>${money(c.prem)}</b></div><div><span><b>Total general</b> <span class="mu small">${c.gral<0?'(en contra)':c.gral>0?'(a favor)':''}</span></span>${sgn(c.gral)}</div><div><span>Tiene que pagar (total − ${TOTO_PCT}%)</span><b>${money(c.neto)}</b></div>${c.pago?`<div><span>Ya pagó</span><b>${money(c.pago)}</b></div><div><span><b>Debe</b></span>${debeTxt(c.debe)}</div>`:''}</div>`}
function saveToto(id){const o=totoLeer();
  try{if(id){const x=S.toto.find(v=>v.id===id);if(!Array.isArray(x.pagos)){x.pagos=totoPagosDe(x,totoCalc(x).neto);delete x.pagado}Object.assign(x,o)}else S.toto.push({id:uid(),...o,pagos:[]});F.totoM=o.fecha.slice(0,7);F.totoD=o.fecha;done('Día guardado')}catch(e){console.error(e);toast('No se pudo guardar: '+(e&&e.message||e))}}
function totoFix(x){if(!Array.isArray(x.pagos)){x.pagos=totoPagosDe(x,totoCalc(x).neto)}delete x.pagado;return x}
/* check: pagó todo (agrega lo que faltaba) / destildar: borra los pagos de ese día */
function totoPago(id,v){const x=S.toto.find(t=>t.id===id);if(!x)return;totoFix(x);const c=totoCalc(x);
  if(v){if(c.debe!==0)x.pagos.push({f:hoy(),m:c.debe})}else x.pagos=[];save();toast(v?'Marcado como pagado completo':'Pagos de ese día quitados');rerender()}
function openTotoPago(id){const x=S.toto.find(t=>t.id===id);if(!x)return;const c=totoCalc(x);
  modal(`<h2>Pago parcial · ${fd(x.fecha)}</h2><p class="mu small">Toto Ortega</p>
  <div class="card" style="padding:12px 14px"><div class="list"><div><span>Tiene que pagar (total − ${TOTO_PCT}%)</span><b>${money(c.neto)}</b></div><div><span>Ya pagó</span><b>${money(c.pago)}</b></div><div><span><b>Debe</b></span>${debeTxt(c.debe)}</div></div></div>
  ${c.P.length?`<span class="lbl" style="margin-top:12px;display:block">Pagos de este día</span><div class="list">${c.P.map((p,i)=>`<div><span>${fd(p.f)}</span><span class="acts" style="align-items:center"><b>${money(p.m)}</b>${Array.isArray(x.pagos)?`<button class="btn sm g" onclick="totoQuitarPago('${id}',${i})" aria-label="Quitar pago">✕</button>`:''}</span></div>`).join('')}</div>`:''}
  <div class="row" style="margin-top:12px"><label class="f">Monto que paga ahora<input id="tp-m" class="money" inputmode="numeric" value=""></label><label class="f">Fecha<input type="date" id="tp-f" value="${hoy()}"></label></div>
  <div class="mfoot"><span></span><div class="acts"><button class="btn" onclick="close_()">Cancelar</button><button class="btn p" onclick="saveTotoPago('${id}')">Guardar</button></div></div>`);setTimeout(()=>{const i=$('#tp-m');if(i)i.focus()},50)}
function saveTotoPago(id){const x=S.toto.find(t=>t.id===id);if(!x)return;const m=num(val('tp-m'));if(!m)return toast('Poné el monto que pagó');
  totoFix(x);const c=totoCalc(x);x.pagos.push({f:val('tp-f')||hoy(),m});done('Pago guardado')}
function totoQuitarPago(id,i){const x=S.toto.find(t=>t.id===id);if(!x||!Array.isArray(x.pagos))return;x.pagos.splice(i,1);save();toast('Pago quitado');rerender();openTotoPago(id)}
function pdfToto(){const PP=totoPer();const L=PP.L.sort((a,b)=>a.fecha.localeCompare(b.fecha));if(!L.length)return toast('No hay días para exportar');
  const per=PP.tit;
  const head=['Fecha',...TOTO_J.map(([,t])=>t),'Total',TOTO_PCT+'%','Total − '+TOTO_PCT+'%','Premios','Premios agencia (Ema)','Total general','Pagó','Debe'];
  const T={total:0,com:0,neto:0,prem:0,premAg:0,gral:0,pago:0,debe:0},J={};TOTO_J.forEach(([k])=>J[k]=0);
  const body=L.map(x=>{const c=totoCalc(x);for(const k in T)T[k]+=c[k];TOTO_J.forEach(([k])=>J[k]+=+x[k]||0);
    return[fd(x.fecha),...TOTO_J.map(([k])=>(x[k]?pm(x[k]):'—')+(totoConcDe(x,k)?'\nN° '+totoConcDe(x,k):'')),pm(c.total),pm(c.com),pm(c.neto),c.prem?pm(c.prem):'—',c.premAg?pm(c.premAg):'—',pm(c.gral),c.pago?pm(c.pago):'—',c.debe>0?pm(c.debe):c.debe<0?'+'+pm(-c.debe):'—']});
  const foot=['Total',...TOTO_J.map(([k])=>pm(J[k])),pm(T.total),pm(T.com),pm(T.neto),pm(T.prem),pm(T.premAg),pm(T.gral),'',''];
  const res=[`Total jugado ${pm(T.total)}`,`${TOTO_PCT}% ${pm(T.com)}`,`Total − ${TOTO_PCT}% ${pm(T.neto)}`,`Premios ${pm(T.prem)}`,`Total general ${pm(T.gral)}`,`Me pagó ${pm(T.pago)}`,`Me debe ${pm(Math.max(0,T.debe))}`];
  const archivo=`Toto_Ortega_${PP.key}.pdf`;
  (async()=>{toast('Armando el PDF…');
  try{if(!window.jspdf)await loadJs('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      if(!window.jspdf.jsPDF.API.autoTable)await loadJs('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')}
  catch(e){const wn=window.open('','_blank');if(!wn)return toast('Sin internet no se pudo crear el PDF. Permití ventanas emergentes para imprimirlo.');
    const tr=(r,t)=>`<tr>${r.map((c,i)=>`<${t} style="text-align:${i?'right':'left'}">${esc(c)}</${t}>`).join('')}</tr>`;
    wn.document.write(`<html><head><title>Toto Ortega · ${esc(per)}</title><style>@page{size:A4 landscape;margin:10mm}body{font:11px system-ui,sans-serif;margin:0;color:#1C1F24}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border-bottom:1px solid #ddd;padding:4px 5px;white-space:nowrap}th{background:#f1f0eb}tfoot td{font-weight:700}</style></head><body><h2>Toto Ortega · ${esc(per)}</h2><p><b>${res.map(esc).join(' · ')}</b></p><table><thead>${tr(head,'th')}</thead><tbody>${body.map(r=>tr(r,'td')).join('')}</tbody><tfoot>${tr(foot,'td')}</tfoot></table><p style="color:#888">Elegí “Guardar como PDF” en la ventana de impresión.</p></body></html>`);
    wn.document.close();wn.focus();setTimeout(()=>wn.print(),300);return}
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'landscape'});const W=doc.internal.pageSize.getWidth(),Hh=doc.internal.pageSize.getHeight();
  doc.setFillColor(61,90,128);doc.rect(0,0,W,24,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('Toto Ortega',12,11);
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(per,12,18);doc.text(`Al ${fd(hoy())}`,W-12,11,{align:'right'});doc.text(S.conf.nombre||'',W-12,18,{align:'right'});
  doc.setTextColor(30);doc.setFontSize(9.5);doc.setFont('helvetica','bold');doc.text(res.join('   ·   '),12,32);
  const cs={};for(let i=1;i<head.length;i++)cs[i]={halign:'right'};cs[0]={cellWidth:18};
  doc.autoTable({startY:36,head:[head],body,foot:[foot],styles:{fontSize:7.5,cellPadding:1.6,textColor:30,overflow:'linebreak'},headStyles:{fillColor:[241,240,235],textColor:80,fontStyle:'bold',halign:'right'},footStyles:{fillColor:[255,255,255],textColor:30,fontStyle:'bold',halign:'right'},columnStyles:cs,margin:{left:10,right:10},
    didParseCell:d=>{if(d.column.index===0)d.cell.styles.halign='left';if(d.section==='body'){const last=head.length-1;if(d.column.index===last&&String(d.cell.raw).startsWith('$'))d.cell.styles.textColor=[179,48,42];if(d.column.index===last-2&&String(d.cell.raw).startsWith('-'))d.cell.styles.textColor=[179,48,42];if(d.column.index===last-3)d.cell.styles.textColor=[61,90,128]}}});
  const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(130);doc.text(`Página ${i} de ${n}`,W-12,Hh-6,{align:'right'})}
  doc.save(archivo);toast('PDF descargado')})()}
function delToto(id){if(!confirm('¿Eliminar este día de la planilla?'))return;S.toto=S.toto.filter(v=>v.id!==id);done('Eliminado')}

/* ============ PDF de listados (Quini 6 · Lotería) ============ */
const FILTXT={todos:'',deben:' · solo los que deben',pagados:' · solo pagados'};
async function pdfLista(titulo,sub,head,body,tot,archivo,colR){toast('Armando el PDF…');
  try{if(!window.jspdf)await loadJs('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      if(!window.jspdf.jsPDF.API.autoTable)await loadJs('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')}
  catch(e){const wn=window.open('','_blank');if(!wn)return toast('Sin internet no se pudo crear el PDF. Permití ventanas emergentes para imprimirlo.');
    wn.document.write(`<html><head><title>${esc(titulo)}</title><style>body{font:13px system-ui,sans-serif;margin:24px;color:#1C1F24}table{width:100%;border-collapse:collapse;margin:8px 0 20px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}th{background:#f1f0eb}</style></head><body><h2>${esc(titulo)}</h2><p>${esc(sub)}</p><table><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>${body.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table><p>${tot.map(esc).join(' · ')}</p><p style="color:#888">Elegí “Guardar como PDF” en la ventana de impresión.</p></body></html>`);
    wn.document.close();wn.focus();setTimeout(()=>wn.print(),300);return}
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'});const W=doc.internal.pageSize.getWidth();
  doc.setFillColor(14,107,79);doc.rect(0,0,W,30,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text(titulo,14,14);
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(sub,14,21);doc.text(`Al ${fd(hoy())}`,W-14,14,{align:'right'});doc.text(S.conf.nombre||'',W-14,21,{align:'right'});
  doc.setTextColor(30);doc.setFontSize(11);doc.setFont('helvetica','bold');doc.text(tot.join('   ·   '),14,40);
  const est=head.length-1,cs={};colR.forEach(i=>cs[i]={halign:'right'});
  doc.autoTable({startY:45,head:[head],body,styles:{fontSize:9,cellPadding:2.2,textColor:30},headStyles:{fillColor:[241,240,235],textColor:80,fontStyle:'bold'},columnStyles:cs,margin:{left:14,right:14},
    didParseCell:d=>{if(d.section==='body'&&d.column.index===est)d.cell.styles.textColor=String(d.cell.raw).startsWith('Debe')?[179,48,42]:[14,107,79]}});
  const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(130);doc.text(`Página ${i} de ${n}`,W-14,290,{align:'right'})}
  doc.save(archivo);toast('PDF descargado')}
function pdfLot(){const s=so(F.so)||sorteoAct();if(!s)return;const V=S.lot.filter(l=>l.soId===s.id).sort(byNum).filter(v=>gPass(v.pagado));const imp=v=>v.frac*v.precio;
  pdfLista(`Lotería · ${plain(s.nombre)}`,`Sorteo del ${fd(s.fecha)}${FILTXT[F.gf||'todos']}`,['N°','Socio','Fracciones','Importe','Estado'],
    V.map(v=>[String(v.numero),sname(v.sid),plain(fracTxt(v)),pm(imp(v)),v.pagado?'Pagado':v.abono>0?`Debe ${pm(falt(v,imp(v)))} (pagó ${pm(v.abono)})`:'Debe']),
    [`${V.length} número${V.length===1?'':'s'}`,`Cobrado ${pm(sum(V,v=>cobr(v,imp(v))))}`,`Falta cobrar ${pm(sum(V,v=>falt(v,imp(v))))}`],
    `Loteria_${plain(s.nombre).replace(/[^\wáéíóúñÁÉÍÓÚÑ ]+/g,'').trim().replace(/\s+/g,'_')}_${s.fecha}.pdf`,[3])}
function pdfQ6(){const f=F.q6F;if(!f)return;const V=S.q6.filter(j=>j.fecha===f).sort(byName).filter(j=>gPass(j.pagado));
  pdfLista('Quini 6',`Sorteo del ${DIAS[parse(f).getDay()]} ${fd(f)}${FILTXT[F.gf||'todos']}`,['Socio','Cómo juega','Monto','Estado'],
    V.map(j=>[sname(j.sid),j.auto?'Juega siempre':'Jugada suelta',pm(j.monto),j.pagado?'Pagado':j.abono>0?`Debe ${pm(falt(j,j.monto))} (pagó ${pm(j.abono)})`:'Debe']),
    [`${V.length} jugada${V.length===1?'':'s'}`,`Cobrado ${pm(sum(V,j=>cobr(j,j.monto)))}`,`Falta cobrar ${pm(sum(V,j=>falt(j,j.monto)))}`],
    `Quini6_${f}.pdf`,[2])}

/* ============ usuarios / login ============ */
const userAvatar=u=>u.foto?`<img class="av" src="${esc(u.foto)}" alt="Foto de ${esc(u.nombre)}" style="object-fit:cover">`:`<span class="av">${esc((u.nombre||'?')[0]).toUpperCase()}</span>`;
const uname=id=>id==='auto'?'Automático':(S.usuarios.find(u=>u.id===id)||(S.usuariosBaja||[]).find(u=>u.id===id)||{}).nombre||'';
const porTxt=x=>{if(!x)return'';const a=x.por&&x.por!=='auto'?'Cargó '+esc(uname(x.por)):x.por==='auto'?'Automático':'';const m=x.modPor&&x.modPor!==x.por?'editó '+esc(uname(x.modPor))+(x.modTs?' '+fd(x.modTs.slice(0,10)):''):'';return [a,m].filter(Boolean).join(' · ')};
function showLogin(mensaje=''){document.body.classList.add('locked');window.dispatchEvent(new CustomEvent('agencia:salir', {detail:mensaje}))}
function cargarAgencia(datos){
  S=norm(datos.estado);
  CUR=datos.perfil;
  revision=datos.revision;
  snapAll();
  document.body.classList.remove('locked');

  render();
}

async function salir(){
  if(PENDIENTES.length)return;
  CUR=null;
  S=norm(vacio());
  V='inicio';
  close_();

  $('#panel-legacy').replaceChildren();
  window.dispatchEvent(new CustomEvent('agencia:socios',{detail:null}));
  publicarCheques();
  publicarAjustes();
  publicarActividad();
  publicarSeguros();
  $('#side').replaceChildren();
  try{
    await window.agencia.salir();
    showLogin();
  }catch(error){
    showLogin(error.message);
  }
}
/* ============ Actividad ============ */
function publicarActividad(){
  const detalle=V==='actividad'&&CUR?{
    usuarios:S.usuarios.map(({id,nombre})=>({id,nombre})),
    movimientos:[...S.log].reverse().map((movimiento,indice)=>({
      id:String(indice),usuarioId:movimiento.uid||'',nombre:uname(movimiento.uid),
      fecha:movimiento.ts?fd(new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date(movimiento.ts))):'—',
      hora:horaAR(movimiento.ts),accion:movimiento.acc||'',tipo:AUDN[movimiento.k]||movimiento.k||'',
      detalle:movimiento.txt||'',
    })),
  }:null;
  window.dispatchEvent(new CustomEvent('agencia:actividad',{detail:detalle}));
}
/* ============ comunes ============ */
function editPayment(k,id){
  const jugada=S[k].find(v=>v.id===id);
  if(!jugada)return;
  abrirPago({
    clave:k+'|'+id,titulo:'Editar pago',fecha:jugada.fpago,
    medio:jugada.medio,detalle:jugada.det,textoGuardar:'Guardar',
    guardar:(fecha,medio,detalle)=>{
      Object.assign(jugada,{fpago:fecha,medio,det:detalle});
      done('Pago actualizado');
    },
    anular:{texto:'Anular pago',ejecutar:()=>anularPago(k+'|'+id)},
  });
}
function tg(k,id){const x=S[k].find(v=>v.id===id);x.pagado=!x.pagado;if(x.pagado){x.fpago=hoy();x.medio=''}else{delete x.fpago;delete x.medio}save();toast(x.pagado?'Marcado como pagado':'Marcado como pendiente');rerender()}
function del(k,id){if(!confirm('¿Eliminar?'))return;let lib=0;{const kk=k==='seguros'?'seg':k==='rifas'?'rifa':k;const x=S[k].find(v=>v.id===id);
  if(x&&['seg','rifa','q6','lot','quiniela'].includes(kk)){const n=kk==='seg'?x.cuotas.length:kk==='rifa'?x.pagos.length:0;
    (n?Array.from({length:n},(_,i)=>[kk,id,i]):[[kk,id]]).forEach(ref=>{lib+=liberarDeCobros(ref,false)})}}
  if(lib)setTimeout(()=>toast(`Lo que ya había pagado (${money(lib)}) quedó como saldo a favor`),2500);if(k==='q6'){const j=S.q6.find(x=>x.id===id);if(j)S.q6skip.push(j.sid+'|'+j.fecha)}S[k]=S[k].filter(x=>x.id!==id);done('Eliminado')}
function modal(h){closeCal();$('#modal').innerHTML=h;$('#ov').hidden=false;enh($('#modal'));pgDet()}
const fmtN=v=>{if(v===''||v===null||v===undefined)return'';const n=typeof v==='number'?v:num(v);return redondear(n).toLocaleString('es-AR',{maximumFractionDigits:2,minimumFractionDigits:Math.round(n*100)%100?2:0})};
function formatoImporteEntrada(v){const limpio=String(v).replace(/[^\d,]/g,'');if(!limpio)return'';const pos=limpio.indexOf(','),entero=(pos<0?limpio:limpio.slice(0,pos)).replace(/^0+(?=\d)/,'')||'0';return Number(entero).toLocaleString('es-AR')+(pos<0?'':','+limpio.slice(pos+1).replace(/,/g,'').slice(0,2))}
document.addEventListener('input',e=>{const i=e.target;if(i.classList&&i.classList.contains('money')){const antes=i.value,pos=i.selectionStart??antes.length;const relevantes=antes.slice(0,pos).replace(/[^\d,]/g,'').length;i.value=formatoImporteEntrada(antes);let cursor=0,cont=0;while(cursor<i.value.length&&cont<relevantes){if(/[\d,]/.test(i.value[cursor]))cont++;cursor++}try{i.setSelectionRange(cursor,cursor)}catch(_){}}});
document.addEventListener('blur',e=>{const i=e.target;if(i.classList&&i.classList.contains('money'))i.value=fmtN(i.value)},true);
const CAL_ICON='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
function enh(root){root.querySelectorAll('input.money').forEach(i=>{if(!i.dataset.moneyReady){const raw=i.value;i.value=fmtN(/^\d+(?:\.\d+)?$/.test(raw)?Number(raw):raw);i.dataset.moneyReady='1'}i.inputMode='decimal'});
  root.querySelectorAll('input[type=date]').forEach(inp=>{const inl=!inp.closest('label.f');inp.type='hidden';const w=document.createElement('span');w.className='dpw';w.style.display=inl?'inline-block':'block';
    inp.parentNode.insertBefore(w,inp);w.appendChild(inp);const b=document.createElement('button');b.type='button';b.className='dp'+(inl?' inl':'');w.appendChild(b);
    inp._upd=()=>{b.innerHTML=CAL_ICON+'<span>'+(inp.dataset.label?inp.dataset.label:inp.value?DIAS[parse(inp.value).getDay()]+' '+fd(inp.value):'Elegir fecha')+'</span>'};inp._upd();
    b.onclick=e=>{e.preventDefault();e.stopPropagation();openCal(w,inp)}})}
let calEl=null,calAnchor=null;
function closeCal(){if(calEl){calEl.remove();calEl=null}calAnchor=null}
function openCal(w,inp){const was=calEl&&calAnchor===w;closeCal();if(was)return;let ym=(inp.value||hoy()).slice(0,7);
  const c=document.createElement('div');c.className='cal';c.setAttribute('role','group');c.setAttribute('aria-label','Elegir fecha');c.onclick=e=>{e.stopPropagation();if(e.target.closest('button'))e.preventDefault()};document.body.appendChild(c);calEl=c;calAnchor=w;
  const pick=v=>{inp.value=v;inp._upd();closeCal();inp.dispatchEvent(new Event('change'))};
  const draw=()=>{const[y,m]=ym.split('-').map(Number);const off=(new Date(y,m-1,1).getDay()+6)%7,dim=new Date(y,m,0).getDate();
    let h=`<div class="ch2"><button type="button" class="btn sm g" data-n="-1" aria-label="Mes anterior">‹</button><div class="cal-selects"><select class="cal-month" aria-label="Mes">${MESES.map((mes,i)=>`<option value="${i+1}" ${i+1===m?'selected':''}>${mes}</option>`).join('')}</select><input class="cal-year" aria-label="Año" type="number" min="1" max="9999" value="${y}" inputmode="numeric"></div><button type="button" class="btn sm g" data-n="1" aria-label="Mes siguiente">›</button></div><div class="g">${['L','M','M','J','V','S','D'].map(d=>`<span>${d}</span>`).join('')}${'<i></i>'.repeat(off)}`;
    for(let d=1;d<=dim;d++){const iso=`${y}-${pad(m)}-${pad(d)}`;h+=`<button type="button" data-d="${iso}" class="${iso===inp.value?'sel':''} ${iso===hoy()?'hoy':''}">${d}</button>`}
    c.innerHTML=h+`</div><div class="ft"><button type="button" class="btn sm" data-d="${hoy()}">Hoy</button><button type="button" class="btn sm" data-d="${addDays(hoy(),-1)}">Ayer</button><button type="button" class="btn sm g" data-x="1" style="margin-left:auto">Cerrar</button></div>`;
    c.querySelectorAll('[data-n]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();ym=addMonths(ym+'-01',+b.dataset.n).slice(0,7);draw()});
    c.querySelector('.cal-month').onchange=e=>{ym=ym.slice(0,4)+'-'+pad(+e.target.value);draw()};
    c.querySelector('.cal-year').onchange=e=>{const year=+e.target.value;if(Number.isInteger(year)&&year>=1&&year<=9999){ym=String(year).padStart(4,'0')+ym.slice(4);draw()}};
    c.querySelectorAll('[data-d]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();pick(b.dataset.d)});c.querySelector('[data-x]').onclick=e=>{e.preventDefault();e.stopPropagation();closeCal()}};
  draw();const a=w.getBoundingClientRect(),r=c.getBoundingClientRect(),gap=6,edge=8;const vw=document.documentElement.clientWidth||window.innerWidth,vh=window.innerHeight;const below=vh-a.bottom-gap-edge,above=a.top-gap-edge;const top=below>=r.height?a.bottom+gap:above>=r.height?a.top-gap-r.height:Math.max(edge,Math.min(vh-r.height-edge,below>=above?a.bottom+gap:a.top-gap-r.height));c.style.left=Math.max(edge,Math.min(a.left,vw-r.width-edge))+'px';c.style.top=Math.max(edge,top)+'px'}
window.addEventListener('resize',closeCal);
document.addEventListener('scroll',e=>{if(calEl&&!calEl.contains(e.target))closeCal()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&calEl){e.preventDefault();e.stopImmediatePropagation();const a=calAnchor;closeCal();a?.querySelector('.dp')?.focus()}},true);
document.addEventListener('click',closeCal);
function close_(){
  $('#ov').hidden=true;
  window.dispatchEvent(new CustomEvent('agencia:editar-socio',{detail:null}));
  window.dispatchEvent(new CustomEvent('agencia:editar-sorteo',{detail:null}));
  window.dispatchEvent(new CustomEvent('agencia:editar-seguro',{detail:null}));
  window.dispatchEvent(new CustomEvent('agencia:editar-pago',{detail:null}));
  window.dispatchEvent(new CustomEvent('agencia:registrar-cobro',{detail:null}));
}
/* Guarda el formulario y abre el cobro de lo que se acaba de cargar */
function guardarYCobrar(col,fn){const antes=new Set(S[col].map(x=>x.id));const editId=(document.querySelector('#modal [onclick*="del(\''+col+'\'"]')||{}).getAttribute?.('onclick')?.match(/'([^']+)'\)$/)?.[1];
  fn();if(!$('#ov').hidden)return;   // no se guardó (falta algún dato)
  const nuevos=S[col].filter(x=>!antes.has(x.id));const x=nuevos[0]||S[col].find(v=>v.id===editId);if(!x)return;
  const t=col==='seguros'?'seg':col==='rifas'?'rifa':col;
  let key=null;if(nuevos.length<=1){if(t==='seg'){const i=x.cuotas.findIndex(c=>!c.pago&&!c.anulado);key=i<0?null:`seg|${x.id}|${i}`}else if(t==='rifa'){const i=x.pagos.findIndex(p=>!p);key=i<0?null:`rifa|${x.id}|${i}`}else key=x.pagado?null:`${t}|${x.id}`}
  openCobro(x.sid,key)}
function done(t){save();close_();toast(t);rerender()}
let tT;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(tT);tT=setTimeout(()=>e.classList.remove('on'),2400)}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#ov').hidden)close_()});
window.cargarAgencia=cargarAgencia;
