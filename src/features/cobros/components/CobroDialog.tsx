import { useDialogo, useDialogos } from '../../../shared/stores/dialogos.store';
import { useDatosCobro } from '../hooks/useCobros';
import { CobroFormulario } from './CobroFormulario';
import { DialogoCarga } from '../../../shared/components/DialogoCarga';

/** "Registrar cobro". Se abre con `abrir({ tipo: 'cobro', sid, solo? })`; los conceptos y la cuenta se leen del servidor. */
export function CobroDialog() {
  const cobro = useDialogo('cobro');
  return cobro && <Contenido key={`${cobro.sid}|${cobro.solo ?? ''}`} socioId={cobro.sid} solo={cobro.solo ?? null} />;
}

function Contenido({ socioId, solo }: { socioId: string; solo: string | null }) {
  const cerrar = useDialogos((estado) => estado.cerrar);
  const consulta = useDatosCobro(socioId, solo);
  if (consulta.data) return <CobroFormulario datos={consulta.data} cerrar={cerrar} />;
  return consulta.error ? <DialogoCarga error={consulta.error.message} cerrar={cerrar} /> : null;
}
