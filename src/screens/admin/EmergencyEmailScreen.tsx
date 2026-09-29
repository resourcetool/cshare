import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Badge, Body, Button, Card, Chip, ChipRow, EmptyState, Label, Notice, SectionTitle, Small, TextField, Title } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { confirmAsync } from '../../components/confirm';
import { useLive } from '../../hooks/useLive';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { subscribeToGroups } from '../../services/groupService';
import { sendEmergencyEmail, EMAIL_SEND_INTERVAL_MS, wait } from '../../services/emailService';
import { subscribeToUsers } from '../../services/userService';
import { MinistryGroup, UserProfile } from '../../types';
import { space } from '../../theme';
import { friendlyError } from '../../utils/errors';

type RecipientMode = 'all' | 'groups' | 'people';

export default function EmergencyEmailScreen() {
  const { profile } = useAppData();
  const { palette } = useTheme();
  const users = useLive<UserProfile[]>(subscribeToUsers, []);
  const groups = useLive<MinistryGroup[]>(subscribeToGroups, []);
  const [mode, setMode] = useState<RecipientMode>('all');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [personSearch, setPersonSearch] = useState('');
  const [subject, setSubject] = useState('Emergency notification');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad' | 'warn'; text: string } | null>(null);

  const activeUsers = useMemo(
    () => (users.data ?? []).filter(u => u.active && u.email.trim()),
    [users.data],
  );

  const filteredPeople = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return activeUsers;
    return activeUsers.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [activeUsers, personSearch]);

  const recipients = useMemo(() => {
    const byId = new Map(activeUsers.map(u => [u.id, u]));
    let list: UserProfile[] = [];

    if (mode === 'all') {
      list = activeUsers;
    } else if (mode === 'groups') {
      const ids = new Set(selectedGroups);
      list = activeUsers.filter(u => u.groupId && ids.has(u.groupId));
    } else {
      list = selectedPeople.map(id => byId.get(id)).filter((u): u is UserProfile => !!u);
    }

    const seen = new Set<string>();
    return list
      .filter(u => {
        const email = u.email.trim().toLowerCase();
        if (!email || seen.has(email)) return false;
        seen.add(email);
        return true;
      })
      .map(u => ({ id: u.id, name: u.name, email: u.email.trim() }));
  }, [activeUsers, mode, selectedGroups, selectedPeople]);

  const toggle = (id: string, setSelected: React.Dispatch<React.SetStateAction<string[]>>) => {
    setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  };

  const send = async () => {
    if (!subject.trim()) return setNotice({ tone: 'bad', text: 'Enter a subject.' });
    if (!message.trim()) return setNotice({ tone: 'bad', text: 'Enter the emergency message.' });
    if (recipients.length === 0) return setNotice({ tone: 'bad', text: 'Choose at least one recipient with an email address.' });

    const ok = await confirmAsync(
      'Send emergency email?',
      `This will send the message to ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}. Email cannot be recalled after it is sent.`,
      'Send email',
      true,
    );
    if (!ok) return;

    setSending(true);
    setProgress(0);
    setNotice(null);

    let sent = 0;
    const failed: string[] = [];

    try {
      for (let i = 0; i < recipients.length; i += 1) {
        const recipient = recipients[i];
        try {
          await sendEmergencyEmail({
            recipient,
            subject: subject.trim(),
            message: message.trim(),
            senderName: profile.name,
            replyTo: profile.email,
          });
          sent += 1;
        } catch (e) {
          failed.push(`${recipient.name}: ${friendlyError(e)}`);
        }
        setProgress(i + 1);
        if (i < recipients.length - 1) await wait(EMAIL_SEND_INTERVAL_MS);
      }

      if (failed.length === 0) {
        setNotice({ tone: 'good', text: `Emergency email sent to all ${sent} selected recipients.` });
        setMessage('');
      } } else {
  setNotice({
    tone: 'bad',
    text: `${sent} sent successfully; ${failed.length} failed.\n\n${failed.join('\n')}`,
  });
}
    } finally {
      setSending(false);
    }
  };

  const loading = (users.loading && !users.data) || (groups.loading && !groups.data);

  return (
    <Screen scroll>
      <Card style={{ backgroundColor: palette.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
            <Icon name="attention" size={22} color={palette.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Title style={{ color: palette.onPrimary, fontSize: 22 }}>Emergency notification</Title>
            <Small style={{ color: palette.onPrimary, opacity: 0.82, marginTop: space.xs }}>
              Send an urgent email to active congregation members. Nothing is saved to Firestore.
            </Small>
          </View>
        </View>
      </Card>

      {notice ? <Notice tone={notice.tone} message={notice.text} /> : null}

      <SectionTitle>Recipients</SectionTitle>
      <ChipRow>
        <Chip label="Entire congregation" selected={mode === 'all'} onPress={() => setMode('all')} disabled={sending} />
        <Chip label="Ministry groups" selected={mode === 'groups'} onPress={() => setMode('groups')} disabled={sending} />
        <Chip label="Specific people" selected={mode === 'people'} onPress={() => setMode('people')} disabled={sending} />
      </ChipRow>

      {mode === 'all' ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <Body style={{ fontWeight: '700' }}>Active congregation members</Body>
              <Small>Only active profiles with an email address are included.</Small>
            </View>
            <Badge label={`${recipients.length}`} tone="info" />
          </View>
        </Card>
      ) : null}

      {mode === 'groups' ? (
        <View>
          <Small style={{ marginBottom: space.md }}>Select one or more ministry groups. People without a group will not be included.</Small>
          {loading ? <ActivityIndicator color={palette.primary} /> : null}
          {!loading && groups.data?.length === 0 ? <EmptyState title="No ministry groups" message="Create ministry groups first." /> : null}
          {(groups.data ?? []).map(group => {
            const selected = selectedGroups.includes(group.id);
            const count = activeUsers.filter(u => u.groupId === group.id).length;
            return (
              <Pressable key={group.id} disabled={sending} onPress={() => toggle(group.id, setSelectedGroups)} style={{ opacity: sending ? 0.5 : 1 }}>
                <Card style={selected ? { borderColor: palette.primary, borderWidth: 2 } : undefined}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: selected ? palette.primary : palette.placeholder, alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
                      {selected ? <Icon name="check" size={18} color={palette.primary} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: '700' }}>{group.name}</Body>
                      <Small>{count} active {count === 1 ? 'person' : 'people'} with email</Small>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {mode === 'people' ? (
        <View>
          <TextField label="Search people" value={personSearch} onChangeText={setPersonSearch} placeholder="Name or email" autoCapitalize="none" />
          <Small style={{ marginBottom: space.md }}>{selectedPeople.length} selected</Small>
          {filteredPeople.map(person => {
            const selected = selectedPeople.includes(person.id);
            return (
              <Pressable key={person.id} disabled={sending} onPress={() => toggle(person.id, setSelectedPeople)} style={{ opacity: sending ? 0.5 : 1 }}>
                <Card style={selected ? { borderColor: palette.primary, borderWidth: 2 } : undefined}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: selected ? palette.primary : palette.placeholder, alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
                      {selected ? <Icon name="check" size={18} color={palette.primary} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: '700' }}>{person.name}</Body>
                      <Small>{person.email}</Small>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <SectionTitle>Message</SectionTitle>
      <TextField label="Subject" value={subject} onChangeText={setSubject} placeholder="Emergency notification" editable={!sending} maxLength={160} />
      <TextField label="Message" value={message} onChangeText={setMessage} placeholder="Type the emergency information here…" multiline editable={!sending} maxLength={5000} />

      <Card>
        <Label>Ready to send</Label>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
          <Small>Recipients</Small>
          <Body style={{ fontWeight: '700' }}>{sending ? `${progress} / ${recipients.length}` : recipients.length}</Body>
        </View>
        <Small style={{ marginTop: space.sm }}>
          Each recipient receives a separate email. Their email address is not exposed to other recipients.
        </Small>
      </Card>

      <Button
        label={sending ? `Sending ${progress} of ${recipients.length}…` : 'Send emergency email'}
        onPress={send}
        loading={sending}
        disabled={loading || recipients.length === 0}
        style={{ marginTop: space.md }}
      />
    </Screen>
  );
}
