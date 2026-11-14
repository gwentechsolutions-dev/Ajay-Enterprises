"use client";

import * as React from "react";
import Link from "next/link";
import {
  Scale,
  ArrowLeft,
  RefreshCw,
  Printer,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Landmark,
  FileSpreadsheet,
  Receipt,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function FinancialReportsPage() {
  const [data, setData] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState<"TB" | "PNL" | "BS" | "BANKING" | "GST" | "EXPENSES">("TB");
  const [isLoading, setIsLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/reports/financial");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to load financial statements", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const integrity = data?.integrity;
  const tb = data?.trialBalance;
  const pnl = data?.profitAndLoss;
  const bs = data?.balanceSheet;
  const banking = data?.cashAndBankSummary || [];
  const gst = data?.gstSummary;
  const expenses = data?.expenseBreakdown || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/reports" className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Reports Hub
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Financial Statements & Double-Entry Ledgers</h1>
          <p className="text-sm text-slate-500">
            Strict double-entry accounting records, Trial Balance, P&L, Balance Sheet, and Statutory GST preparations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="border-slate-300">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="border-slate-300">
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Statement
          </Button>
        </div>
      </div>

      {/* Financial Integrity Invariant Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          integrity?.trialBalanced ? "bg-emerald-50/80 border-emerald-200 text-emerald-950" : "bg-red-50 border-red-200 text-red-950"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${integrity?.trialBalanced ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
              {integrity?.trialBalanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wider">Trial Balance Integrity</div>
              <div className="text-xs text-slate-600">
                Debits: <strong>₹{Number(integrity?.trialDebitSum || 0).toLocaleString("en-IN")}</strong> | Credits: <strong>₹{Number(integrity?.trialCreditSum || 0).toLocaleString("en-IN")}</strong>
              </div>
            </div>
          </div>
          <Badge variant={integrity?.trialBalanced ? "success" : "destructive"}>
            {integrity?.trialBalanced ? "BALANCED" : "DISCREPANCY"}
          </Badge>
        </div>

        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          integrity?.balanceSheetBalanced ? "bg-emerald-50/80 border-emerald-200 text-emerald-950" : "bg-red-50 border-red-200 text-red-950"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${integrity?.balanceSheetBalanced ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
              {integrity?.balanceSheetBalanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wider">Balance Sheet Equation</div>
              <div className="text-xs text-slate-600">
                Assets = Liabilities + Equity (Diff: ₹{Number(integrity?.balanceSheetDifference || 0).toFixed(2)})
              </div>
            </div>
          </div>
          <Badge variant={integrity?.balanceSheetBalanced ? "success" : "destructive"}>
            {integrity?.balanceSheetBalanced ? "A = L + E MATCH" : "UNBALANCED"}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-semibold">
        {[
          { id: "TB", label: "Trial Balance" },
          { id: "PNL", label: "Profit & Loss Statement" },
          { id: "BS", label: "Balance Sheet" },
          { id: "BANKING", label: "Cash & Bank Ledgers" },
          { id: "GST", label: "Statutory GST Summary" },
          { id: "EXPENSES", label: "Expense Analysis" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 px-3 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "border-[#0B1E36] text-[#0B1E36]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500 text-xs">Loading financial ledgers...</div>
      ) : (
        <>
          {/* TAB 1: TRIAL BALANCE */}
          {activeTab === "TB" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Double-Entry Trial Balance</CardTitle>
                <CardDescription className="text-xs">Closing balances of all active Chart of Accounts</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Account Name</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Debit Balance (₹)</th>
                        <th className="px-4 py-3 text-right">Credit Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(tb?.items || []).map((acc: any) => (
                        <tr key={acc.accountId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{acc.accountCode}</td>
                          <td className="px-4 py-2.5 font-medium">{acc.accountName}</td>
                          <td className="px-4 py-2.5 text-slate-500">{acc.accountCategory}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                            {Number(acc.closingDebit) > 0 ? Number(acc.closingDebit).toLocaleString("en-IN", { style: "currency", currency: "INR" }) : "-"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                            {Number(acc.closingCredit) > 0 ? Number(acc.closingCredit).toLocaleString("en-IN", { style: "currency", currency: "INR" }) : "-"}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                        <td colSpan={3} className="px-4 py-3">TOTAL TRIAL BALANCE</td>
                        <td className="px-4 py-3 text-right text-emerald-800">
                          {Number(tb?.totalDebitSum || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-800">
                          {Number(tb?.totalCreditSum || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: PROFIT & LOSS */}
          {activeTab === "PNL" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-emerald-800">Income Accounts</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-200">
                      {(pnl?.incomeAccounts || []).map((i: any) => (
                        <tr key={i.code} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-700">{i.code}</td>
                          <td className="px-4 py-2.5">{i.name}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                            {Number(i.amount).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold border-t border-slate-300">
                        <td colSpan={2} className="px-4 py-3">TOTAL INCOME</td>
                        <td className="px-4 py-3 text-right text-emerald-800">
                          {Number(pnl?.totalIncome || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-orange-800">Expense Accounts</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-200">
                      {(pnl?.expenseAccounts || []).map((e: any) => (
                        <tr key={e.code} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-700">{e.code}</td>
                          <td className="px-4 py-2.5">{e.name}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-600">
                            {Number(e.amount).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold border-t border-slate-300">
                        <td colSpan={2} className="px-4 py-3">TOTAL EXPENSES</td>
                        <td className="px-4 py-3 text-right text-red-700">
                          {Number(pnl?.totalExpenses || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <div className="md:col-span-2">
                <Card className={pnl?.isProfit ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300"}>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase font-bold tracking-wider text-slate-500">Period Result</div>
                      <div className="text-2xl font-bold text-slate-900 mt-1">
                        {pnl?.isProfit ? "Net Profit" : "Net Loss"}: {Number(pnl?.netProfitOrLoss || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                      </div>
                    </div>
                    <Badge variant={pnl?.isProfit ? "success" : "destructive"} className="text-sm px-3 py-1">
                      {pnl?.isProfit ? "NET PROFIT" : "NET LOSS"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 3: BALANCE SHEET */}
          {activeTab === "BS" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-[#0B1E36]">Assets</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-200">
                      {(bs?.assets || []).map((a: any) => (
                        <tr key={a.accountId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-700">{a.accountCode}</td>
                          <td className="px-4 py-2.5">{a.accountName}</td>
                          <td className="px-4 py-2.5 text-right font-medium">
                            {Number(a.closingDebit).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                        <td colSpan={2} className="px-4 py-3">TOTAL ASSETS</td>
                        <td className="px-4 py-3 text-right text-emerald-800">
                          {Number(bs?.totalAssets || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-[#0B1E36]">Liabilities & Equity</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-200">
                      {(bs?.liabilities || []).map((l: any) => (
                        <tr key={l.accountId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-700">{l.accountCode}</td>
                          <td className="px-4 py-2.5">{l.accountName}</td>
                          <td className="px-4 py-2.5 text-right font-medium">
                            {Number(l.closingCredit).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold text-slate-700">
                        <td colSpan={2} className="px-4 py-2">Current Period Net Profit</td>
                        <td className="px-4 py-2 text-right font-bold text-emerald-700">
                          {Number(bs?.currentPeriodProfit || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </td>
                      </tr>
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                        <td colSpan={2} className="px-4 py-3">TOTAL LIABILITIES & EQUITY</td>
                        <td className="px-4 py-3 text-right text-emerald-800">
                          {Number(bs?.totalLiabilitiesAndEquity || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 4: BANKING */}
          {activeTab === "BANKING" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Cash in Hand & Bank Accounts Summary</CardTitle>
                <CardDescription className="text-xs">Reconciled liquid balances across Office Cash (1010) and Operating Banks (1020)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="px-4 py-3">Account Code</th>
                      <th className="px-4 py-3">Account Name</th>
                      <th className="px-4 py-3 text-right">Total Inflows (Debits)</th>
                      <th className="px-4 py-3 text-right">Total Outflows (Credits)</th>
                      <th className="px-4 py-3 text-right">Closing Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {banking.map((b: any) => (
                      <tr key={b.accountId} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{b.accountCode}</td>
                        <td className="px-4 py-2.5 font-medium">{b.accountName}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-700">{Number(b.totalDebits).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-700">{Number(b.totalCredits).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-800">{Number(b.closingBalance).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* TAB 5: GST */}
          {activeTab === "GST" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Statutory GST Tax Summary</CardTitle>
                <CardDescription className="text-xs">Outward tax liability vs eligible input tax credit (ITC)</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Outward Tax Liability (GSTR-1)</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {Number(gst?.totalOutwardTax || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Eligible Input Tax Credit (ITC)</div>
                    <div className="text-xl font-bold text-emerald-700 mt-1">
                      {Number(gst?.totalInwardItc || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Net GST Payable / (Credit)</div>
                    <div className="text-xl font-bold text-[#0B1E36] mt-1">
                      {Number(gst?.netTaxPayable || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 6: EXPENSES */}
          {activeTab === "EXPENSES" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-[#0B1E36]">Expense Account Analysis</CardTitle>
                <CardDescription className="text-xs">Breakdown of operational, fleet, labour, and maintenance expenditures</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-[#0B1E36] text-white uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Expense Head</th>
                      <th className="px-4 py-3 text-right">Total Expense (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {expenses.map((e: any) => (
                      <tr key={e.accountId} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-[#0B1E36]">{e.accountCode}</td>
                        <td className="px-4 py-2.5 font-medium">{e.accountName}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-red-600">
                          {Number(e.totalExpense).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
