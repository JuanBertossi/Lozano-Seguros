import type { UseFormReturn } from 'react-hook-form';
import type { PagoInput } from '../schemas/pago.schema';

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
const campo = 'w-full rounded-lg border border-solid border-[var(--ln)] bg-[var(--sf)] px-3 py-[11px] text-[16.5px] focus-visible:outline-2 focus-visible:outline-[var(--ac)]';

export function PagoCampos({ form }: { form: UseFormReturn<PagoInput> }) {
  const { register, watch, setValue, formState: { errors } } = form;
  const medio = watch('medio');
  const cargar = watch('cargarDetalle');
  const campos = medio && medio !== 'efectivo' ? detalles[medio] : undefined;
  const seleccionMedio = register('medio');

  return (
    <>
      <label className="grid gap-1.5 text-[14.5px] font-medium">Día que llegó el pago
        <input type="date" className={campo} {...register('fecha')} />
      </label>
      {errors.fecha && <p role="alert" className="text-sm text-[var(--bad)]">{errors.fecha.message}</p>}
      <fieldset className="m-0 border-0 p-0">
        <legend className="text-sm font-medium">Medio de pago</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {medios.map(([id, nombre]) => (
            <label key={id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-[var(--ln)] px-[11px] py-[7px] text-sm">
              <input type="radio" value={id} className="accent-[var(--ac)]" {...seleccionMedio} onChange={(event) => {
                void seleccionMedio.onChange(event);
                setValue('cargarDetalle', id === 'cheque' || id === 'echeq');
              }} />{nombre}
            </label>
          ))}
        </div>
      </fieldset>
      {campos && <>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="accent-[var(--ac)]" {...register('cargarDetalle')} />¿Cargar los datos {nombres[medio as keyof typeof nombres]}?</label>
        {cargar && <div className="grid gap-3 rounded-[10px] border border-solid border-[var(--ln)] p-3 min-[560px]:grid-cols-2">
          {campos.map(([id, nombre]) => <label key={id} className="grid gap-1.5 text-[14.5px] font-medium">{nombre}<input className={campo} type={id === 'fcobro' ? 'date' : 'text'} {...register(id)} /></label>)}
        </div>}
        {errors.fcobro && <p role="alert" className="text-sm text-[var(--bad)]">{errors.fcobro.message}</p>}
      </>}
    </>
  );
}
