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
  FileText,
  Truck,
  RotateCcw,
  ReceiptIndianRupee,
  Users2,
  Building2,
  Boxes,
  ArrowRight,
  Sparkles,
  Loader2,
  X,
  FileDigit,
  AlertTriangle,
  Clock,
  Info,
  CheckCheck,
} from "lucide-react";
import { SessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getDefaultPortalForRole, isExecutiveRole, isRouteAllowedForRole } from "@/lib/portal-routing";

interface TopbarProps {
  user: SessionUser;
  onMenuToggle: () => void;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  href: string;
  timestamp?: string;
}

export function Topbar({ user, onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  // Notifications State & Persistence
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());
  const [loadingNotifications, setLoadingNotifications] = React.useState(false);
  const notificationsRef = React.useRef<HTMLDivElement>(null);

  // Load read notifications from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("inventra_read_notifications");
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchNotifications = React.useCallback(async () => {
    try {
      setLoadingNotifications(true);
      const res = await fetch("/api/v1/notifications");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.notifications) {
          setNotifications(json.data.notifications);
        }
      }
    } catch (e) {
      console.error("Failed to load notifications", e);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  // Fetch notifications on mount and set polling interval (60s)
  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = React.useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("inventra_read_notifications", JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const visibleNotifications = React.useMemo(() => {
    return notifications.filter((n) => isRouteAllowedForRole(user.role, n.href));
  }, [notifications, user.role]);

  const markAllAsRead = React.useCallback(() => {
    const allIds = new Set(visibleNotifications.map((n) => n.id));
    setReadIds((prev) => {
      const next = new Set([...Array.from(prev), ...Array.from(allIds)]);
      try {
        localStorage.setItem("inventra_read_notifications", JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
    toast.success("All notifications marked as read");
  }, [visibleNotifications]);

  const unreadCount = React.useMemo(() => {
    return visibleNotifications.filter((n) => !readIds.has(n.id)).length;
  }, [visibleNotifications, readIds]);

  // Search Palette State & Client-Side Cache
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const searchCacheRef = React.useRef<Map<string, any[]>>(new Map());
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Close profile & notifications dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global Ctrl + K listener
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced search query with client cache and AbortController to prevent serverless queuing
  React.useEffect(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // 1. Instant cache hit check (0ms response)
    if (searchCacheRef.current.has(trimmed)) {
      setSearchResults(searchCacheRef.current.get(trimmed) || []);
      setSelectedIndex(0);
      setIsSearching(false);
      return;
    }

    // 2. Abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.success) {
          const results = data.data.results || [];
          searchCacheRef.current.set(trimmed, results);
          setSearchResults(results);
          setSelectedIndex(0);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Global search failed:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 240);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const handleSelectResult = (href: string) => {
    router.push(href);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = searchResults[selectedIndex] || searchResults[0];
      if (target) {
        handleSelectResult(target.href);
      }
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Delivery Notes":
        return <Truck className="h-4 w-4 text-sky-600" />;
      case "Material Returns":
        return <RotateCcw className="h-4 w-4 text-amber-600" />;
      case "Invoices":
        return <ReceiptIndianRupee className="h-4 w-4 text-emerald-600" />;
      case "Rental Agreements":
        return <FileText className="h-4 w-4 text-indigo-600" />;
      case "Customers":
        return <Users2 className="h-4 w-4 text-blue-600" />;
      case "Construction Sites":
        return <Building2 className="h-4 w-4 text-orange-600" />;
      case "Materials":
        return <Boxes className="h-4 w-4 text-purple-600" />;
      default:
        return <FileDigit className="h-4 w-4 text-slate-500" />;
    }
  };

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
    <header className="flex min-h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-4 lg:px-6 shadow-sm pt-[env(safe-area-inset-top,0px)]">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 touch-manipulation"
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 text-sm min-w-0">
          <span className="font-semibold text-slate-800 truncate">{breadcrumbTitle}</span>
          {pathSegments.length > 1 && (
            <>
              <span className="text-slate-400 shrink-0">/</span>
              <span className="text-slate-500 capitalize truncate hidden xs:inline sm:inline">
                {pathSegments[1].replace("-", " ")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center: Global Document & Entity Search */}
      <div className="flex items-center justify-end sm:justify-start sm:max-w-md sm:w-full mx-1 sm:mx-4 min-w-0 sm:flex-1">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search documents, customers, sites"
          className="relative flex items-center justify-center sm:justify-start h-9 w-9 sm:w-full rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100/90 sm:px-3 text-xs text-slate-500 transition-colors shadow-2xs group cursor-pointer text-left shrink-0"
        >
          <Search className="h-4 w-4 text-slate-400 group-hover:text-slate-600 sm:mr-2 shrink-0" />
          <span className="hidden sm:inline truncate">Search documents, customers, sites...</span>
          <kbd className="hidden md:inline-flex ml-auto items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 shadow-2xs">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Search Modal Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-xl border border-slate-200 shadow-2xl top-[12%] sm:top-[20%] translate-y-0">
          {/* Search Header Input */}
          <div className="flex items-center border-b border-slate-200 pl-4 pr-12 py-3 bg-white">
            <Search className="h-4 w-4 text-slate-400 mr-3 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search by DN #, MRN #, Invoice #, E-Way Bill, Customer, Site, or Material..."
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none pr-2"
            />
            {isSearching && <Loader2 className="h-4 w-4 text-slate-400 animate-spin mr-2 shrink-0" />}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-slate-600 p-1 mr-2 rounded hover:bg-slate-100 transition-colors"
                title="Clear input"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 shrink-0">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-slate-100">
            {searchQuery.trim().length >= 2 ? (
              searchResults.length > 0 ? (
                searchResults.map((result, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={result.id || idx}
                      onClick={() => handleSelectResult(result.href)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? "bg-slate-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          {getCategoryIcon(result.category)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {result.title}
                            </span>
                            {result.badge && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-semibold px-1.5 py-0 bg-slate-50 text-slate-600 border-slate-200"
                              >
                                {result.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {result.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                          {result.category}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </div>
                  );
                })
              ) : isSearching ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Searching records across INVENTRA...
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No matching documents, customers, sites, or materials found for &ldquo;{searchQuery}&rdquo;.
                </div>
              )
            ) : (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                  <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                  Quick Navigation Suggestions
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: "Delivery Driver App", href: "/delivery-portal", icon: Truck },
                    { label: "Delivery Notes (DN)", href: "/delivery-notes", icon: Truck },
                    { label: "Material Returns (MRN)", href: "/return-notes", icon: RotateCcw },
                    { label: "Vehicle Trips", href: "/fleet/trips", icon: Truck },
                    { label: "Tax Invoices", href: "/invoices", icon: ReceiptIndianRupee },
                    { label: "Customers & Sites", href: "/customers", icon: Users2 },
                    { label: "Inventory Hub", href: "/inventory", icon: Boxes },
                    { label: "Reports Hub", href: "/reports", icon: FileText },
                  ]
                    .filter((s) => isRouteAllowedForRole(user.role, s.href))
                    .slice(0, 6)
                    .map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.href}
                        type="button"
                        onClick={() => handleSelectResult(s.href)}
                        className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                      >
                        <Icon className="h-4 w-4 text-[#0B1E36]" />
                        <span className="text-xs font-medium text-slate-700">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Use <kbd className="font-mono bg-white border border-slate-200 px-1 rounded text-slate-600">&uarr;</kbd> <kbd className="font-mono bg-white border border-slate-200 px-1 rounded text-slate-600">&darr;</kbd> to navigate, <kbd className="font-mono bg-white border border-slate-200 px-1 rounded text-slate-600">&crarr;</kbd> to select</span>
            <span>INVENTRA Universal Search</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Right: Notifications & User Profile */}
      <div className="flex items-center gap-3">
        {/* Notifications Dropdown */}
        <div ref={notificationsRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              if (!notificationsOpen && notifications.length === 0) {
                fetchNotifications();
              }
            }}
            title={unreadCount > 0 ? `${unreadCount} unread notifications` : "System Notifications"}
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors cursor-pointer ${
              notificationsOpen
                ? "bg-slate-100 text-slate-800"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F26522]" />
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {notificationsOpen && (
            <div className="absolute right-[-3.25rem] sm:right-0 mt-2 w-[calc(100vw-1rem)] max-w-[24rem] sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-slate-900">Notifications</span>
                  {unreadCount > 0 ? (
                    <Badge className="bg-[#F26522] hover:bg-[#EA580C] text-white text-[10px] px-1.5 py-0 h-4 font-bold border-0">
                      {unreadCount} new
                    </Badge>
                  ) : (
                    <span className="text-[11px] text-slate-400">All read</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] font-medium text-slate-500 hover:text-[#0B1E36] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="h-3.5 w-3.5 text-[#F26522]" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                {loadingNotifications && visibleNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Checking for alerts...</p>
                  </div>
                ) : visibleNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="text-xs font-semibold text-slate-800">All caught up!</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      No active alerts for your workspace.
                    </p>
                  </div>
                ) : (
                  visibleNotifications.map((item) => {
                    const isUnread = !readIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          markAsRead(item.id);
                          setNotificationsOpen(false);
                          const targetHref = isRouteAllowedForRole(user.role, item.href)
                            ? item.href
                            : getDefaultPortalForRole(user.role);
                          router.push(targetHref);
                        }}
                        className={`p-3 text-left transition-colors flex items-start gap-3 hover:bg-slate-50 cursor-pointer ${
                          isUnread ? "bg-orange-50/30" : ""
                        }`}
                      >
                        {/* Severity Icon */}
                        <div
                          className={`mt-0.5 flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg ${
                            item.severity === "CRITICAL"
                              ? "bg-red-50 text-red-600 border border-red-100"
                              : item.severity === "WARNING"
                              ? "bg-amber-50 text-amber-600 border border-amber-100"
                              : "bg-blue-50 text-blue-600 border border-blue-100"
                          }`}
                        >
                          {item.severity === "CRITICAL" ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : item.severity === "WARNING" ? (
                            <Clock className="h-3.5 w-3.5" />
                          ) : (
                            <Info className="h-3.5 w-3.5" />
                          )}
                        </div>

                        {/* Text Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p
                              className={`text-xs truncate ${
                                isUnread ? "font-bold text-slate-900" : "font-medium text-slate-700"
                              }`}
                            >
                              {item.title}
                            </p>
                            {isUnread && (
                              <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-[#F26522]" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50 px-3.5 py-2 flex items-center justify-between text-[11px]">
                <Link
                  href={isExecutiveRole(user.role) ? "/dashboard" : getDefaultPortalForRole(user.role)}
                  onClick={() => setNotificationsOpen(false)}
                  className="text-[#0B1E36] font-semibold hover:underline flex items-center gap-1"
                >
                  <span>
                    {isExecutiveRole(user.role)
                      ? "Executive Dashboard"
                      : getDefaultPortalForRole(user.role) === "/delivery-portal"
                      ? "Delivery Driver App"
                      : getDefaultPortalForRole(user.role) === "/warehouse-portal"
                      ? "Warehouse Portal"
                      : getDefaultPortalForRole(user.role) === "/labour/attendance"
                      ? "Daily Attendance"
                      : "My Workspace"}
                  </span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchNotifications();
                  }}
                  disabled={loadingNotifications}
                  className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Refresh alerts"
                >
                  <RotateCcw className={`h-3 w-3 ${loadingNotifications ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          )}
        </div>

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

                {isRouteAllowedForRole(user.role, "/company") && (
                  <Link
                    href="/company"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    <span>Company Profile</span>
                  </Link>
                )}

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

