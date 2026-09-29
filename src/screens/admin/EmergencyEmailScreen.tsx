import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Screen } from '../../components/Screen';
import {
  Badge,
  Body,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Label,
  Notice,
  SectionTitle,
  Small,
  TextField,
  Title,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { confirmAsync } from '../../components/confirm';
import { useLive } from '../../hooks/useLive';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { subscribeToGroups } from '../../services/groupService';
import {
  sendEmergencyEmail,
  EMAIL_SEND_INTERVAL_MS,
  wait,
} from '../../services/emailService';
import { subscribeToUsers } from '../../services/userService';
import { MinistryGroup, UserProfile } from '../../types';
import { space } from '../../theme';

type RecipientMode = 'all' | 'groups' | 'people';

export default function EmergencyEmailScreen() {
  const { profile } = useAppData();
  const { palette } = useTheme();

  const users = useLive<UserProfile[]>(subscribeToUsers, []);
  const groups = useLive<MinistryGroup[]>(subscribeToGroups, []);

  const [mode, setMode] =
    useState<RecipientMode>('all');

  const [selectedGroups, setSelectedGroups] =
    useState<string[]>([]);

  const [selectedPeople, setSelectedPeople] =
    useState<string[]>([]);

  const [personSearch, setPersonSearch] =
    useState('');

  const [subject, setSubject] =
    useState('Emergency notification');

  const [message, setMessage] =
    useState('');

  const [sending, setSending] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [notice, setNotice] = useState<{
    tone: 'good' | 'bad' | 'warn';
    text: string;
  } | null>(null);

  const activeUsers = useMemo(
    () =>
      (users.data ?? []).filter(
        user =>
          user.active &&
          user.email.trim(),
      ),
    [users.data],
  );

  const filteredPeople = useMemo(() => {
    const query =
      personSearch.trim().toLowerCase();

    if (!query) {
      return activeUsers;
    }

    return activeUsers.filter(
      user =>
        user.name
          .toLowerCase()
          .includes(query) ||
        user.email
          .toLowerCase()
          .includes(query),
    );
  }, [activeUsers, personSearch]);

  const recipients = useMemo(() => {
    const byId = new Map(
      activeUsers.map(user => [
        user.id,
        user,
      ]),
    );

    let list: UserProfile[] = [];

    if (mode === 'all') {
      list = activeUsers;
    } else if (mode === 'groups') {
      const groupIds =
        new Set(selectedGroups);

      list = activeUsers.filter(
        user =>
          user.groupId &&
          groupIds.has(user.groupId),
      );
    } else {
      list = selectedPeople
        .map(id => byId.get(id))
        .filter(
          (
            user,
          ): user is UserProfile =>
            !!user,
        );
    }

    // Prevent the same email address from
    // receiving duplicate emails.
    const seen = new Set<string>();

    return list
      .filter(user => {
        const email =
          user.email
            .trim()
            .toLowerCase();

        if (
          !email ||
          seen.has(email)
        ) {
          return false;
        }

        seen.add(email);

        return true;
      })
      .map(user => ({
        id: user.id,
        name: user.name,
        email: user.email.trim(),
      }));
  }, [
    activeUsers,
    mode,
    selectedGroups,
    selectedPeople,
  ]);

  const toggle = (
    id: string,
    setSelected: React.Dispatch<
      React.SetStateAction<string[]>
    >,
  ) => {
    setSelected(current =>
      current.includes(id)
        ? current.filter(
            item => item !== id,
          )
        : [...current, id],
    );
  };

  const send = async () => {
    if (!subject.trim()) {
      setNotice({
        tone: 'bad',
        text: 'Enter a subject.',
      });
      return;
    }

    if (!message.trim()) {
      setNotice({
        tone: 'bad',
        text:
          'Enter the emergency message.',
      });
      return;
    }

    if (recipients.length === 0) {
      setNotice({
        tone: 'bad',
        text:
          'Choose at least one recipient with an email address.',
      });
      return;
    }

    const ok = await confirmAsync(
      'Send emergency email?',
      `This will send the message to ${
        recipients.length
      } ${
        recipients.length === 1
          ? 'person'
          : 'people'
      }. Email cannot be recalled after it is sent.`,
      'Send email',
      true,
    );

    if (!ok) {
      return;
    }

    setSending(true);
    setProgress(0);
    setNotice(null);

    let sent = 0;

    const failed: string[] = [];

    try {
      for (
        let i = 0;
        i < recipients.length;
        i += 1
      ) {
        const recipient =
          recipients[i];

        try {
          await sendEmergencyEmail({
            recipient,
            subject: subject.trim(),
            message: message.trim(),
            senderName: profile.name,
            replyTo: profile.email,
          });

          sent += 1;
        } catch (error) {
          /*
           * IMPORTANT:
           *
           * We intentionally do NOT use friendlyError()
           * here because it hides the real EmailJS error.
           *
           * This will show us the exact response returned
           * by EmailJS, including HTTP status.
           */
          const errorMessage =
            error instanceof Error
              ? error.message
              : String(error);

          failed.push(
            `${recipient.name}: ${errorMessage}`,
          );
        }

        setProgress(i + 1);

        /*
         * EmailJS rate limit protection.
         */
        if (
          i <
          recipients.length - 1
        ) {
          await wait(
            EMAIL_SEND_INTERVAL_MS,
          );
        }
      }

      if (failed.length === 0) {
        setNotice({
          tone: 'good',
          text:
            `Emergency email sent to all ${sent} selected ${
              sent === 1
                ? 'recipient'
                : 'recipients'
            }.`,
        });

        setMessage('');
      } else {
        setNotice({
          tone: 'bad',
          text:
            `${sent} sent successfully; ${failed.length} failed.\n\n` +
            failed.join('\n'),
        });
      }
    } finally {
      setSending(false);
    }
  };

  const loading =
    (users.loading &&
      !users.data) ||
    (groups.loading &&
      !groups.data);

  return (
    <Screen scroll>
      <Card
        style={{
          backgroundColor:
            palette.primary,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor:
                palette.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: space.md,
            }}
          >
            <Icon
              name="attention"
              size={22}
              color={
                palette.onPrimary
              }
            />
          </View>

          <View
            style={{ flex: 1 }}
          >
            <Title
              style={{
                color:
                  palette.onPrimary,
                fontSize: 22,
              }}
            >
              Emergency notification
            </Title>

            <Small
              style={{
                color:
                  palette.onPrimary,
                opacity: 0.82,
                marginTop: space.xs,
              }}
            >
              Send an urgent email to active congregation
              members. Nothing is saved to Firestore.
            </Small>
          </View>
        </View>
      </Card>

      {notice ? (
        <Notice
          tone={notice.tone}
          message={notice.text}
        />
      ) : null}

      <SectionTitle>
        Recipients
      </SectionTitle>

      <ChipRow>
        <Chip
          label="Entire congregation"
          selected={
            mode === 'all'
          }
          onPress={() =>
            setMode('all')
          }
          disabled={sending}
        />

        <Chip
          label="Ministry groups"
          selected={
            mode === 'groups'
          }
          onPress={() =>
            setMode('groups')
          }
          disabled={sending}
        />

        <Chip
          label="Specific people"
          selected={
            mode === 'people'
          }
          onPress={() =>
            setMode('people')
          }
          disabled={sending}
        />
      </ChipRow>

      {mode === 'all' ? (
        <Card>
          <View
            style={{
              flexDirection:
                'row',
              justifyContent:
                'space-between',
              alignItems:
                'center',
            }}
          >
            <View
              style={{
                flex: 1,
                paddingRight:
                  space.md,
              }}
            >
              <Body
                style={{
                  fontWeight:
                    '700',
                }}
              >
                Active congregation
                members
              </Body>

              <Small>
                Only active profiles
                with an email
                address are included.
              </Small>
            </View>

            <Badge
              label={`${recipients.length}`}
              tone="info"
            />
          </View>
        </Card>
      ) : null}

      {mode === 'groups' ? (
        <View>
          <Small
            style={{
              marginBottom:
                space.md,
            }}
          >
            Select one or more ministry
            groups. People without a group
            will not be included.
          </Small>

          {loading ? (
            <ActivityIndicator
              color={
                palette.primary
              }
            />
          ) : null}

          {!loading &&
          groups.data?.length ===
            0 ? (
            <EmptyState
              title="No ministry groups"
              message="Create ministry groups first."
            />
          ) : null}

          {(groups.data ?? []).map(
            group => {
              const selected =
                selectedGroups.includes(
                  group.id,
                );

              const count =
                activeUsers.filter(
                  user =>
                    user.groupId ===
                    group.id,
                ).length;

              return (
                <Pressable
                  key={group.id}
                  disabled={sending}
                  onPress={() =>
                    toggle(
                      group.id,
                      setSelectedGroups,
                    )
                  }
                  style={{
                    opacity:
                      sending
                        ? 0.5
                        : 1,
                  }}
                >
                  <Card
                    style={
                      selected
                        ? {
                            borderColor:
                              palette.primary,
                            borderWidth: 2,
                          }
                        : undefined
                    }
                  >
                    <View
                      style={{
                        flexDirection:
                          'row',
                        alignItems:
                          'center',
                      }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor:
                            selected
                              ? palette.primary
                              : palette.placeholder,
                          alignItems:
                            'center',
                          justifyContent:
                            'center',
                          marginRight:
                            space.md,
                        }}
                      >
                        {selected ? (
                          <Icon
                            name="check"
                            size={18}
                            color={
                              palette.primary
                            }
                          />
                        ) : null}
                      </View>

                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Body
                          style={{
                            fontWeight:
                              '700',
                          }}
                        >
                          {group.name}
                        </Body>

                        <Small>
                          {count}{' '}
                          active{' '}
                          {count === 1
                            ? 'person'
                            : 'people'}{' '}
                          with email
                        </Small>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            },
          )}
        </View>
      ) : null}

      {mode === 'people' ? (
        <View>
          <TextField
            label="Search people"
            value={personSearch}
            onChangeText={
              setPersonSearch
            }
            placeholder="Name or email"
            autoCapitalize="none"
            editable={!sending}
          />

          <Small
            style={{
              marginBottom:
                space.md,
            }}
          >
            {selectedPeople.length}{' '}
            selected
          </Small>

          {filteredPeople.map(
            person => {
              const selected =
                selectedPeople.includes(
                  person.id,
                );

              return (
                <Pressable
                  key={person.id}
                  disabled={sending}
                  onPress={() =>
                    toggle(
                      person.id,
                      setSelectedPeople,
                    )
                  }
                  style={{
                    opacity:
                      sending
                        ? 0.5
                        : 1,
                  }}
                >
                  <Card
                    style={
                      selected
                        ? {
                            borderColor:
                              palette.primary,
                            borderWidth: 2,
                          }
                        : undefined
                    }
                  >
                    <View
                      style={{
                        flexDirection:
                          'row',
                        alignItems:
                          'center',
                      }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor:
                            selected
                              ? palette.primary
                              : palette.placeholder,
                          alignItems:
                            'center',
                          justifyContent:
                            'center',
                          marginRight:
                            space.md,
                        }}
                      >
                        {selected ? (
                          <Icon
                            name="check"
                            size={18}
                            color={
                              palette.primary
                            }
                          />
                        ) : null}
                      </View>

                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Body
                          style={{
                            fontWeight:
                              '700',
                          }}
                        >
                          {person.name}
                        </Body>

                        <Small>
                          {person.email}
                        </Small>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            },
          )}
        </View>
      ) : null}

      <SectionTitle>
        Message
      </SectionTitle>

      <TextField
        label="Subject"
        value={subject}
        onChangeText={
          setSubject
        }
        placeholder="Emergency notification"
        editable={!sending}
        maxLength={160}
      />

      <TextField
        label="Message"
        value={message}
        onChangeText={
          setMessage
        }
        placeholder="Type the emergency information here…"
        multiline
        editable={!sending}
        maxLength={5000}
      />

      <Card>
        <Label>
          Ready to send
        </Label>

        <View
          style={{
            flexDirection:
              'row',
            justifyContent:
              'space-between',
            marginTop:
              space.sm,
          }}
        >
          <Small>
            Recipients
          </Small>

          <Body
            style={{
              fontWeight:
                '700',
            }}
          >
            {sending
              ? `${progress} / ${recipients.length}`
              : recipients.length}
          </Body>
        </View>

        <Small
          style={{
            marginTop:
              space.sm,
          }}
        >
          Each recipient receives a
          separate email. Their email
          address is not exposed to other
          recipients.
        </Small>
      </Card>

      <Button
        label={
          sending
            ? `Sending ${progress} of ${recipients.length}…`
            : 'Send emergency email'
        }
        onPress={send}
        loading={sending}
        disabled={
          loading ||
          sending ||
          recipients.length === 0
        }
        style={{
          marginTop:
            space.md,
        }}
      />
    </Screen>
  );
}