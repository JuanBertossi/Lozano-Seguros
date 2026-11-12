import { useEffect,useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDialogo } from '../../../shared/stores/dialogos.store';
import { useWhatsAppSocio } from '../hooks/useWhatsAppSocio';
import { btnMd, btnMdP, campoF, cuerpo, dialogo as marco, etiquetaF, notaF, opcionF, opcionesF, pie, titulo } from './estilos';
import { abrirModal } from '../../../shared/lib/dialogo';
const schema=z.object({mensaje:z.string(),pdf:z.boolean()});
type Datos=z.infer<typeof schema>;
type Preparado=NonNullable<ReturnType<typeof useWhatsAppSocio>['datos']>;
export function WhatsAppDialog(){const d=useDialogo('whatsapp');return d&&<Preparar key={d.sid} socioId={d.sid}/>}
function Preparar({socioId}:{socioId:string}){
 const w=useWhatsAppSocio(socioId);
 if(!w.datos)return <dialog open className={marco}><form onSubmit={e=>e.preventDefault()}><div className={cuerpo}><p role="status" className="text-[var(--mu)]">{w.mensaje}</p></div><div className={pie}><span/><div className="flex flex-wrap gap-2"><button type="button" className={btnMd} onClick={w.cerrar}>Cerrar</button></div></div></form></dialog>;
 return <Formulario datos={w.datos} enviar={w.enviar} cerrar={w.cerrar}/>;
}
function Formulario({datos:e,enviar,cerrar}:{datos:Preparado;enviar:(datos:Datos)=>Promise<void>;cerrar:()=>void}){const dialogo=useRef<HTMLDialogElement>(null),{register,handleSubmit,formState:{isSubmitting}}=useForm<Datos>({resolver:zodResolver(schema),defaultValues:{mensaje:e.mensaje,pdf:true}});useEffect(()=>{abrirModal(dialogo.current);},[]);
 return <dialog ref={dialogo} aria-labelledby="titulo-whatsapp" className={marco} onCancel={event=>{event.preventDefault();if(!isSubmitting)cerrar()}}><form onSubmit={handleSubmit(enviar)}><div className={cuerpo}><h2 id="titulo-whatsapp" className={titulo}>Enviar por WhatsApp</h2><p className="mb-3 text-[14.5px] text-[var(--mu)]">A {e.nombre} · +{e.telefono}</p><label className={etiquetaF}>Mensaje<textarea rows={4} className={campoF} {...register('mensaje')}/></label><div className={opcionesF}><label className={opcionF}><input type="checkbox" {...register('pdf')}/>Adjuntar estado de cuenta en PDF</label></div><p className={notaF}>{e.movil?<>Se abre el menú para compartir: elegí <b>WhatsApp</b> y el chat de {e.nombre.split(' ')[0]}.</>:<>El PDF se descarga en tu compu y se abre el chat con el mensaje escrito. En WhatsApp tocá el clip <b>📎 → Documento</b> y elegí el PDF de <b>Descargas</b> (o arrastralo al chat).</>}</p></div><div className={pie}><span/><div className="flex flex-wrap gap-2"><button type="button" className={btnMd} disabled={isSubmitting} onClick={cerrar}>Cancelar</button><button disabled={isSubmitting} className={btnMdP}>{isSubmitting?'Preparando…':'Enviar'}</button></div></div></form></dialog>;
}
