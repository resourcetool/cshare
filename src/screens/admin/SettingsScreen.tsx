import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { DateTimeField } from '../../components/DateTimeField';
import { AccountSection, AppearanceSettings, CalendarSettings, NotificationSettings, ProfileForm } from '../../components/ProfileSections';
import { ReminderPicker } from '../../components/ReminderPicker';
import { Badge, Body, Button, Card, Chip, ChipRow, IconBadge, Label, Notice, SectionTitle, Small, SwitchRow, TextField, Title } from '../../components/ui';
import { MEETING_TEMPLATES, TemplateLang, WEEKDAYS } from '../../constants';
import { useAppData } from '../../context/AppDataContext';
import { AdminNav } from '../../navigation/types';
import { loadMeetingTemplate, saveSettings } from '../../services/settingsService';
import { confirmAsync } from '../../components/confirm';
import { AppSettings } from '../../types';
import { space } from '../../theme';
import { friendlyError } from '../../utils/errors';

/** A clearly-labelled group of settings, so admins can scan straight to the part they need
 * instead of scrolling a single long, undifferentiated list. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space.xxl }}>
      <Title style={{ marginBottom: space.md }}>{title}</Title>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const nav = useNavigation<AdminNav>();
  const { settings, types } = useAppData();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<TemplateLang>('en');
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  useEffect(() => {
    if (!dirty) setDraft(settings);
  }, [settings, dirty]);

  const change = (patch: Partial<AppSettings>) => {
    setDraft(d => ({ ...d, ...patch }));
    setDirty(true);
    setMessage(null);
  };

  const setCategory = (i: number, value: string) => change({ categories: draft.categories.map((c, idx) => (idx === i ? value : c)) });

  const save = async () => {
    const categories = draft.categories.map(c => c.trim()).filter(Boolean);
    if (categories.length === 0) return setMessage({ tone: 'bad', text: 'Keep at least one section.' });
    if (!(draft.regularPioneerHours > 0) || !(draft.auxiliaryPioneerHours > 0)) {
      return setMessage({ tone: 'bad', text: 'Hour references must be greater than zero.' });
    }
    setBusy(true);
    try {
      const r = await saveSettings({ ...draft, categories });
      setDirty(false);
      setMessage({ tone: 'good', text: r === 'queued' ? 'Saved on this phone. It will sync when you have internet.' : 'Settings saved.' });
    } catch (e) {
      setMessage({ tone: 'bad', text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  const loadTemplate = async () => {
    if (types.length > 0) {
      const ok = await confirmAsync('Replace the list?', `This replaces your assignment types, sections and minutes wording with the ${MEETING_TEMPLATES[lang].label} layout. People’s qualifications for the old types will no longer apply.`, 'Replace', true);
      if (!ok) return;
    }
    try {
      await loadMeetingTemplate(lang);
      setDirty(false);
      setMessage({ tone: 'good', text: `The ${MEETING_TEMPLATES[lang].label} layout is ready. Change any word below to suit your congregation.` });
    } catch (e) {
      setMessage({ tone: 'bad', text: friendlyError(e) });
    }
  };

  return (
    <Screen inTabs footer={dirty ? <Button label="Save settings" onPress={save} loading={busy} /> : undefined}>
      {message ? <Notice tone={message.tone} message={message.text} /> : null}

      {/* GENERAL --------------------------------------------------------------------- */}
      <Group title="General">
        <SectionTitle>Appearance</SectionTitle>
        <AppearanceSettings />
      </Group>

      {/* MEETINGS -------------------------------------------------------------------- */}
      <Group title="Meetings">
        <SectionTitle>Midweek meeting</SectionTitle>
        <Label style={{ marginBottom: space.sm }}>Usual day</Label>
        <ChipRow>
          {WEEKDAYS.map((d, i) => (
            <Chip key={d} label={d} selected={draft.meetingDay === i} onPress={() => change({ meetingDay: i })} />
          ))}
        </ChipRow>
        <DateTimeField label="Usual start time" mode="time" value={draft.meetingTime} onChange={v => change({ meetingTime: v })} />
        <TextField label="Name of this meeting" value={draft.midweekName} onChangeText={v => change({ midweekName: v })} />

        <SectionTitle>Weekend meeting</SectionTitle>
        <Label style={{ marginBottom: space.sm }}>Usual day</Label>
        <ChipRow>
          {WEEKDAYS.map((d, i) => (
            <Chip key={d} label={d} selected={draft.weekendDay === i} onPress={() => change({ weekendDay: i })} />
          ))}
        </ChipRow>
        <DateTimeField label="Usual start time" mode="time" value={draft.weekendTime} onChange={v => change({ weekendTime: v })} />
        <TextField label="Name of this meeting" value={draft.weekendName} onChangeText={v => change({ weekendName: v })} />

        <SectionTitle>Language of the sheet</SectionTitle>
        <Small style={{ marginBottom: space.md }}>
          Every name on the sheet can be changed to your congregation’s language: sections below, and each part under “Assignment types”. Pick a starting point, then edit any word.
        </Small>
        <ChipRow>
          {(Object.keys(MEETING_TEMPLATES) as TemplateLang[]).map(k => (
            <Chip key={k} label={MEETING_TEMPLATES[k].label} selected={lang === k} onPress={() => setLang(k)} />
          ))}
        </ChipRow>
        <Button label={`Load the ${MEETING_TEMPLATES[lang].label} layout`} variant="secondary" onPress={loadTemplate} style={{ marginBottom: space.lg }} />
        <TextField
          label="How minutes are written"
          value={draft.minutesFormat}
          onChangeText={v => change({ minutesFormat: v })}
          autoCapitalize="none"
          hint="Use {n} for the number. For example: {n} min  or  Simma {n}. Shown as (7 min)."
        />

        <SectionTitle>Sections of the weekly sheet</SectionTitle>
        {draft.categories.map((c, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label={`Section ${i + 1}`} value={c} onChangeText={v => setCategory(i, v)} />
            </View>
            <Button label="Remove" variant="ghost" onPress={() => change({ categories: draft.categories.filter((_, idx) => idx !== i) })} style={{ marginTop: 26 }} />
          </View>
        ))}
        <Button label="Add a section" variant="secondary" onPress={() => change({ categories: [...draft.categories, ''] })} />

        <SectionTitle>Parts of the meetings</SectionTitle>
        {types.length === 0 ? (
          <Card>
            <Body>No parts yet. Use “Load the layout” in “Language of the sheet” above to fill in the parts, minutes, sections and icons.</Body>
          </Card>
        ) : (
          types.map(t => (
            <Card key={t.id} onPress={() => nav.navigate('TypeEdit', { typeId: t.id })} accessibilityLabel={t.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconBadge icon={t.icon} size={40} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Label>{t.name}</Label>
                  <Small>{t.meeting === 'weekend' ? settings.weekendName : settings.midweekName} · {t.category}{t.kind === 'song' ? ' · song' : t.kind === 'note' ? ' · text line' : ` · ${t.minutes} min`}{t.people > 1 ? ` · ${t.people} people` : ''}</Small>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
                {t.requiresQualification ? <Badge label="Qualification" tone="info" /> : null}
                {!t.active ? <Badge label="Not in use" /> : null}
              </View>
            </Card>
          ))
        )}
        <Button label="Add assignment type" variant="secondary" onPress={() => nav.navigate('TypeEdit')} />
      </Group>

      {/* FIELD SERVICE REPORTS --------------------------------------------------------- */}
      <Group title="Field service reports">
        <SectionTitle>Hour references</SectionTitle>
        <Small style={{ marginBottom: space.md }}>
          These are references, not limits — anyone can enter more hours than shown here.
        </Small>
        <TextField
          label="Regular Pioneer"
          value={String(draft.regularPioneerHours)}
          onChangeText={v => change({ regularPioneerHours: Number(v.replace(/[^0-9]/g, '')) || 0 })}
          keyboardType="number-pad"
        />
        <TextField
          label="Auxiliary Pioneer"
          value={String(draft.auxiliaryPioneerHours)}
          onChangeText={v => change({ auxiliaryPioneerHours: Number(v.replace(/[^0-9]/g, '')) || 0 })}
          keyboardType="number-pad"
        />
        <SectionTitle>Ministry groups</SectionTitle>
        <Small style={{ marginBottom: space.md }}>Set up groups, move people between them, and assign a group overseer.</Small>
        <Button label="Manage ministry groups" variant="secondary" onPress={() => nav.navigate('Groups')} />
      </Group>

      {/* REMINDERS ------------------------------------------------------------------- */}
      <Group title="Reminders">
        <Body style={{ marginBottom: space.md }}>
          CSHARE's own reminders are calculated automatically for every assignment — closer, more useful reminders when there's little notice, spread-out ones when there's plenty. There is nothing to configure here.
        </Body>
        <SwitchRow label="Loud final reminder" description="Lets the very last reminder before an assignment ring like a call, where Android allows it. People can still turn this off for themselves." value={draft.callStyleEnabled} onValueChange={v => change({ callStyleEnabled: v })} />
        <SectionTitle>Phone calendar alerts</SectionTitle>
        <Small style={{ marginBottom: space.md }}>
          Separate from the above: if someone turns on "Add my assignments to my phone calendar" for themselves, this is how far ahead the calendar app's own alert appears (up to 3).
        </Small>
        <ReminderPicker value={draft.reminderOffsetsMinutes} onChange={v => change({ reminderOffsetsMinutes: v })} />
      </Group>

      {/* MY CSHARE --------------------------------------------------------------------- */}
      <Group title="My CSHARE">
        <SectionTitle>My reminders</SectionTitle>
        <NotificationSettings />
        <SectionTitle>My phone calendar</SectionTitle>
        <CalendarSettings />
        <SectionTitle>My details</SectionTitle>
        <ProfileForm />
        <SectionTitle>Account</SectionTitle>
        <AccountSection />
      </Group>
    </Screen>
  );
}
