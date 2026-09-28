import React from 'react';
import { Icon, IconName } from '../components/Icon';

/** Consistent outline icons for the bottom tabs. */
export function tabIcon(name: IconName) {
  return function TabIcon({ color }: { focused: boolean; color: string }) {
    return <Icon name={name} size={23} color={color} />;
  };
}
