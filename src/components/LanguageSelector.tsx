import React from "react";
import { useLanguage } from "../context/LanguageContext";
import { Language } from "../utils/translations";
import { cn } from "../lib/utils";

export function LanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  const options: { code: Language; label: string; flag: string }[] = [
    { code: "fr", label: "FR", flag: "🇫🇷" },
    { code: "en", label: "EN", flag: "🇬🇧" },
    { code: "es", label: "ES", flag: "🇪🇸" },
  ];

  return (
    <div className={cn("flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10", className)}>
      {options.map((opt) => {
        const active = language === opt.code;
        return (
          <button
            key={opt.code}
            onClick={() => setLanguage(opt.code)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase duration-200",
              active
                ? "bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.4)]"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <span>{opt.flag}</span>
            <span className="tracking-wider">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
