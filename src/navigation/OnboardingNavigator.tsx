import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import AuthScreen from '@/screens/AuthScreen';

export type OnboardingStackParamList = {
  Auth: undefined;
};

const Stack = createStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Auth" component={AuthScreen} />
    </Stack.Navigator>
  );
}
