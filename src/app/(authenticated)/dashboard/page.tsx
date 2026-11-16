"use client";

import * as React from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  ReceiptIndianRupee,
  Boxes,
  Truck,
  AlertTriangle,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Landmark,
  Building2,
  HardHat,
  Scale,
  Calendar,
  Layers,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  ArrowLeftRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickActionDialog } from "@/components/dashboard/quick-action-dialog";

export default function OwnerDashboardPage() {
  const [data, setData] = React.useState<any | null>(null);
  const [period, setPeriod] = React.useState<"THIS_MONTH" | "PREV_MONTH" | "THIS_FY" | "PREV_FY">("THIS_MONTH");
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchDashboardData = React.useCallback(async (p: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/dashboard?period=${p}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDashboardData(period);
  }, [period, fetchDashboardData]);

  const kpis = data?.kpis;
  const breakdown = data?.categoryBreakdown;
  const trends = data?.monthlyTrends || [];
  const alerts = data?.alerts || [];
  const recent = data?.recentActivity || [];

  const formatCurrency = (val: any) => {
    if (!val && val !== 0) return "₹0";
    const num = Number(val);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatQuantity = (val: any) => {
    if (!val && val !== 0) return "0";
    return Number(val).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner & Period Filter */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36] whitespace-nowrap">
              AJAY ENTERPRISES · Executive Dashboard
            </h1>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-semibold text-xs whitespace-nowrap shrink-0">
                INVENTRA v1.0
              </Badge>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs whitespace-nowrap shrink-0">
                FY {data?.period?.fiscalYear || "2026-27"}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Real-time management overview, reconciled accounting ledgers, and centering material operations.
          </p>
        </div>

        {/* Period Selector & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-lg flex items-center border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setPeriod("THIS_MONTH")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                period === "THIS_MONTH" ? "bg-white text-[#0B1E36] font-semibold shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod("PREV_MONTH")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                period === "PREV_MONTH" ? "bg-white text-[#0B1E36] font-semibold shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Prev Month
            </button>
            <button
              onClick={() => setPeriod("THIS_FY")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                period === "THIS_FY" ? "bg-white text-[#0B1E36] font-semibold shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              This FY
            </button>
            <button
              onClick={() => setPeriod("PREV_FY")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                period === "PREV_FY" ? "bg-white text-[#0B1E36] font-semibold shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Prev FY
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData(period)}
            disabled={isLoading}
            isLoading={isLoading}
            loadingText="Refreshing..."
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <QuickActionDialog buttonLabel="ADD" />

          <Link href="/reports">
            <Button size="sm" className="bg-[#0B1E36] hover:bg-[#071424] text-white gap-1.5 text-xs">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Reports Hub
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Top Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Rental Revenue */}
        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rental Revenue (Period)</span>
              <div className="h-9 w-9 flex items-center justify-center bg-slate-100 text-[#0B1E36] rounded-lg ring-1 ring-slate-200/60">
                <ReceiptIndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {isLoading ? <Skeleton className="h-7 w-32 inline-block rounded" /> : formatCurrency(kpis?.revenueThisMonth)}
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>FY Total:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(kpis?.revenueThisFinancialYear)}</span>
              </div>
              {Number(kpis?.uninvoicedAccrualRevenue) > 0 && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-200/60">
                  <span className="font-semibold">+</span>
                  <span className="font-semibold">{formatCurrency(kpis?.uninvoicedAccrualRevenue)}</span>
                  <span className="text-amber-600">unbilled daily accrual</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cash Collected vs Invoiced */}
        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cash Collected (Period)</span>
              <div className="h-9 w-9 flex items-center justify-center bg-emerald-50 text-emerald-700 rounded-lg ring-1 ring-emerald-200/60">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-emerald-700">
                {isLoading ? <Skeleton className="h-7 w-32 inline-block rounded" /> : formatCurrency(kpis?.cashCollectedInPeriod)}
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
              <span>Customer receipts</span>
              <span className="text-emerald-700 font-medium inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Authorized
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Customer Outstanding Receivables */}
        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer Outstanding</span>
              <div className="h-9 w-9 flex items-center justify-center bg-orange-50 text-[#EA580C] rounded-lg ring-1 ring-orange-200/60">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {isLoading ? <Skeleton className="h-7 w-32 inline-block rounded" /> : formatCurrency(kpis?.customerOutstandingReceivables)}
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Due receivables</span>
              <Link href="/reports/customers" className="text-[#EA580C] hover:text-[#C2410C] font-medium hover:underline inline-flex items-center gap-1 transition-colors">
                View ageing <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit & Liquid Funds */}
        <Card className="bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Profit (Period)</span>
              <div className={`h-9 w-9 flex items-center justify-center rounded-lg ring-1 ${kpis?.isProfit ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60" : "bg-red-50 text-red-700 ring-red-200/60"}`}>
                {kpis?.isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-2xl font-bold tracking-tight ${kpis?.isProfit ? "text-emerald-700" : "text-red-700"}`}>
                {isLoading ? <Skeleton className="h-7 w-32 inline-block rounded" /> : formatCurrency(kpis?.netProfitInPeriod)}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                kpis?.isProfit 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                  : "bg-red-50 text-red-700 border-red-200"
              }`}>
                {kpis?.isProfit ? "PROFIT" : "LOSS"}
              </span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>Liquid Cash & Bank:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(kpis?.totalLiquidFunds)}</span>
              </div>
              {kpis?.cashAndBankAccounts && kpis.cashAndBankAccounts.length > 0 && (
                <div
                  className="text-[11px] text-slate-400 mt-1 truncate cursor-help"
                  title={kpis.cashAndBankAccounts.map((a: any) => `${a.accountCode}: ${formatCurrency(a.closingBalance)}`).join(" · ")}
                >
                  {kpis.cashAndBankAccounts.map((a: any) => `${a.accountCode}: ${formatCurrency(a.closingBalance)}`).join(" · ")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Operational & Equipment Deployment KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Material at Sites</div>
          <div className="text-xl font-bold text-[#0B1E36] mt-1">{formatQuantity(kpis?.materialQuantityAtSites)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Held on rent</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Warehouse Stock</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{formatQuantity(kpis?.availableWarehouseStock)}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Available for hire</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Under Repair / Dmg</div>
          <div className="text-xl font-bold text-amber-700 mt-1">{formatQuantity(kpis?.damagedAndUnderRepairStock)}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">In repair jobs</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Missing Units</div>
          <div className="text-xl font-bold text-red-600 mt-1">{formatQuantity(kpis?.missingMaterialQuantity)}</div>
          <div className="text-[11px] text-red-500 mt-0.5">Under investigation</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Active Agreements</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{kpis?.activeRentalAgreements || 0}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Running contracts</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Active Sites</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{kpis?.activeCustomerSites || 0}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Live customer sites</div>
        </div>

        <div
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1 group hover:border-slate-300 transition-colors cursor-help"
          title={
            kpis?.inventoryValuation
              ? `${formatCurrency(kpis.inventoryValuation.totalOwnedValuation)} (${
                  kpis.inventoryValuation.status === "PARTIALLY_VALUED"
                    ? `Partial: ${kpis.inventoryValuation.valuedVariantsCount}/${kpis.inventoryValuation.totalVariantsCount} variants valued`
                    : "Fully valued"
                } at purchase cost)`
              : "Valuation unavailable"
          }
        >
          <div className="text-slate-500 text-xs font-medium">Owned Valuation</div>
          <div className="text-xl font-bold text-slate-900 mt-1 whitespace-nowrap">
            {formatCurrency(kpis?.inventoryValuation?.totalOwnedValuation)}
          </div>
          <div className="text-[11px] mt-0.5 flex items-center gap-1">
            {kpis?.inventoryValuation?.status === "PARTIALLY_VALUED" ? (
              <span
                className="text-amber-600 font-medium truncate"
                title={`${kpis.inventoryValuation.valuedVariantsCount} of ${kpis.inventoryValuation.totalVariantsCount} variants valued at purchase cost`}
              >
                Partial ({kpis.inventoryValuation.valuedVariantsCount}/{kpis.inventoryValuation.totalVariantsCount})
              </span>
            ) : (
              <span className="text-slate-400">At purchase cost</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Visual Analytics: Monthly Trends & Category Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Revenue vs Expense Trends */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base text-[#0B1E36]">Revenue vs Operating Expenses (Last 6 Months)</CardTitle>
              <CardDescription className="text-xs">Reconciled from posted general ledger transactions</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#0B1E36]"></span> Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500"></span> Expense</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Profit</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {trends.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No historical financial data found</div>
            ) : (
              <div className="space-y-4">
                {trends.map((t: any) => {
                  const maxVal = Math.max(...trends.map((x: any) => Math.max(x.totalRevenue, x.totalExpense, 1000)));
                  const revWidth = Math.min(100, Math.round((t.totalRevenue / maxVal) * 100));
                  const expWidth = Math.min(100, Math.round((t.totalExpense / maxVal) * 100));

                  return (
                    <div key={t.month} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-slate-700">
                        <span className="font-semibold">{t.month}</span>
                        <span>
                          Rev: <strong>₹{t.totalRevenue.toLocaleString("en-IN")}</strong> | Exp: ₹{t.totalExpense.toLocaleString("en-IN")} | Net:{" "}
                          <strong className={t.netProfit >= 0 ? "text-emerald-700" : "text-red-600"}>
                            ₹{t.netProfit.toLocaleString("en-IN")}
                          </strong>
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${revWidth}%` }}
                            className="bg-[#0B1E36] rounded-full transition-all duration-500"
                            title={`Revenue: ₹${t.totalRevenue}`}
                          />
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${expWidth}%` }}
                            className="bg-orange-500 rounded-full transition-all duration-500"
                            title={`Expense: ₹${t.totalExpense}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right 1 Col: Revenue Mix by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#0B1E36]">Revenue Mix by Stream</CardTitle>
            <CardDescription className="text-xs">Period revenue breakdown</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {breakdown ? (
              <>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Rental Charges</span>
                    <span className="font-bold text-[#0B1E36]">{formatCurrency(breakdown.rentalRevenue)}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${Number(breakdown.total) > 0 ? (Number(breakdown.rentalRevenue) / Number(breakdown.total)) * 100 : 0}%`,
                      }}
                      className="h-full bg-[#0B1E36] rounded-full"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Material Sales</span>
                    <span className="font-bold text-slate-800">{formatCurrency(breakdown.materialSales)}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${Number(breakdown.total) > 0 ? (Number(breakdown.materialSales) / Number(breakdown.total)) * 100 : 0}%`,
                      }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Transport & Freight</span>
                    <span className="font-bold text-slate-800">{formatCurrency(breakdown.transportIncome)}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${Number(breakdown.total) > 0 ? (Number(breakdown.transportIncome) / Number(breakdown.total)) * 100 : 0}%`,
                      }}
                      className="h-full bg-amber-500 rounded-full"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">Damage & Loss Claims</span>
                    <span className="font-bold text-slate-800">{formatCurrency(breakdown.repairRecovery)}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${Number(breakdown.total) > 0 ? (Number(breakdown.repairRecovery) / Number(breakdown.total)) * 100 : 0}%`,
                      }}
                      className="h-full bg-orange-600 rounded-full"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-700">Total Billed</span>
                  <span className="text-[#0B1E36]">{formatCurrency(breakdown.total)}</span>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm">No revenue data for selected period</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. Business Alerts & Actionable Exceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exceptions & Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-[#0B1E36] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Actionable Business Alerts ({alerts.length})
              </CardTitle>
              <CardDescription className="text-xs">Immediate operational and financial items requiring review</CardDescription>
            </div>
            <Link href="/invoices">
              <Button variant="ghost" size="sm" className="text-xs text-orange-600 hover:text-orange-700">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                All operational items, invoices, and statutory compliances are up to date!
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                {alerts.map((al: any) => (
                  <Link
                    key={al.id}
                    href={al.href}
                    className="py-3 px-2 flex items-start gap-3 hover:bg-slate-50 rounded-lg transition-colors group"
                  >
                    <div
                      className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                        al.severity === "CRITICAL"
                          ? "bg-red-100 text-red-700"
                          : al.severity === "WARNING"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                          {al.title}
                        </span>
                        <Badge
                          variant={al.severity === "CRITICAL" ? "destructive" : al.severity === "WARNING" ? "warning" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {al.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{al.description}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 self-center" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Business Activity Feed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-[#0B1E36] flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Recent Business Activity
              </CardTitle>
              <CardDescription className="text-xs">Live consolidated operations feed across all branches</CardDescription>
            </div>
            <Link href="/movements">
              <Button variant="ghost" size="sm" className="text-xs text-[#0B1E36]">
                Movements
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {recent.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">No recent operational activity recorded</div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                {recent.map((rec: any) => (
                  <Link
                    key={rec.id}
                    href={rec.href}
                    className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 tracking-wider">
                        {rec.category}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-[#0B1E36] truncate">
                          {rec.title}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{rec.description}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="text-[10px] font-medium border-slate-200">
                        {rec.status}
                      </Badge>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(rec.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6. Navigation Shortcuts to Reports Hub */}
      <Card className="bg-gradient-to-r from-[#0B1E36] to-[#1E293B] text-white">
        <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Comprehensive Reports & Analytics Layer</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Access dedicated analytics for rentals, customer profitability, physical stock custody, statutory GST & double-entry financials, company-owned fleet mileage, and labour wage reconciliations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/reports/rentals">
              <Button size="sm" variant="secondary" className="text-xs bg-white text-[#0B1E36] hover:bg-slate-100">
                Rental Analytics
              </Button>
            </Link>
            <Link href="/reports/financial">
              <Button size="sm" variant="secondary" className="text-xs bg-white text-[#0B1E36] hover:bg-slate-100">
                Financial Statements
              </Button>
            </Link>
            <Link href="/reports">
              <Button size="sm" className="text-xs bg-orange-600 hover:bg-orange-700 text-white gap-1.5">
                Universal Report Builder <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
