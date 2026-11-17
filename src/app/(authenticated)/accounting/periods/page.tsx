"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Lock,
  Unlock,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Building,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AccountingPeriodsPage() {
  const [periods, setPeriods] = React.useState<any[]>([]);
  const [accounts, setAccounts] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Close FY Modal
  const [isCloseFyOpen, setIsCloseFyOpen] = React.useState(false);
  const [closeFiscalYear, setCloseFiscalYear] = React.useState("2025-26");
  const [retainedEarningsId, setRetainedEarningsId] = React.useState("");
  const [closeRemarks, setCloseRemarks] = React.useState("");
  const [isClosing, setIsClosing] = React.useState(false);
  const [closeResult, setCloseResult] = React.useState<any | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        fetch("/api/v1/accounting/periods"),
        fetch("/api/v1/accounting/accounts"),
      ]);
      const pData = await pRes.json();
      const aData = await aRes.json();

      if (pData.success) setPeriods(pData.data || []);
      if (aData.success) {
        const equity = (aData.data || []).filter((a: any) => a.category === "EQUITY");
        setAccounts(equity);
        const re = equity.find((a: any) => a.accountCode === "3020" || a.accountName.toLowerCase().includes("retained"));
        if (re) setRetainedEarningsId(re.id);
        else if (equity.length > 0) setRetainedEarningsId(equity[0].id);
      }
    } catch (err) {
      console.error("Failed to load periods data", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleToggleLock = async (periodId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/v1/accounting/periods/${periodId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId,
          isLocked: !currentStatus,
          notes: !currentStatus ? "Locked by user" : "Unlocked for adjustments",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update period lock");
      }
      toast.success(!currentStatus ? "Accounting period locked successfully" : "Accounting period unlocked successfully");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update period lock");
    }
  };

  const handleCloseFy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeFiscalYear || !retainedEarningsId) {
      setErrorMsg("Please specify the fiscal year and select Retained Earnings account.");
      return;
    }
    setIsClosing(true);
    setErrorMsg(null);
    setCloseResult(null);
    try {
      const res = await fetch("/api/v1/accounting/periods/close-fy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiscalYear: closeFiscalYear,
          retainedEarningsAccountId: retainedEarningsId,
          remarks: closeRemarks || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to close financial year");
      }
      setCloseResult(data.data);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsClosing(false);
    }
  };

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
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Fiscal Years & Period Locks</h1>
          <p className="text-sm text-slate-500">
            Accounting period locks, audit integrity seals, and annual financial year closing
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
            onClick={() => setIsCloseFyOpen(true)}
            className="bg-rose-700 hover:bg-rose-800 text-white"
          >
            <Lock className="w-4 h-4 mr-2" />
            Close Financial Year
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Period Lock & Immutability Rules:</div>
          <p className="mt-0.5 text-amber-800">
            When an accounting period is locked, no back-dated journal entries, invoices, purchase bills, or
            payments can be posted into it. Annual Financial Year closing permanently seals the year, transfers net
            profit/loss to Retained Earnings (3020), and locks all 12 monthly periods.
          </p>
        </div>
      </div>

      {/* Periods Table */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0B1E36]">Monthly Accounting Periods</h2>
          <span className="text-xs text-slate-400">Total Periods: {periods.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Fiscal Year</th>
                <th className="px-4 py-3">Period Name</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No accounting periods generated yet
                  </td>
                </tr>
              ) : (
                periods.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">{p.fiscalYear}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.periodName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(p.startDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(p.endDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.isLocked
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {p.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {p.isLocked ? "LOCKED" : "OPEN"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{p.notes || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleLock(p.id, p.isLocked)}
                        className={`h-8 px-2 text-xs font-semibold ${
                          p.isLocked
                            ? "text-emerald-700 hover:bg-emerald-50"
                            : "text-rose-700 hover:bg-rose-50"
                        }`}
                      >
                        {p.isLocked ? "Unlock Period" : "Lock Period"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Close FY Modal */}
      <Dialog open={isCloseFyOpen} onOpenChange={setIsCloseFyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-rose-700 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Annual Financial Year Closing
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCloseFy} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-600 rounded-md border border-red-200">
                {errorMsg}
              </div>
            )}

            {closeResult ? (
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-sm text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Financial Year {closeFiscalYear} Successfully Closed!
                </div>
                <div>
                  Net Profit Transferred:{" "}
                  <span className="font-bold font-mono">₹{closeResult.netProfitOrLoss.toFixed(2)}</span>
                </div>
                <div>
                  Closing Journal Ref:{" "}
                  <span className="font-bold font-mono">{closeResult.closingJournal?.journalNumber}</span>
                </div>
                <div className="pt-2">All accounting periods for this fiscal year are now locked.</div>
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Financial Year to Close *</Label>
                  <Input
                    value={closeFiscalYear}
                    onChange={(e) => setCloseFiscalYear(e.target.value)}
                    required
                    placeholder="2025-26"
                    className="mt-1 font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Format: YYYY-YY (e.g. 2025-26)</p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-700">
                    Retained Earnings Account (EQUITY) *
                  </Label>
                  <select
                    value={retainedEarningsId}
                    onChange={(e) => setRetainedEarningsId(e.target.value)}
                    required
                    className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B1E36]"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.accountCode} - {a.accountName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-700">Closing Remarks</Label>
                  <Input
                    value={closeRemarks}
                    onChange={(e) => setCloseRemarks(e.target.value)}
                    placeholder="Annual closing remarks..."
                    className="mt-1"
                  />
                </div>

                <div className="bg-slate-50 p-3 rounded text-xs text-slate-600 border border-slate-200 space-y-1">
                  <div className="font-semibold text-slate-800">Closing Actions Executed:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                    <li>Computes total revenue & total expenses for FY {closeFiscalYear}.</li>
                    <li>Generates balanced YEAR_END_CLOSING journal zeroing P&L accounts.</li>
                    <li>Credits Retained Earnings (Profit) or debits Retained Earnings (Loss).</li>
                    <li>Locks all monthly periods and creates immutable FinancialYearClosing seal.</li>
                  </ul>
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCloseFyOpen(false);
                  setCloseResult(null);
                }}
                disabled={isClosing}
              >
                Close
              </Button>
              {!closeResult && (
                <Button
                  type="submit"
                  disabled={isClosing}
                  className="bg-rose-700 hover:bg-rose-800 text-white"
                >
                  {isClosing ? "Closing FY..." : "Execute FY Close"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

