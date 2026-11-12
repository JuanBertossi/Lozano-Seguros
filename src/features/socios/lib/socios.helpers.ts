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
