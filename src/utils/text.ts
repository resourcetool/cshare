/** Keep digits and a leading +, so the phone/SMS apps accept it. */
export function cleanPhone(phone: string): string {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^0-9]/g, '');
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}
