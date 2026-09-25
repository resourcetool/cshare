import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { space } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/** Quiet strip at the top of every screen: offline notice, then "Synced" for a moment. */
export function OfflineBanner() {
  const { online, justSynced } = useOnlineStatus();
  const { palette } = useTheme();
  if (online && !justSynced) return null;
  return (
    <View style={[styles.bar, { backgroundColor: online ? palette.good : '#3A4A52' }]} accessibilityLiveRegion="polite">
      <Text style={styles.text} maxFontSizeMultiplier={1.3}>
        {online ? 'Synced' : 'Offline — Showing saved information'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingVertical: space.sm, paddingHorizontal: space.lg },
  text: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
