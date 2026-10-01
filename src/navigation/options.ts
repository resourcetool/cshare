import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Palette } from '../theme';

export const tabScreenOptions = (palette: Palette, bottomInset = 0): BottomTabNavigationOptions => ({
  headerStyle: { backgroundColor: palette.surface, elevation: 0, shadowOpacity: 0 },
  headerTitleStyle: { fontSize: 18, fontWeight: '700', color: palette.ink },
  headerShadowVisible: false,
  tabBarActiveTintColor: palette.primary,
  tabBarInactiveTintColor: palette.muted,
  tabBarStyle: {
    height: 66 + bottomInset,
    paddingTop: 6,
    paddingBottom: 7 + bottomInset,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    elevation: 8,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  tabBarItemStyle: { paddingVertical: 1 },
});

export const stackScreenOptions = (palette: Palette): NativeStackNavigationOptions => ({
  headerStyle: { backgroundColor: palette.surface },
  headerTintColor: palette.primary,
  headerTitleStyle: { fontSize: 18, fontWeight: '700', color: palette.ink },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: palette.bg },
});
