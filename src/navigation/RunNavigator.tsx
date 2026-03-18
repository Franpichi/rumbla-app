import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import RunScreen        from '@/screens/RunScreen';
import RunSummaryScreen from '@/screens/RunSummaryScreen';
import { RunStackParamList } from '@/types/navigation';

const Stack = createStackNavigator<RunStackParamList>();

export default function RunNavigator(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RunHome"     component={RunScreen} />
      <Stack.Screen name="RunSummary"  component={RunSummaryScreen} />
    </Stack.Navigator>
  );
}
