import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import RootNavigator from './navigation/RootNavigator';
import { flushPendingNavigation, navigationRef, openAssignment, openGroupReport } from './navigation/navigationRef';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getLaunchNotificationData, listenForNotificationPress } from './services/notificationService';
import { logError } from './utils/errors';
import './firebase';

function Root() {
  const { palette, scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: palette.bg, primary: palette.primary, card: palette.surface, text: palette.ink, border: palette.line },
  };

  useEffect(() => {
    // Tapping a reminder opens that assignment.
    getLaunchNotificationData()
      .then(data => {
        const groupId = data?.groupId;
        const assignmentId = data?.assignmentId;
        if (typeof groupId === 'string') openGroupReport(groupId);
        else if (typeof assignmentId === 'string') openAssignment(assignmentId);
      })
      .catch(e => logError('launch notification', e));
    return listenForNotificationPress(openAssignment, openGroupReport);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={palette.bg} />
      <ErrorBoundary>
        <AuthProvider>
          <NavigationContainer ref={navigationRef} theme={navTheme} onReady={flushPendingNavigation}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}
