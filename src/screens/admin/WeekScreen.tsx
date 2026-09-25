import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { confirmAsync } from '../../components/confirm';
import { MeetingDetailsModal } from '../../components/MeetingDetailsModal';
import { Planner } from '../../components/Planner';
import { ProgramSheet } from '../../components/ProgramSheet';
import { RowEditorModal } from '../../components/RowEditorModal';
import { SheetActions } from '../../components/SheetActions';
import { WeekNav } from '../../components/WeekNav';
import { Body, Button, Card, Chip, ChipRow, EmptyState, Heading, Label, LoadingView, Notice, Small } from '../../components/ui';
import { MEETING_TEMPLATES, TemplateLang } from '../../constants';
import { useAppData } from '../../context/AppDataContext';
import { useLive } from '../../hooks/useLive';
import { AdminTabParams } from '../../navigation/types';
import { getRecentAssignments, subscribeToWeekAssignments } from '../../services/assignmentService';
import { clearSheet, publishProgram } from '../../services/programService';
import { loadMeetingTemplate } from '../../services/settingsService';
import { subscribeToUsers } from '../../services/userService';
import { subscribeToWeek } from '../../services/weekService';
import { Assignment, DisplayStatus, Meeting, ProgramRow, UserProfile, Week } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { radius, space } from '../../theme';
import { suggestAssignees } from '../../utils/autoAssign';
import { dateInWeek, formatDayLong, formatTime, formatWeekRange, weekIdFor } from '../../utils/dates';
import { friendlyError, logError } from '../../utils/errors';
import { belongsToSheet, blankRow, insertInSection, rowAssignmentId, rowFromType, rowsFromTypes } from '../../utils/program';
import { statusFor } from '../../utils/status';

interface Proposal {
  rowId: string;
  label: string;
  people: UserProfile[];
}

/**
 * The one place to create, read, change and delete a week's meetings.
 * Tap any line to edit it. Every change is saved straight away (and reaches the phones of the
 * people involved), so there is no separate "save" step to forget.
 */
export default function WeekScreen() {
  const { palette } = useTheme();
  const route = useRoute<RouteProp<AdminTabParams, 'Week'>>();
  const { profile, settings, types, typesReady, reloadKey } = useAppData();
  const insets = useSafeAreaInsets();

  const [weekId, setWeekId] = useState(route.params?.weekId ?? weekIdFor(new Date()));
  const [meeting, setMeeting] = useState<Meeting>(route.params?.meeting ?? 'midweek');
  const [mode, setMode] = useState<'sheet' | 'planner'>(route.params?.planner ? 'planner' : 'sheet');
  const [editing, setEditing] = useState<ProgramRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSection, setAddSection] = useState('');
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [lang, setLang] = useState<TemplateLang>('en');
  const [notice, setNotice] = useState<{ tone: 'bad' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (route.params?.weekId) setWeekId(route.params.weekId);
    if (route.params?.meeting) setMeeting(route.params.meeting);
    setMode(route.params?.planner ? 'planner' : 'sheet');
  }, [route.params?.weekId, route.params?.meeting, route.params?.planner]);

  const week = useLive<Week | null>((ok, err) => subscribeToWeek(weekId, ok, err), [weekId, reloadKey]);
  const assignments = useLive<Assignment[]>((ok, err) => subscribeToWeekAssignments(weekId, ok, err), [weekId, reloadKey]);
  const users = useLive<UserProfile[]>(subscribeToUsers, [reloadKey]);

  const sheet = week.data?.sheets[meeting];
  const people = users.data ?? [];
  const meetingName = meeting === 'midweek' ? settings.midweekName : settings.weekendName;
  const meetingTypes = types.filter(t => t.active && t.meeting === meeting);

  const statuses = useMemo(() => {
    const byId = new Map((assignments.data ?? []).map(a => [a.id, a]));
    const out: Record<string, DisplayStatus[]> = {};
    (sheet?.program ?? []).forEach(r => {
      const a = byId.get(rowAssignmentId(weekId, meeting, r.id));
      out[r.id] = r.assigneeIds.map(id => (a ? statusFor(a, id) : 'scheduled'));
    });
    return out;
  }, [assignments.data, sheet, weekId, meeting]);

  /** Saves the whole sheet (and the assignments made from it) in one go. */
  const persist = (rows: ProgramRow[], meta?: { title: string; date: string; startTime: string }) => {
    const base = meta ?? sheet;
    if (!base) return;
    setNotice(null);
    publishProgram({
      weekId,
      meeting,
      title: base.title,
      date: base.date,
      startTime: base.startTime,
      rows,
      existing: assignments.data ?? [],
      reminders: settings.reminderOffsetsMinutes,
      adminId: profile.id,
    })
      .then(r => {
        if (r === 'queued') setNotice({ tone: 'info', text: "Saved on this phone. It will reach everyone's phones when you have internet." });
      })
      .catch(e => {
        logError('save sheet', e);
        setNotice({ tone: 'bad', text: friendlyError(e) });
      });
  };

  const startSheet = () => {
    const isMid = meeting === 'midweek';
    persist(rowsFromTypes(types, meeting), {
      title: '',
      date: dateInWeek(weekId, isMid ? settings.meetingDay : settings.weekendDay),
      startTime: isMid ? settings.meetingTime : settings.weekendTime,
    });
  };

  const loadTemplate = async () => {
    try {
      await loadMeetingTemplate(lang);
    } catch (e) {
      setNotice({ tone: 'bad', text: friendlyError(e) });
    }
  };

  // ---- editing one line
  const saveRow = (row: ProgramRow) => {
    if (!sheet) return;
    const exists = sheet.program.some(r => r.id === row.id);
    persist(exists ? sheet.program.map(r => (r.id === row.id ? row : r)) : insertInSection(sheet.program, row));
    setEditing(null);
  };

  const deleteRow = async (row: ProgramRow) => {
    if (!sheet) return;
    if (!(await confirmAsync('Remove this line?', `“${row.title || row.label}” will be taken off the sheet${row.assigneeIds.length ? ' and off the people’s assignments' : ''}.`, 'Remove', true))) return;
    persist(sheet.program.filter(r => r.id !== row.id));
    setEditing(null);
  };

  // ---- adding a line
  const openAdd = (section?: string) => {
    setAddSection(section ?? sheet?.program[sheet.program.length - 1]?.section ?? settings.categories[0] ?? '');
    setAddOpen(true);
  };
  const addLine = (typeId: string | null) => {
    const id = `x${Date.now()}`;
    const t = meetingTypes.find(x => x.id === typeId);
    const row = t ? rowFromType(t, id, addSection) : blankRow(addSection, id);
    setAddOpen(false);
    setEditing(row); // opens the editor; the line is added to the sheet when saved
  };

  // ---- suggestions (always reviewed first)
  const runSuggest = async () => {
    if (!sheet) return;
    setSuggesting(true);
    setNotice(null);
    try {
      const recent = (await getRecentAssignments(120)).filter(a => !belongsToSheet(a.id, weekId, meeting));
      const used = new Set(sheet.program.flatMap(r => r.assigneeIds));
      const found: Proposal[] = [];
      for (const r of sheet.program.filter(x => x.kind === 'part' && x.assigneeIds.length === 0)) {
        const res = suggestAssignees({
          typeId: r.typeId, requiredRole: r.requiredRole, requiresQualification: r.requiresQualification,
          count: r.people, people, recent, weekId, excludeIds: Array.from(used), now: new Date(),
        });
        res.picks.forEach(p => used.add(p.id));
        if (res.picks.length) found.push({ rowId: r.id, label: r.title || r.label, people: res.picks });
      }
      if (found.length === 0) setNotice({ tone: 'info', text: 'No suggestions: every part already has someone, or nobody is marked as qualified yet.' });
      else setProposals(found);
    } catch (e) {
      logError('suggest week', e);
      setNotice({ tone: 'bad', text: 'Suggestions need some saved information. Please connect to the internet once and try again.' });
    } finally {
      setSuggesting(false);
    }
  };

  const acceptProposals = () => {
    if (!sheet || !proposals) return;
    persist(
      sheet.program.map(r => {
        const p = proposals.find(x => x.rowId === r.id);
        return p ? { ...r, assigneeIds: p.people.map(x => x.id), assigneeNames: Object.fromEntries(p.people.map(x => [x.id, x.name])) } : r;
      }),
    );
    setProposals(null);
  };

  const removeSheet = async () => {
    if (!(await confirmAsync('Delete this sheet?', `The ${meetingName} sheet for this week and everyone’s assignments from it will be deleted.`, 'Delete', true))) return;
    clearSheet(weekId, meeting, assignments.data ?? []).catch(e => setNotice({ tone: 'bad', text: friendlyError(e) }));
  };

  // ---- render
  if (mode === 'planner') {
    return (
      <Screen inTabs>
        <Button label="◀ Back to the sheet" variant="secondary" onPress={() => setMode('sheet')} style={{ marginBottom: space.lg }} />
        <Planner
          onOpen={(id, m) => {
            setWeekId(id);
            setMeeting(m);
            setMode('sheet');
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen inTabs>
      <Button label="🗓️ Planner: see the coming weeks" variant="secondary" onPress={() => setMode('planner')} style={{ marginBottom: space.md }} />
      <WeekNav weekId={weekId} onChange={setWeekId} />
      <ChipRow>
        <Chip label={`📋 ${settings.midweekName}`} selected={meeting === 'midweek'} onPress={() => setMeeting('midweek')} />
        <Chip label={`📋 ${settings.weekendName}`} selected={meeting === 'weekend'} onPress={() => setMeeting('weekend')} />
      </ChipRow>

      {notice ? <Notice tone={notice.tone} message={notice.text} /> : null}
      {week.error ? <Notice tone="warn" message={week.error} /> : null}

      {week.loading && !week.data && !sheet ? (
        <LoadingView />
      ) : !sheet ? (
        !typesReady ? (
          <LoadingView />
        ) : meetingTypes.length === 0 ? (
          <>
            <EmptyState title="Choose a language to begin" message="This sets up the parts, minutes, sections and icons of both meetings. You can rename anything afterwards." />
            <ChipRow>
              {(Object.keys(MEETING_TEMPLATES) as TemplateLang[]).map(k => (
                <Chip key={k} label={MEETING_TEMPLATES[k].label} selected={lang === k} onPress={() => setLang(k)} />
              ))}
            </ChipRow>
            <Button label={`Load the ${MEETING_TEMPLATES[lang].label} layout`} onPress={loadTemplate} style={{ marginTop: space.md }} />
          </>
        ) : (
          <EmptyState
            title={`No ${meetingName} sheet for ${formatWeekRange(weekId)}`}
            message="Start the sheet, then tap any line to choose who does it."
            actionLabel="Start the sheet"
            onAction={startSheet}
          />
        )
      ) : (
        <>
          <Card onPress={() => setDetailsOpen(true)} accessibilityLabel="Change day, time and reading">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Small>{meetingName}</Small>
                {sheet.title ? <Heading>{sheet.title}</Heading> : <Label>No reading added</Label>}
                <Body>{formatDayLong(sheet.date)} · {formatTime(sheet.startTime)}</Body>
              </View>
              <Body style={{ color: palette.primary, fontWeight: '700' }}>Change</Body>
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.md }}>
            <Button label="＋ Add" onPress={() => openAdd()} style={{ flex: 1 }} />
            <Button label="✨ Suggest people" variant="secondary" onPress={runSuggest} loading={suggesting} style={{ flex: 1 }} />
          </View>

          <ProgramSheet rows={sheet.program} minutesFormat={settings.minutesFormat} statuses={statuses} onPressRow={setEditing} />

          <SheetActions
            doc={{
              meetingName,
              weekRange: formatWeekRange(weekId),
              title: sheet.title,
              dateLine: `${formatDayLong(sheet.date)} · ${formatTime(sheet.startTime)}`,
              rows: sheet.program,
              minutesFormat: settings.minutesFormat,
            }}
          />
          <Button label="Delete this sheet" variant="ghost" onPress={removeSheet} />
        </>
      )}

      <RowEditorModal
        row={editing}
        people={people.filter(u => u.active || (editing?.assigneeIds ?? []).includes(u.id))}
        onSave={saveRow}
        onDelete={deleteRow}
        onClose={() => setEditing(null)}
      />

      {sheet ? (
        <MeetingDetailsModal
          visible={detailsOpen}
          meetingName={meetingName}
          title={sheet.title}
          date={sheet.date}
          startTime={sheet.startTime}
          onClose={() => setDetailsOpen(false)}
          onSave={v => {
            persist(sheet.program, v);
            setDetailsOpen(false);
          }}
        />
      ) : null}

      <Modal visible={addOpen} animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={{ flex: 1, backgroundColor: palette.bg, padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: Math.max(insets.bottom, space.lg) }}>
          <Heading>Add to the sheet</Heading>
          <Small style={{ marginBottom: space.lg }}>Choose where it goes, then what it is. You pick the person next.</Small>
          <View style={{ flex: 1 }}>
            <Label style={{ marginBottom: space.sm }}>Where?</Label>
            <ChipRow>
              {Array.from(new Set([...(sheet?.program.map(r => r.section) ?? []), ...settings.categories])).map(c => (
                <Chip key={c} label={c} selected={addSection === c} onPress={() => setAddSection(c)} />
              ))}
            </ChipRow>
            <Label style={{ marginTop: space.md, marginBottom: space.sm }}>What is it?</Label>
            <ChipRow>
              {meetingTypes.map(t => (
                <Chip key={t.id} label={`${t.icon} ${t.name}`} onPress={() => addLine(t.id)} />
              ))}
              <Chip label="＋ Something else" onPress={() => addLine(null)} />
            </ChipRow>
          </View>
          <Button label="Cancel" variant="ghost" onPress={() => setAddOpen(false)} />
        </View>
      </Modal>

      <Modal visible={proposals !== null} animationType="slide" onRequestClose={() => setProposals(null)}>
        <View style={{ flex: 1, backgroundColor: palette.bg, padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: Math.max(insets.bottom, space.lg) }}>
          <Heading>Suggestions</Heading>
          <Small style={{ marginBottom: space.lg }}>Nothing is saved until you accept. You can change any name afterwards.</Small>
          <View style={{ flex: 1 }}>
            {(proposals ?? []).map(p => (
              <View key={p.rowId} style={{ backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line, padding: space.md, marginBottom: space.sm }}>
                <Small>{p.label}</Small>
                <Body style={{ fontWeight: '700' }}>{p.people.map(x => x.name).join(' / ')}</Body>
              </View>
            ))}
          </View>
          <Button label="Use these suggestions" onPress={acceptProposals} />
          <Button label="Not now" variant="ghost" onPress={() => setProposals(null)} style={{ marginTop: space.sm }} />
        </View>
      </Modal>
    </Screen>
  );
}
