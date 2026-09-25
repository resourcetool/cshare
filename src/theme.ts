import { TextStyle } from 'react-native';

export type Palette = typeof lightColors;

/** Calm, restrained, professional — not a "colourful cards" palette. */
export const lightColors = {
  bg: '#F3F6F6',
  surface: '#FFFFFF',
  surfaceAlt: '#EBF0F1',
  ink: '#14252D',
  muted: '#55666E',
  placeholder: '#8A989F',
  line: '#D5DEE1',
  primary: '#0E5A66',
  primarySoft: '#DDEDEF',
  onPrimary: '#FFFFFF',
  good: '#1B7A4B',
  goodSoft: '#DFF1E7',
  warn: '#9A5B00',
  warnSoft: '#FCEBCB',
  bad: '#B3261E',
  badSoft: '#F9DEDC',
  info: '#35568A',
  infoSoft: '#E1E9F6',
  neutralSoft: '#E7ECEE',
  call: '#101C36',
  overlay: 'rgba(10, 20, 24, 0.5)',
};

/** Not an inverted light theme — chosen so the same design still reads calm and legible at night. */
export const darkColors: Palette = {
  bg: '#0E1416',
  surface: '#182226',
  surfaceAlt: '#1F2B30',
  ink: '#EAF1F2',
  muted: '#A9BAC0',
  placeholder: '#6E8189',
  line: '#33454B',
  primary: '#5FC4D2',
  primarySoft: '#1E3A3F',
  onPrimary: '#052226',
  good: '#7BD6A6',
  goodSoft: '#173A2A',
  warn: '#F0BE6E',
  warnSoft: '#3E2E10',
  bad: '#F5978F',
  badSoft: '#3E1B18',
  info: '#9CBCF2',
  infoSoft: '#1D2B45',
  neutralSoft: '#26343A',
  call: '#0B1220',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** Kept as the default palette for any code path that hasn't been switched over to useTheme() yet
 * (so the app still looks correct in light mode there); everything theme-aware uses useTheme(). */
export const colors = lightColors;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const TOUCH = 56;

export type TextStyles = Record<'title' | 'heading' | 'body' | 'small' | 'label', TextStyle>;

export function makeText(palette: Palette): TextStyles {
  return {
    title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: palette.ink },
    heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: palette.ink },
    body: { fontSize: 17, lineHeight: 24, color: palette.ink },
    small: { fontSize: 15, lineHeight: 21, color: palette.muted },
    label: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: palette.ink },
  };
}

/** Kept for any not-yet-converted call site; theme-aware code should use useTheme() + makeText(). */
export const text = makeText(lightColors);
