import React, { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import RNPrint from 'react-native-print';
import { space } from '../theme';
import { logError } from '../utils/errors';
import { SheetDoc, sheetToHtml, sheetToText } from '../utils/sheetShare';
import { Button } from './ui';

/** Share the sheet as text (WhatsApp, SMS ...) or print it / save it as a PDF. */
export function SheetActions({ doc }: { doc: SheetDoc }) {
  const [busy, setBusy] = useState(false);

  const share = async () => {
    try {
      await Share.share({ message: sheetToText(doc) });
    } catch (e) {
      logError('share', e);
    }
  };

  const print = async () => {
    setBusy(true);
    try {
      await RNPrint.print({ html: sheetToHtml(doc), jobName: `${doc.meetingName} ${doc.weekRange}` });
    } catch (e) {
      logError('print', e);
      Alert.alert('Could not open printing', 'Please try again, or use “Share” instead.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.lg }}>
      <Button label="📤 Share" variant="secondary" onPress={share} style={{ flex: 1 }} />
      <Button label="🖨️ Print / PDF" variant="secondary" onPress={print} loading={busy} style={{ flex: 1 }} />
    </View>
  );
}
