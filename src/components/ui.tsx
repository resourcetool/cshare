import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Palette, radius, space, TextStyles, TOUCH } from '../theme';
import { Tone } from '../utils/status';

function useStyles() {
  const { palette, text } = useTheme();
  return useMemo(() => ({ s: makeStyles(palette), text, palette }), [palette, text]);
}

type TextVariant = keyof TextStyles;
type TextProps = { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

function ThemedText({ variant, children, style, numberOfLines }: TextProps & { variant: TextVariant }) {
  const { text } = useTheme();
  return (
    <Text style={[text[variant], style]} numberOfLines={numberOfLines} maxFontSizeMultiplier={1.5}>
      {children}
    </Text>
  );
}
export const Title = (p: TextProps) => <ThemedText variant="title" {...p} />;
export const Heading = (p: TextProps) => <ThemedText variant="heading" {...p} />;
export const Body = (p: TextProps) => <ThemedText variant="body" {...p} />;
export const Small = (p: TextProps) => <ThemedText variant="small" {...p} />;
export const Label = (p: TextProps) => <ThemedText variant="label" {...p} />;

// ------------------------------------------------------------------ Button
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const { s, palette } = useStyles();
  const off = disabled || loading;
  const fg = variant === 'primary' || variant === 'danger' ? palette.onPrimary : palette.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.button,
        variant === 'primary' && { backgroundColor: palette.primary },
        variant === 'danger' && { backgroundColor: palette.bad },
        variant === 'secondary' && { backgroundColor: palette.surface, borderWidth: 2, borderColor: palette.primary },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        pressed && { opacity: 0.8 },
        off && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[s.buttonText, { color: fg }]} maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ------------------------------------------------------------------ Card, Badge, Notice
export function Card({ children, style, onPress, accessibilityLabel }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { s } = useStyles();
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }, style]}>
      {children}
    </Pressable>
  );
}

function tones(palette: Palette): Record<Tone, { bg: string; fg: string }> {
  return {
    good: { bg: palette.goodSoft, fg: palette.good },
    warn: { bg: palette.warnSoft, fg: palette.warn },
    bad: { bg: palette.badSoft, fg: palette.bad },
    info: { bg: palette.infoSoft, fg: palette.info },
    neutral: { bg: palette.neutralSoft, fg: palette.muted },
  };
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { s, palette } = useStyles();
  const t = tones(palette)[tone];
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={[s.badgeText, { color: t.fg }]} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </View>
  );
}

export function Notice({ tone = 'info', message, actionLabel, onAction }: {
  tone?: Tone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { s, text, palette } = useStyles();
  const t = tones(palette)[tone];
  return (
    <View style={[s.notice, { backgroundColor: t.bg }]} accessibilityLiveRegion="polite">
      <Text style={[text.body, { color: t.fg }]} maxFontSizeMultiplier={1.5}>
        {message}
      </Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}

export function LoadingView({ message = 'Loading…' }: { message?: string }) {
  const { s, text, palette } = useStyles();
  return (
    <View style={s.center} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={palette.primary} />
      <Text style={[text.body, { marginTop: space.md }]}>{message}</Text>
    </View>
  );
}

export function EmptyState({ title, message, actionLabel, onAction }: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { s, palette } = useStyles();
  return (
    <View style={s.empty}>
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      {message ? <Body style={{ textAlign: 'center', color: palette.muted, marginTop: space.sm }}>{message}</Body> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={{ marginTop: space.lg, alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

// ------------------------------------------------------------------ Form controls
export function TextField({
  label, value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry, autoCapitalize, error, editable = true, maxLength, hint, autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string | null;
  editable?: boolean;
  maxLength?: number;
  hint?: string;
  autoComplete?: 'email' | 'password' | 'name' | 'tel' | 'off' | 'new-password' | 'current-password';
}) {
  const { s, palette } = useStyles();
  return (
    <View style={{ marginBottom: space.lg }}>
      <Label style={{ marginBottom: space.xs }}>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        editable={editable}
        maxLength={maxLength}
        style={[s.input, multiline && { minHeight: 110, textAlignVertical: 'top' }, !editable && { backgroundColor: palette.surfaceAlt }, error ? { borderColor: palette.bad } : null]}
      />
      {hint && !error ? <Small style={{ marginTop: space.xs }}>{hint}</Small> : null}
      {error ? <Small style={{ color: palette.bad, marginTop: space.xs }}>{error}</Small> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, disabled }: { label: string; selected?: boolean; onPress: () => void; disabled?: boolean }) {
  const { s, text, palette } = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[s.chip, selected && { backgroundColor: palette.primary, borderColor: palette.primary }, disabled && { opacity: 0.5 }]}>
      <Text style={[text.body, { color: selected ? palette.onPrimary : palette.ink }]} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  const { s } = useStyles();
  return <View style={s.chipRow}>{children}</View>;
}

export function SwitchRow({ label, description, value, onValueChange, disabled }: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { s, palette } = useStyles();
  return (
    <View style={s.switchRow}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Label>{label}</Label>
        {description ? <Small>{description}</Small> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: palette.line, true: palette.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export function IconBadge({ icon, size = 44, tint }: { icon: string; size?: number; tint?: string }) {
  const { palette } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint ?? palette.primarySoft, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ fontSize: size * 0.5 }}>{icon}</Text>
    </View>
  );
}

/** − 7 min +  */
export function Stepper({ label, value, onChange, min = 0, max = 60, suffix = '' }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const { s, text } = useStyles();
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <View style={s.stepper} accessibilityLabel={`${label}: ${value}${suffix}`}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Less ${label}`} onPress={() => step(-1)} style={s.stepBtn}>
        <Text style={s.stepBtnText}>−</Text>
      </Pressable>
      <Text style={[text.label, { minWidth: 64, textAlign: 'center' }]} maxFontSizeMultiplier={1.3}>{value}{suffix}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`More ${label}`} onPress={() => step(1)} style={s.stepBtn}>
        <Text style={s.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Heading style={{ marginTop: space.xl, marginBottom: space.md }}>{children}</Heading>;
}

function makeStyles(palette: Palette) {
  return StyleSheet.create({
    button: { minHeight: TOUCH, borderRadius: radius.md, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
    buttonText: { fontSize: 18, fontWeight: '700' },
    card: { backgroundColor: palette.surface, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md, borderWidth: 1, borderColor: palette.line },
    badge: { alignSelf: 'flex-start', paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill },
    badgeText: { fontSize: 14, fontWeight: '700' },
    notice: { borderRadius: radius.md, padding: space.lg, marginBottom: space.lg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
    empty: { alignItems: 'center', padding: space.xl, marginTop: space.xl },
    input: { minHeight: TOUCH, borderWidth: 1.5, borderColor: palette.line, borderRadius: radius.md, backgroundColor: palette.surface, paddingHorizontal: space.lg, paddingVertical: space.md, fontSize: 18, color: palette.ink },
    chip: { minHeight: 48, paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: palette.line, backgroundColor: palette.surface, marginRight: space.sm, marginBottom: space.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
    stepper: { flexDirection: 'row', alignItems: 'center' },
    stepBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
    stepBtnText: { fontSize: 26, fontWeight: '700', color: palette.primary, lineHeight: 30 },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: TOUCH, paddingVertical: space.sm },
  });
}
