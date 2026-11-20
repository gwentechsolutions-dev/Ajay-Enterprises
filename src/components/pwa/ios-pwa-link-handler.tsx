"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * iOS PWA Standalone Link Handler
 *
 * In iOS Safari standalone mode (Add to Home Screen / WebClip), WebKit treats
 * default anchor link navigations as external navigation by default, popping open
 * an in-app Safari browser view (SFSafariViewController / WebSheet with an 'X' button)
 * instead of navigating inside the standalone container.
 *
 * This component listens for link clicks in the capture phase on standalone devices,
 * intercepts internal route navigations, prevents the default WebKit breakout, and
 * delegates the transition to Next.js's client-side router (`router.push`).
 */
export function IosPwaLinkHandler() {
  const router = useRouter();

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect if running in standalone PWA mode (iOS navigator.standalone or display-mode: standalone)
    const isStandalone =
      ("standalone" in window.navigator && Boolean((window.navigator as any).standalone)) ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);

    if (!isStandalone) return;

    const handleStandaloneClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref) return;

      // Allow hash jumps, protocol handlers, new-tab requests, and file downloads to proceed natively
      if (
        rawHref.startsWith("#") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("sms:") ||
        rawHref.startsWith("javascript:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.hasAttribute("data-no-pwa-intercept") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.defaultPrevented
      ) {
        return;
      }

      try {
        const url = new URL(anchor.href, window.location.href);

        // Only intercept internal same-origin links
        if (url.origin === window.location.origin) {
          // Allow statutory PDF print routes & direct API endpoints to load natively
          if (
            url.pathname.includes("/pdf") ||
            url.pathname.includes("/print") ||
            url.pathname.startsWith("/api/")
          ) {
            return;
          }

          // Same page navigation: prevent breakout and do nothing
          if (
            url.pathname === window.location.pathname &&
            url.search === window.location.search
          ) {
            e.preventDefault();
            return;
          }

          // Stop WebKit from launching SFSafariViewController / in-app browser sheet
          e.preventDefault();
          e.stopPropagation();

          // Dispatch internal navigation event for progress indicators
          window.dispatchEvent(new CustomEvent("inventra-nav-start"));

          // Perform smooth client-side SPA routing within the PWA container
          router.push(url.pathname + url.search + url.hash);
        }
      } catch {
        // Fallback gracefully on URL parsing errors
      }
    };

    // Attach in capture phase so it executes BEFORE WebKit default link routing and before component state mutations
    document.addEventListener("click", handleStandaloneClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleStandaloneClick, { capture: true });
    };
  }, [router]);

  return null;
}
