"use client";

import * as React from "react";
import Link from "next/link";
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Scale,
  ReceiptIndianRupee,
  FileSpreadsheet,
  Calendar,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccountingDashboardPage() {
  const [tb, setTb] = React.useState<any | null>(null);
  const [pnl, setPnl] = React.useState<any | null>(null);
  const [gst, setGst] = React.useState<any | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tbRes, pnlRes, gstRes] = await Promise.all([
        fetch("/api/v1/accounting/reports/trial-balance"),
        fetch("/api/v1/accounting/reports/profit-loss"),
        fetch("/api/v1/accounting/reports/gst"),
      ]);
      const tbData = await tbRes.json();
      const pnlData = await pnlRes.json();
      const gstData = await gstRes.json();

      if (tbData.success) setTb(tbData.data);
      if (pnlData.success) setPnl(pnlData.data);
      if (gstData.success) setGst(gstData.data);
    } catch (err) {
      console.error("Failed to load accounting dashboard data", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleSeedChart = async () => {
    setIsSeeding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/accounting/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage("Default Chart of Accounts initialized successfully!");
        await loadData();
      } else {
        setMessage(data.error?.message || "Failed to initialize chart of accounts");
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const netGstPayable = gst
    ? Number(gst.gstr3b?.netTaxPayable || 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1E36] break-words">Accounting ERP</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 whitespace-nowrap">
              Double-Entry General Ledger
            </span>
          </div>
          <p className="text-sm text-slate-500">
            AJAY ENTERPRISES — Financial Accounting, Chart of Accounts, General Ledger & Statutory GST
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleSeedChart}
            disabled={isSeeding}
            className="bg-[#0B1E36] hover:bg-[#071322] text-white"
          >
            <Sparkles className="w-4 h-4 mr-2 text-[#F26522]" />
            {isSeeding ? "Initializing..." : "Seed Default Chart"}
          </Button>
        </div>
      </div>

      {message && (
        <div className="p-3 text-xs bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
          {message}
        </div>
      )}

      {/* Financial Health Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Gross Revenue (P&L)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-[#0B1E36] mt-2">
            ₹{pnl ? Number(pnl.totalIncome).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Rental, sales & service income</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Operating Expenses</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">
            ₹{pnl ? Number(pnl.totalExpenses).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Direct, labour & administrative costs</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Net Profit / Margin</span>
            <Scale className="w-4 h-4 text-blue-600" />
          </div>
          <div
            className={`text-2xl font-bold mt-2 ${
              pnl && Number(pnl.netProfit) >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            ₹{pnl ? Number(pnl.netProfit).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {pnl && Number(pnl.netProfit) >= 0 ? "Operating surplus" : "Operating deficit"}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Net GST Liability</span>
            <ReceiptIndianRupee className="w-4 h-4 text-[#F26522]" />
          </div>
          <div className="text-2xl font-bold text-[#0B1E36] mt-2">
            ₹{netGstPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Output tax minus eligible ITC</div>
        </div>
      </div>

      {/* Trial Balance Invariant Guard */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              tb?.isBalanced ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            }`}
          >
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#0B1E36] flex items-center gap-2">
              General Ledger Double-Entry Invariant:
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  tb?.isBalanced ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}
              >
                {tb?.isBalanced ? "BALANCED (Σ Debits == Σ Credits)" : "UNBALANCED"}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Total Debits: ₹{tb ? Number(tb.totalDebit).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"} | Total Credits: ₹
              {tb ? Number(tb.totalCredit).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
            </div>
          </div>
        </div>
        <Link href="/accounting/reports">
          <Button variant="outline" size="sm" className="text-xs">
            View Full Trial Balance
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </Link>
      </div>

      {/* Accounting Hub Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* General Ledger Journals */}
        <Link
          href="/accounting/journals"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-[#0B1E36] hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-700 group-hover:bg-[#0B1E36] group-hover:text-white transition-colors">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B1E36] transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="font-bold text-slate-800 group-hover:text-[#0B1E36]">General Ledger & Journals</h3>
          <p className="text-xs text-slate-500 mt-1">
            Manual and auto-posted journal entries with strict debit-credit validation and audit trails.
          </p>
        </Link>

        {/* Receipts & Payments */}
        <Link
          href="/accounting/payments"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-[#0B1E36] hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-[#0B1E36] group-hover:text-white transition-colors">
              <IndianRupee className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B1E36] transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="font-bold text-slate-800 group-hover:text-[#0B1E36]">Receipts & Payments</h3>
          <p className="text-xs text-slate-500 mt-1">
            Customer payment receipts, supplier disbursements, multi-invoice allocations, and advances.
          </p>
        </Link>

        {/* Indian GST Center */}
        <Link
          href="/accounting/gst"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-[#0B1E36] hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-orange-50 text-[#F26522] group-hover:bg-[#F26522] group-hover:text-white transition-colors">
              <ReceiptIndianRupee className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B1E36] transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="font-bold text-slate-800 group-hover:text-[#0B1E36]">GST & Statutory Tax</h3>
          <p className="text-xs text-slate-500 mt-1">
            GSTR-1 outward supplies, GSTR-3B monthly return summaries, and HSN/SAC rate masters.
          </p>
        </Link>

        {/* Financial Statements */}
        <Link
          href="/accounting/reports"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-[#0B1E36] hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-700 group-hover:bg-[#0B1E36] group-hover:text-white transition-colors">
              <Scale className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B1E36] transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="font-bold text-slate-800 group-hover:text-[#0B1E36]">Financial Reports & Statements</h3>
          <p className="text-xs text-slate-500 mt-1">
            Trial Balance, Profit & Loss Statement, Balance Sheet, and Customer / Supplier Ageing.
          </p>
        </Link>

        {/* Periods & FY Closing */}
        <Link
          href="/accounting/periods"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-[#0B1E36] hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 group-hover:bg-[#0B1E36] group-hover:text-white transition-colors">
              <Calendar className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B1E36] transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="font-bold text-slate-800 group-hover:text-[#0B1E36]">Fiscal Years & Period Locks</h3>
          <p className="text-xs text-slate-500 mt-1">
            Monthly accounting period locks, historical audit freeze, and annual Financial Year closing.
          </p>
        </Link>
      </div>
    </div>
  );
}

