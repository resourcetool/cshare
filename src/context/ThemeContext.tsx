import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, makeText, Palette, TextStyles } from '../theme';
import { logError } from '../utils/errors';

export type AppearanceMode = 'system' | 'light' | 'dark';
const KEY = '@cshare/appearance';

interface ThemeValue {
  /** what the person picked: "system" (default), "light" or "dark" */
  mode: AppearanceMode;
  /** what is actually showing right now, after resolving "system" against the OS setting */
  scheme: 'light' | 'dark';
  palette: Palette;
  text: TextStyles;
  setMode: (m: AppearanceMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<AppearanceMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => {
        if (raw === 'light' || raw === 'dark' || raw === 'system') setModeState(raw);
      })
      .catch(e => logError('load appearance', e))
      .finally(() => setLoaded(true));
  }, []);

  const setMode = (m: AppearanceMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(e => logError('save appearance', e));
  };

  const scheme: 'light' | 'dark' = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const palette = scheme === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeValue>(
    () => ({ mode, scheme, palette, text: makeText(palette), setMode }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, scheme, palette],
  );

  // Don't render with the wrong theme for one frame while AsyncStorage loads.
  if (!loaded) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme() must be used inside <ThemeProvider>');
  return v;
}
