"use client";

import * as React from "react";
import { toast } from "sonner";

interface PwaContextValue {
  isInstalled: boolean;
  canInstall: boolean;
  isStandalone: boolean;
  isIos: boolean;
  promptInstall: () => Promise<void>;
  showIosInstructions: boolean;
  setShowIosInstructions: (show: boolean) => void;
}

const PwaContext = React.createContext<PwaContextValue>({
  isInstalled: false,
  canInstall: false,
  isStandalone: false,
  isIos: false,
  promptInstall: async () => {},
  showIosInstructions: false,
  setShowIosInstructions: () => {},
});

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);
  const [showIosInstructions, setShowIosInstructions] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Service Worker Registration
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[PWA] Service Worker registered:", reg.scope);
          })
          .catch((err) => {
            console.warn("[PWA] Service Worker registration failed:", err);
          });
      });
    }

    // 2. Check if already installed / standalone mode
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standaloneMode);
    if (standaloneMode) {
      setIsInstalled(true);
    }
    setIsInstalled(isStandalone);

    // 3. Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // 4. Capture Android Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success("INVENTRA Driver Portal installed to Home Screen!");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (isInstalled) {
      toast.info("INVENTRA is already installed on your device.");
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn("[PWA] Install prompt error:", err);
      }
    } else if (isIos) {
      setShowIosInstructions(true);
    } else {
      toast.info("To install INVENTRA: Tap your browser's menu (⋮ or Share) and select 'Add to Home screen' or 'Install App'.");
    }
  };

  const canInstall = !isInstalled && (Boolean(deferredPrompt) || isIos);

  return (
    <PwaContext.Provider
      value={{
        isInstalled,
        canInstall,
        isStandalone,
        isIos,
        promptInstall,
        showIosInstructions,
        setShowIosInstructions,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  return React.useContext(PwaContext);
}
