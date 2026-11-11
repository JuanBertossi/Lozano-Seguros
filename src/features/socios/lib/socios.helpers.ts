export interface SocioBase {
  id: string;
  nombre: string;
  nro: string | number;
  activo: boolean;
}

export function proximoNumeroSocio(socios: SocioBase[]): string {
  return String(socios.reduce((maximo, socio) => Math.max(maximo, parseInt(String(socio.nro)) || 0), 0) + 1);
}

export function buscarSocioPorNombre<T extends SocioBase>(socios: T[], nombre: string): T | undefined {
  const normalizado = nombre.trim().toLowerCase();
  return socios.find((socio) => socio.nombre.trim().toLowerCase() === normalizado);
}

export function numeroWhatsApp(telefono: string): string {
  let numero = String(telefono).replace(/\D/g, '').replace(/^00/, '').replace(/^54/, '').replace(/^9/, '').replace(/^0/, '');
  if (numero.length === 12) {
    for (const indice of [2, 3, 4]) {
      if (numero.substring(indice, indice + 2) === '15') {
        numero = numero.slice(0, indice) + numero.slice(indice + 2);
        break;
      }
    }
  }
  return numero.length === 10 ? `549${numero}` : '';
}
