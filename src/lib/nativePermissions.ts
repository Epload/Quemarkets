import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import {
  isRunningInIframe,
  probePushNotificationPermission,
  requestPushNotificationPermission,
} from './pushNotifications';

export type AppPermissionKey = 'location' | 'camera' | 'microphone' | 'notifications';
export type PermissionGrantState = 'granted' | 'denied' | 'prompt';

export type AppPermissionsMap = Record<AppPermissionKey, PermissionGrantState>;

const STORAGE_PERMS_KEY = 'quemarket_permissions_v1';

export const DEFAULT_PERMISSIONS_STATE: AppPermissionsMap = {
  location: 'prompt',
  camera: 'prompt',
  microphone: 'prompt',
  notifications: 'prompt',
};

export function areAllAppPermissionsGranted(perms: AppPermissionsMap): boolean {
  return (
    perms.location === 'granted' &&
    perms.camera === 'granted' &&
    perms.microphone === 'granted' &&
    perms.notifications === 'granted'
  );
}

function readStoredPermissions(): AppPermissionsMap {
  try {
    const raw = localStorage.getItem(STORAGE_PERMS_KEY);
    if (!raw) return { ...DEFAULT_PERMISSIONS_STATE };
    const parsed = JSON.parse(raw) as Partial<AppPermissionsMap>;
    return {
      location: parsed.location || 'prompt',
      camera: parsed.camera || 'prompt',
      microphone: parsed.microphone || 'prompt',
      notifications: parsed.notifications || 'prompt',
    };
  } catch {
    return { ...DEFAULT_PERMISSIONS_STATE };
  }
}

function writeStoredPermissions(next: AppPermissionsMap): void {
  try {
    localStorage.setItem(STORAGE_PERMS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}

async function queryWebPermission(name: string): Promise<PermissionGrantState | null> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return null;
  }
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName });
    if (status.state === 'granted') return 'granted';
    if (status.state === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return null;
  }
}

function getMediaErrorName(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    return String((err as { name?: unknown }).name || '');
  }
  return '';
}

function isNoDeviceError(err: unknown): boolean {
  const name = getMediaErrorName(err);
  return (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    name === 'OverconstrainedError' ||
    name === 'NotReadableError'
  );
}

export async function probeAppPermissions(): Promise<AppPermissionsMap> {
  const stored = readStoredPermissions();
  const next: AppPermissionsMap = { ...stored };

  if (Capacitor.isNativePlatform()) {
    try {
      const geo = await Geolocation.checkPermissions();
      if (geo.location === 'granted' || geo.coarseLocation === 'granted') {
        next.location = 'granted';
      } else if (geo.location === 'denied' && geo.coarseLocation === 'denied') {
        next.location = 'denied';
      } else {
        next.location = 'prompt';
      }
    } catch {
      // keep stored
    }

    try {
      const cam = await Camera.checkPermissions();
      if (cam.camera === 'granted' || cam.photos === 'granted' || cam.photos === 'limited') {
        next.camera = 'granted';
      } else if (cam.camera === 'denied' && cam.photos === 'denied') {
        next.camera = 'denied';
      } else {
        next.camera = 'prompt';
      }
    } catch {
      // keep stored
    }
  } else {
    const webGeo = await queryWebPermission('geolocation');
    if (webGeo) {
      next.location = webGeo;
    }

    const webCam = await queryWebPermission('camera');
    if (webCam) {
      next.camera = webCam;
    } else if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      // Safari/Firefox don't always support permissions.query('camera'); non-empty device labels mean granted
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasGrantedVideo = devices.some((d) => d.kind === 'videoinput' && Boolean(d.label));
        if (hasGrantedVideo) next.camera = 'granted';
      } catch {
        // ignore
      }
    }
  }

  const webMic = await queryWebPermission('microphone');
  if (webMic) {
    next.microphone = webMic;
  } else if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasGrantedAudio = devices.some((d) => d.kind === 'audioinput' && Boolean(d.label));
      if (hasGrantedAudio) next.microphone = 'granted';
    } catch {
      // ignore
    }
  }

  next.notifications = await probePushNotificationPermission();

  writeStoredPermissions(next);
  return next;
}

export function subscribePermissionChanges(
  onUpdate: (perms: AppPermissionsMap) => void
): () => void {
  let active = true;
  const cleanups: Array<() => void> = [];

  const refresh = () => {
    probeAppPermissions()
      .then((perms) => {
        if (active) onUpdate(perms);
      })
      .catch(() => {});
  };

  if (typeof window !== 'undefined') {
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    cleanups.push(() => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  if (!Capacitor.isNativePlatform() && typeof navigator !== 'undefined' && navigator.permissions?.query) {
    const names = ['geolocation', 'camera', 'microphone', 'notifications'];
    for (const name of names) {
      navigator.permissions
        .query({ name: name as PermissionName })
        .then((status) => {
          if (!active) return;
          const listener = () => refresh();
          status.addEventListener('change', listener);
          cleanups.push(() => status.removeEventListener('change', listener));
        })
        .catch(() => {
          // Unsupported permission name in this browser
        });
    }
  }

  return () => {
    active = false;
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  };
}

export interface RequestPermissionResult {
  state: PermissionGrantState;
  coords?: { lat: number; lng: number };
  message?: string;
}

function requestBrowserGeolocation(): Promise<RequestPermissionResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve({
        state: 'prompt',
        message: 'Tu navegador no soporta geolocalización automática.',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          state: 'granted',
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      },
      async (err) => {
        // Even if position lookup fails (POSITION_UNAVAILABLE=2 or TIMEOUT=3),
        // the user may have clicked "Allow" on the browser dialog. Verify via Permissions API.
        const queried = await queryWebPermission('geolocation');
        if (queried === 'granted') {
          resolve({ state: 'granted' });
          return;
        }
        if (err.code === 1 || queried === 'denied') {
          resolve({
            state: 'denied',
            message:
              'Ubicación bloqueada por el navegador. Actívala en el ícono de ajustes de la barra de direcciones.',
          });
          return;
        }
        resolve({
          state: 'prompt',
          message: 'No se pudo obtener la señal GPS a tiempo. Intenta de nuevo o elige tu ciudad.',
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

async function requestBrowserMedia(kind: 'camera' | 'microphone'): Promise<RequestPermissionResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    // On HTTP non-localhost or older WebViews without getUserMedia, gallery file picker still works for camera
    if (kind === 'camera') {
      return { state: 'granted' };
    }
    return {
      state: 'prompt',
      message: 'El micrófono requiere conexión segura (HTTPS) en este navegador.',
    };
  }

  try {
    const constraints: MediaStreamConstraints =
      kind === 'camera'
        ? { video: { facingMode: 'environment' } }
        : { audio: true };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (firstErr) {
      if (kind === 'camera' && isNoDeviceError(firstErr)) {
        // Retry with generic { video: true } for desktop webcams without facingMode
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } else {
        throw firstErr;
      }
    }

    stream.getTracks().forEach((track) => track.stop());
    return { state: 'granted' };
  } catch (err) {
    if (isNoDeviceError(err)) {
      if (kind === 'camera') {
        // Desktop without webcam can still upload product photos from gallery/files
        return {
          state: 'granted',
          message: 'Sin cámara física detectada; puedes subir fotos desde tus archivos.',
        };
      }
      return {
        state: 'prompt',
        message: 'No se detectó un micrófono conectado en este dispositivo.',
      };
    }

    const queried = await queryWebPermission(kind);
    if (queried === 'granted') {
      return { state: 'granted' };
    }

    const blockedHint = isRunningInIframe()
      ? `Permiso de ${kind === 'camera' ? 'cámara' : 'micrófono'} bloqueado en esta vista. Permite el acceso en tu navegador o ábrela en una pestaña nueva.`
      : `Permiso de ${kind === 'camera' ? 'cámara' : 'micrófono'} bloqueado. Actívalo en el ícono de ajustes junto a la dirección web.`;

    return {
      state: 'denied',
      message: blockedHint,
    };
  }
}

export async function requestAppPermission(
  key: AppPermissionKey
): Promise<RequestPermissionResult> {
  const current = readStoredPermissions();

  if (key === 'location') {
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Geolocation.requestPermissions();
        const ok = perm.location === 'granted' || perm.coarseLocation === 'granted';
        current.location = ok ? 'granted' : 'denied';
        writeStoredPermissions(current);
        if (ok) {
          try {
            const pos = await Geolocation.getCurrentPosition({
              enableHighAccuracy: false,
              timeout: 8000,
            });
            return {
              state: 'granted',
              coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            };
          } catch {
            return { state: 'granted' };
          }
        }
        return {
          state: current.location,
          message: 'Activa la ubicación en los ajustes de la app para detectar tu ciudad.',
        };
      } catch {
        current.location = 'denied';
        writeStoredPermissions(current);
        return {
          state: 'denied',
          message: 'No se pudo solicitar la ubicación en este dispositivo.',
        };
      }
    }

    const geoRes = await requestBrowserGeolocation();
    current.location = geoRes.state;
    writeStoredPermissions(current);
    return geoRes;
  }

  if (key === 'camera') {
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
        const ok =
          perm.camera === 'granted' || perm.photos === 'granted' || perm.photos === 'limited';
        current.camera = ok ? 'granted' : 'denied';
        writeStoredPermissions(current);
        return {
          state: current.camera,
          ...(ok ? {} : { message: 'Activa cámara y fotos en los ajustes del dispositivo.' }),
        };
      } catch {
        current.camera = 'denied';
        writeStoredPermissions(current);
        return {
          state: 'denied',
          message: 'No se pudo solicitar el permiso de cámara.',
        };
      }
    }

    const camRes = await requestBrowserMedia('camera');
    current.camera = camRes.state;
    writeStoredPermissions(current);
    return camRes;
  }

  if (key === 'microphone') {
    const micRes = await requestBrowserMedia('microphone');
    current.microphone = micRes.state;
    writeStoredPermissions(current);
    return micRes;
  }

  // notifications
  const notifState = await requestPushNotificationPermission();
  current.notifications = notifState;
  writeStoredPermissions(current);
  return {
    state: notifState,
    ...(notifState === 'denied'
      ? {
          message:
            'Notificaciones bloqueadas en el navegador. Actívalas en el ícono de ajustes junto a la dirección web.',
        }
      : {}),
  };
}

export interface RequestAllPermissionsResult {
  permissions: AppPermissionsMap;
  coords?: { lat: number; lng: number };
  feedbackMessage?: string;
}

/**
 * Requests all missing permissions safely across both Web browsers and Native Capacitor apps.
 * - On Native Android/iOS: requests sequentially so OS dialogs never collide.
 * - On Web browsers: fires user-gesture-sensitive prompts immediately before slow awaits
 *   and requests camera+microphone together so browser user activation never expires.
 */
export async function requestAllAppPermissions(
  currentMap: AppPermissionsMap
): Promise<RequestAllPermissionsResult> {
  const next: AppPermissionsMap = { ...currentMap };
  let coords: { lat: number; lng: number } | undefined;
  let feedbackMessage: string | undefined;

  if (Capacitor.isNativePlatform()) {
    const order: AppPermissionKey[] = ['location', 'camera', 'microphone', 'notifications'];
    for (const key of order) {
      if (next[key] === 'granted') continue;
      const res = await requestAppPermission(key);
      next[key] = res.state;
      if (key === 'location' && res.coords) coords = res.coords;
      if (res.state !== 'granted' && res.message && !feedbackMessage) {
        feedbackMessage = res.message;
      }
    }
    writeStoredPermissions(next);
    return { permissions: next, coords, feedbackMessage };
  }

  // Web browser path: initiate prompts synchronously inside the click gesture so Chrome/Safari/Firefox allow all of them.
  const notifPromise =
    next.notifications === 'granted'
      ? Promise.resolve<PermissionGrantState>('granted')
      : requestPushNotificationPermission();

  const geoPromise =
    next.location === 'granted'
      ? Promise.resolve<RequestPermissionResult>({ state: 'granted' })
      : requestBrowserGeolocation();

  let mediaPromise: Promise<{ camera: RequestPermissionResult; microphone: RequestPermissionResult }>;
  const needCam = next.camera !== 'granted';
  const needMic = next.microphone !== 'granted';

  if (needCam && needMic && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    // Request camera + microphone in ONE prompt to avoid gesture expiry and extra popups
    mediaPromise = navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        return {
          camera: { state: 'granted' as PermissionGrantState },
          microphone: { state: 'granted' as PermissionGrantState },
        };
      })
      .catch(async () => {
        // Fallback individually in case only one device (e.g. mic without webcam) exists
        const [camRes, micRes] = await Promise.all([
          requestBrowserMedia('camera'),
          requestBrowserMedia('microphone'),
        ]);
        return { camera: camRes, microphone: micRes };
      });
  } else {
    mediaPromise = Promise.all([
      needCam ? requestBrowserMedia('camera') : Promise.resolve({ state: 'granted' as PermissionGrantState }),
      needMic ? requestBrowserMedia('microphone') : Promise.resolve({ state: 'granted' as PermissionGrantState }),
    ]).then(([camera, microphone]) => ({ camera, microphone }));
  }

  const [notifState, geoRes, mediaRes] = await Promise.all([
    notifPromise,
    geoPromise,
    mediaPromise,
  ]);

  next.notifications = notifState;
  next.location = geoRes.state;
  next.camera = mediaRes.camera.state;
  next.microphone = mediaRes.microphone.state;

  if (geoRes.coords) coords = geoRes.coords;

  feedbackMessage =
    (geoRes.state !== 'granted' ? geoRes.message : undefined) ||
    (mediaRes.camera.state !== 'granted' ? mediaRes.camera.message : undefined) ||
    (mediaRes.microphone.state !== 'granted' ? mediaRes.microphone.message : undefined) ||
    (notifState === 'denied'
      ? 'Notificaciones bloqueadas en el navegador. Actívalas en el ícono de ajustes junto a la dirección web.'
      : undefined);

  writeStoredPermissions(next);
  return { permissions: next, coords, feedbackMessage };
}
