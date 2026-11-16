"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Truck,
  RotateCcw,
  Users2,
  Building2,
  ShoppingBag,
  FileText,
  ArrowLeftRight,
  Repeat,
  IndianRupee,
  Compass,
  HardHat,
  Layers,
  ArrowRight,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface QuickActionItem {
  id: string;
  title: string;
  subtitle: string;
  category: "Operations" | "Masters" | "Financials" | "Logistics & Labour";
  keywords: string[];
  badge?: string;
  href: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const QUICK_ACTIONS: QuickActionItem[] = [
  {
    id: "dn",
    title: "Delivery Note (DN)",
    subtitle: "Dispatch centering materials from yard to active customer site",
    category: "Operations",
    keywords: ["delivery", "dn", "dispatch", "send", "issue", "materials", "outward", "challan"],
    badge: "Most Used",
    href: "/delivery-notes?action=new",
    icon: Truck,
    iconBg: "bg-sky-50 border-sky-200",
    iconColor: "text-sky-600",
  },
  {
    id: "mrn",
    title: "Material Return (MRN)",
    subtitle: "Receive returned materials back to yard with inspection & count",
    category: "Operations",
    keywords: ["return", "mrn", "receive", "inward", "pickup", "reconciliation"],
    badge: "Most Used",
    href: "/return-notes?action=new",
    icon: RotateCcw,
    iconBg: "bg-amber-50 border-amber-200",
    iconColor: "text-amber-600",
  },
  {
    id: "customer",
    title: "New Customer Account",
    subtitle: "Register builder/client company with PAN, GSTIN & billing address",
    category: "Masters",
    keywords: ["customer", "client", "builder", "account", "contractor", "party", "new client"],
    href: "/customers?action=new",
    icon: Users2,
    iconBg: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-600",
  },
  {
    id: "site",
    title: "New Construction Site",
    subtitle: "Create independent project site, engineer contacts & location under customer",
    category: "Masters",
    keywords: ["site", "project", "construction", "location", "tower", "plot", "building"],
    href: "/customers?action=new_site",
    icon: Building2,
    iconBg: "bg-orange-50 border-orange-200",
    iconColor: "text-orange-600",
  },
  {
    id: "bill",
    title: "Purchase Bill / GRN",
    subtitle: "Record equipment purchase from supplier with tax & delivery details",
    category: "Financials",
    keywords: ["bill", "purchase", "grn", "supplier", "vendor", "expense", "buy", "invoice"],
    href: "/purchases/bills?action=new",
    icon: ShoppingBag,
    iconBg: "bg-emerald-50 border-emerald-200",
    iconColor: "text-emerald-600",
  },
  {
    id: "agreement",
    title: "New Rental Agreement",
    subtitle: "Set up commercial hire contract with daily item rates & deposit terms",
    category: "Operations",
    keywords: ["agreement", "contract", "rental", "tariff", "rate", "terms", "lease"],
    href: "/rentals/agreements?action=new",
    icon: FileText,
    iconBg: "bg-indigo-50 border-indigo-200",
    iconColor: "text-indigo-600",
  },
  {
    id: "dstn",
    title: "Direct Site Transfer (DSTN)",
    subtitle: "Transfer centering equipment directly between two client sites",
    category: "Operations",
    keywords: ["dstn", "direct transfer", "site transfer", "equipment transfer", "inter site"],
    href: "/operations/direct-transfers/new",
    icon: ArrowLeftRight,
    iconBg: "bg-purple-50 border-purple-200",
    iconColor: "text-purple-600",
  },
  {
    id: "stn",
    title: "Stock Transfer (STN)",
    subtitle: "Relocate material between AJAY ENTERPRISES storage yards",
    category: "Operations",
    keywords: ["stn", "stock transfer", "inter yard", "depot", "warehouse", "movement"],
    href: "/stock-transfers?action=new",
    icon: Repeat,
    iconBg: "bg-teal-50 border-teal-200",
    iconColor: "text-teal-600",
  },
  {
    id: "receipt",
    title: "Record Customer Receipt",
    subtitle: "Log incoming customer settlement payment via NEFT, RTGS, Cheque or Cash",
    category: "Financials",
    keywords: ["receipt", "payment", "customer payment", "neft", "cheque", "collection", "money"],
    href: "/accounting/payments?action=receipt",
    icon: IndianRupee,
    iconBg: "bg-green-50 border-green-200",
    iconColor: "text-green-600",
  },
  {
    id: "fleet",
    title: "Record Vehicle Fuel & Expense",
    subtitle: "Log fuel refilling, toll payments, or fleet maintenance costs",
    category: "Logistics & Labour",
    keywords: ["fleet", "fuel", "diesel", "trip", "vehicle", "driver", "maintenance", "toll"],
    href: "/fleet/fuel",
    icon: Compass,
    iconBg: "bg-cyan-50 border-cyan-200",
    iconColor: "text-cyan-600",
  },
  {
    id: "attendance",
    title: "Daily Labour Attendance",
    subtitle: "Mark yard loading/unloading staff daily muster roll & overtime",
    category: "Logistics & Labour",
    keywords: ["attendance", "labour", "worker", "muster", "wages", "shift", "overtime"],
    href: "/labour/attendance",
    icon: HardHat,
    iconBg: "bg-yellow-50 border-yellow-200",
    iconColor: "text-yellow-600",
  },
  {
    id: "repair",
    title: "Material Repair Job",
    subtitle: "Send damaged props/spans/sheets for welding & straightening",
    category: "Logistics & Labour",
    keywords: ["repair", "maintenance", "reconditioning", "welding", "damaged", "workshop"],
    href: "/material-maintenance",
    icon: Layers,
    iconBg: "bg-rose-50 border-rose-200",
    iconColor: "text-rose-600",
  },
];

interface QuickActionDialogProps {
  buttonLabel?: string;
  className?: string;
}

export function QuickActionDialog({
  buttonLabel = ":ADD",
  className,
}: QuickActionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Filter actions based on query and category
  const filteredActions = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return QUICK_ACTIONS.filter((action) => {
      // Category filter
      if (selectedCategory !== "ALL" && action.category !== selectedCategory) {
        return false;
      }
      // Query search
      if (!query) return true;
      const titleMatch = action.title.toLowerCase().includes(query);
      const subtitleMatch = action.subtitle.toLowerCase().includes(query);
      const keywordMatch = action.keywords.some((kw) => kw.includes(query));
      return titleMatch || subtitleMatch || keywordMatch;
    });
  }, [searchQuery, selectedCategory]);

  // Reset selected index when filter changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, selectedCategory]);

  // Focus input when dialog opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
      setSelectedCategory("ALL");
      setSelectedIndex(0);
    }
  }, [open]);

  const handleSelect = (action: QuickActionItem) => {
    setOpen(false);
    router.push(action.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredActions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        handleSelect(filteredActions[selectedIndex]);
      }
    }
  };

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className={`bg-[#F26522] hover:bg-[#ea580c] text-white gap-1.5 text-xs font-bold shadow-xs transition-all duration-150 cursor-pointer ${
          className || ""
        }`}
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-xl border border-slate-200 shadow-2xl top-[20%] translate-y-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Quick Create Operation</DialogTitle>
          </DialogHeader>

          {/* Search Header Input */}
          <div className="flex items-center border-b border-slate-200 pl-4 pr-12 py-3 bg-white">
            <Search className="h-4 w-4 text-slate-400 mr-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type to create: customer, delivery note, return, bill, agreement..."
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none pr-2"
            />
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

          {/* Quick Filter Categories */}
          <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-50/80 border-b border-slate-200 overflow-x-auto text-xs">
            <span className="text-[11px] font-medium text-slate-500 mr-1 shrink-0">Filter:</span>
            {["ALL", "Operations", "Masters", "Financials", "Logistics & Labour"].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? "bg-[#0B1E36] text-white shadow-2xs"
                    : "bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/80"
                }`}
              >
                {cat === "ALL" ? "All Operations" : cat}
              </button>
            ))}
          </div>

          {/* Action Items List */}
          <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-slate-100">
            {filteredActions.length > 0 ? (
              filteredActions.map((action, idx) => {
                const IconComponent = action.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={action.id}
                    onClick={() => handleSelect(action)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? "bg-slate-100/90 ring-1 ring-slate-300"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border ${action.iconBg}`}
                      >
                        <IconComponent className={`h-5 w-5 ${action.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 truncate">
                            {action.title}
                          </span>
                          {action.badge && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-orange-50 text-[#F26522] border-orange-200 font-semibold"
                            >
                              {action.badge}
                            </Badge>
                          )}
                          <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                            {action.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {action.subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-2 shrink-0">
                      <span className="text-[11px] font-medium text-slate-400 group-hover:text-slate-600 hidden sm:inline-block">
                        Create
                      </span>
                      <ArrowRight
                        className={`h-4 w-4 transition-transform ${
                          isSelected ? "text-[#F26522] translate-x-0.5" : "text-slate-300"
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center">
                <Sparkles className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No actions found</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  No operational actions matching &ldquo;{searchQuery}&rdquo;. Try searching for &ldquo;delivery&rdquo;, &ldquo;return&rdquo;, &ldquo;customer&rdquo;, &ldquo;bill&rdquo;, or &ldquo;site&rdquo;.
                </p>
              </div>
            )}
          </div>

          {/* Quick Footer */}
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200 text-[10px]">
                  ↑↓
                </kbd>{" "}
                to navigate
              </span>
              <span>
                <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200 text-[10px]">
                  Enter
                </kbd>{" "}
                to create
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              INVENTRA Quick Operations
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
