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
  ReceiptIndianRupee,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  HardHat,
  Lock,
  Layers,
  ClipboardCheck,
  Factory,
  ShoppingBag,
  RotateCcw,
  ArrowLeftRight,
  Repeat,
  Compass,
  FileText,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
  Landmark,
  Scale,
  FileSpreadsheet,
  Calendar,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionUser } from "@/lib/auth";
import { getDefaultPortalForRole, isNavItemAllowedForRole } from "@/lib/portal-routing";

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
    group: "Operations & Movement",
    items: [
      { title: "Delivery Notes (DN)", href: "/delivery-notes", icon: Truck },
      { title: "Material Returns (MRN)", href: "/return-notes", icon: RotateCcw },
      { title: "Direct Transfers (DSTN)", href: "/operations/direct-transfers", icon: ArrowLeftRight },
      { title: "Stock Transfers (STN)", href: "/stock-transfers", icon: ArrowLeftRight },
      { title: "Purchases & GRN", href: "/purchases", icon: ShoppingBag },
      { title: "Hiring Notes (HDN/HRN)", href: "/hiring-notes", icon: Repeat },
      { title: "Movement Ledger", href: "/movements", icon: History },
      { title: "Stock Verification", href: "/inventory/audits", icon: ClipboardCheck },
    ],
  },
  {
    group: "Rental & Billing Engine",
    items: [
      { title: "Rental Operations", href: "/rentals", icon: ReceiptIndianRupee },
      { title: "Rental Agreements", href: "/rentals/agreements", icon: FileText },
      { title: "Field Held Equipment", href: "/rentals/held-stock", icon: Boxes },
      { title: "Monthly Statements", href: "/rentals/statements", icon: Calculator },
      { title: "Damage & Loss Claims", href: "/rentals/damage-loss", icon: AlertTriangle },
      { title: "Site Closure & Settlement", href: "/rentals/closures", icon: CheckCircle2 },
    ],
  },
  {
    group: "Invoicing & Financial ERP",
    items: [
      { title: "Tax Invoices", href: "/invoices", icon: FileText },
      { title: "Purchase Bills", href: "/purchases/bills", icon: ShoppingBag },
      { title: "Accounting Hub", href: "/accounting", icon: BookOpen },
      { title: "Chart of Accounts", href: "/accounting/accounts", icon: Layers },
      { title: "General Ledger", href: "/accounting/journals", icon: FileSpreadsheet },
      { title: "Receipts & Payments", href: "/accounting/payments", icon: IndianRupee },
      { title: "Banking & Contra", href: "/accounting/banking", icon: Landmark },
      { title: "GST & Statutory Tax", href: "/accounting/gst", icon: ReceiptIndianRupee },
      { title: "Financial Reports", href: "/accounting/reports", icon: Scale },
      { title: "Fiscal Years & Locks", href: "/accounting/periods", icon: Calendar },
    ],
  },
  {
    group: "Catalogue & Masters",
    items: [
      { title: "Customers & Sites", href: "/customers", icon: Users2 },
      { title: "Material Catalogue", href: "/materials", icon: Layers },
      { title: "Suppliers", href: "/suppliers", icon: Factory },
      { title: "Warehouses & Yards", href: "/warehouses", icon: WarehouseIcon },
      { title: "Branches", href: "/branches", icon: GitBranch },
    ],
  },
  {
    group: "Company Fleet & Logistics",
    items: [
      { title: "Fleet Overview", href: "/fleet", icon: Truck },
      { title: "Company Vehicles", href: "/fleet/vehicles", icon: Truck },
      { title: "Drivers Master", href: "/fleet/drivers", icon: Users },
      { title: "Vehicle Trips", href: "/fleet/trips", icon: Compass },
      { title: "Fuel Management", href: "/fleet/fuel", icon: Repeat },
      { title: "Vehicle Maintenance", href: "/fleet/maintenance", icon: AlertTriangle },
    ],
  },
  {
    group: "Labour & Material Reconditioning",
    items: [
      { title: "Labour Overview", href: "/labour", icon: HardHat },
      { title: "Workforce Register", href: "/labour/workers", icon: Users2 },
      { title: "Daily Attendance", href: "/labour/attendance", icon: ClipboardCheck },
      { title: "Wage Settlements", href: "/labour/wages", icon: Calculator },
      { title: "Labour Advances", href: "/labour/advances", icon: IndianRupee },
      { title: "Centering Material Repairs", href: "/material-maintenance", icon: Layers },
    ],
  },
  {
    group: "Portals (PWA & Yard)",
    items: [
      { title: "Warehouse Yard Portal", href: "/warehouse-portal", icon: WarehouseIcon },
      { title: "Delivery Driver App", href: "/delivery-portal", icon: Compass },
    ],
  },
  {
    group: "Analytics & Reports",
    items: [
      { title: "Reports Hub", href: "/reports", icon: FileSpreadsheet },
      { title: "Rental Analytics", href: "/reports/rentals", icon: ReceiptIndianRupee },
      { title: "Customer Receivables", href: "/reports/customers", icon: Users2 },
      { title: "Inventory Custody", href: "/reports/inventory", icon: Boxes },
      { title: "Financial Statements", href: "/reports/financial", icon: Scale },
      { title: "Fleet & Mileage", href: "/reports/fleet", icon: Truck },
      { title: "Labour & Wages", href: "/reports/labour", icon: HardHat },
      { title: "Material Repairs", href: "/reports/maintenance", icon: Layers },
    ],
  },
  {
    group: "Production Cutover & Launch",
    items: [
      { title: "Cutover & Go-Live Hub", href: "/cutover", icon: ShieldCheck, badge: "Owner" },
      { title: "Demo Data Manager", href: "/demo-data", icon: Database, badge: "Demo" },
      { title: "Pilot Operations", href: "/pilot", icon: Compass },
      { title: "Staff Training & SOPs", href: "/training", icon: BookOpen },
    ],
  },
  {
    group: "Administration",
    items: [
      { title: "Company Profile", href: "/company", icon: Building2 },
      { title: "Users", href: "/users", icon: Users },
      { title: "Roles & Permissions", href: "/roles", icon: ShieldCheck },
      { title: "Document Settings", href: "/document-settings", icon: FileDigit },
      { title: "Audit Logs", href: "/audit-logs", icon: History },
    ],
  },
];

interface SidebarProps {
  user?: SessionUser;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function Sidebar({ user, isCollapsed, setIsCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();

  const filteredNavigation = React.useMemo(() => {
    return NAVIGATION.map((group) => ({
      ...group,
      items: group.items.filter((item) => isNavItemAllowedForRole(user?.role, item.href)),
    })).filter((group) => group.items.length > 0);
  }, [user?.role]);

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
            href={getDefaultPortalForRole(user?.role)}
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
          {filteredNavigation.map((group) => (
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
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all active:scale-[0.98]",
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
                v1.0 Live
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

