/**
 * FRIEND OS — PWA Manager & Service Worker Registration
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

class PWAManager {
  private deferredPrompt: InstallPromptEvent | null = null;
  private listeners: Set<() => void> = new Set();
  private updateListeners: Set<() => void> = new Set();
  private isStandalone = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.checkStandalone();
      this.initListeners();
    }
  }

  private checkStandalone() {
    this.isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
  }

  private initListeners() {
    // Listen for install prompt from Chrome/Android
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as InstallPromptEvent;
      this.notifyListeners();
    });

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isStandalone = true;
      this.notifyListeners();
      console.log('🎉 FRIEND OS was successfully installed on the device.');
    });

    // Online/Offline tracking
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners();
    });
  }

  public registerServiceWorker() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((registration) => {
            this.registration = registration;
            console.log('⚡ FRIEND OS PWA ServiceWorker Registered successfully:', registration.scope);

            // Check for updates periodically and on registration
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('🔄 New FRIEND OS version is available!');
                    this.notifyUpdateListeners();
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('PWA ServiceWorker Registration Notice:', err);
          });

        // Listen for controller changes to reload seamlessly
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      });
    }
  }

  public subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public subscribeUpdate(callback: () => void) {
    this.updateListeners.add(callback);
    return () => this.updateListeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => cb());
  }

  private notifyUpdateListeners() {
    this.updateListeners.forEach((cb) => cb());
  }

  public canInstall(): boolean {
    return !this.isStandalone && this.deferredPrompt !== null;
  }

  public getIsStandalone(): boolean {
    return this.isStandalone;
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public isIOS(): boolean {
    if (typeof window === 'undefined') return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
  }

  public isAndroid(): boolean {
    if (typeof window === 'undefined') return false;
    return /android/i.test(navigator.userAgent);
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.notifyListeners();
      return choice.outcome === 'accepted';
    } catch (e) {
      console.warn('Install prompt error:', e);
      return false;
    }
  }

  public applyUpdate() {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }
}

export const pwaManager = new PWAManager();
