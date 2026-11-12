import type { MouseEvent } from 'react';
import { useNavegacion } from '../../../shared/stores/navegacion.store';
import { useTotoPagina } from '../hooks/useTotoPagina';
import { TotoPeriodo } from '../components/TotoPeriodo';
import { TotoResumen } from '../components/TotoResumen';
import { TotoTabla } from '../components/TotoTabla';
import { boton, cabecera, subtitulo, titulo } from '../../../shared/lib/clases';

export function TotoPage() {
  const pagina = useNavegacion((estado) => estado.pagina);
  return pagina === 'toto' ? <Contenido /> : null;
}

function Contenido() {
  const t = useTotoPagina();
  const { operacion, periodo, datos } = t;
  if (!periodo || !datos) {
    return (
      <div role="status">
        <p>{t.error instanceof Error ? t.error.message : 'Cargando planilla…'}</p>
        {t.error && <button type="button" className={boton()} onClick={t.reintentar}>Reintentar</button>}
      </div>
    );
  }
  // Mientras una operación está en curso, solo el botón de reintento responde.
  const bloquearClics = (evento: MouseEvent) => {
    if (operacion.bloqueado && !(evento.target as Element).closest('[data-retry-toto]')) { evento.preventDefault(); evento.stopPropagation(); }
  };
  return (
    <section aria-labelledby="titulo-toto" onClickCapture={bloquearClics}>
      {operacion.error && <p role="alert" className="mb-3 text-[13px] text-[var(--bad)]">{operacion.error}</p>}
      {operacion.bloqueado && !operacion.procesando && <button type="button" data-retry-toto className={boton()} onClick={() => void operacion.enviar()}>Reintentar operación</button>}
      <header className={cabecera}>
        <div>
          <h1 id="titulo-toto" className={`${titulo} border-l-[5px] border-solid border-[var(--toto)] pl-3`}>Toto Ortega</h1>
          <div className={subtitulo}>Planilla diaria: lo jugado en cada sorteo, menos el {datos.porcentaje}% y los premios.</div>
        </div>
        <button type="button" className={boton('primario')} onClick={t.cargar}>+ Cargar día</button>
      </header>
      <TotoPeriodo periodo={periodo} subtitulo={t.subtitulo} irHoy={t.irHoy} anteriorDeshabilitado={t.anteriorDeshabilitado} siguienteDeshabilitado={t.siguienteDeshabilitado} onIr={t.ir} onHoy={t.hoy} onCambiar={t.cambiar} />
      <TotoResumen datos={datos} bajo={periodo.bajo} />
      <TotoTabla datos={datos} titulo={periodo.titulo} bajo={periodo.bajo} vista={periodo.vista} bloqueado={operacion.bloqueado} onCargar={t.cargar} onEditar={t.editar} onPdf={t.pdf} onMarcar={t.marcarPago} onParcial={t.pagoParcial} />
    </section>
  );
}
