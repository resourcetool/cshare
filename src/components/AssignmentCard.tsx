import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Assignment, UserProfile } from '../types';
import { formatDayWithYear, formatTimeRange } from '../utils/dates';
import { statusFor, statusLabel, statusTone } from '../utils/status';
import { meetsRequiredRole } from '../utils/qualifications';
import { useTheme } from '../context/ThemeContext';
import { space } from '../theme';
import { Badge, Body, Card, Heading, IconBadge, Small } from './ui';

interface Props {
  assignment: Assignment;
  /** the signed-in person */
  uid: string;
  variant: 'user' | 'admin';
  onPress: () => void;
  /** admins: used to warn about people who are not marked as qualified */
  usersById?: Record<string, UserProfile>;
  showDay?: boolean;
  highlight?: boolean;
  /** e.g. "Weekend Meeting", shown above the title */
  meetingName?: string;
}

export function AssignmentCard({ assignment: a, uid, variant, onPress, usersById, showDay = true, highlight, meetingName }: Props) {
  const { palette } = useTheme();
  const when = `${showDay ? formatDayWithYear(a.date, new Date()) + ', ' : ''}${formatTimeRange(a.startTime, a.endTime)}`;
  const label = `${a.title}, ${when}`;

  if (variant === 'user') {
    const s = statusFor(a, uid);
    const isChild = a.childAssignees?.includes(uid);
    const others = a.assigneeIds.filter(id => id !== uid).map(id => a.assigneeNames[id] ?? 'Someone');
    return (
      <Card onPress={onPress} accessibilityLabel={label} style={highlight ? { borderColor: palette.primary, borderWidth: 2 } : undefined}>
        <View style={styles.top}>
          {a.icon ? <View style={{ marginRight: space.md }}><IconBadge icon={a.icon} /></View> : null}
          <View style={{ flex: 1, paddingRight: space.sm }}>
            {meetingName ? <Small>{meetingName}</Small> : null}
            <Heading>{a.title}</Heading>
            <Body>{when}</Body>
            {isChild ? <Small style={{ marginTop: space.xs }}>For your child, {a.assigneeNames[uid]}</Small> : null}
          </View>
          <Badge label={statusLabel(s, 'user')} tone={statusTone(s)} />
        </View>
        {a.location ? <Small style={{ marginTop: space.xs }}>{a.location}</Small> : null}
        {others.length ? <Small style={{ marginTop: space.xs }}>With {others.join(', ')}</Small> : null}
      </Card>
    );
  }

  return (
    <Card onPress={onPress} accessibilityLabel={label}>
      <View style={styles.top}>
        {a.icon ? <View style={{ marginRight: space.md }}><IconBadge icon={a.icon} /></View> : null}
        <View style={{ flex: 1, paddingRight: space.sm }}>
          <Heading>{a.title}</Heading>
          <Body>{when}</Body>
        </View>
        {a.status === 'cancelled' ? <Badge label="Cancelled" /> : null}
      </View>
      {a.assigneeIds.length === 0 ? (
        <View style={{ marginTop: space.sm }}>
          <Badge label="Nobody assigned yet" tone="warn" />
        </View>
      ) : (
        a.assigneeIds.map(id => {
          const s = statusFor(a, id);
          const person = usersById?.[id];
          const isChild = a.childAssignees?.includes(id);
          const unqualified = a.requiresQualification && a.requiredRole && !isChild && person && !meetsRequiredRole(person.qualifications, a.requiredRole);
          return (
            <View key={id} style={[styles.person, { borderTopColor: palette.line }]}>
              <View style={{ flex: 1, paddingRight: space.sm }}>
                <Body>{a.assigneeNames[id] ?? person?.name ?? 'Unknown'}</Body>
                {isChild ? <Small>Child of {person?.name ?? 'this account'} (no phone of their own)</Small> : null}
                {unqualified ? <Small style={{ color: palette.warn }}>Not marked as qualified</Small> : null}
                {s === 'cannot_do' && a.responses[id]?.reason ? <Small>“{a.responses[id]?.reason}”</Small> : null}
              </View>
              <Badge label={statusLabel(s, 'admin')} tone={statusTone(s)} />
            </View>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  person: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1 },
});
