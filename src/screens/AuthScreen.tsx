import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { colors, typography, spacing, radius } from '@/utils/constants';
import { UserProfile } from '@/types/models';

// Required for expo-auth-session OAuth redirect handling on mobile
WebBrowser.maybeCompleteAuthSession();

// ---------------------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------------------

async function fetchOrCreateProfile(userId: string, displayName: string | null): Promise<UserProfile> {
  const { data: existing, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (existing) return existing as UserProfile;

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(fetchError.message);
  }

  // Create a stub profile — user will complete setup in ProfileSetupScreen
  const username = `user_${userId.slice(0, 8)}`;
  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username,
      display_name: displayName,
      city: 'Copenhagen',
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);
  return created as UserProfile;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AuthScreen(): React.ReactElement {
  const { setUser, setSession } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ── Apple Sign In ──────────────────────────────────────────────────────────

  async function handleAppleSignIn(): Promise<void> {
    try {
      setIsLoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken ?? '',
      });

      if (error) throw new Error(error.message);
      if (!data.session || !data.user) throw new Error('No session returned from Apple sign in.');

      const displayName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(' ') || null
        : null;

      const profile = await fetchOrCreateProfile(data.user.id, displayName);

      setSession(data.session);
      setUser(profile);
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err as { code?: string }).code === 'ERR_REQUEST_CANCELED'
      ) {
        // User dismissed the Apple sheet — not an error
        return;
      }
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Google Sign In ─────────────────────────────────────────────────────────

  async function handleGoogleSignIn(): Promise<void> {
    try {
      setIsLoading(true);

      // Build the redirect URI that Supabase will send the user back to
      const redirectUri = AuthSession.makeRedirectUri();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw new Error(error.message);
      if (!data.url) throw new Error('No OAuth URL returned from Supabase.');

      // Open the Google consent screen in an in-app browser
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (result.type !== 'success') {
        // User cancelled or browser closed — not an error
        return;
      }

      // Extract the session tokens from the redirect URL
      const url = result.url;
      const params = new URLSearchParams(url.split('#')[1] ?? url.split('?')[1] ?? '');
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) {
        throw new Error('Missing tokens in OAuth redirect.');
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });

      if (sessionError) throw new Error(sessionError.message);
      if (!sessionData.session || !sessionData.user) throw new Error('No session after Google sign in.');

      const displayName = sessionData.user.user_metadata?.full_name as string | null ?? null;
      const profile = await fetchOrCreateProfile(sessionData.user.id, displayName);

      setSession(sessionData.session);
      setUser(profile);
    } catch (err: unknown) {
      Alert.alert('Google sign in failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Email Sign In / Sign Up ────────────────────────────────────────────────

  async function handleEmailAuth(): Promise<void> {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }

    try {
      setIsLoading(true);

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        if (!data.session || !data.user) {
          Alert.alert('Check your email', 'A confirmation link has been sent.');
          return;
        }
        const profile = await fetchOrCreateProfile(data.user.id, null);
        setSession(data.session);
        setUser(profile);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        if (!data.session || !data.user) throw new Error('No session returned.');
        const profile = await fetchOrCreateProfile(data.user.id, null);
        setSession(data.session);
        setUser(profile);
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo / headline */}
        <Text style={styles.logo}>RUMBLA</Text>
        <Text style={styles.tagline}>Conquer your city, street by street.</Text>

        {/* Apple Sign In — iOS only */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={radius.md}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        )}

        {/* Google Sign In */}
        <TouchableOpacity
          style={[styles.googleButton, isLoading && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email fallback toggle */}
        {!isEmailMode ? (
          <TouchableOpacity
            style={styles.emailToggle}
            onPress={() => setIsEmailMode(true)}
          >
            <Text style={styles.emailToggleText}>Continue with email</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textDisabled}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.buttonDisabled]}
              onPress={handleEmailAuth}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isSignUp ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsSignUp((v) => !v)}>
              <Text style={styles.switchModeText}>
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  logo: {
    fontFamily: typography.fontFamily,
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.accent,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    fontWeight: typography.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  appleButton: {
    width: '100%',
    height: 50,
  },
  googleButton: {
    width: '100%',
    height: 50,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  dividerText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    color: colors.textDisabled,
  },
  emailToggle: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  emailToggleText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontFamily: typography.fontFamily,
    fontSize: typography.base,
    color: colors.textPrimary,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitButtonText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  switchModeText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
