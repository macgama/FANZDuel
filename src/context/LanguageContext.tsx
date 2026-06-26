import React, { createContext, useContext, useState, useEffect } from "react";
import { translations, Language } from "../utils/translations";

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string, params?: Record<string, any>) => string;
  tDb: (field: any, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("tbo_language");
    if (saved === "fr" || saved === "en" || saved === "es") {
      return saved as Language;
    }
    // Try browser locale fallback
    const browserLang = navigator.language.slice(0, 2);
    if (browserLang === "es") return "es";
    if (browserLang === "en") return "en";
    return "fr";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("tbo_language", lang);
  };

  const t = (key: string, fallback?: string, params?: Record<string, any>): string => {
    let translation = translations[language]?.[key] || translations["fr"]?.[key] || fallback || key;
    if (params) {
      Object.keys(params).forEach(param => {
        translation = translation.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
      });
    }
    return translation;
  };

  const tDb = (field: any, fallback: string = ''): string => {
    if (!field) return fallback;
    if (typeof field === 'string') return field;
    return field[language] || field['fr'] || field['en'] || Object.values(field)[0] || fallback;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tDb }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
