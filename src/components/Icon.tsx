import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export type IconName =
  | 'home'
  | 'calendar'
  | 'report'
  | 'phone'
  | 'settings'
  | 'planner'
  | 'meeting'
  | 'people'
  | 'groups'
  | 'attention'
  | 'refresh'
  | 'arrow-right'
  | 'arrow-left'
  | 'close'
  | 'check'
  | 'eye'
  | 'part'
  | 'song'
  | 'prayer'
  | 'comment'
  | 'book'
  | 'diamond'
  | 'home-part'
  | 'education'
  | 'pin'
  | 'grid';

const legacyIconMap: Record<string, IconName> = {
  '🎤': 'part',
  '🎵': 'song',
  '🙏': 'prayer',
  '💬': 'comment',
  '📖': 'book',
  '💎': 'diamond',
  '🗣️': 'comment',
  '🏠': 'home-part',
  '👥': 'people',
  '📚': 'book',
  '🎓': 'education',
  '📌': 'pin',
  '🗓️': 'planner',
  '📋': 'meeting',
  '📊': 'report',
  '🧭': 'groups',
  '⚙️': 'settings',
  '📅': 'calendar',
  '📝': 'report',
  '📞': 'phone',
  '👁': 'eye',
};

export function iconNameForLegacy(value: string): IconName {
  return legacyIconMap[value] ?? 'grid';
}

export function Icon({ name, size = 22, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const { palette } = useTheme();
  const tint = color ?? palette.primary;
  const stroke = Math.max(1.5, size * 0.075);
  const common = { borderColor: tint, borderWidth: stroke } as const;
  const s = size;

  if (name === 'home' || name === 'home-part') {
    return (
      <View style={[styles.box, { width: s, height: s }, style]}>
        <View style={[styles.homeRoof, { width: s * 0.58, height: s * 0.58, left: s * 0.21, top: s * 0.12, borderLeftWidth: stroke, borderTopWidth: stroke, borderColor: tint }]} />
        <View style={[common, { position: 'absolute', width: s * 0.52, height: s * 0.39, left: s * 0.24, top: s * 0.42, borderTopWidth: 0, borderRadius: 2 }]} />
        <View style={{ position: 'absolute', width: s * 0.12, height: s * 0.22, left: s * 0.44, top: s * 0.59, backgroundColor: tint, borderRadius: 1 }} />
      </View>
    );
  }

  if (name === 'calendar' || name === 'planner') {
    return (
      <View style={[styles.box, { width: s, height: s }, style]}>
        <View style={[common, { position: 'absolute', left: s * 0.12, top: s * 0.18, width: s * 0.76, height: s * 0.7, borderRadius: 3 }]} />
        <View style={{ position: 'absolute', left: s * 0.12, top: s * 0.38, width: s * 0.76, height: stroke, backgroundColor: tint }} />
        <View style={{ position: 'absolute', left: s * 0.29, top: s * 0.1, width: stroke, height: s * 0.18, backgroundColor: tint, borderRadius: 2 }} />
        <View style={{ position: 'absolute', left: s * 0.65, top: s * 0.1, width: stroke, height: s * 0.18, backgroundColor: tint, borderRadius: 2 }} />
        {name === 'planner' ? <View style={{ position: 'absolute', left: s * 0.28, top: s * 0.52, width: s * 0.44, height: stroke, backgroundColor: tint }} /> : null}
      </View>
    );
  }

  if (name === 'report') {
    return (
      <View style={[styles.box, { width: s, height: s }, style]}>
        <View style={[common, { position: 'absolute', left: s * 0.18, top: s * 0.1, width: s * 0.62, height: s * 0.8, borderRadius: 3 }]} />
        <View style={{ position: 'absolute', left: s * 0.31, top: s * 0.34, width: s * 0.36, height: stroke, backgroundColor: tint }} />
        <View style={{ position: 'absolute', left: s * 0.31, top: s * 0.52, width: s * 0.36, height: stroke, backgroundColor: tint }} />
        <View style={{ position: 'absolute', left: s * 0.31, top: s * 0.7, width: s * 0.24, height: stroke, backgroundColor: tint }} />
      </View>
    );
  }

  if (name === 'phone') {
    return (
      <View style={[styles.box, { width: s, height: s }, style]}>
        <View style={{ width: s * 0.42, height: s * 0.72, borderLeftWidth: stroke, borderBottomWidth: stroke, borderColor: tint, borderRadius: s * 0.24, transform: [{ rotate: '-38deg' }] }} />
        <View style={{ position: 'absolute', width: s * 0.2, height: stroke, backgroundColor: tint, left: s * 0.1, top: s * 0.27, transform: [{ rotate: '-38deg' }] }} />
        <View style={{ position: 'absolute', width: s * 0.2, height: stroke, backgroundColor: tint, right: s * 0.1, bottom: s * 0.27, transform: [{ rotate: '-38deg' }] }} />
      </View>
    );
  }

  if (name === 'settings') {
    return (
      <View style={[styles.box, { width: s, height: s }, style]}>
        <View style={{ width: s * 0.48, height: s * 0.48, borderRadius: 999, borderWidth: stroke, borderColor: tint }} />
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ position: 'absolute', width: stroke, height: s * 0.2, backgroundColor: tint, borderRadius: 2, transform: [{ rotate: `${i * 45 + 22.5}deg` }] }} />
        ))}
      </View>
    );
  }

  if (name === 'people' || name === 'groups') {
    return (
      <View style={[styles.box, { width: s, height: s }, style]}>
        <View style={[styles.head, { width: s * 0.22, height: s * 0.22, left: s * 0.39, top: s * 0.13, borderColor: tint, borderWidth: stroke }]} />
        <View style={[styles.shoulder, { width: s * 0.46, height: s * 0.28, left: s * 0.27, top: s * 0.49, borderColor: tint, borderWidth: stroke, borderBottomWidth: 0, borderRadius: s }]} />
        {name === 'groups' ? <>
          <View style={[styles.head, { width: s * 0.16, height: s * 0.16, left: s * 0.08, top: s * 0.25, borderColor: tint, borderWidth: stroke }]} />
          <View style={[styles.head, { width: s * 0.16, height: s * 0.16, right: s * 0.08, top: s * 0.25, borderColor: tint, borderWidth: stroke }]} />
        </> : null}
      </View>
    );
  }

  if (name === 'meeting' || name === 'comment') {
    return (
      <View style={[styles.box, { width: s, height: s }, style]}>
        <View style={[common, { position: 'absolute', left: s * 0.1, top: s * 0.18, width: s * 0.8, height: s * 0.56, borderRadius: s * 0.12 }]} />
        <View style={{ position: 'absolute', left: s * 0.27, top: s * 0.68, width: s * 0.2, height: stroke, backgroundColor: tint, transform: [{ rotate: '35deg' }] }} />
        <View style={{ position: 'absolute', left: s * 0.29, top: s * 0.43, width: s * 0.42, height: stroke, backgroundColor: tint }} />
      </View>
    );
  }

  if (name === 'attention') return <Text style={[styles.symbol, { fontSize: s, color: tint }, style as StyleProp<TextStyle>]}>!</Text>;
  if (name === 'refresh') return <Text style={[styles.symbol, { fontSize: s * 0.95, color: tint }, style as StyleProp<TextStyle>]}>↻</Text>;
  if (name === 'arrow-right') return <Text style={[styles.symbol, { fontSize: s * 0.9, color: tint }, style as StyleProp<TextStyle>]}>›</Text>;
  if (name === 'arrow-left') return <Text style={[styles.symbol, { fontSize: s * 0.9, color: tint }, style as StyleProp<TextStyle>]}>‹</Text>;
  if (name === 'close') return <Text style={[styles.symbol, { fontSize: s * 0.8, color: tint }, style as StyleProp<TextStyle>]}>×</Text>;
  if (name === 'check') return <Text style={[styles.symbol, { fontSize: s * 0.8, color: tint }, style as StyleProp<TextStyle>]}>✓</Text>;
  if (name === 'eye') return (
    <View style={[styles.box, { width: s, height: s * 0.7 }, style]}>
      <View style={{ width: s * 0.78, height: s * 0.46, borderWidth: stroke, borderColor: tint, borderRadius: s, transform: [{ rotate: '0deg' }] }} />
      <View style={{ position: 'absolute', width: s * 0.16, height: s * 0.16, borderRadius: 999, backgroundColor: tint }} />
    </View>
  );
  if (name === 'part') return <Text style={[styles.symbol, { fontSize: s * 0.9, color: tint }, style as StyleProp<TextStyle>]}>◌</Text>;
  if (name === 'song') return <Text style={[styles.symbol, { fontSize: s * 0.9, color: tint }, style as StyleProp<TextStyle>]}>♫</Text>;
  if (name === 'prayer') return <Text style={[styles.symbol, { fontSize: s * 0.9, color: tint }, style as StyleProp<TextStyle>]}>+</Text>;
  if (name === 'book') return <Text style={[styles.symbol, { fontSize: s * 0.85, color: tint }, style as StyleProp<TextStyle>]}>▤</Text>;
  if (name === 'diamond') return <Text style={[styles.symbol, { fontSize: s * 0.8, color: tint }, style as StyleProp<TextStyle>]}>◇</Text>;
  if (name === 'education') return <Text style={[styles.symbol, { fontSize: s * 0.85, color: tint }, style as StyleProp<TextStyle>]}>▱</Text>;
  if (name === 'pin') return <Text style={[styles.symbol, { fontSize: s * 0.9, color: tint }, style as StyleProp<TextStyle>]}>⌖</Text>;
  return (
    <View style={[styles.box, { width: s, height: s }, style]}>
      <View style={[common, { position: 'absolute', width: s * 0.34, height: s * 0.34, left: s * 0.08, top: s * 0.08, borderRadius: 3 }]} />
      <View style={[common, { position: 'absolute', width: s * 0.34, height: s * 0.34, right: s * 0.08, top: s * 0.08, borderRadius: 3 }]} />
      <View style={[common, { position: 'absolute', width: s * 0.34, height: s * 0.34, left: s * 0.08, bottom: s * 0.08, borderRadius: 3 }]} />
      <View style={[common, { position: 'absolute', width: s * 0.34, height: s * 0.34, right: s * 0.08, bottom: s * 0.08, borderRadius: 3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  symbol: { fontWeight: '400', includeFontPadding: false, textAlign: 'center' },
  homeRoof: { position: 'absolute', transform: [{ rotate: '45deg' }] },
  head: { position: 'absolute', borderRadius: 999 },
  shoulder: { position: 'absolute', borderRadius: 999 },
});
