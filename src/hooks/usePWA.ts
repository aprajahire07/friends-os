import { useState, useEffect } from 'react';
import { pwaManager } from '../lib/pwa';

export function usePWA() {
  const [canInstall, setCanInstall] = useState<boolean>(pwaManager.canInstall());
  const [isStandalone, setIsStandalone] = useState<boolean>(pwaManager.getIsStandalone());
  const [isOnline, setIsOnline] = useState<boolean>(pwaManager.getIsOnline());
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);

  useEffect(() => {
    const unsub = pwaManager.subscribe(() => {
      setCanInstall(pwaManager.canInstall());
      setIsStandalone(pwaManager.getIsStandalone());
      setIsOnline(pwaManager.getIsOnline());
    });

    const unsubUpdate = pwaManager.subscribeUpdate(() => {
      setHasUpdate(true);
    });

    return () => {
      unsub();
      unsubUpdate();
    };
  }, []);

  return {
    canInstall,
    isStandalone,
    isOnline,
    isIOS: pwaManager.isIOS(),
    isAndroid: pwaManager.isAndroid(),
    hasUpdate,
    promptInstall: () => pwaManager.promptInstall(),
    applyUpdate: () => pwaManager.applyUpdate()
  };
}
