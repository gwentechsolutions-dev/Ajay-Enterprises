"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { TopProgressBar } from "./top-progress-bar";
import { DemoModeBanner } from "./demo-mode-banner";
import { SessionUser } from "@/lib/auth";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/lib/auth-context";

interface AppShellProps {
  user: SessionUser;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const isDeliveryPortal = pathname === "/delivery-portal";

  return (
    <AuthProvider user={user}>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex w-full max-w-full overflow-x-hidden">
        {/* Global Navigation Loading Progress Bar */}
        <React.Suspense fallback={null}>
          <TopProgressBar />
        </React.Suspense>

        {/* Toast notifications */}
        <Toaster position="top-right" richColors />

        {/* Main Collapsible Sidebar */}
        <Sidebar
          user={user}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        {/* Right Content Area */}
        <div
          className={cn(
            "flex-1 flex flex-col min-h-screen min-w-0 max-w-full transition-all duration-300 ease-in-out",
            isCollapsed ? "lg:ml-20" : "lg:ml-64",
            isDeliveryPortal && "max-md:ml-0"
          )}
        >
          {/* Global Demo Mode Banner */}
          <DemoModeBanner />

          {/* Topbar - sticky at top with safe-area padding for mobile PWA notch/island */}
          <div className={cn("sticky top-0 z-30 bg-white", isDeliveryPortal && "max-md:hidden")}>
            <Topbar user={user} onMenuToggle={() => setMobileOpen(true)} />
          </div>

          {/* Page Main Content */}
          <main
            className={cn(
              "flex-1 min-w-0 max-w-full p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto",
              isDeliveryPortal && "max-md:p-2 max-md:pb-24 max-md:pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] max-md:max-w-none"
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
