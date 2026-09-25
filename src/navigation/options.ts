import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Palette } from '../theme';

export const tabScreenOptions = (palette: Palette): BottomTabNavigationOptions => ({
  headerStyle: { backgroundColor: palette.surface },
  headerTitleStyle: { fontSize: 20, fontWeight: '700', color: palette.ink },
  tabBarActiveTintColor: palette.primary,
  tabBarInactiveTintColor: palette.muted,
  tabBarStyle: { height: 72, paddingTop: 6, backgroundColor: palette.surface, borderTopColor: palette.line },
  tabBarLabelStyle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
});

export const stackScreenOptions = (palette: Palette): NativeStackNavigationOptions => ({
  headerStyle: { backgroundColor: palette.surface },
  headerTintColor: palette.primary,
  headerTitleStyle: { fontSize: 20, fontWeight: '700', color: palette.ink },
  contentStyle: { backgroundColor: palette.bg },
});
