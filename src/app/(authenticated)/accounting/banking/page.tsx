"use client";

import * as React from "react";
import Link from "next/link";
import {
  Landmark,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  ArrowRightLeft,
  Wallet,
  CheckCircle2,
  Building,
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

export default function BankingContraPage() {
  const [bankAccounts, setBankAccounts] = React.useState<any[]>([]);
  const [companyBanks, setCompanyBanks] = React.useState<any[]>([]);
  const [contraJournals, setContraJournals] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Contra Modal
  const [isContraModalOpen, setIsContraModalOpen] = React.useState(false);
  const [fromAccountId, setFromAccountId] = React.useState("");
  const [toAccountId, setToAccountId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [transDate, setTransDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [reference, setReference] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [accRes, bnkRes, jRes] = await Promise.all([
        fetch("/api/v1/accounting/accounts"),
        fetch("/api/v1/company/bank-accounts"),
        fetch("/api/v1/accounting/journals?type=CONTRA"),
      ]);
      const accData = await accRes.json();
      const bnkData = await bnkRes.json();
      const jData = await jRes.json();

      if (accData.success) {
        const bkCash = (accData.data || []).filter(
          (a: any) =>
            a.subcategory === "BANK_ACCOUNTS" ||
            a.subcategory === "CASH_IN_HAND" ||
            a.accountCode.startsWith("101") ||
            a.accountCode.startsWith("102")
        );
        setBankAccounts(bkCash);
        if (bkCash.length >= 2) {
          setFromAccountId(bkCash[0].id);
          setToAccountId(bkCash[1].id);
        }
      }
      if (bnkData.success) setCompanyBanks(bnkData.data || []);
      if (jData.success) setContraJournals(jData.data || []);
    } catch (err) {
      console.error("Failed to load banking data", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleContraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || Number(amount) <= 0) {
      setErrorMsg("Please select valid source and destination accounts and a positive amount.");
      return;
    }
    if (fromAccountId === toAccountId) {
      setErrorMsg("Source and Destination accounts cannot be the same.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/accounting/banking/contra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: Number(amount),
          transactionDate: transDate,
          referenceNumber: reference || undefined,
          description: description || "Inter-account bank/cash contra transfer",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to execute contra transfer");
      }
      setIsContraModalOpen(false);
      setAmount("");
      setReference("");
      setDescription("");
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
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
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Banking & Cash Register</h1>
          <p className="text-sm text-slate-500">
            Company-owned bank accounts, petty cash registers, and Contra transfers
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
            onClick={() => setIsContraModalOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#071322] text-white"
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            New Contra Voucher
          </Button>
        </div>
      </div>

      {/* Bank & Cash Accounts Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {bankAccounts.map((acc) => (
          <div
            key={acc.id}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-slate-500">{acc.accountCode}</span>
              <div className="p-2 rounded-lg bg-slate-50 text-[#0B1E36]">
                {acc.accountCode.startsWith("101") ? (
                  <Wallet className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Landmark className="w-5 h-5 text-blue-600" />
                )}
              </div>
            </div>
            <h3 className="font-bold text-slate-800 text-base">{acc.accountName}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{acc.subcategory.replace(/_/g, " ")}</p>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">GL Book Balance:</span>
              <span className="text-lg font-bold font-mono text-[#0B1E36]">
                ₹{Number(acc.currentBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Contra Vouchers Register */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0B1E36] flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-[#F26522]" />
            Recent Contra Transactions
          </h2>
          <span className="text-xs text-slate-400">Cash Deposits, Cash Withdrawals & Bank Transfers</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Voucher #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Narration & Reference</th>
                <th className="px-4 py-3 text-right">Transfer Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contraJournals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No contra vouchers recorded yet
                  </td>
                </tr>
              ) : (
                contraJournals.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">
                      {j.journalNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(j.postingDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{j.narration}</div>
                      {j.referenceNumber && (
                        <div className="text-xs text-slate-400">Ref: {j.referenceNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                      ₹{Number(j.totalDebit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        {j.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contra Modal */}
      <Dialog open={isContraModalOpen} onOpenChange={setIsContraModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36] flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[#F26522]" />
              New Banking Contra Voucher
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleContraSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-600 rounded-md border border-red-200">
                {errorMsg}
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-slate-700">Source Account (Credit) *</Label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                required
                className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B1E36]"
              >
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} - {a.accountName} (₹{Number(a.currentBalance).toFixed(2)})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Funds will be deducted from this account.</p>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Destination Account (Debit) *</Label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                required
                className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B1E36]"
              >
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountCode} - {a.accountName} (₹{Number(a.currentBalance).toFixed(2)})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Funds will be deposited into this account.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  className="mt-1 font-mono font-bold"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Date *</Label>
                <Input
                  type="date"
                  value={transDate}
                  onChange={(e) => setTransDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Cheque / UTR / Reference #</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. CHQ-891021 or UTR-2026-11"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Narration / Purpose</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Cash withdrawn for warehouse operations"
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsContraModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#0B1E36] hover:bg-[#071322] text-white"
              >
                {isSubmitting ? "Transferring..." : "Post Contra Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

