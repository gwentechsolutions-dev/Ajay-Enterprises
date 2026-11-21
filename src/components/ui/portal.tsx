"use client";

import * as React from "react";
import { createPortal } from "react-dom";

interface ModalPortalProps {
  children: React.ReactNode;
}

/**
 * Universal Modal Portal for INVENTRA
 * Mounts overlays and modals directly into `document.body` so they escape
 * any parent stacking contexts, overflow clipping, or layout containers,
 * ensuring the backdrop blur and darkening cover 100% of the viewport
 * including Topbar, Sidebar, and banners.
 */
export function ModalPortal({ children }: ModalPortalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    // Prevent background scrolling while the modal is active
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}
