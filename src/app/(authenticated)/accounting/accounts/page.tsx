"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  RefreshCw,
  Search,
  Lock,
  ArrowLeft,
  IndianRupee,
  Sparkles,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");

  // Add Account Modal
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [accountCode, setAccountCode] = React.useState("");
  const [accountName, setAccountName] = React.useState("");
  const [category, setCategory] = React.useState("ASSET");
  const [subcategory, setSubcategory] = React.useState("CURRENT_ASSETS");
  const [normalBalance, setNormalBalance] = React.useState("DEBIT");
  const [notes, setNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/accounting/accounts");
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadAccounts();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountCode,
          accountName,
          category,
          subcategory,
          normalBalance,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to create account");
      }
      setIsModalOpen(false);
      setAccountCode("");
      setAccountName("");
      setNotes("");
      await loadAccounts();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch =
      acc.accountCode.toLowerCase().includes(search.toLowerCase()) ||
      acc.accountName.toLowerCase().includes(search.toLowerCase()) ||
      acc.subcategory.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = categoryFilter === "ALL" || acc.category === categoryFilter;
    return matchesSearch && matchesCategory;
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
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Chart of Accounts</h1>
          <p className="text-sm text-slate-500">
            Double-entry ledger chart configured for AJAY ENTERPRISES
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAccounts}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#071322] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by code, account name, or subcategory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[195px] bg-white">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="ASSET">Assets (1000s)</SelectItem>
              <SelectItem value="LIABILITY">Liabilities (2000s)</SelectItem>
              <SelectItem value="EQUITY">Equity (3000s)</SelectItem>
              <SelectItem value="INCOME">Income (4000s)</SelectItem>
              <SelectItem value="EXPENSE">Expenses (5000s)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Account Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Subcategory</th>
                <th className="px-4 py-3 text-center">Normal Bal</th>
                <th className="px-4 py-3 text-right">Current Balance</th>
                <th className="px-4 py-3 text-center">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No accounts found
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">
                      {acc.accountCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{acc.accountName}</div>
                      {acc.notes && <div className="text-xs text-slate-400">{acc.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          acc.category === "ASSET"
                            ? "bg-blue-100 text-blue-800"
                            : acc.category === "LIABILITY"
                            ? "bg-amber-100 text-amber-800"
                            : acc.category === "EQUITY"
                            ? "bg-purple-100 text-purple-800"
                            : acc.category === "INCOME"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {acc.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {acc.subcategory.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-mono font-semibold">
                      {acc.normalBalance}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                      ₹{Number(acc.currentBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {acc.isSystemAccount ? (
                        <span className="inline-flex items-center text-xs text-slate-500 gap-1">
                          <Lock className="w-3 h-3 text-slate-400" />
                          System
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Custom</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36]">
              Add General Ledger Account
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-600 rounded-md border border-red-200">
                {errorMsg}
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-slate-700">Account Code *</Label>
              <Input
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                required
                placeholder="e.g. 1090, 5090"
                className="mt-1 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Ranges: 1000s Assets | 2000s Liabilities | 3000s Equity | 4000s Income | 5000s Expenses
              </p>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Account Name *</Label>
              <Input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
                placeholder="e.g. Site Maintenance Supplies"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Category *</Label>
                <div className="mt-1">
                  <Select
                    value={category}
                    onValueChange={(cat) => {
                      setCategory(cat);
                      setNormalBalance(cat === "ASSET" || cat === "EXPENSE" ? "DEBIT" : "CREDIT");
                    }}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASSET">ASSET</SelectItem>
                      <SelectItem value="LIABILITY">LIABILITY</SelectItem>
                      <SelectItem value="EQUITY">EQUITY</SelectItem>
                      <SelectItem value="INCOME">INCOME</SelectItem>
                      <SelectItem value="EXPENSE">EXPENSE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Normal Balance *</Label>
                <div className="mt-1">
                  <Select value={normalBalance} onValueChange={setNormalBalance}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select Balance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEBIT">DEBIT</SelectItem>
                      <SelectItem value="CREDIT">CREDIT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Subcategory *</Label>
              <Input
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                required
                placeholder="e.g. CURRENT_ASSETS, OPERATING_EXPENSES"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Description / Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional description of account purpose..."
                className="mt-1"
              />
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
                disabled={isSubmitting}
                className="bg-[#0B1E36] hover:bg-[#071322] text-white"
              >
                {isSubmitting ? "Creating..." : "Save Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

