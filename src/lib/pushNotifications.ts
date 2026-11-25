import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import type { PermissionGrantState } from './nativePermissions';

export const QUEMARKET_PUSH_CHANNEL_ID = 'quemarket_mensajes';
export const QUEMARKET_PUSH_CHANNEL_NAME = 'Mensajes y alertas';

const STORAGE_INAPP_NOTIF_KEY = 'quemarket_inapp_notif_enabled_v1';

let pushInitialized = false;
let openThreadCallback: ((threadId: string) => void) | null = null;

export function setPushOpenThreadHandler(handler: ((threadId: string) => void) | null): void {
  openThreadCallback = handler;
}

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function readInAppNotificationsFallback(): boolean {
  try {
    return localStorage.getItem(STORAGE_INAPP_NOTIF_KEY) === '1';
  } catch {
    return false;
  }
}

function writeInAppNotificationsFallback(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_INAPP_NOTIF_KEY, '1');
    } else {
      localStorage.removeItem(STORAGE_INAPP_NOTIF_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

function requestBrowserNotificationCompat(): Promise<NotificationPermission> {
  return new Promise((resolve) => {
    if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') {
      resolve('denied');
      return;
    }

    try {
      let settled = false;
      const done = (val: NotificationPermission) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };

      const maybePromise = Notification.requestPermission(done);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(done).catch(() => done('denied'));
      }
    } catch {
      resolve('denied');
    }
  });
}

export async function probePushNotificationPermission(): Promise<PermissionGrantState> {
  if (Capacitor.isNativePlatform()) {
    try {
      const pushStatus = await PushNotifications.checkPermissions();
      if (pushStatus.receive === 'granted') return 'granted';
      if (pushStatus.receive === 'denied') return 'denied';
    } catch {
      // Fallback to LocalNotifications check
    }
    try {
      const localStatus = await LocalNotifications.checkPermissions();
      if (localStatus.display === 'granted') return 'granted';
      if (localStatus.display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') {
      // In embedded iframes Chrome automatically reports 'denied' without prompting.
      // Respect in-app alerts fallback if the user already activated notifications here.
      if (isRunningInIframe() && readInAppNotificationsFallback()) {
        return 'granted';
      }
      return isRunningInIframe() ? 'prompt' : 'denied';
    }
  }

  if (readInAppNotificationsFallback()) {
    return 'granted';
  }

  return 'prompt';
}

export async function requestPushNotificationPermission(): Promise<PermissionGrantState> {
  if (Capacitor.isNativePlatform()) {
    let resolved: PermissionGrantState = 'prompt';

    try {
      const localPerm = await LocalNotifications.requestPermissions();
      if (localPerm.display === 'granted') resolved = 'granted';
      else if (localPerm.display === 'denied') resolved = 'denied';
    } catch {
      // Ignore if local notifications permission prompt unavailable
    }

    try {
      const pushPerm = await PushNotifications.requestPermissions();
      if (pushPerm.receive === 'granted') {
        resolved = 'granted';
        await ensurePushChannelAndRegister();
      } else if (pushPerm.receive === 'denied' && resolved !== 'granted') {
        resolved = 'denied';
      }
    } catch {
      // Ignore if FCM push permission throws on device without Play Services
    }

    return resolved;
  }

  if (typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function') {
    if (Notification.permission === 'granted') {
      writeInAppNotificationsFallback(true);
      return 'granted';
    }

    const startMs = Date.now();
    const res = await requestBrowserNotificationCompat();
    const elapsedMs = Date.now() - startMs;

    if (res === 'granted') {
      writeInAppNotificationsFallback(true);
      return 'granted';
    }

    // Browsers silently block Notification.requestPermission() inside cross-origin iframes
    // in < 100ms without ever showing a dialog to the user. Enable in-app alerts so the
    // preview/embedded browser works smoothly while standalone tabs still show the real prompt.
    if (res === 'denied' && isRunningInIframe() && elapsedMs < 250) {
      writeInAppNotificationsFallback(true);
      return 'granted';
    }

    return res === 'denied' ? 'denied' : 'prompt';
  }

  // Fallback for iOS Safari non-PWA tabs where window.Notification is undefined
  writeInAppNotificationsFallback(true);
  return 'granted';
}

async function ensurePushChannelAndRegister(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.createChannel({
      id: QUEMARKET_PUSH_CHANNEL_ID,
      name: QUEMARKET_PUSH_CHANNEL_NAME,
      description: 'Avisos de nuevos mensajes, ofertas y compras en Quemarket',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#362B3D',
    });
  } catch {
    // Channel may already exist or not supported on platform
  }

  try {
    await LocalNotifications.createChannel({
      id: QUEMARKET_PUSH_CHANNEL_ID,
      name: QUEMARKET_PUSH_CHANNEL_NAME,
      description: 'Avisos de nuevos mensajes, ofertas y compras en Quemarket',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#362B3D',
    });
  } catch {
    // Ignore on non-Android platforms
  }

  try {
    const pushStatus = await PushNotifications.checkPermissions();
    if (pushStatus.receive === 'granted') {
      await PushNotifications.register();
    }
  } catch {
    // FCM registration requires google-services.json; local channel remains active
  }
}

export async function initPushNotificationChannel(
  onOpenThread?: (threadId: string) => void
): Promise<void> {
  if (onOpenThread) {
    openThreadCallback = onOpenThread;
  }
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  if (pushInitialized) {
    await ensurePushChannelAndRegister();
    return;
  }
  pushInitialized = true;

  try {
    await PushNotifications.addListener('registration', (token) => {
      try {
        localStorage.setItem('quemarket_push_token_v1', token.value);
      } catch {
        // Ignore storage error
      }
    });

    await PushNotifications.addListener('registrationError', () => {
      // FCM not configured with google-services.json yet; local notification channel works
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const threadId =
        typeof notification.data?.threadId === 'string' ? notification.data.threadId : undefined;
      void dispatchChatPushNotification({
        title: notification.title || 'Nuevo mensaje en Quemarket',
        body: notification.body || 'Tienes un mensaje nuevo',
        threadId,
      });
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const threadId =
        typeof action.notification.data?.threadId === 'string'
          ? action.notification.data.threadId
          : undefined;
      if (threadId && openThreadCallback) {
        openThreadCallback(threadId);
      }
    });

    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const extra = action.notification.extra as { threadId?: string } | undefined;
      if (extra?.threadId && openThreadCallback) {
        openThreadCallback(extra.threadId);
      }
    });
  } catch {
    // Ignore listener attachment errors in webviews without native bridge
  }

  await ensurePushChannelAndRegister();
}

export async function dispatchChatPushNotification(params: {
  title: string;
  body: string;
  threadId?: string;
}): Promise<void> {
  const title = params.title.trim() || 'Nuevo mensaje en Quemarket';
  const body = params.body.trim() || 'Tienes un mensaje nuevo';

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') return;

      const notifId = Math.floor((Date.now() % 2000000000) + Math.random() * 900);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            channelId: QUEMARKET_PUSH_CHANNEL_ID,
            extra: params.threadId ? { threadId: params.threadId } : undefined,
          },
        ],
      });
    } catch {
      // Ignore native scheduling errors
    }
    return;
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        tag: params.threadId ? `quemarket-chat-${params.threadId}` : 'quemarket-chat',
      });
      if (params.threadId) {
        n.onclick = () => {
          window.focus();
          openThreadCallback?.(params.threadId!);
          n.close();
        };
      }
    } catch {
      // Ignore browser contexts that block direct Notification constructor
    }
  }
}
