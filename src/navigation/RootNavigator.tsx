import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import AuthScreen from '@/screens/AuthScreen';
import { colors } from '@/utils/constants';

// ---------------------------------------------------------------------------
// Lazy screen imports — keeps cold start fast (Phase 4 performance rule)
// ---------------------------------------------------------------------------
const MapScreen      = React.lazy(() => import('@/screens/MapScreen'));
const RunScreen      = React.lazy(() => import('@/screens/RunScreen'));
const FeedScreen     = React.lazy(() => import('@/screens/FeedScreen'));
const ProfileScreen  = React.lazy(() => import('@/screens/ProfileScreen'));

// ---------------------------------------------------------------------------
// Navigator types
// ---------------------------------------------------------------------------

export type OnboardingStackParamList = {
  Auth: undefined;
};

export type MainTabParamList = {
  Map: undefined;
  Run: undefined;
  Feed: undefined;
  Profile: undefined;
};

const OnboardingStack = createStackNavigator<OnboardingStackParamList>();
const MainTab         = createBottomTabNavigator<MainTabParamList>();

// ---------------------------------------------------------------------------
// Onboarding stack
// ---------------------------------------------------------------------------

function OnboardingNavigator(): React.ReactElement {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="Auth" component={AuthScreen} />
    </OnboardingStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Main tab navigator
// ---------------------------------------------------------------------------

function MainTabNavigator(): React.ReactElement {
  return (
    <MainTab.Navigator
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
      <MainTab.Screen
        name="Map"
        children={() => (
          <React.Suspense fallback={<LoadingScreen />}>
            <MapScreen />
          </React.Suspense>
        )}
      />
      <MainTab.Screen
        name="Run"
        children={() => (
          <React.Suspense fallback={<LoadingScreen />}>
            <RunScreen />
          </React.Suspense>
        )}
      />
      <MainTab.Screen
        name="Feed"
        children={() => (
          <React.Suspense fallback={<LoadingScreen />}>
            <FeedScreen />
          </React.Suspense>
        )}
      />
      <MainTab.Screen
        name="Profile"
        children={() => (
          <React.Suspense fallback={<LoadingScreen />}>
            <ProfileScreen />
          </React.Suspense>
        )}
      />
    </MainTab.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Loading screen — shown while the auth listener hydrates
// ---------------------------------------------------------------------------

function LoadingScreen(): React.ReactElement {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root navigator
// ---------------------------------------------------------------------------

export default function RootNavigator(): React.ReactElement {
  useAuth(); // initializes the Supabase auth listener and syncs to authStore

  const { isLoading, isAuthenticated } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabNavigator /> : <OnboardingNavigator />}
    </NavigationContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
});
