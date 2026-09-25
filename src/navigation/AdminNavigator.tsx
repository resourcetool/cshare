import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/admin/DashboardScreen';
import WeekScreen from '../screens/admin/WeekScreen';
import PeopleScreen from '../screens/admin/PeopleScreen';
import SettingsScreen from '../screens/admin/SettingsScreen';
import PersonEditScreen from '../screens/admin/PersonEditScreen';
import TypeEditScreen from '../screens/admin/TypeEditScreen';
import GroupsScreen from '../screens/admin/GroupsScreen';
import GroupEditScreen from '../screens/admin/GroupEditScreen';
import ContactAdminScreen from '../screens/user/ContactAdminScreen';
import AssignmentDetailScreen from '../screens/shared/AssignmentDetailScreen';
import CantDoScreen from '../screens/shared/CantDoScreen';
import MyReportScreen from '../screens/shared/MyReportScreen';
import GroupReportScreen from '../screens/shared/GroupReportScreen';
import { AdminStackParams, AdminTabParams } from './types';
import { stackScreenOptions, tabScreenOptions } from './options';
import { useTheme } from '../context/ThemeContext';
import { tabIcon } from './TabIcon';

const Tab = createBottomTabNavigator<AdminTabParams>();
const Stack = createNativeStackNavigator<AdminStackParams>();

function AdminTabs() {
  const { palette } = useTheme();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(palette)}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'CSHARE', tabBarLabel: 'Dashboard', tabBarIcon: tabIcon('🏠') }} />
      <Tab.Screen name="Week" component={WeekScreen} options={{ title: 'Week', tabBarLabel: 'Week', tabBarIcon: tabIcon('📅') }} />
      <Tab.Screen name="People" component={PeopleScreen} options={{ title: 'People', tabBarLabel: 'People', tabBarIcon: tabIcon('👥') }} />
      <Tab.Screen name="Report" component={MyReportScreen} options={{ title: 'My Monthly Report', tabBarLabel: 'Report', tabBarIcon: tabIcon('📝') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings', tabBarLabel: 'Settings', tabBarIcon: tabIcon('⚙️') }} />
    </Tab.Navigator>
  );
}

export default function AdminNavigator() {
  const { palette } = useTheme();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(palette)}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} options={{ headerShown: false }} />
      <Stack.Screen name="PersonEdit" component={PersonEditScreen} options={{ title: 'Person' }} />
      <Stack.Screen name="TypeEdit" component={TypeEditScreen} options={{ title: 'Assignment type' }} />
      <Stack.Screen name="Groups" component={GroupsScreen} options={{ title: 'Ministry groups' }} />
      <Stack.Screen name="GroupEdit" component={GroupEditScreen} options={{ title: 'Group' }} />
      <Stack.Screen name="AssignmentDetail" component={AssignmentDetailScreen} options={{ title: 'My assignment' }} />
      <Stack.Screen name="CantDo" component={CantDoScreen} options={{ title: "I can't do this" }} />
      <Stack.Screen name="ContactAdmin" component={ContactAdminScreen} options={{ title: 'Contact admin' }} />
      <Stack.Screen name="MyReport" component={MyReportScreen} options={{ title: 'My Monthly Report' }} />
      <Stack.Screen name="GroupReport" component={GroupReportScreen} options={{ title: 'Group Monthly Report' }} />
    </Stack.Navigator>
  );
}
