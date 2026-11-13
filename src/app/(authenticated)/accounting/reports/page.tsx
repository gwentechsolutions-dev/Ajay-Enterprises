"use client";

import * as React from "react";
import Link from "next/link";
import {
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Calendar,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  Printer,
  Clock,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccountingReportsPage() {
  const [activeTab, setActiveTab] = React.useState<"TB" | "PNL" | "BS" | "AGEING">("TB");
  const [tb, setTb] = React.useState<any | null>(null);
  const [pnl, setPnl] = React.useState<any | null>(null);
  const [bs, setBs] = React.useState<any | null>(null);
  const [ageing, setAgeing] = React.useState<any | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const [tbRes, pnlRes, bsRes, agRes] = await Promise.all([
        fetch("/api/v1/accounting/reports/trial-balance"),
        fetch("/api/v1/accounting/reports/profit-loss"),
        fetch("/api/v1/accounting/reports/balance-sheet"),
        fetch("/api/v1/accounting/reports/ageing"),
      ]);
      const tbData = await tbRes.json();
      const pnlData = await pnlRes.json();
      const bsData = await bsRes.json();
      const agData = await agRes.json();

      if (tbData.success) setTb(tbData.data);
      if (pnlData.success) setPnl(pnlData.data);
      if (bsData.success) setBs(bsData.data);
      if (agData.success) setAgeing(agData.data);
    } catch (err) {
      console.error("Failed to load reports", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadReports();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/accounting"
              className="text-slate-400 hover:text-slate-600 transition-colors text-xs flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Accounting Hub
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Financial Statements & Reports</h1>
          <p className="text-sm text-slate-500">
            Double-entry Trial Balance, Profit & Loss, Balance Sheet, and Receivables/Payables Ageing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadReports}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="border-slate-300 text-slate-700"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("TB")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "TB"
              ? "border-[#0B1E36] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Scale className="w-4 h-4" />
          Trial Balance
        </button>
        <button
          onClick={() => setActiveTab("PNL")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "PNL"
              ? "border-[#0B1E36] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Profit & Loss Statement
        </button>
        <button
          onClick={() => setActiveTab("BS")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "BS"
              ? "border-[#0B1E36] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Balance Sheet
        </button>
        <button
          onClick={() => setActiveTab("AGEING")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "AGEING"
              ? "border-[#0B1E36] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          Customer & Supplier Ageing
        </button>
      </div>

      {/* Tab 1: Trial Balance */}
      {activeTab === "TB" && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-[#0B1E36]">Double-Entry Trial Balance</h2>
              <p className="text-xs text-slate-400">As on {new Date().toLocaleDateString("en-IN")}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                tb?.isBalanced ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              {tb?.isBalanced ? "BALANCED (Σ Debits == Σ Credits)" : "UNBALANCED"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Code</th>
                  <th className="p-2.5">Account Name</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5 text-right">Debit (₹)</th>
                  <th className="p-2.5 text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {!tb?.rows || tb.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 font-sans">
                      No general ledger balances found. Click Seed Default Chart in Accounting Hub.
                    </td>
                  </tr>
                ) : (
                  tb.rows.map((row: any) => (
                    <tr key={row.accountId} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-[#0B1E36]">{row.accountCode}</td>
                      <td className="p-2.5 font-sans font-medium text-slate-800">{row.accountName}</td>
                      <td className="p-2.5 font-sans text-slate-500">{row.category}</td>
                      <td className="p-2.5 text-right font-bold text-slate-800">
                        {Number(row.debitAmount) > 0 ? `₹${Number(row.debitAmount).toFixed(2)}` : "-"}
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-800">
                        {Number(row.creditAmount) > 0 ? `₹${Number(row.creditAmount).toFixed(2)}` : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold font-mono border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="p-3 text-right font-sans text-sm text-[#0B1E36]">
                    Total:
                  </td>
                  <td className="p-3 text-right text-sm text-[#0B1E36]">
                    ₹{tb ? Number(tb.totalDebit).toFixed(2) : "0.00"}
                  </td>
                  <td className="p-3 text-right text-sm text-[#0B1E36]">
                    ₹{tb ? Number(tb.totalCredit).toFixed(2) : "0.00"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Profit & Loss */}
      {activeTab === "PNL" && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-base font-bold text-[#0B1E36]">Statement of Profit & Loss</h2>
            <p className="text-xs text-slate-400">Current Financial Year Performance</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income Side */}
            <div className="space-y-3">
              <h3 className="font-bold text-emerald-800 text-sm border-b pb-1">INCOME (4000s)</h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {pnl?.incomeAccounts?.map((acc: any) => (
                    <tr key={acc.accountId} className="py-1">
                      <td className="py-2 text-slate-700">{acc.accountName}</td>
                      <td className="py-2 text-right font-mono font-bold text-emerald-700">
                        ₹{Number(acc.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-emerald-600 font-bold">
                  <tr>
                    <td className="py-2 text-emerald-900">Total Income:</td>
                    <td className="py-2 text-right font-mono text-emerald-900">
                      ₹{pnl ? Number(pnl.totalIncome).toFixed(2) : "0.00"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Expenses Side */}
            <div className="space-y-3">
              <h3 className="font-bold text-rose-800 text-sm border-b pb-1">EXPENSES (5000s)</h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {pnl?.expenseAccounts?.map((acc: any) => (
                    <tr key={acc.accountId} className="py-1">
                      <td className="py-2 text-slate-700">{acc.accountName}</td>
                      <td className="py-2 text-right font-mono font-bold text-rose-700">
                        ₹{Number(acc.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-rose-600 font-bold">
                  <tr>
                    <td className="py-2 text-rose-900">Total Expenses:</td>
                    <td className="py-2 text-right font-mono text-rose-900">
                      ₹{pnl ? Number(pnl.totalExpenses).toFixed(2) : "0.00"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Net Profit Summary */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <span className="text-base font-bold text-[#0B1E36]">NET PROFIT / (LOSS) FOR THE YEAR:</span>
            <span
              className={`text-xl font-bold font-mono ${
                pnl && Number(pnl.netProfit) >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              ₹{pnl ? Number(pnl.netProfit).toFixed(2) : "0.00"}
            </span>
          </div>
        </div>
      )}

      {/* Tab 3: Balance Sheet */}
      {activeTab === "BS" && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-base font-bold text-[#0B1E36]">Balance Sheet</h2>
            <p className="text-xs text-slate-400">Assets = Liabilities + Equity Invariant Verification</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assets */}
            <div className="space-y-3">
              <h3 className="font-bold text-blue-800 text-sm border-b pb-1">ASSETS (1000s)</h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {bs?.assetAccounts?.map((acc: any) => (
                    <tr key={acc.accountId}>
                      <td className="py-2 text-slate-700">{acc.accountName}</td>
                      <td className="py-2 text-right font-mono font-bold text-slate-800">
                        ₹{Number(acc.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-blue-600 font-bold">
                  <tr>
                    <td className="py-2 text-blue-900">Total Assets:</td>
                    <td className="py-2 text-right font-mono text-blue-900 text-sm">
                      ₹{bs ? Number(bs.totalAssets).toFixed(2) : "0.00"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Liabilities & Equity */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-bold text-amber-800 text-sm border-b pb-1">LIABILITIES (2000s)</h3>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {bs?.liabilityAccounts?.map((acc: any) => (
                      <tr key={acc.accountId}>
                        <td className="py-1.5 text-slate-700">{acc.accountName}</td>
                        <td className="py-1.5 text-right font-mono font-bold text-slate-800">
                          ₹{Number(acc.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-amber-300 font-semibold">
                    <tr>
                      <td className="py-1.5 text-amber-900">Total Liabilities:</td>
                      <td className="py-1.5 text-right font-mono text-amber-900">
                        ₹{bs ? Number(bs.totalLiabilities).toFixed(2) : "0.00"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="font-bold text-purple-800 text-sm border-b pb-1">EQUITY & RESERVES (3000s)</h3>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {bs?.equityAccounts?.map((acc: any) => (
                      <tr key={acc.accountId}>
                        <td className="py-1.5 text-slate-700">{acc.accountName}</td>
                        <td className="py-1.5 text-right font-mono font-bold text-slate-800">
                          ₹{Number(acc.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-1.5 text-slate-700 font-medium">Current Period Net Profit:</td>
                      <td className="py-1.5 text-right font-mono font-bold text-emerald-600">
                        ₹{bs ? Number(bs.currentPeriodProfit || 0).toFixed(2) : "0.00"}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="border-t border-purple-300 font-semibold">
                    <tr>
                      <td className="py-1.5 text-purple-900">Total Equity:</td>
                      <td className="py-1.5 text-right font-mono text-purple-900">
                        ₹{bs ? Number(bs.totalEquity).toFixed(2) : "0.00"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="pt-2 border-t-2 border-slate-400 flex justify-between font-bold text-sm text-[#0B1E36]">
                <span>Total Liabilities & Equity:</span>
                <span className="font-mono">
                  ₹{bs ? (Number(bs.totalLiabilities) + Number(bs.totalEquity)).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Ageing */}
      {activeTab === "AGEING" && (
        <div className="space-y-6">
          {/* Customer Receivables Ageing */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-[#0B1E36] text-sm">
              Customer Accounts Receivable Ageing (Overdue Analysis)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Customer</th>
                    <th className="p-2.5 text-right">0 - 30 Days</th>
                    <th className="p-2.5 text-right">31 - 60 Days</th>
                    <th className="p-2.5 text-right">61 - 90 Days</th>
                    <th className="p-2.5 text-right">90+ Days</th>
                    <th className="p-2.5 text-right">Total Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {!ageing?.customers || ageing.customers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 font-sans">
                        No outstanding customer invoices found
                      </td>
                    </tr>
                  ) : (
                    ageing.customers.map((c: any) => (
                      <tr key={c.customerId} className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans font-semibold text-slate-800">{c.customerName}</td>
                        <td className="p-2.5 text-right text-emerald-600">₹{Number(c.days0To30).toFixed(2)}</td>
                        <td className="p-2.5 text-right text-amber-600">₹{Number(c.days31To60).toFixed(2)}</td>
                        <td className="p-2.5 text-right text-orange-600">₹{Number(c.days61To90).toFixed(2)}</td>
                        <td className="p-2.5 text-right text-rose-600 font-bold">₹{Number(c.daysOver90).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-bold text-[#0B1E36]">₹{Number(c.totalOutstanding).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Supplier Payables Ageing */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-[#0B1E36] text-sm">
              Supplier Accounts Payable Ageing (Payment Schedule)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Supplier</th>
                    <th className="p-2.5 text-right">0 - 30 Days</th>
                    <th className="p-2.5 text-right">31 - 60 Days</th>
                    <th className="p-2.5 text-right">61 - 90 Days</th>
                    <th className="p-2.5 text-right">90+ Days</th>
                    <th className="p-2.5 text-right">Total Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {!ageing?.suppliers || ageing.suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 font-sans">
                        No outstanding supplier bills found
                      </td>
                    </tr>
                  ) : (
                    ageing.suppliers.map((s: any) => (
                      <tr key={s.supplierId} className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans font-semibold text-slate-800">{s.supplierName}</td>
                        <td className="p-2.5 text-right text-slate-700">₹{Number(s.days0To30).toFixed(2)}</td>
                        <td className="p-2.5 text-right text-amber-600">₹{Number(s.days31To60).toFixed(2)}</td>
                        <td className="p-2.5 text-right text-orange-600">₹{Number(s.days61To90).toFixed(2)}</td>
                        <td className="p-2.5 text-right text-rose-600 font-bold">₹{Number(s.daysOver90).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">₹{Number(s.totalOutstanding).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
