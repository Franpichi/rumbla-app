import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import MapScreen     from '@/screens/MapScreen';
import RunScreen     from '@/screens/RunScreen';
import FeedScreen    from '@/screens/FeedScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import { colors } from '@/utils/constants';

export type MainTabParamList = {
  Map: undefined;
  Run: undefined;
  Feed: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function TabNavigator(): React.ReactElement {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.borderSubtle,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDisabled,
      }}
    >
      <Tab.Screen name="Map"     component={MapScreen} />
      <Tab.Screen name="Run"     component={RunScreen} />
      <Tab.Screen name="Feed"    component={FeedScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
