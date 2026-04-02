import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { radius } from '@/utils/constants';
import { UserProfile } from '@/types/models';

// Required for expo-auth-session OAuth redirect handling on mobile
WebBrowser.maybeCompleteAuthSession();

// ---------------------------------------------------------------------------
// Design tokens (per Issue 3 spec)
// ---------------------------------------------------------------------------

const C = {
  bg:           '#0D0F14',
  primary:      '#FF5C35',
  accent:       '#00E5CC',
  inputBg:      '#1A1D24',
  border:       '#2A2D35',
  textPrimary:  '#FFFFFF',
  textSecondary:'#888888',
  error:        '#FF4444',
} as const;

// ---------------------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------------------

async function fetchOrCreateProfile(
  userId: string,
  displayName: string | null,
  username?: string,
): Promise<UserProfile> {
  const { data: existing, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (existing) return existing as UserProfile;

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(fetchError.message);
  }

  const resolvedUsername = username?.trim().replace(/^@/, '') || `user_${userId.slice(0, 8)}`;

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username: resolvedUsername,
      display_name: displayName,
      city: 'Copenhagen',
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);
  return created as UserProfile;
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

interface InputProps {
  value:               string;
  onChangeText:        (t: string) => void;
  placeholder:         string;
  keyboardType?:       'default' | 'email-address';
  autoCapitalize?:     'none' | 'words';
  secureTextEntry?:    boolean;
  showToggle?:         boolean;
  onToggle?:           () => void;
}

function AuthInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'none',
  secureTextEntry = false,
  showToggle = false,
  onToggle,
}: InputProps): React.ReactElement {
  return (
    <View style={inputStyles.wrapper}>
      <TextInput
        style={inputStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#555555"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        secureTextEntry={secureTextEntry}
      />
      {showToggle && (
        <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={inputStyles.eye}>👁</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const inputStyles = StyleSheet.create({
  wrapper: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  C.inputBg,
    borderWidth:      1,
    borderColor:      C.border,
    borderRadius:     12,
    paddingHorizontal: 16,
    paddingVertical:  14,
  },
  input: {
    flex:      1,
    color:     C.textPrimary,
    fontSize:  15,
    padding:   0,
  },
  eye: {
    fontSize: 18,
    marginLeft: 8,
  },
});

function Divider(): React.ReactElement {
  return (
    <View style={divStyles.row}>
      <View style={divStyles.line} />
      <Text style={divStyles.text}>or</Text>
      <View style={divStyles.line} />
    </View>
  );
}

const divStyles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: C.border },
  text: { fontSize: 13, color: C.textSecondary },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AuthScreen(): React.ReactElement {
  const { setUser, setSession } = useAuthStore();

  // Form state
  const [isSignUp,       setIsSignUp]       = useState(false);
  const [username,       setUsername]       = useState('');
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [showPassword,   setShowPassword]   = useState(false);
  const [isLoading,      setIsLoading]      = useState(false);
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null);

  function clearError() { setErrorMsg(null); }

  // ── Apple Sign In ──────────────────────────────────────────────────────────

  async function handleAppleSignIn(): Promise<void> {
    clearError();
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
        return;
      }
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Google Sign In ─────────────────────────────────────────────────────────

  async function handleGoogleSignIn(): Promise<void> {
    clearError();
    try {
      setIsLoading(true);

      const redirectUri = AuthSession.makeRedirectUri();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });

      if (error) throw new Error(error.message);
      if (!data.url) throw new Error('No OAuth URL returned from Supabase.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (result.type !== 'success') return;

      const url    = result.url;
      const params = new URLSearchParams(url.split('#')[1] ?? url.split('?')[1] ?? '');
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) throw new Error('Missing tokens in OAuth redirect.');

      const { data: sessionData, error: sessionError } =
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });

      if (sessionError) throw new Error(sessionError.message);
      if (!sessionData.session || !sessionData.user) throw new Error('No session after Google sign in.');

      const displayName = sessionData.user.user_metadata?.full_name as string | null ?? null;
      const profile = await fetchOrCreateProfile(sessionData.user.id, displayName);
      setSession(sessionData.session);
      setUser(profile);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign in failed.');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Email Auth ─────────────────────────────────────────────────────────────

  async function handleEmailAuth(): Promise<void> {
    clearError();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter your email and password.');
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
        const profile = await fetchOrCreateProfile(data.user.id, null, username);
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
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.logo}>RUMBLA</Text>
        <Text style={styles.tagline}>Conquer your city, street by street.</Text>

        {/* Apple Sign In — iOS only */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        )}

        {/* Google */}
        <TouchableOpacity
          style={[styles.googleButton, isLoading && styles.disabled]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          <Text style={styles.googleG}>G</Text>
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        <Divider />

        {/* Sign-up only: username */}
        {isSignUp && (
          <AuthInput
            value={username}
            onChangeText={setUsername}
            placeholder="@username"
          />
        )}

        {/* Email */}
        <AuthInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
        />

        {/* Password */}
        <AuthInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry={!showPassword}
          showToggle
          onToggle={() => setShowPassword((v) => !v)}
        />

        {/* Forgot password — sign-in only */}
        {!isSignUp && (
          <TouchableOpacity style={styles.forgotWrap} activeOpacity={0.7}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        {/* Error */}
        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        {/* Loading indicator */}
        {isLoading ? (
          <ActivityIndicator color={C.primary} style={styles.loader} />
        ) : null}

        {/* Primary CTA */}
        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.disabled]}
          onPress={handleEmailAuth}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        {/* Switch mode */}
        <View style={styles.switchRow}>
          <Text style={styles.switchBase}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          </Text>
          <TouchableOpacity onPress={() => { setIsSignUp((v) => !v); clearError(); }}>
            <Text style={styles.switchLink}>
              {isSignUp ? 'Sign in' : 'Sign up'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 14,
  },

  // Header
  logo: {
    fontSize:    42,
    fontWeight:  '700',
    color:       C.primary,
    textAlign:   'center',
    letterSpacing: 4,
    marginTop:   80,
  },
  tagline: {
    fontSize:     13,
    color:        C.textSecondary,
    textAlign:    'center',
    marginBottom: 34,
  },

  // Apple
  appleButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
  },

  // Google
  googleButton: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius:    12,
    height:          52,
    gap:             10,
  },
  googleG: {
    fontSize:    18,
    fontWeight:  '700',
    color:       C.primary,
  },
  googleText: {
    fontSize:   15,
    fontWeight: '600',
    color:      '#000000',
  },

  // Forgot password
  forgotWrap: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontSize: 13,
    color:    C.accent,
  },

  // Error
  error: {
    fontSize: 13,
    color:    C.error,
    textAlign: 'center',
  },

  // Loader
  loader: {
    alignSelf: 'center',
  },

  // Primary CTA
  primaryButton: {
    backgroundColor: C.primary,
    borderRadius:    12,
    height:          52,
    justifyContent:  'center',
    alignItems:      'center',
  },
  primaryButtonText: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#FFFFFF',
  },

  // Switch mode
  switchRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    marginTop:      4,
  },
  switchBase: {
    fontSize: 13,
    color:    C.textSecondary,
  },
  switchLink: {
    fontSize:   13,
    color:      C.accent,
    fontWeight: '600',
  },

  disabled: {
    opacity: 0.55,
  },
});
