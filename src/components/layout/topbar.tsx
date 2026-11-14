"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  Search,
  Bell,
  User as UserIcon,
  LogOut,
  KeyRound,
  Building,
  CheckCircle2,
} from "lucide-react";
import { SessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface TopbarProps {
  user: SessionUser;
  onMenuToggle: () => void;
}

export function Topbar({ user, onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      const res = await fetch("/api/v1/auth/logout", { method: "POST" });
      if (res.ok) {
        toast.success("Signed out successfully");
        router.push("/login");
        router.refresh();
      }
    } catch {
      toast.error("Failed to sign out");
    } finally {
      setSigningOut(false);
    }
  };

  // Convert pathname to clean breadcrumbs
  const pathSegments = pathname.split("/").filter(Boolean);
  const breadcrumbTitle = pathSegments.length > 0
    ? pathSegments[0].charAt(0).toUpperCase() + pathSegments[0].slice(1).replace("-", " ")
    : "Dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6 shadow-sm">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-slate-800">{breadcrumbTitle}</span>
          {pathSegments.length > 1 && (
            <>
              <span className="text-slate-400">/</span>
              <span className="text-slate-500 capitalize">
                {pathSegments[1].replace("-", " ")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center: Global Search Placeholder */}
      <div className="hidden md:flex items-center max-w-md w-full mx-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents, customers, sites... (Ctrl + K)"
            disabled
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none cursor-not-allowed"
          />
          <span className="absolute right-2.5 top-2 rounded bg-slate-200/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
            Coming Soon
          </span>
        </div>
      </div>

      {/* Right: Notifications & User Profile */}
      <div className="flex items-center gap-3">
        {/* Notifications Icon */}
        <button
          type="button"
          title="System Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent-500" />
        </button>

        {/* User Profile Menu */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-900 text-white font-semibold text-xs shadow-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col text-xs leading-tight">
              <span className="font-semibold text-slate-800 truncate max-w-[120px]">
                {user.name}
              </span>
              <span className="text-slate-500 text-[10px]">{user.role}</span>
            </div>
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in-50 zoom-in-95 z-50">
              <div className="border-b border-slate-100 p-2.5 mb-1">
                <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary-900 bg-primary-50">
                    {user.role}
                  </Badge>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {user.userCode}
                  </span>
                </div>
              </div>

              <div className="space-y-0.5">
                <Link
                  href="/change-password"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                  <span>Change Password</span>
                </Link>

                <Link
                  href="/company"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  <Building className="h-3.5 w-3.5 text-slate-400" />
                  <span>Company Profile</span>
                </Link>

                <div className="border-t border-slate-100 my-1" />

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors font-medium disabled:opacity-60"
                >
                  <LogOut className={`h-3.5 w-3.5 text-red-500 ${signingOut ? "animate-spin" : ""}`} />
                  <span>{signingOut ? "Signing out..." : "Sign Out"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

