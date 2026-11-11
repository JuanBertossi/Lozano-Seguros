import { useMemo } from 'react';

export interface DatosBusqueda {
  socios: { id: string; nombre: string; nro: string | number; dni?: string; fijos: { numero: string | number }[] }[];
  loteria: { sid: string; numero: string | number; soId: string }[];
  sorteos: { id: string; nombre: string }[];
  rifas: { sid: string; nro: string | number; anio: number | string }[];
}

export function useBusquedaPanel(datos: DatosBusqueda, consulta: string) {
  return useMemo(() => {
    const texto = consulta.trim().toLowerCase();
    if (!texto) return [];
    const resultados: { id: string; principal: string; secundario: string }[] = [];
    const nombres = new Map(datos.socios.map((socio) => [socio.id, socio.nombre]));
    const sorteos = new Map(datos.sorteos.map((sorteo) => [sorteo.id, sorteo.nombre]));
    for (const socio of datos.socios) {
      if (socio.nombre.toLowerCase().includes(texto) || String(socio.nro).toLowerCase() === texto || (socio.dni || '').includes(texto))
        resultados.push({ id: socio.id, principal: socio.nombre, secundario: `Socio ${socio.nro}` });
    }
    for (const venta of datos.loteria) {
      if (String(venta.numero).includes(texto))
        resultados.push({ id: venta.sid, principal: `${venta.numero} · ${nombres.get(venta.sid) || '(socio borrado)'}`, secundario: sorteos.get(venta.soId) || '' });
    }
    for (const socio of datos.socios) for (const fijo of socio.fijos) {
      if (String(fijo.numero).includes(texto))
        resultados.push({ id: socio.id, principal: `${fijo.numero} · ${socio.nombre}`, secundario: 'Número fijo' });
    }
    for (const rifa of datos.rifas) {
      if (String(rifa.nro).includes(texto))
        resultados.push({ id: rifa.sid, principal: `Rifa ${rifa.nro} · ${nombres.get(rifa.sid) || '(socio borrado)'}`, secundario: String(rifa.anio) });
    }
    return resultados.slice(0, 12);
  }, [datos, consulta]);
}
