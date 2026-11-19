"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Truck,
  RotateCcw,
  ReceiptIndianRupee,
  Lock,
  ChevronRight,
  X,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDriverTranslation } from "@/lib/i18n/driver-portal";
import { cn } from "@/lib/utils";

interface DriverQuickActionsProps {
  canCreateDN: boolean;
  canCreateMRN: boolean;
  canCreateInvoice: boolean;
  className?: string;
}

export function DriverQuickActions({
  canCreateDN,
  canCreateMRN,
  canCreateInvoice,
  className,
}: DriverQuickActionsProps) {
  const { t } = useDriverTranslation();
  const router = useRouter();

  const [isOpen, setIsOpen] = React.useState(false);
  const [isPressing, setIsPressing] = React.useState(false);
  const [pressProgress, setPressProgress] = React.useState(0);

  const pressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const progressAnimRef = React.useRef<number | null>(null);
  const startPosRef = React.useRef<{ x: number; y: number } | null>(null);
  const startTimeRef = React.useRef<number>(0);

  const HOLD_DURATION = 600; // ms

  const clearPressTimers = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (progressAnimRef.current) {
      cancelAnimationFrame(progressAnimRef.current);
      progressAnimRef.current = null;
    }
    setIsPressing(false);
    setPressProgress(0);
    startPosRef.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only primary button
    if (e.button !== 0) return;

    startPosRef.current = { x: e.clientX, y: e.clientY };
    startTimeRef.current = Date.now();
    setIsPressing(true);
    setPressProgress(0);

    // Animate circular progress ring
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION) * 100);
      setPressProgress(progress);
      if (progress < 100) {
        progressAnimRef.current = requestAnimationFrame(animate);
      }
    };
    progressAnimRef.current = requestAnimationFrame(animate);

    // Trigger on long press threshold
    pressTimerRef.current = setTimeout(() => {
      // Haptic feedback if device supports it
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
      clearPressTimers();
      setIsOpen(true);
    }, HOLD_DURATION);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startPosRef.current) return;
    const dist = Math.hypot(
      e.clientX - startPosRef.current.x,
      e.clientY - startPosRef.current.y
    );
    // If movement > 10px, it's a scroll gesture -> cancel long press
    if (dist > 10) {
      clearPressTimers();
    }
  };

  const handlePointerUp = () => {
    if (!startTimeRef.current) {
      clearPressTimers();
      return;
    }
    const elapsed = Date.now() - startTimeRef.current;
    clearPressTimers();

    // If it was a quick tap (< 500ms), also open the quick action menu!
    if (elapsed < HOLD_DURATION) {
      setIsOpen(true);
    }
  };

  const handlePointerCancel = () => {
    clearPressTimers();
  };

  const handleAction = (path: string, allowed: boolean) => {
    if (!allowed) return;
    setIsOpen(false);
    router.push(path);
  };

  // SVG circular stroke calculation for 56px button (r=26, circ ≈ 163.3)
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pressProgress / 100) * circumference;

  return (
    <>
      {/* Floating Long-Press & Tap Action Button */}
      <div className={cn("fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6", className)}>
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={t.quickActionsTitle}
          title={t.quickActionHoldHint}
          className={cn(
            "relative w-14 h-14 rounded-full bg-gradient-to-tr from-[#EA580C] to-[#F26522] text-white shadow-xl shadow-orange-600/30 flex items-center justify-center transition-transform active:scale-95 select-none touch-none",
            isPressing && "scale-95 ring-4 ring-orange-400/40"
          )}
        >
          {/* Progress Ring Overlay */}
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            <circle
              cx="28"
              cy="28"
              r={radius}
              fill="transparent"
              stroke="#FFFFFF"
              strokeWidth="3.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={cn("transition-all duration-75", !isPressing && "opacity-0")}
            />
          </svg>

          <Plus className={cn("w-7 h-7 text-white transition-transform duration-200", isPressing && "rotate-45")} />
        </button>
      </div>

      {/* Quick Actions Bottom Sheet / Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent hideClose className="max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          <div className="bg-[#0B1E36] p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#F26522]" />
                <DialogTitle className="text-base font-black text-white">
                  {t.quickActionsTitle}
                </DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <DialogDescription className="text-xs text-slate-300 mt-1">
              {t.quickActionsSubtitle}
            </DialogDescription>
          </div>

          <div className="p-3 space-y-2 bg-slate-50 max-h-[75vh] overflow-y-auto">
            {/* 1. Create Delivery Note (DN) */}
            <button
              type="button"
              disabled={!canCreateDN}
              onClick={() => handleAction("/delivery-notes?action=new", canCreateDN)}
              className={cn(
                "w-full p-3.5 rounded-xl border text-left transition-all flex items-center gap-3.5",
                canCreateDN
                  ? "bg-white hover:bg-sky-50/60 border-slate-200 hover:border-sky-300 shadow-sm active:scale-[0.99]"
                  : "bg-slate-100/80 border-slate-200 opacity-60 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                  canCreateDN ? "bg-sky-100 text-sky-700" : "bg-slate-200 text-slate-400"
                )}
              >
                <Truck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-slate-900 block truncate">
                    {t.quickActionDN}
                  </span>
                  {!canCreateDN && (
                    <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> Restricted
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                  {canCreateDN ? t.quickActionDNDesc : t.quickActionUnauthorized}
                </p>
              </div>
              {canCreateDN && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>

            {/* 2. Create Material Return Note (MRN) */}
            <button
              type="button"
              disabled={!canCreateMRN}
              onClick={() => handleAction("/return-notes?action=new", canCreateMRN)}
              className={cn(
                "w-full p-3.5 rounded-xl border text-left transition-all flex items-center gap-3.5",
                canCreateMRN
                  ? "bg-white hover:bg-amber-50/60 border-slate-200 hover:border-amber-300 shadow-sm active:scale-[0.99]"
                  : "bg-slate-100/80 border-slate-200 opacity-60 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                  canCreateMRN ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-400"
                )}
              >
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-slate-900 block truncate">
                    {t.quickActionMRN}
                  </span>
                  {!canCreateMRN && (
                    <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> Restricted
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                  {canCreateMRN ? t.quickActionMRNDesc : t.quickActionUnauthorized}
                </p>
              </div>
              {canCreateMRN && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>

            {/* 3. Create Invoice */}
            <button
              type="button"
              disabled={!canCreateInvoice}
              onClick={() => handleAction("/invoices?action=new", canCreateInvoice)}
              className={cn(
                "w-full p-3.5 rounded-xl border text-left transition-all flex items-center gap-3.5",
                canCreateInvoice
                  ? "bg-white hover:bg-emerald-50/60 border-slate-200 hover:border-emerald-300 shadow-sm active:scale-[0.99]"
                  : "bg-slate-100/80 border-slate-200 opacity-60 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                  canCreateInvoice ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-400"
                )}
              >
                <ReceiptIndianRupee className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-slate-900 block truncate">
                    {t.quickActionInvoice}
                  </span>
                  {!canCreateInvoice && (
                    <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> Restricted
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                  {canCreateInvoice ? t.quickActionInvoiceDesc : t.quickActionInvoiceRestricted}
                </p>
              </div>
              {canCreateInvoice && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
