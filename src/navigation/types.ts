import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Meeting, PeopleFilter } from '../types';

export type { PeopleFilter };

// NOTE: React Navigation needs these to be `type` aliases, not `interface`s.

/** Screens both roles can open (the administrator stack is a superset of the user stack). */
export type SharedStackParams = {
  AssignmentDetail: { assignmentId: string };
  CantDo: { assignmentId: string };
  ContactAdmin: undefined;
  MyReport: undefined;
  GroupReport: { groupId?: string } | undefined;
};

export type UserStackParams = SharedStackParams & {
  UserTabs: undefined;
};

export type AdminStackParams = SharedStackParams & {
  AdminTabs: undefined;
  PersonEdit: { userId: string };
  TypeEdit: { typeId?: string } | undefined;
  Groups: undefined;
  GroupEdit: { groupId?: string } | undefined;
};

export type UserTabParams = {
  Home: undefined;
  MyWeek: undefined;
  Report: undefined;
  Contact: undefined;
  Profile: undefined;
};

export type AdminTabParams = {
  Dashboard: undefined;
  Week: { weekId?: string; meeting?: Meeting; planner?: boolean } | undefined;
  People: { filter?: PeopleFilter } | undefined;
  Report: undefined;
  Settings: undefined;
};

export type UserNav = CompositeNavigationProp<
  BottomTabNavigationProp<UserTabParams>,
  NativeStackNavigationProp<UserStackParams>
>;
export type AdminNav = CompositeNavigationProp<
  BottomTabNavigationProp<AdminTabParams>,
  NativeStackNavigationProp<AdminStackParams>
>;
