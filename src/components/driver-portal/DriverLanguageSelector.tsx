"use client";

import * as React from "react";
import { Languages, Check, ChevronDown } from "lucide-react";
import { useDriverTranslation, SUPPORTED_LANGUAGES, DriverLanguage } from "@/lib/i18n/driver-portal";
import { cn } from "@/lib/utils";

export function DriverLanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage, isUpdating } = useDriverTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentOption = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        aria-label="Change language"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-bold transition border border-white/15 backdrop-blur-sm shadow-sm"
      >
        <Languages className="h-3.5 w-3.5 text-[#F26522]" />
        <span className="font-semibold">{currentOption.nativeLabel}</span>
        <ChevronDown className={cn("h-3 w-3 opacity-70 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 rounded-xl bg-white shadow-xl border border-slate-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            Select Language
          </div>

          <div className="p-1 space-y-0.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition text-left",
                    isSelected
                      ? "bg-amber-50 text-amber-950 font-bold"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-xs">{lang.nativeLabel}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{lang.label}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-[#F26522]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
