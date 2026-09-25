import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/user/HomeScreen';
import MyWeekScreen from '../screens/user/MyWeekScreen';
import ContactAdminScreen from '../screens/user/ContactAdminScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import AssignmentDetailScreen from '../screens/shared/AssignmentDetailScreen';
import CantDoScreen from '../screens/shared/CantDoScreen';
import MyReportScreen from '../screens/shared/MyReportScreen';
import GroupReportScreen from '../screens/shared/GroupReportScreen';
import { UserStackParams, UserTabParams } from './types';
import { tabScreenOptions, stackScreenOptions } from './options';
import { useTheme } from '../context/ThemeContext';
import { tabIcon } from './TabIcon';

const Tab = createBottomTabNavigator<UserTabParams>();
const Stack = createNativeStackNavigator<UserStackParams>();

function UserTabs() {
  const { palette } = useTheme();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(palette)}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home', tabBarIcon: tabIcon('🏠') }} />
      <Tab.Screen name="MyWeek" component={MyWeekScreen} options={{ title: 'Week', tabBarLabel: 'Week', tabBarIcon: tabIcon('📅') }} />
      <Tab.Screen name="Report" component={MyReportScreen} options={{ title: 'My Monthly Report', tabBarLabel: 'Report', tabBarIcon: tabIcon('📝') }} />
      <Tab.Screen name="Contact" component={ContactAdminScreen} options={{ title: 'Contact admin', tabBarLabel: 'Contact', tabBarIcon: tabIcon('📞') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Settings', tabBarLabel: 'Settings', tabBarIcon: tabIcon('⚙️') }} />
    </Tab.Navigator>
  );
}

export default function UserNavigator() {
  const { palette } = useTheme();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(palette)}>
      <Stack.Screen name="UserTabs" component={UserTabs} options={{ headerShown: false }} />
      <Stack.Screen name="AssignmentDetail" component={AssignmentDetailScreen} options={{ title: 'Assignment' }} />
      <Stack.Screen name="CantDo" component={CantDoScreen} options={{ title: "I can't do this" }} />
      <Stack.Screen name="ContactAdmin" component={ContactAdminScreen} options={{ title: 'Contact admin' }} />
      <Stack.Screen name="MyReport" component={MyReportScreen} options={{ title: 'My Monthly Report' }} />
      <Stack.Screen name="GroupReport" component={GroupReportScreen} options={{ title: 'Group Monthly Report' }} />
    </Stack.Navigator>
  );
}
