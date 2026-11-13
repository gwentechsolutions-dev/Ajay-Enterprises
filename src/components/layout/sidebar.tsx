"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  GitBranch,
  Warehouse as WarehouseIcon,
  Users,
  ShieldCheck,
  FileDigit,
  History,
  Users2,
  Boxes,
  Truck,
  Receipt,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  HardHat,
  Lock,
  Layers,
  ClipboardCheck,
  Factory,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  disabled?: boolean;
  badge?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAVIGATION: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Inventory Hub", href: "/inventory", icon: Boxes },
    ],
  },
  {
    group: "Materials & Operations",
    items: [
      { title: "Material Catalogue", href: "/materials", icon: Layers },
      { title: "Movement Ledger", href: "/movements", icon: Truck },
      { title: "Stock Verification", href: "/inventory/audits", icon: ClipboardCheck },
      { title: "Customers & Sites", href: "/customers", icon: Users2 },
      { title: "Suppliers", href: "/suppliers", icon: Factory },
    ],
  },
  {
    group: "Business Master",
    items: [
      { title: "Company Profile", href: "/company", icon: Building2 },
      { title: "Branches", href: "/branches", icon: GitBranch },
      { title: "Warehouses & Yards", href: "/warehouses", icon: WarehouseIcon },
    ],
  },
  {
    group: "Administration",
    items: [
      { title: "Users", href: "/users", icon: Users },
      { title: "Roles & Permissions", href: "/roles", icon: ShieldCheck },
      { title: "Document Settings", href: "/document-settings", icon: FileDigit },
      { title: "Audit Logs", href: "/audit-logs", icon: History },
    ],
  },
  {
    group: "Upcoming (Phase 3+)",
    items: [
      { title: "Rental Billing", href: "/billing", icon: Receipt, disabled: true, badge: "Phase 3" },
      { title: "General Ledger", href: "/accounting", icon: BookOpen, disabled: true, badge: "Phase 4" },
      { title: "Labour Attendance", href: "/labour", icon: HardHat, disabled: true, badge: "Phase 6" },
    ],
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function Sidebar({ isCollapsed, setIsCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-[#0B1E36] text-white transition-all duration-300 ease-in-out",
          isCollapsed ? "w-20" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 overflow-hidden"
            onClick={() => setMobileOpen(false)}
          >
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white/10 p-1 flex items-center justify-center">
              <Image
                src="/assets/inventra-logo.png"
                alt="INVENTRA Logo"
                width={36}
                height={36}
                className="object-contain"
                priority
              />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-base font-bold tracking-tight text-white leading-tight">
                  INVENTRA
                </span>
                <span className="text-[10px] font-semibold text-accent-400 tracking-wider uppercase">
                  AJAY ENTERPRISES
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {NAVIGATION.map((group) => (
            <div key={group.group} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  {group.group}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

                if (item.disabled) {
                  return (
                    <div
                      key={item.title}
                      title={isCollapsed ? `${item.title} (${item.badge || 'Coming Soon'})` : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed select-none transition-colors opacity-60",
                        isCollapsed ? "justify-center" : "justify-between"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </div>
                      {!isCollapsed && item.badge && (
                        <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 flex items-center gap-1">
                          <Lock className="h-2.5 w-2.5" />
                          {item.badge}
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={isCollapsed ? item.title : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent-500 text-white font-semibold shadow-sm"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white",
                      isCollapsed && "justify-center"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                    {!isCollapsed && <span>{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Operating Identity Footer */}
        {!isCollapsed ? (
          <div className="p-3 border-t border-slate-800 bg-[#071322]">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="truncate">AJAY ENTERPRISES ERP</span>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                Phase 1 Live
              </span>
            </div>
          </div>
        ) : (
          <div className="p-2 border-t border-slate-800 flex justify-center bg-[#071322]">
            <span className="h-2 w-2 rounded-full bg-emerald-400" title="System Online" />
          </div>
        )}
      </aside>
    </>
  );
}

