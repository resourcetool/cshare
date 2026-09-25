import { AppRegistry } from 'react-native';
import notifee from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import BackgroundFetch from 'react-native-background-fetch';
import App from './src/App';
import CallReminderRoot from './src/screens/CallReminderRoot';
import { handlePush, headlessSync } from './src/services/backgroundSync';
import { name as appName } from './app.json';

// Required by Notifee so background events are accepted (reminders are Android alarms; nothing to do here).
notifee.onBackgroundEvent(async () => {});

// Works with the app closed:
//  1) Android wakes this every ~15+ minutes when the phone has internet (and after a restart)
BackgroundFetch.registerHeadlessTask(headlessSync);
//  2) if Cloud Functions are deployed, a push message triggers the same sync immediately
messaging().setBackgroundMessageHandler(async message => {
  try {
    await handlePush(message.data);
  } catch (e) {
    console.warn('[CSHARE] push handler', e);
  }
});

AppRegistry.registerComponent(appName, () => App);
// Small separate root used by the call-style reminder activity (see android/.../CallActivity.kt)
AppRegistry.registerComponent('CshareCall', () => CallReminderRoot);
