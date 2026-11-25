import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export function isNativeCapacitorApp(): boolean {
  return Capacitor.isNativePlatform();
}

export async function initCapacitorShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#FAFAFC' });
  } catch {
    // StatusBar plugin unavailable on this platform
  }

  try {
    await SplashScreen.hide();
  } catch {
    // SplashScreen plugin unavailable on this platform
  }
}

export function registerNativeBackButton(onBackPressed: () => boolean): () => void {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  let listenerHandle: PluginListenerHandle | null = null;
  let disposed = false;

  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const handled = onBackPressed();
    if (handled) return;
    if (canGoBack) {
      window.history.back();
      return;
    }
    CapacitorApp.minimizeApp().catch(() => {
      CapacitorApp.exitApp().catch(() => {});
    });
  })
    .then((handle) => {
      if (disposed) {
        handle.remove().catch(() => {});
      } else {
        listenerHandle = handle;
      }
    })
    .catch(() => {});

  return () => {
    disposed = true;
    listenerHandle?.remove().catch(() => {});
  };
}
