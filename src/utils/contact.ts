import { Alert, Linking } from 'react-native';
import { cleanPhone } from './text';

async function open(url: string, what: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(`Could not ${what}`, `This phone could not open the ${what === 'call' ? 'phone' : 'messages'} app.`);
  }
}

/** Opens the phone's dialler with the number filled in (the person presses call). */
export function callNumber(phone: string) {
  return open(`tel:${cleanPhone(phone)}`, 'call');
}

/** Opens the phone's messages app with an optional ready-written text. */
export function textNumber(phone: string, body?: string) {
  const query = body ? `?body=${encodeURIComponent(body)}` : '';
  return open(`sms:${cleanPhone(phone)}${query}`, 'send a text');
}
