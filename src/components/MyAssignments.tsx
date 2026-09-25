import React from 'react';
import { AssignmentCard } from './AssignmentCard';
import {
  EmptyState,
  LoadingView,
  SectionTitle,
} from './ui';
import { useAppData } from '../context/AppDataContext';
import { useNow } from '../hooks/useNow';
import {
  todaysFor,
  upcomingFor,
} from '../utils/status';
import { Assignment } from '../types';

/**
 * Shows today's and upcoming assignments.
 *
 * Past assignments are intentionally not shown here.
 * The assignment service now retrieves the person's assignments
 * reliably by assignee, while this component decides what is
 * currently relevant to display.
 */
export function MyAssignments({
  onOpen,
}: {
  onOpen: (a: Assignment) => void;
}) {
  const {
    profile,
    settings,
    myAssignments,
    myLoading,
  } = useAppData();

  const now = useNow();

  const today =
    todaysFor(
      myAssignments,
      now,
    );

  const upcoming =
    upcomingFor(
      myAssignments,
      now,
    ).filter(
      a =>
        !today.some(
          t => t.id === a.id,
        ),
    );

  const nameOf = (
    a: Assignment,
  ) =>
    a.meeting === 'weekend'
      ? settings.weekendName
      : a.meeting === 'midweek'
        ? settings.midweekName
        : undefined;

  if (
    myLoading &&
    myAssignments.length === 0
  ) {
    return (
      <LoadingView
        message="Loading your assignments…"
      />
    );
  }

  if (
    today.length === 0 &&
    upcoming.length === 0
  ) {
    return (
      <EmptyState
        title="No upcoming assignments"
        message="You're all caught up. When an administrator gives you a part, it will appear here and you will be reminded."
      />
    );
  }

  return (
    <>
      {today.length ? (
        <>
          <SectionTitle>
            Today
          </SectionTitle>

          {today.map((a, i) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              uid={profile.id}
              variant="user"
              meetingName={nameOf(a)}
              onPress={() =>
                onOpen(a)
              }
              highlight={i === 0}
            />
          ))}
        </>
      ) : null}

      {upcoming.length ? (
        <>
          <SectionTitle>
            Upcoming
          </SectionTitle>

          {upcoming.map(a => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              uid={profile.id}
              variant="user"
              meetingName={nameOf(a)}
              onPress={() =>
                onOpen(a)
              }
            />
          ))}
        </>
      ) : null}
    </>
  );
}