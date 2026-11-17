"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { TopProgressBar } from "./top-progress-bar";
import { DemoModeBanner } from "./demo-mode-banner";
import { SessionUser } from "@/lib/auth";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";

interface AppShellProps {
  user: SessionUser;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
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
          "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out",
          isCollapsed ? "lg:ml-20" : "lg:ml-64"
        )}
      >
        {/* Global Demo Mode Banner */}
        <DemoModeBanner />

        {/* Topbar */}
        <Topbar user={user} onMenuToggle={() => setMobileOpen(true)} />

        {/* Page Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
