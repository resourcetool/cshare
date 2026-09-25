import React from 'react';
import { Screen } from '../../components/Screen';
import { AccountSection, CalendarSettings, NotificationSettings, ProfileForm } from '../../components/ProfileSections';
import { SectionTitle } from '../../components/ui';

export default function ProfileScreen() {
  return (
    <Screen inTabs>
      <SectionTitle>Reminders</SectionTitle>
      <NotificationSettings />
      <SectionTitle>Phone calendar</SectionTitle>
      <CalendarSettings />
      <SectionTitle>My details</SectionTitle>
      <ProfileForm />
      <SectionTitle>Account</SectionTitle>
      <AccountSection />
    </Screen>
  );
}
