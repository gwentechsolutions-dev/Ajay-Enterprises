"use client";

import * as React from "react";
import { toast } from "sonner";
import { en } from "./en";
import { ta } from "./ta";
import { hi } from "./hi";
import { DriverLanguage, DriverTranslationDictionary, SUPPORTED_LANGUAGES } from "./types";

export * from "./types";
export { en, ta, hi };

export const dictionaries: Record<DriverLanguage, DriverTranslationDictionary> = {
  en,
  ta,
  hi,
};

export const DRIVER_LANG_STORAGE_KEY = "inventra_driver_language";

interface DriverLanguageContextType {
  language: DriverLanguage;
  setLanguage: (lang: DriverLanguage) => Promise<void>;
  t: DriverTranslationDictionary;
  isUpdating: boolean;
}

const DriverLanguageContext = React.createContext<DriverLanguageContextType>({
  language: "en",
  setLanguage: async () => {},
  t: en,
  isUpdating: false,
});

export function DriverLanguageProvider({
  children,
  initialLanguage = "en",
}: {
  children: React.ReactNode;
  initialLanguage?: DriverLanguage;
}) {
  const [language, setLanguageState] = React.useState<DriverLanguage>(() => {
    // 1. Try local storage cache for immediate client render without layout shift
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(DRIVER_LANG_STORAGE_KEY) as DriverLanguage;
      if (cached && (cached === "en" || cached === "ta" || cached === "hi")) {
        return cached;
      }
    }
    return initialLanguage;
  });

  const [isUpdating, setIsUpdating] = React.useState(false);

  // Sync with initialLanguage when fetched from database session
  React.useEffect(() => {
    if (initialLanguage && (initialLanguage === "en" || initialLanguage === "ta" || initialLanguage === "hi")) {
      setLanguageState(initialLanguage);
      if (typeof window !== "undefined") {
        localStorage.setItem(DRIVER_LANG_STORAGE_KEY, initialLanguage);
      }
    }
  }, [initialLanguage]);

  const setLanguage = React.useCallback(async (newLang: DriverLanguage) => {
    if (newLang === language) return;

    // 1. Immediate optimistic UI switch
    setLanguageState(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem(DRIVER_LANG_STORAGE_KEY, newLang);
    }

    const dict = dictionaries[newLang] || dictionaries.en;
    toast.success(dict.languageChanged);

    // 2. Asynchronously persist to database against authenticated driver record
    try {
      setIsUpdating(true);
      const res = await fetch("/api/v1/portals/delivery/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang }),
      });
      const json = await res.json();
      if (!json.success) {
        console.warn("Language persistence warning:", json.error?.message);
      }
    } catch (err) {
      console.warn("Could not persist language to server (operating offline):", err);
    } finally {
      setIsUpdating(false);
    }
  }, [language]);

  const t = React.useMemo(() => {
    return dictionaries[language] || dictionaries.en;
  }, [language]);

  return (
    <DriverLanguageContext.Provider value={{ language, setLanguage, t, isUpdating }}>
      {children}
    </DriverLanguageContext.Provider>
  );
}

export function useDriverTranslation() {
  const context = React.useContext(DriverLanguageContext);
  if (!context) {
    throw new Error("useDriverTranslation must be used within a DriverLanguageProvider");
  }
  return context;
}
