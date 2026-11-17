"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/loading-states";
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

export default function JournalsPage() {
  const [journals, setJournals] = React.useState<any[]>([]);
  const [accounts, setAccounts] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("ALL");

  // Create Journal Modal
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [journalType, setJournalType] = React.useState("GENERAL");
  const [postingDate, setPostingDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [narration, setNarration] = React.useState("");
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [lines, setLines] = React.useState<any[]>([
    { accountId: "", description: "", debitAmount: 0, creditAmount: 0 },
    { accountId: "", description: "", debitAmount: 0, creditAmount: 0 },
  ]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // View Journal Modal
  const [selectedJournal, setSelectedJournal] = React.useState<any | null>(null);

  // Reverse Journal Modal
  const [reversalTarget, setReversalTarget] = React.useState<any | null>(null);
  const [reversalReason, setReversalReason] = React.useState("");
  const [isReversing, setIsReversing] = React.useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [jRes, aRes] = await Promise.all([
        fetch("/api/v1/accounting/journals"),
        fetch("/api/v1/accounting/accounts"),
      ]);
      const jData = await jRes.json();
      const aData = await aRes.json();

      if (jData.success) setJournals(jData.data || []);
      if (aData.success) setAccounts(aData.data || []);
    } catch (err) {
      console.error("Failed to load journals", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleAddLine = () => {
    setLines([...lines, { accountId: "", description: "", debitAmount: 0, creditAmount: 0 }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  const handleLineChange = (idx: number, field: string, val: any) => {
    const updated = [...lines];
    updated[idx][field] = val;
    // Mutually exclusive debit/credit
    if (field === "debitAmount" && Number(val) > 0) {
      updated[idx].creditAmount = 0;
    } else if (field === "creditAmount" && Number(val) > 0) {
      updated[idx].debitAmount = 0;
    }
    setLines(updated);
  };

  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debitAmount || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.creditAmount || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = diff < 0.01 && totalDebit > 0;

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      setErrorMsg("Journal entry must be balanced (Total Debits == Total Credits).");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/accounting/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalType,
          postingDate,
          narration,
          referenceNumber: referenceNumber || undefined,
          lines: lines.map((l) => ({
            accountId: l.accountId,
            description: l.description || narration,
            debitAmount: Number(l.debitAmount || 0),
            creditAmount: Number(l.creditAmount || 0),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to post journal entry");
      }
      setIsModalOpen(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setJournalType("GENERAL");
    setNarration("");
    setReferenceNumber("");
    setLines([
      { accountId: "", description: "", debitAmount: 0, creditAmount: 0 },
      { accountId: "", description: "", debitAmount: 0, creditAmount: 0 },
    ]);
  };

  const handleReverseJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget || !reversalReason) return;
    setIsReversing(true);
    try {
      const res = await fetch(`/api/v1/accounting/journals/${reversalTarget.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reversalReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to reverse journal");
      }
      setReversalTarget(null);
      setReversalReason("");
      toast.success("Journal reversed successfully");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reverse journal");
    } finally {
      setIsReversing(false);
    }
  };

  const filteredJournals = journals.filter((j) => {
    const matchesSearch =
      j.journalNumber.toLowerCase().includes(search.toLowerCase()) ||
      j.narration.toLowerCase().includes(search.toLowerCase()) ||
      (j.referenceNumber && j.referenceNumber.toLowerCase().includes(search.toLowerCase()));

    const matchesType = typeFilter === "ALL" || j.journalType === typeFilter;
    return matchesSearch && matchesType;
  });

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
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">General Ledger & Journals</h1>
          <p className="text-sm text-slate-500">
            Immutable general journal entries with strict debit-credit balancing and audit history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            loadingText="Refreshing..."
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#071322] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Journal Entry
          </Button>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by journal #, narration, or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
          >
            <option value="ALL">All Journal Types</option>
            <option value="GENERAL">General</option>
            <option value="SALES">Sales / Billing</option>
            <option value="PURCHASE">Purchase</option>
            <option value="RECEIPT">Receipt</option>
            <option value="PAYMENT">Payment</option>
            <option value="CONTRA">Contra</option>
            <option value="REVERSAL">Reversal</option>
            <option value="YEAR_END_CLOSING">Year-End Closing</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Journal #</th>
                <th className="px-4 py-3">Posting Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Narration & Ref</th>
                <th className="px-4 py-3 text-right">Debit (₹)</th>
                <th className="px-4 py-3 text-right">Credit (₹)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeleton columns={8} rows={6} />
              ) : filteredJournals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No journal entries found
                  </td>
                </tr>
              ) : (
                filteredJournals.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">
                      {j.journalNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(j.postingDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {j.journalType}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate">
                      <div className="font-medium text-slate-800">{j.narration}</div>
                      {j.referenceNumber && (
                        <div className="text-xs text-slate-400">Ref: {j.referenceNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                      ₹{Number(j.totalDebit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                      ₹{Number(j.totalCredit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          j.status === "POSTED"
                            ? "bg-emerald-100 text-emerald-800"
                            : j.status === "REVERSED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedJournal(j)}
                          className="h-8 px-2 text-xs text-slate-600 hover:text-[#0B1E36]"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Lines
                        </Button>
                        {j.status === "POSTED" && j.journalType !== "REVERSAL" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReversalTarget(j)}
                            title="Reverse this journal entry"
                            className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Reverse
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Journal Entry Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36]">
              Create General Ledger Journal Entry
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateJournal} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-600 rounded-md border border-red-200">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Journal Type *</Label>
                <select
                  value={journalType}
                  onChange={(e) => setJournalType(e.target.value)}
                  className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B1E36]"
                >
                  <option value="GENERAL">GENERAL</option>
                  <option value="ADJUSTMENT">ADJUSTMENT</option>
                  <option value="CONTRA">CONTRA</option>
                  <option value="SALES">SALES</option>
                  <option value="PURCHASE">PURCHASE</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Posting Date *</Label>
                <Input
                  type="date"
                  value={postingDate}
                  onChange={(e) => setPostingDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Reference Number</Label>
                <Input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. VOUCHER-901"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Narration / Description *</Label>
              <Input
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                required
                placeholder="Comprehensive narration explaining the accounting transaction..."
                className="mt-1"
              />
            </div>

            {/* Lines Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-[#0B1E36] uppercase">Journal Lines</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLine}
                  className="text-xs h-7"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Line
                </Button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-medium">
                    <tr>
                      <th className="p-2 w-1/3">Account</th>
                      <th className="p-2">Line Description</th>
                      <th className="p-2 w-28 text-right">Debit (₹)</th>
                      <th className="p-2 w-28 text-right">Credit (₹)</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <select
                            value={l.accountId}
                            onChange={(e) => handleLineChange(idx, "accountId", e.target.value)}
                            required
                            className="w-full h-8 px-2 text-xs border border-slate-300 rounded bg-white"
                          >
                            <option value="">-- Select GL Account --</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.accountCode} - {a.accountName} ({a.category})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            value={l.description}
                            onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                            placeholder="Line detail..."
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.debitAmount}
                            onChange={(e) => handleLineChange(idx, "debitAmount", e.target.value)}
                            className="h-8 text-xs text-right font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.creditAmount}
                            onChange={(e) => handleLineChange(idx, "creditAmount", e.target.value)}
                            className="h-8 text-xs text-right font-mono"
                          />
                        </td>
                        <td className="p-2 text-center">
                          {lines.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-slate-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invariant Balance Footer */}
            <div
              className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                isBalanced
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span className="font-semibold">
                  {isBalanced
                    ? "Double-Entry Invariant Satisfied: Balanced!"
                    : `Unbalanced! Difference: ₹${diff.toFixed(2)}`}
                </span>
              </div>
              <div className="font-mono text-right space-x-4">
                <span>Total Debit: ₹{totalDebit.toFixed(2)}</span>
                <span>Total Credit: ₹{totalCredit.toFixed(2)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isBalanced}
                isLoading={isSubmitting}
                loadingText="Posting..."
                className="bg-[#0B1E36] hover:bg-[#071322] text-white"
              >
                Post Journal Entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Journal Detail Modal */}
      {selectedJournal && (
        <Dialog open={!!selectedJournal} onOpenChange={() => setSelectedJournal(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#0B1E36]">
                Journal Entry {selectedJournal.journalNumber}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Posting Date:</span>
                  <span className="font-semibold">
                    {new Date(selectedJournal.postingDate).toLocaleDateString("en-IN")}
                  </span>
                  <span className="text-slate-500 block mt-1">Type:</span>
                  <span className="font-semibold">{selectedJournal.journalType}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status:</span>
                  <span className="font-semibold">{selectedJournal.status}</span>
                  {selectedJournal.referenceNumber && (
                    <>
                      <span className="text-slate-500 block mt-1">Reference:</span>
                      <span className="font-semibold">{selectedJournal.referenceNumber}</span>
                    </>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-500 block font-semibold mb-1">Narration:</span>
                <p className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-700">
                  {selectedJournal.narration}
                </p>
              </div>

              {/* Lines */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2">Account</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-right">Debit (₹)</th>
                      <th className="p-2 text-right">Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedJournal.lines?.map((line: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium">
                          {line.account?.accountCode} - {line.account?.accountName}
                        </td>
                        <td className="p-2 text-slate-500">{line.description}</td>
                        <td className="p-2 text-right font-mono font-semibold">
                          {Number(line.debitAmount) > 0 ? `₹${Number(line.debitAmount).toFixed(2)}` : "-"}
                        </td>
                        <td className="p-2 text-right font-mono font-semibold">
                          {Number(line.creditAmount) > 0 ? `₹${Number(line.creditAmount).toFixed(2)}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={2} className="p-2 text-right">
                        Totals:
                      </td>
                      <td className="p-2 text-right font-mono">
                        ₹{Number(selectedJournal.totalDebit).toFixed(2)}
                      </td>
                      <td className="p-2 text-right font-mono">
                        ₹{Number(selectedJournal.totalCredit).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedJournal(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reversal Confirmation Modal */}
      {reversalTarget && (
        <Dialog open={!!reversalTarget} onOpenChange={() => setReversalTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-rose-600 flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Reverse Journal Entry
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReverseJournal} className="space-y-4">
              <p className="text-xs text-slate-600">
                You are about to reverse journal{" "}
                <span className="font-bold text-slate-800">{reversalTarget.journalNumber}</span> (₹
                {Number(reversalTarget.totalDebit).toFixed(2)}). An authorized inverse journal entry will be
                automatically created and posted to restore account balances.
              </p>

              <div>
                <Label className="text-xs font-medium text-slate-700">Reason for Reversal *</Label>
                <Input
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  required
                  placeholder="e.g. Incorrect account selected or duplicate entry"
                  className="mt-1"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReversalTarget(null)}
                  disabled={isReversing}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isReversing}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isReversing ? "Reversing..." : "Confirm Reversal"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

