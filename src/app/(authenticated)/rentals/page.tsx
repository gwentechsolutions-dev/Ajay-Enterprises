"use client";

import * as React from "react";
import Link from "next/link";
import {
  ReceiptIndianRupee,
  FileText,
  Boxes,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Building,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RentalDashboardPage() {
  const [data, setData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchDashboard = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/rentals/dashboard");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load rental dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#F26522] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
              Phase 4 Operational
            </span>
            <span className="text-xs text-slate-500 font-mono">AJAY ENTERPRISES</span>
          </div>
          <h1 className="text-2xl font-black text-[#0B1E36] tracking-tight mt-1">
            Rental Management & Monthly Billing
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Deterministic daily equipment rental calculation, field held stock, and consolidated monthly statements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboard}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            asChild
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
          >
            <Link href="/rentals/statements">
              <Calculator className="h-3.5 w-3.5 mr-1.5" />
              Generate Monthly Statement
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Active Site Agreements</span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-[#0B1E36] flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {isLoading ? "..." : data?.activeAgreementsCount ?? 0}
            </span>
            <span className="text-xs text-slate-500">
              across {data?.activeSitesCount ?? 0} sites
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <Link
              href="/rentals/agreements"
              className="text-xs font-semibold text-[#0B1E36] hover:text-[#F26522] flex items-center gap-1"
            >
              Manage Agreements <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Equipment in Field</span>
            <div className="h-8 w-8 rounded-lg bg-orange-50 text-[#F26522] flex items-center justify-center">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {isLoading ? "..." : Number(data?.totalHeldQty ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">Nos. deployed</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <Link
              href="/rentals/held-stock"
              className="text-xs font-semibold text-[#0B1E36] hover:text-[#F26522] flex items-center gap-1"
            >
              Track Field Stock <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Daily Rental Accrual</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">
              ₹{isLoading ? "..." : Number(data?.dailyAccrualRunRate ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">/ day</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Actual daily earning across all sites
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>30-Day Expected Revenue</span>
            <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <ReceiptIndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              ₹{isLoading ? "..." : Number(data?.monthlyProjectedRevenue ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">projected</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Deposits held: ₹{Number(data?.totalDepositsHeld ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Module Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Link
          href="/rentals/agreements"
          className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0B1E36] hover:shadow-md transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-slate-100 group-hover:bg-[#0B1E36] text-[#0B1E36] group-hover:text-white flex items-center justify-center transition-colors">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-slate-900 mt-3 text-sm">Rental Agreements</h3>
          <p className="text-xs text-slate-500 mt-1">
            Site-specific rate agreements, terms, and security deposit commitments.
          </p>
        </Link>

        <Link
          href="/rentals/held-stock"
          className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0B1E36] hover:shadow-md transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-slate-100 group-hover:bg-[#0B1E36] text-[#0B1E36] group-hover:text-white flex items-center justify-center transition-colors">
            <Boxes className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-slate-900 mt-3 text-sm">Field Held Stock</h3>
          <p className="text-xs text-slate-500 mt-1">
            Live site equipment matrix, batch rates, and inventory reconciliation.
          </p>
        </Link>

        <Link
          href="/rentals/statements"
          className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0B1E36] hover:shadow-md transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-slate-100 group-hover:bg-[#0B1E36] text-[#0B1E36] group-hover:text-white flex items-center justify-center transition-colors">
            <Calculator className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-slate-900 mt-3 text-sm">Monthly Statements</h3>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic daily accruals, site-wise & consolidated customer billing.
          </p>
        </Link>

        <Link
          href="/rentals/damage-loss"
          className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0B1E36] hover:shadow-md transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-slate-100 group-hover:bg-[#0B1E36] text-[#0B1E36] group-hover:text-white flex items-center justify-center transition-colors">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-slate-900 mt-3 text-sm">Damage & Loss Claims</h3>
          <p className="text-xs text-slate-500 mt-1">
            Repairable damages, scrap grading, missing stock loss recovery.
          </p>
        </Link>

        <Link
          href="/rentals/closures"
          className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0B1E36] hover:shadow-md transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-slate-100 group-hover:bg-[#0B1E36] text-[#0B1E36] group-hover:text-white flex items-center justify-center transition-colors">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-slate-900 mt-3 text-sm">Site Closure</h3>
          <p className="text-xs text-slate-500 mt-1">
            Pre-closure unreturned audits, owner exceptions, and final settlements.
          </p>
        </Link>
      </div>

      {/* Main Content Two-Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Active Sites */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-[#0B1E36]" />
              <h2 className="font-bold text-sm text-slate-900">
                Top Active Sites by Daily Accrual
              </h2>
            </div>
            <Link
              href="/rentals/held-stock"
              className="text-xs font-semibold text-[#0B1E36] hover:text-[#F26522]"
            >
              View All Sites
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading top active sites...</div>
            ) : !data?.topSites || data.topSites.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No active site deployments yet. Dispatch materials via{" "}
                <Link href="/delivery-notes" className="text-[#0B1E36] font-semibold underline">
                  Delivery Notes
                </Link>{" "}
                to initiate daily accrual.
              </div>
            ) : (
              data.topSites.map((site: any, idx: number) => (
                <div key={site.siteId || idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-bold text-sm text-slate-900">{site.siteName}</p>
                    <p className="text-xs text-slate-500">Customer: {site.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm text-emerald-700">
                      ₹{Number(site.dailyAccrual).toLocaleString()} <span className="text-xs font-normal text-slate-400">/ day</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {Number(site.heldQty).toLocaleString()} Nos. on site
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Generated Statements */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#0B1E36]" />
              <h2 className="font-bold text-sm text-slate-900">Recent Statements</h2>
            </div>
            <Link
              href="/rentals/statements"
              className="text-xs font-semibold text-[#0B1E36] hover:text-[#F26522]"
            >
              All Statements
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading statements...</div>
            ) : !data?.recentStatements || data.recentStatements.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No statements generated yet.
              </div>
            ) : (
              data.recentStatements.map((stmt: any) => (
                <div key={stmt.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#0B1E36]">
                      {stmt.statementNumber}
                    </span>
                    <p className="text-xs text-slate-700 font-medium truncate max-w-[160px]">
                      {stmt.customer?.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(stmt.periodStartDate).toLocaleDateString()} to{" "}
                      {new Date(stmt.periodEndDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xs text-slate-900">
                      ₹{Number(stmt.netPayableAmount).toLocaleString()}
                    </span>
                    <div>
                      <span
                        className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          stmt.status === "FINALIZED"
                            ? "bg-emerald-100 text-emerald-800"
                            : stmt.status === "APPROVED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {stmt.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

