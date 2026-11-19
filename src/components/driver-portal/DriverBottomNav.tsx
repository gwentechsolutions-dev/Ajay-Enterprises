"use client";

import * as React from "react";
import {
  Home,
  Truck,
  RotateCcw,
  Compass,
  User,
} from "lucide-react";
import { useDriverTranslation } from "@/lib/i18n/driver-portal";
import { cn } from "@/lib/utils";

export type DriverNavTab = "HOME" | "DELIVERIES" | "PICKUPS" | "TRIPS" | "PROFILE";

interface DriverBottomNavProps {
  activeTab: DriverNavTab;
  onChangeTab: (tab: DriverNavTab) => void;
  pendingDeliveriesCount?: number;
  pendingPickupsCount?: number;
  className?: string;
}

export function DriverBottomNav({
  activeTab,
  onChangeTab,
  pendingDeliveriesCount = 0,
  pendingPickupsCount = 0,
  className,
}: DriverBottomNavProps) {
  const { t } = useDriverTranslation();

  const handleTabClick = (tab: DriverNavTab) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
    onChangeTab(tab);
  };

  const navItems: Array<{
    id: DriverNavTab;
    label: string;
    icon: React.ElementType;
    badgeCount?: number;
  }> = [
    { id: "HOME", label: t.navHome, icon: Home },
    {
      id: "DELIVERIES",
      label: t.navDeliveries,
      icon: Truck,
      badgeCount: pendingDeliveriesCount,
    },
    {
      id: "PICKUPS",
      label: t.navPickups,
      icon: RotateCcw,
      badgeCount: pendingPickupsCount,
    },
    { id: "TRIPS", label: t.navTrips, icon: Compass },
    { id: "PROFILE", label: t.navProfile, icon: User },
  ];

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:hidden",
        className
      )}
      aria-label="Driver portal navigation"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item.id)}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 min-h-[50px] touch-manipulation select-none active:scale-95",
                isActive
                  ? "text-[#F26522] font-black"
                  : "text-slate-500 hover:text-slate-800 font-semibold"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform duration-150",
                    isActive && "scale-110 stroke-[2.5]"
                  )}
                />

                {/* Notification Badge */}
                {Boolean(item.badgeCount && item.badgeCount > 0) && (
                  <span className="absolute -top-1 -right-2 bg-[#F26522] text-white text-[9px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {item.badgeCount}
                  </span>
                )}
              </div>

              <span className="text-[10px] mt-0.5 tracking-tight leading-tight truncate max-w-[64px]">
                {item.label}
              </span>

              {/* Active Underline Pill */}
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-[#F26522]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
