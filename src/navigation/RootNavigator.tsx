import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import OnboardingNavigator from '@/navigation/OnboardingNavigator';
import TabNavigator from '@/navigation/TabNavigator';
import { colors } from '@/utils/constants';

function LoadingScreen(): React.ReactElement {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export default function RootNavigator(): React.ReactElement {
  useAuth(); // initializes the Supabase auth listener and syncs to authStore

  const { isLoading, isAuthenticated } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <TabNavigator /> : <OnboardingNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
});
