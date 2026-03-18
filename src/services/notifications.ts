import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { supabase } from '@/services/supabase';

// ---------------------------------------------------------------------------
// Global notification behaviour — how alerts appear while the app is foregrounded
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ---------------------------------------------------------------------------
// requestPermissions
// Returns true if permission was granted (or already granted).
// ---------------------------------------------------------------------------

export async function requestPermissions(): Promise<boolean> {
  // Android 13+ requires explicit POST_NOTIFICATIONS permission
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:       'Rumbla',
      importance: Notifications.AndroidImportance.MAX,
      sound:      'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ---------------------------------------------------------------------------
// registerPushToken
// Gets the Expo push token and persists it to profiles.push_token.
// Requires the push_token column to exist — run this SQL in Supabase:
//   ALTER TABLE profiles ADD COLUMN push_token TEXT;
// ---------------------------------------------------------------------------

export async function registerPushToken(userId: string): Promise<void> {
  // Physical device only — simulator/emulator cannot receive push notifications
  const isDevice = await isPhysicalDevice();
  if (!isDevice) {
    console.log('[notifications] Skipping push token — not a physical device.');
    return;
  }

  const granted = await requestPermissions();
  if (!granted) {
    console.log('[notifications] Push permission not granted — skipping token registration.');
    return;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token     = tokenData.data;

    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('[notifications] Failed to save push token:', error.message);
    } else {
      console.log('[notifications] Push token registered:', token);
    }
  } catch (err: unknown) {
    console.error('[notifications] getExpoPushTokenAsync failed:', err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// scheduleLocalNotification
// Fires an immediate local notification — useful for testing conquest events
// before the server-side push pipeline is wired up.
// ---------------------------------------------------------------------------

export async function scheduleLocalNotification(
  title: string,
  body:  string,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
    },
    trigger: null, // null = fire immediately
  });
}

// ---------------------------------------------------------------------------
// Notification handlers — call setupNotificationHandlers() once at app root.
// Returns a cleanup function to remove both listeners.
// ---------------------------------------------------------------------------

export function setupNotificationHandlers(
  onReceived?: (notification: Notifications.Notification) => void,
  onResponse?:  (response: Notifications.NotificationResponse) => void,
): () => void {
  // Fired while app is foregrounded
  const receivedSub = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('[notifications] Received:', notification.request.content.title);
      onReceived?.(notification);
    },
  );

  // Fired when user taps a notification (foreground or background)
  const responseSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('[notifications] Response:', response.notification.request.content.title);
      onResponse?.(response);
    },
  );

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

// ---------------------------------------------------------------------------
// Internal helper — expo-notifications doesn't export isDevice directly
// ---------------------------------------------------------------------------

async function isPhysicalDevice(): Promise<boolean> {
  try {
    const expoConstants = await import('expo-constants');
    // expo-constants default export is the Constants object
    const Constants = expoConstants.default;
    return Constants.isDevice === true;
  } catch {
    return false;
  }
}
