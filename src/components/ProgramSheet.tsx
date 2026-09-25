import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DisplayStatus, ProgramRow } from '../types';
import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme';
import { formatTime } from '../utils/dates';
import { assigneeText, formatMinutes, programSections, rowHeading, rowNumbers } from '../utils/program';
import { BANDS } from '../utils/sheetShare';
import { Badge, IconBadge, Small } from './ui';

interface Props {
  rows: ProgramRow[];
  /** the signed-in person: their own parts are highlighted */
  uid?: string;
  minutesFormat?: string;
  /** administrators: tapping a line opens it for editing */
  onPressRow?: (row: ProgramRow) => void;
  /** administrators: what each assigned person answered, per line */
  statuses?: Record<string, DisplayStatus[]>;
}

function summary(list: DisplayStatus[]): { label: string; tone: 'good' | 'bad' | 'info' | 'neutral' } | null {
  if (list.length === 0) return null;
  if (list.includes('cannot_do')) return { label: "Can't do", tone: 'bad' };
  const seen = list.filter(s => s === 'seen').length;
  if (seen === list.length) return { label: 'Seen', tone: 'good' };
  if (seen > 0) return { label: `${seen}/${list.length} seen`, tone: 'info' };
  return { label: 'Not seen', tone: 'neutral' };
}

/** The meeting sheet: coloured section bands, each line with its name(s) underneath (like the printed sheet). */
export function ProgramSheet({ rows, uid, minutesFormat = '{n} min', onPressRow, statuses }: Props) {
  const { palette } = useTheme();
  const nums = rowNumbers(rows);
  const numbers = new Map(rows.map((r, i) => [r.id, nums[i]]));
  return (
    <View>
      {programSections(rows).map((section, si) => (
        <View key={`${section.section}-${si}`} style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <View style={[styles.band, { backgroundColor: BANDS[si % BANDS.length] }]}>
            <Text style={styles.bandText} maxFontSizeMultiplier={1.4}>{section.section.toUpperCase()}</Text>
          </View>
          {section.rows.map((r, i) => {
            const mine = !!uid && r.assigneeIds.includes(uid);
            const n = numbers.get(r.id);
            const who = assigneeText(r);
            const badge = statuses && r.kind === 'part' ? summary(statuses[r.id] ?? []) : null;
            const mins = r.kind !== 'song' && r.minutes > 0 ? `  (${formatMinutes(minutesFormat, r.minutes)})` : '';
            const body = (
              <View style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: palette.line }, mine && { backgroundColor: palette.goodSoft }]}>
                <IconBadge icon={r.icon} size={38} tint={mine ? '#BFE3D0' : palette.primarySoft} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text style={[styles.heading, { color: palette.ink }]} maxFontSizeMultiplier={1.4}>{n ? `${n}. ` : ''}{rowHeading(r)}{mins}</Text>
                  {r.kind === 'part' ? (
                    who ? (
                      <Text style={[styles.who, { color: palette.primary }]} maxFontSizeMultiplier={1.4}>{who}</Text>
                    ) : onPressRow ? (
                      <Text style={[styles.assign, { color: palette.muted }]} maxFontSizeMultiplier={1.4}>＋ Tap to assign</Text>
                    ) : (
                      <Small>Not assigned yet</Small>
                    )
                  ) : null}
                  {r.startTime && onPressRow ? <Small>{formatTime(r.startTime)}</Small> : null}
                </View>
                {mine ? <Badge label="You" tone="good" /> : badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
              </View>
            );
            return onPressRow ? (
              <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Edit ${rowHeading(r)}`} onPress={() => onPressRow(r)} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
                {body}
              </Pressable>
            ) : (
              <View key={r.id}>{body}</View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: radius.md, borderWidth: 1, marginBottom: space.lg, overflow: 'hidden' },
  band: { paddingVertical: space.sm, paddingHorizontal: space.lg },
  bandText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', padding: space.md, minHeight: 64 },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: '700' },
  who: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  assign: { fontSize: 16, lineHeight: 22, fontStyle: 'italic' },
});
