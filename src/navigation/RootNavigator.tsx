import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import OnboardingNavigator from '@/navigation/OnboardingNavigator';
import TabNavigator from '@/navigation/TabNavigator';
import { registerPushToken, setupNotificationHandlers } from '@/services/notifications';
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

  const { isLoading, isAuthenticated, user } = useAuthStore();

  // ── Push notification setup — runs once when user authenticates ────────────

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Register push token in the background — non-blocking
    registerPushToken(user.id);
  }, [isAuthenticated, user?.id]);

  // ── Notification handlers — active for the lifetime of the app ────────────

  useEffect(() => {
    const cleanup = setupNotificationHandlers(
      (notification) => {
        // TODO: route foreground notification to ZoneStolenToast in Phase 4
        console.log('[RootNavigator] Notification received:', notification.request.content.title);
      },
      (response) => {
        // TODO: deep-link tap handling (zone stolen → MapScreen, etc.) in Phase 4
        console.log('[RootNavigator] Notification tapped:', response.notification.request.content.title);
      },
    );
    return cleanup;
  }, []);

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
