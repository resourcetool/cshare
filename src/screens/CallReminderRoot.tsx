import React, { useEffect } from 'react';
import { BackHandler, Linking, StatusBar, StyleSheet, Text, Vibration, View } from 'react-native';
import Sound from 'react-native-sound';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '../theme';

/**
 * Separate root component shown by CallActivity when the final reminder is tapped
 * (or shown over the lock screen when Android allows a full-screen alert).
 * It looks like an incoming call but is only a CSHARE screen: no phone call is made.
 */
function CallReminder() {
  const insets = useSafeAreaInsets();
  const close = () => BackHandler.exitApp(); // finishes this activity only

  useEffect(() => {
    Sound.setCategory('Playback');
    const ring = new Sound('cshare_ring', Sound.MAIN_BUNDLE, error => {
      if (error) return; // no sound is fine, the notification already vibrated
      ring.setNumberOfLoops(-1);
      ring.play();
    });
    Vibration.vibrate([0, 700, 500], true);
    const stopAfter = setTimeout(close, 60000); // never ring forever
    return () => {
      clearTimeout(stopAfter);
      Vibration.cancel();
      ring.stop();
      ring.release();
    };
  }, []);

  const openApp = async () => {
    try {
      await Linking.openURL('cshare://open');
    } finally {
      close();
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.call} />
      <View style={styles.top}>
        <Text style={styles.brand} maxFontSizeMultiplier={1.3}>CSHARE</Text>
        <Text style={styles.headline} maxFontSizeMultiplier={1.3}>You have an assignment</Text>
        <Text style={styles.body} maxFontSizeMultiplier={1.3}>Please check the CSHARE app for your assignment.</Text>
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Text accessibilityRole="button" accessibilityLabel="Dismiss" onPress={close} style={[styles.circle, { backgroundColor: '#C7382F' }]}>✕</Text>
          <Text style={styles.actionLabel}>Dismiss</Text>
        </View>
        <View style={styles.action}>
          <Text accessibilityRole="button" accessibilityLabel="Open CSHARE" onPress={openApp} style={[styles.circle, { backgroundColor: '#1F9D5C' }]}>➜</Text>
          <Text style={styles.actionLabel}>Open CSHARE</Text>
        </View>
      </View>
    </View>
  );
}

export default function CallReminderRoot() {
  return (
    <SafeAreaProvider>
      <CallReminder />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.call, justifyContent: 'space-between', paddingHorizontal: space.xl },
  top: { alignItems: 'center', marginTop: space.xxl },
  brand: { color: '#9FB4D9', fontSize: 22, fontWeight: '700', letterSpacing: 4 },
  headline: { color: '#FFFFFF', fontSize: 34, fontWeight: '700', textAlign: 'center', marginTop: space.xl },
  body: { color: '#D7E1F3', fontSize: 20, lineHeight: 28, textAlign: 'center', marginTop: space.lg },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: space.xxl },
  action: { alignItems: 'center' },
  circle: { width: 88, height: 88, borderRadius: radius.pill, overflow: 'hidden', color: '#FFFFFF', fontSize: 36, textAlign: 'center', textAlignVertical: 'center', lineHeight: 88 },
  actionLabel: { color: '#FFFFFF', fontSize: 18, marginTop: space.md, fontWeight: '600' },
});
