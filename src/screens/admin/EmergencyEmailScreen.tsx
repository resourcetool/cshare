import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '../../components/ui';
import {
  Button,
  Card,
  SectionTitle,
  Text,
} from '../../components/ui';

import { Icon } from '../../components/Icon';

import {
  sendEmergencyEmail,
  wait,
  EMAIL_SEND_INTERVAL_MS,
  EmergencyEmailRecipient,
} from '../../services/emailService';

import { confirmAsync } from '../../utils/confirmAsync';

import { useLive } from '../../hooks/useLive';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';


type SendMode = 'all' | 'groups' | 'people';

type NoticeTone = 'good' | 'bad' | 'info';

interface Notice {
  tone: NoticeTone;
  text: string;
}


export default function EmergencyEmailScreen() {
  const { colors } = useTheme();
  const { users, groups } = useAppData();

  const [mode, setMode] = useState<SendMode>('all');

  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);

  const [search, setSearch] = useState('');

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState('');

  const [notice, setNotice] = useState<Notice | null>(null);


  /*
   * --------------------------------------------------------------------------
   * USERS
   * --------------------------------------------------------------------------
   */

  const activeUsers = useMemo(() => {
    return (users ?? []).filter((user: any) => {
      return (
        user?.active !== false &&
        typeof user?.email === 'string' &&
        user.email.trim().length > 0
      );
    });
  }, [users]);


  /*
   * --------------------------------------------------------------------------
   * SEARCH
   * --------------------------------------------------------------------------
   */

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return activeUsers;
    }

    return activeUsers.filter((user: any) => {
      const name = String(user?.name ?? '').toLowerCase();
      const email = String(user?.email ?? '').toLowerCase();

      return (
        name.includes(query) ||
        email.includes(query)
      );
    });
  }, [activeUsers, search]);


  /*
   * --------------------------------------------------------------------------
   * GROUPS
   * --------------------------------------------------------------------------
   */

  const availableGroups = useMemo(() => {
    return groups ?? [];
  }, [groups]);


  /*
   * --------------------------------------------------------------------------
   * TOGGLE GROUP
   * --------------------------------------------------------------------------
   */

  function toggleGroup(groupId: string) {
    setSelectedGroups(current => {
      if (current.includes(groupId)) {
        return current.filter(id => id !== groupId);
      }

      return [...current, groupId];
    });
  }


  /*
   * --------------------------------------------------------------------------
   * TOGGLE PERSON
   * --------------------------------------------------------------------------
   */

  function togglePerson(userId: string) {
    setSelectedPeople(current => {
      if (current.includes(userId)) {
        return current.filter(id => id !== userId);
      }

      return [...current, userId];
    });
  }


  /*
   * --------------------------------------------------------------------------
   * BUILD RECIPIENT LIST
   * --------------------------------------------------------------------------
   */

  const recipients = useMemo<EmergencyEmailRecipient[]>(() => {
    let selectedUsers: any[] = [];

    /*
     * Entire congregation
     */
    if (mode === 'all') {
      selectedUsers = [...activeUsers];
    }

    /*
     * Selected groups
     */
    if (mode === 'groups') {
      selectedUsers = activeUsers.filter((user: any) => {
        const userGroupId =
          user?.groupId ??
          user?.groupID ??
          user?.group;

        return (
          userGroupId &&
          selectedGroups.includes(String(userGroupId))
        );
      });
    }

    /*
     * Selected individual people
     */
    if (mode === 'people') {
      selectedUsers = activeUsers.filter((user: any) =>
        selectedPeople.includes(String(user?.id)),
      );
    }

    /*
     * Convert users into EmailJS recipients.
     *
     * De-duplicate by email address so one person does not
     * receive the same emergency email twice.
     */
    const seenEmails = new Set<string>();

    return selectedUsers
      .map((user: any) => {
        const email = String(user?.email ?? '').trim();

        return {
          id: String(user?.id ?? email),
          name: String(user?.name ?? 'Member'),
          email,
        };
      })
      .filter(recipient => {
        const emailKey = recipient.email.toLowerCase();

        if (!emailKey) {
          return false;
        }

        if (seenEmails.has(emailKey)) {
          return false;
        }

        seenEmails.add(emailKey);

        return true;
      });
  }, [
    mode,
    activeUsers,
    selectedGroups,
    selectedPeople,
  ]);


  /*
   * --------------------------------------------------------------------------
   * VALIDATION
   * --------------------------------------------------------------------------
   */

  function validate(): string | null {
    if (!subject.trim()) {
      return 'Please enter an email subject.';
    }

    if (!message.trim()) {
      return 'Please enter the emergency message.';
    }

    if (recipients.length === 0) {
      return 'Please select at least one recipient.';
    }

    return null;
  }


  /*
   * --------------------------------------------------------------------------
   * SEND
   * --------------------------------------------------------------------------
   */

  async function handleSend() {
    if (sending) {
      return;
    }

    setNotice(null);

    const validationError = validate();

    if (validationError) {
      setNotice({
        tone: 'bad',
        text: validationError,
      });

      return;
    }

    const confirmed = await confirmAsync({
      title: 'Send Emergency Email?',
      message:
        `This will send the emergency message to ${recipients.length} recipient${
          recipients.length === 1 ? '' : 's'
        }.\n\nDo you want to continue?`,
      confirmText: 'Send',
      cancelText: 'Cancel',
    });

    if (!confirmed) {
      return;
    }

    setSending(true);
    setNotice(null);

    let sent = 0;

    const failed: string[] = [];

    try {
      for (let i = 0; i < recipients.length; i += 1) {
        const recipient = recipients[i];

        setProgress(
          `Sending ${i + 1} of ${recipients.length}...\n${recipient.name}`,
        );

        try {
          await sendEmergencyEmail({
            recipient,
            subject: subject.trim(),
            message: message.trim(),
          });

          sent += 1;
        } catch (error) {
          /*
           * IMPORTANT:
           * Do not hide the EmailJS error.
           *
           * This will show the actual HTTP status and response
           * returned by EmailJS, which will help us diagnose
           * the problem.
           */
          const errorMessage =
            error instanceof Error
              ? error.message
              : String(error);

          failed.push(
            `${recipient.name}: ${errorMessage}`,
          );
        }

        /*
         * Do not wait after the final request.
         */
        if (i < recipients.length - 1) {
          await wait(EMAIL_SEND_INTERVAL_MS);
        }
      }

      setProgress('');

      if (failed.length === 0) {
        setNotice({
          tone: 'good',
          text:
            `${sent} email${
              sent === 1 ? '' : 's'
            } sent successfully.`,
        });

        /*
         * Clear the message after a completely successful send.
         */
        setSubject('');
        setMessage('');

        return;
      }

      if (sent === 0) {
        setNotice({
          tone: 'bad',
          text:
            `0 sent successfully; ${failed.length} failed.\n\n` +
            failed.join('\n'),
        });

        return;
      }

      setNotice({
        tone: 'bad',
        text:
          `${sent} sent successfully; ${failed.length} failed.\n\n` +
          failed.join('\n'),
      });
    } finally {
      setSending(false);
      setProgress('');
    }
  }


  /*
   * --------------------------------------------------------------------------
   * MODE BUTTON
   * --------------------------------------------------------------------------
   */

  function ModeButton({
    value,
    title,
    icon,
  }: {
    value: SendMode;
    title: string;
    icon: string;
  }) {
    const selected = mode === value;

    return (
      <Pressable
        onPress={() => {
          setMode(value);
          setNotice(null);
        }}
        disabled={sending}
        style={{
          flex: 1,
          minHeight: 58,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: selected
            ? colors.primary
            : colors.border,
          backgroundColor: selected
            ? colors.primary
            : colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 8,
        }}
      >
        <Icon
          name={icon as any}
          size={20}
          color={
            selected
              ? colors.onPrimary
              : colors.text
          }
        />

        <Text
          style={{
            marginTop: 5,
            fontSize: 12,
            fontWeight: '700',
            color: selected
              ? colors.onPrimary
              : colors.text,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
      </Pressable>
    );
  }


  /*
   * --------------------------------------------------------------------------
   * GROUP LIST
   * --------------------------------------------------------------------------
   */

  function renderGroups() {
    if (availableGroups.length === 0) {
      return (
        <Text
          style={{
            color: colors.mutedText,
            paddingVertical: 10,
          }}
        >
          No groups available.
        </Text>
      );
    }

    return (
      <View style={{ gap: 8 }}>
        {availableGroups.map((group: any) => {
          const groupId = String(
            group?.id ??
            group?.groupId ??
            group?.name ??
            '',
          );

          const groupName = String(
            group?.name ??
            group?.title ??
            'Group',
          );

          const selected =
            selectedGroups.includes(groupId);

          return (
            <Pressable
              key={groupId}
              onPress={() => toggleGroup(groupId)}
              disabled={sending}
              style={{
                minHeight: 52,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: selected
                  ? colors.primary
                  : colors.border,
                backgroundColor: selected
                  ? colors.primary + '12'
                  : colors.card,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: selected
                    ? colors.primary
                    : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                {selected && (
                  <Icon
                    name="check"
                    size={14}
                    color={colors.primary}
                  />
                )}
              </View>

              <Text
                style={{
                  flex: 1,
                  fontWeight: '600',
                  color: colors.text,
                }}
              >
                {groupName}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }


  /*
   * --------------------------------------------------------------------------
   * PEOPLE LIST
   * --------------------------------------------------------------------------
   */

  function renderPeople() {
    return (
      <View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or email..."
          placeholderTextColor={colors.mutedText}
          editable={!sending}
          style={{
            minHeight: 48,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            color: colors.text,
            backgroundColor: colors.card,
            marginBottom: 10,
          }}
        />

        {filteredPeople.length === 0 ? (
          <Text
            style={{
              color: colors.mutedText,
              paddingVertical: 10,
            }}
          >
            No people found.
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {filteredPeople.map((user: any) => {
              const userId = String(
                user?.id ??
                user?.email ??
                '',
              );

              const selected =
                selectedPeople.includes(userId);

              const name = String(
                user?.name ?? 'Member',
              );

              const email = String(
                user?.email ?? '',
              );

              return (
                <Pressable
                  key={userId}
                  onPress={() =>
                    togglePerson(userId)
                  }
                  disabled={sending}
                  style={{
                    minHeight: 58,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selected
                      ? colors.primary
                      : colors.border,
                    backgroundColor: selected
                      ? colors.primary + '12'
                      : colors.card,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: selected
                        ? colors.primary
                        : colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {selected && (
                      <Icon
                        name="check"
                        size={14}
                        color={colors.primary}
                      />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: '700',
                        color: colors.text,
                      }}
                    >
                      {name}
                    </Text>

                    <Text
                      style={{
                        fontSize: 12,
                        marginTop: 2,
                        color: colors.mutedText,
                      }}
                    >
                      {email}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    );
  }


  /*
   * --------------------------------------------------------------------------
   * SCREEN
   * --------------------------------------------------------------------------
   */

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 18 }}>
          <Text
            style={{
              fontSize: 26,
              fontWeight: '800',
              color: colors.text,
            }}
          >
            Emergency Email
          </Text>

          <Text
            style={{
              marginTop: 5,
              color: colors.mutedText,
              lineHeight: 20,
            }}
          >
            Send an urgent notification to selected
            members or the entire congregation.
          </Text>
        </View>


        {/* ---------------------------------------------------------------- */}
        {/* RECIPIENT MODE                                                    */}
        {/* ---------------------------------------------------------------- */}

        <Card style={{ marginBottom: 14 }}>
          <SectionTitle>Recipients</SectionTitle>

          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginTop: 8,
            }}
          >
            <ModeButton
              value="all"
              title="Everyone"
              icon="users"
            />

            <ModeButton
              value="groups"
              title="Groups"
              icon="layers"
            />

            <ModeButton
              value="people"
              title="People"
              icon="user"
            />
          </View>

          <View
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              backgroundColor:
                colors.primary + '10',
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                color: colors.text,
              }}
            >
              {recipients.length} recipient
              {recipients.length === 1
                ? ''
                : 's'}
            </Text>
          </View>
        </Card>


        {/* ---------------------------------------------------------------- */}
        {/* GROUP SELECTION                                                   */}
        {/* ---------------------------------------------------------------- */}

        {mode === 'groups' && (
          <Card style={{ marginBottom: 14 }}>
            <SectionTitle>
              Select Groups
            </SectionTitle>

            <View style={{ marginTop: 8 }}>
              {renderGroups()}
            </View>
          </Card>
        )}


        {/* ---------------------------------------------------------------- */}
        {/* PEOPLE SELECTION                                                  */}
        {/* ---------------------------------------------------------------- */}

        {mode === 'people' && (
          <Card style={{ marginBottom: 14 }}>
            <SectionTitle>
              Select People
            </SectionTitle>

            <View style={{ marginTop: 8 }}>
              {renderPeople()}
            </View>
          </Card>
        )}


        {/* ---------------------------------------------------------------- */}
        {/* EMAIL COMPOSER                                                    */}
        {/* ---------------------------------------------------------------- */}

        <Card style={{ marginBottom: 14 }}>
          <SectionTitle>
            Emergency Message
          </SectionTitle>

          <Text
            style={{
              marginTop: 12,
              marginBottom: 6,
              fontSize: 13,
              fontWeight: '700',
              color: colors.text,
            }}
          >
            Subject
          </Text>

          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Emergency notification"
            placeholderTextColor={colors.mutedText}
            editable={!sending}
            style={{
              minHeight: 48,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              color: colors.text,
              backgroundColor: colors.card,
            }}
          />

          <Text
            style={{
              marginTop: 14,
              marginBottom: 6,
              fontSize: 13,
              fontWeight: '700',
              color: colors.text,
            }}
          >
            Message
          </Text>

          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Type the emergency message..."
            placeholderTextColor={colors.mutedText}
            editable={!sending}
            multiline
            textAlignVertical="top"
            style={{
              minHeight: 160,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: colors.text,
              backgroundColor: colors.card,
            }}
          />
        </Card>


        {/* ---------------------------------------------------------------- */}
        {/* PROGRESS                                                          */}
        {/* ---------------------------------------------------------------- */}

        {sending && (
          <Card
            style={{
              marginBottom: 14,
              borderColor: colors.primary,
              borderWidth: 1,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <ActivityIndicator
                size="small"
                color={colors.primary}
              />

              <Text
                style={{
                  marginLeft: 10,
                  flex: 1,
                  color: colors.text,
                  fontWeight: '600',
                  lineHeight: 20,
                }}
              >
                {progress || 'Sending...'}
              </Text>
            </View>
          </Card>
        )}


        {/* ---------------------------------------------------------------- */}
        {/* NOTICE                                                            */}
        {/* ---------------------------------------------------------------- */}

        {notice && (
          <Card
            style={{
              marginBottom: 14,
              borderWidth: 1,
              borderColor:
                notice.tone === 'good'
                  ? colors.primary
                  : notice.tone === 'bad'
                    ? colors.danger
                    : colors.border,
            }}
          >
            <Text
              style={{
                color:
                  notice.tone === 'good'
                    ? colors.primary
                    : notice.tone === 'bad'
                      ? colors.danger
                      : colors.text,
                lineHeight: 21,
                fontWeight: '600',
              }}
            >
              {notice.text}
            </Text>
          </Card>
        )}


        {/* ---------------------------------------------------------------- */}
        {/* SEND BUTTON                                                       */}
        {/* ---------------------------------------------------------------- */}

        <Pressable
          onPress={handleSend}
          disabled={sending}
          style={{
            minHeight: 54,
            borderRadius: 14,
            backgroundColor: sending
              ? colors.border
              : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            paddingHorizontal: 18,
          }}
        >
          {sending ? (
            <ActivityIndicator
              size="small"
              color={colors.text}
            />
          ) : (
            <Icon
              name="send"
              size={20}
              color={colors.onPrimary}
            />
          )}

          <Text
            style={{
              marginLeft: 8,
              color: sending
                ? colors.mutedText
                : colors.onPrimary,
              fontWeight: '800',
              fontSize: 15,
            }}
          >
            {sending
              ? 'Sending...'
              : 'Send Emergency Email'}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}