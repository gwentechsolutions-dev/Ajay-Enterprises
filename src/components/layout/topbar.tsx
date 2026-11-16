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
} from "lucide-react";
import { SessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
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

  // Search Palette State
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

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

  // Debounced search query
  React.useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.data.results || []);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error("Global search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 180);
    return () => clearTimeout(timer);
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

      {/* Center: Global Document & Entity Search */}
      <div className="flex items-center max-w-md w-full mx-2 sm:mx-4">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="relative w-full flex items-center h-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100/90 px-3 text-xs text-slate-500 transition-colors shadow-2xs group cursor-pointer text-left"
        >
          <Search className="h-4 w-4 text-slate-400 group-hover:text-slate-600 mr-2 shrink-0" />
          <span className="truncate">Search documents, customers, sites...</span>
          <kbd className="hidden sm:inline-flex ml-auto items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 shadow-2xs">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Search Modal Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-xl border border-slate-200 shadow-2xl top-[20%] translate-y-0">
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
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Delivery Notes (DN)", href: "/delivery-notes", icon: Truck },
                    { label: "Material Returns (MRN)", href: "/return-notes", icon: RotateCcw },
                    { label: "Tax Invoices", href: "/invoices", icon: ReceiptIndianRupee },
                    { label: "Customers & Sites", href: "/customers", icon: Users2 },
                    { label: "Inventory Hub", href: "/inventory", icon: Boxes },
                    { label: "Reports Hub", href: "/reports", icon: FileText },
                  ].map((s) => {
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

