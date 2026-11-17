/** Egyptian mobile numbers -> international digits for wa.me (01012345678 -> 201012345678). */
export function waNumber(phone: string): string {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '20' + d.slice(1);
  return d;
}
export const waLink = (phone: string, text: string) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
