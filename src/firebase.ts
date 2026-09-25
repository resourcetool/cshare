import firestore from '@react-native-firebase/firestore';
import { logError } from './utils/errors';

// Firestore's own offline cache does all the synchronisation work. It is on by default on
// Android; we state it explicitly so nobody turns it off by accident.
firestore()
  .settings({ persistence: true })
  .catch(e => logError('firestore settings', e));

export { firestore };
