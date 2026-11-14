"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, X } from "lucide-react";

export function DemoModeBanner() {
  const [activeRunNumber, setActiveRunNumber] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  const checkStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/demo-data");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.isLoaded && json.data?.activeRun) {
          setActiveRunNumber(json.data.activeRun.runNumber);
        } else {
          setActiveRunNumber(null);
        }
      }
    } catch {
      // Silently fail if network unavailable
    }
  }, []);

  React.useEffect(() => {
    checkStatus();

    const handleStatusChanged = () => {
      checkStatus();
    };

    window.addEventListener("demo-status-changed", handleStatusChanged);
    return () => {
      window.removeEventListener("demo-status-changed", handleStatusChanged);
    };
  }, [checkStatus]);

  if (!activeRunNumber || dismissed) {
    return null;
  }

  return (
    <div
      role="banner"
      className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 px-4 py-2 text-xs md:text-sm font-medium shadow-md border-b border-amber-600 sticky top-0 z-50 flex items-center justify-between"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="bg-slate-950 text-amber-400 text-[10px] md:text-xs font-mono font-bold px-2 py-0.5 rounded shadow-sm tracking-wider inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          DEMO MODE
        </span>
        <span className="font-semibold text-slate-900">
          Sample business dataset active ({activeRunNumber}) for AJAY ENTERPRISES. Real statutory & WhatsApp actions are simulated.
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/demo-data"
          className="bg-slate-950 text-white hover:bg-slate-900 text-xs px-2.5 py-1 rounded font-semibold transition-colors inline-flex items-center gap-1 shrink-0 shadow-sm"
        >
          Manage Demo Data
          <ArrowRight className="w-3 h-3" />
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-900 hover:text-slate-950 p-1 rounded transition-colors"
          title="Dismiss banner"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
