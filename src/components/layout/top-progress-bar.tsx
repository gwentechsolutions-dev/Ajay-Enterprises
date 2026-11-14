"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout[]>([]);

  const clearTimers = React.useCallback(() => {
    timerRef.current.forEach((t) => clearTimeout(t));
    timerRef.current = [];
  }, []);

  const startProgress = React.useCallback(() => {
    clearTimers();
    setVisible(true);
    setProgress(15);

    // Progressive trickle
    const t1 = setTimeout(() => setProgress(45), 100);
    const t2 = setTimeout(() => setProgress(70), 300);
    const t3 = setTimeout(() => setProgress(85), 600);
    const t4 = setTimeout(() => setProgress(92), 1200);

    timerRef.current = [t1, t2, t3, t4];
  }, [clearTimers]);

  const completeProgress = React.useCallback(() => {
    clearTimers();
    setProgress(100);

    const tComplete = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);

    timerRef.current = [tComplete];
  }, [clearTimers]);

  // Complete progress whenever route changes
  React.useEffect(() => {
    completeProgress();
  }, [pathname, searchParams, completeProgress]);

  // Global click listener for internal links
  React.useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const target = (e.target as HTMLElement)?.closest?.("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Skip external links, hash-only, mailto, tel, target="_blank", or modifier clicks
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      // Check if target is current URL
      try {
        const currentUrl = new URL(window.location.href);
        const targetUrl = new URL(href, window.location.href);
        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          return;
        }
      } catch {
        // Ignore URL parse error
      }

      startProgress();
    };

    // Custom events for manual control
    const handleCustomStart = () => startProgress();
    const handleCustomStop = () => completeProgress();

    window.addEventListener("click", handleLinkClick, { capture: true });
    window.addEventListener("inventra-nav-start", handleCustomStart);
    window.addEventListener("inventra-nav-stop", handleCustomStop);

    return () => {
      clearTimers();
      window.removeEventListener("click", handleLinkClick, { capture: true });
      window.removeEventListener("inventra-nav-start", handleCustomStart);
      window.removeEventListener("inventra-nav-stop", handleCustomStop);
    };
  }, [startProgress, completeProgress, clearTimers]);

  if (!visible && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-label="Page navigation loading"
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none h-[3px] bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-[#EA580C] via-[#F26522] to-[#FB923C] transition-all duration-200 ease-out shadow-[0_0_8px_rgba(242,101,34,0.7)]"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}

// Utility functions to manually trigger navigation bar
export function startNavProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inventra-nav-start"));
  }
}

export function finishNavProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("inventra-nav-stop"));
  }
}
