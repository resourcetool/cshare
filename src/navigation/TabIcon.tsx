import React from 'react';
import { Text } from 'react-native';

/** Emoji icon for the bottom tabs (works everywhere, no icon library needed). */
export function tabIcon(emoji: string) {
  return function TabIcon() {
    return <Text style={{ fontSize: 24 }}>{emoji}</Text>;
  };
}
