import React, { useMemo } from 'react';
import { Linking } from 'react-native';
import { Badge, Button, Card, Heading, Small } from './ui';
import { useLive } from '../hooks/useLive';
import { subscribeToAppUpdate } from '../services/updateService';
import { AppUpdateConfig } from '../types';
import { APP_VERSION_CODE, APP_VERSION_NAME } from '../config/appVersion';
import { space } from '../theme';

export function AppUpdateNotice() {
  const update = useLive<AppUpdateConfig | null>(subscribeToAppUpdate, []);
  const available = useMemo(() => {
    const u = update.data;
    return !!u?.available && u.versionCode > APP_VERSION_CODE && !!u.url;
  }, [update.data]);

  if (!available || !update.data) return null;

  const openUpdate = async () => {
    try {
      await Linking.openURL(update.data!.url);
    } catch {
      // Android will show the normal error if no browser/Drive handler is available.
    }
  };

  return (
    <Card style={{ marginBottom: space.lg }}>
      <Heading>🔄 CSHARE update available</Heading>
      <Small style={{ marginTop: space.xs }}>
        Version {update.data.versionName} is available. You are using {APP_VERSION_NAME}.
      </Small>
      <Small style={{ marginTop: space.sm }}>{update.data.message}</Small>
      <Button label={`Update to ${update.data.versionName}`} onPress={openUpdate} style={{ marginTop: space.md }} />
      <Badge label="Tap Update to open the APK link" tone="info" />
    </Card>
  );
}
