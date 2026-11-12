import type { UseFormReturn } from 'react-hook-form';
import type { PagoInput } from '../schemas/pago.schema';
import { campoDlg, entradaOpcion, fila2, opcionDlg, opciones, rotuloDlg, rotuloSueltoDlg } from '../lib/clases';

const medios = [
  ['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['echeq', 'E-cheq'],
  ['cheque', 'Cheque físico'], ['mp', 'Mercado Pago'], ['', 'Sin especificar'],
] as const;

const detalles = {
  cheque: [['banco', 'Banco'], ['nro', 'N° de cheque'], ['librador', 'Librador / titular'], ['fcobro', 'Fecha de cobro']],
  echeq: [['banco', 'Banco'], ['nro', 'N° / ID del e-cheq'], ['librador', 'CUIT del librador'], ['fcobro', 'Fecha de pago']],
  transferencia: [['banco', 'Banco o billetera de origen'], ['nro', 'N° de operación / comprobante'], ['librador', 'Titular de la cuenta']],
  mp: [['nro', 'N° de operación'], ['librador', 'Titular']],
} as const;

const nombres = { cheque: 'del cheque', echeq: 'del e-cheq', transferencia: 'de la transferencia', mp: 'del pago' } as const;
const error = 'text-[14.5px] text-[var(--bad)]';

export function PagoCampos({ form }: { form: UseFormReturn<PagoInput> }) {
  const { register, watch, setValue, formState: { errors, defaultValues } } = form;
  const medio = watch('medio');
  const cargar = watch('cargarDetalle');
  const campos = medio && medio !== 'efectivo' ? detalles[medio] : undefined;
  const seleccionMedio = register('medio');
  // Como `pgDet` de la maqueta: si el pago ya tenía datos cargados, se ofrecen tildados al cambiar de medio.
  const teniaDetalle = Boolean(defaultValues?.banco || defaultValues?.nro || defaultValues?.librador || defaultValues?.fcobro);

  return (
    <>
      <label className={rotuloDlg}>Día que llegó el pago
        <input type="date" className={campoDlg} {...register('fecha')} />
      </label>
      {errors.fecha && <p role="alert" className={error}>{errors.fecha.message}</p>}
      <span className={rotuloSueltoDlg} id="medio-pago">Medio de pago</span>
      <div className={opciones} role="radiogroup" aria-labelledby="medio-pago">
        {medios.map(([id, nombre]) => (
          <label key={id} className={opcionDlg}>
            <input type="radio" value={id} className={entradaOpcion} {...seleccionMedio} onChange={(event) => {
              void seleccionMedio.onChange(event);
              setValue('cargarDetalle', teniaDetalle || id === 'cheque' || id === 'echeq');
            }} />{nombre}
          </label>
        ))}
      </div>
      {campos && <>
        <div className="-mt-1 mb-3 flex flex-wrap gap-1.5">
          <label className={opcionDlg}><input type="checkbox" className={entradaOpcion} {...register('cargarDetalle')} />¿Cargar los datos {nombres[medio as keyof typeof nombres]}?</label>
        </div>
        {cargar && <div className="mb-3 rounded-[10px] border border-solid border-[var(--ln)] px-3 pt-3">
          <div className={fila2}>
            {campos.map(([id, nombre]) => <label key={id} className={rotuloDlg}>{nombre}<input className={campoDlg} type={id === 'fcobro' ? 'date' : 'text'} {...register(id)} /></label>)}
          </div>
        </div>}
        {errors.fcobro && <p role="alert" className={error}>{errors.fcobro.message}</p>}
      </>}
    </>
  );
}
