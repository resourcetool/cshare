import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette, space } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useOptionalAppData } from '../context/AppDataContext';
import { OfflineBanner } from './OfflineBanner';

interface ScreenProps {
  children: React.ReactNode;
  /** false for screens that manage their own scrolling (long lists) */
  scroll?: boolean;
  /** buttons pinned to the bottom of the screen */
  footer?: React.ReactNode;
  /** true for screens that are not inside a navigator header (sign-in etc.) */
  standalone?: boolean;
  /** true inside the bottom tab bar (which already keeps clear of the screen edge) */
  inTabs?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, scroll = true, footer, standalone, inTabs, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const data = useOptionalAppData();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await data?.reload();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <View style={[styles.root, standalone && { paddingTop: insets.top }]}>
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={data ? <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[palette.primary]} tintColor={palette.primary} /> : undefined}
          contentContainerStyle={[styles.content, contentStyle]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: inTabs ? space.md : Math.max(insets.bottom, space.md) }]}>{footer}</View> : null}
    </View>
  );
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.bg },
    content: { padding: space.lg, paddingBottom: space.xxl },
    footer: { padding: space.lg, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.line },
  });
}
