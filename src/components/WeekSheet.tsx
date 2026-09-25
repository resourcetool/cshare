import React from 'react';
import { View } from 'react-native';
import { Assignment, UserProfile } from '../types';
import { groupByCategory } from '../utils/sheet';
import { space } from '../theme';
import { AssignmentCard } from './AssignmentCard';
import { Heading } from './ui';

interface Props {
  assignments: Assignment[];
  categories: string[];
  uid: string;
  variant: 'user' | 'admin';
  onPress: (a: Assignment) => void;
  usersById?: Record<string, UserProfile>;
}

/** The weekly "assignment sheet": assignments grouped under their section. */
export function WeekSheet({ assignments, categories, uid, variant, onPress, usersById }: Props) {
  return (
    <View>
      {groupByCategory(assignments, categories).map(section => (
        <View key={section.category}>
          <Heading style={{ marginTop: space.lg, marginBottom: space.sm }}>{section.category}</Heading>
          {section.items.map(a => (
            <AssignmentCard key={a.id} assignment={a} uid={uid} variant={variant} usersById={usersById} onPress={() => onPress(a)} />
          ))}
        </View>
      ))}
    </View>
  );
}
