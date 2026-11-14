"use client";

import * as React from "react";
import Link from "next/link";
import {
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Building,
  CheckCircle2,
  Clock,
  Wallet,
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

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = React.useState<"RECEIPTS" | "DISBURSEMENTS">("RECEIPTS");
  const [receipts, setReceipts] = React.useState<any[]>([]);
  const [disbursements, setDisbursements] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [accounts, setAccounts] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  // Customer Receipt Modal
  const [isReceiptModalOpen, setIsReceiptModalOpen] = React.useState(false);
  const [rcCustomerId, setRcCustomerId] = React.useState("");
  const [rcMethod, setRcMethod] = React.useState("BANK_TRANSFER");
  const [rcAccountId, setRcAccountId] = React.useState("");
  const [rcAmount, setRcAmount] = React.useState("");
  const [rcRef, setRcRef] = React.useState("");
  const [rcNotes, setRcNotes] = React.useState("");
  const [isSubmittingRc, setIsSubmittingRc] = React.useState(false);

  // Supplier Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = React.useState(false);
  const [spSupplierId, setSpSupplierId] = React.useState("");
  const [spMethod, setSpMethod] = React.useState("BANK_TRANSFER");
  const [spAccountId, setSpAccountId] = React.useState("");
  const [spAmount, setSpAmount] = React.useState("");
  const [spRef, setSpRef] = React.useState("");
  const [spNotes, setSpNotes] = React.useState("");
  const [isSubmittingSp, setIsSubmittingSp] = React.useState(false);

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rRes, pRes, cRes, sRes, aRes] = await Promise.all([
        fetch("/api/v1/accounting/receipts"),
        fetch("/api/v1/accounting/payments"),
        fetch("/api/v1/customers"),
        fetch("/api/v1/suppliers"),
        fetch("/api/v1/accounting/accounts"),
      ]);
      const rData = await rRes.json();
      const pData = await pRes.json();
      const cData = await cRes.json();
      const sData = await sRes.json();
      const aData = await aRes.json();

      if (rData.success) setReceipts(rData.data || []);
      if (pData.success) setDisbursements(pData.data || []);
      if (cData.success) setCustomers(cData.data || []);
      if (sData.success) setSuppliers(sData.data || []);
      if (aData.success) {
        // filter bank & cash accounts
        const bankCash = (aData.data || []).filter(
          (a: any) =>
            a.subcategory === "BANK_ACCOUNTS" ||
            a.subcategory === "CASH_IN_HAND" ||
            a.accountCode.startsWith("101") ||
            a.accountCode.startsWith("102")
        );
        setAccounts(bankCash);
        if (bankCash.length > 0) {
          setRcAccountId(bankCash[0].id);
          setSpAccountId(bankCash[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load receipts & payments", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rcCustomerId || !rcAccountId || Number(rcAmount) <= 0) {
      setErrorMsg("Please fill in all required fields with a valid amount.");
      return;
    }
    setIsSubmittingRc(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/accounting/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: rcCustomerId,
          paymentMethod: rcMethod,
          receivingAccountId: rcAccountId,
          amountReceived: Number(rcAmount),
          transactionReference: rcRef || undefined,
          notes: rcNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to record customer receipt");
      }
      setIsReceiptModalOpen(false);
      setRcAmount("");
      setRcRef("");
      setRcNotes("");
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmittingRc(false);
    }
  };

  const handleCreateDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spSupplierId || !spAccountId || Number(spAmount) <= 0) {
      setErrorMsg("Please fill in all required fields with a valid amount.");
      return;
    }
    setIsSubmittingSp(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/accounting/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: spSupplierId,
          paymentMethod: spMethod,
          disbursingAccountId: spAccountId,
          amountPaid: Number(spAmount),
          transactionReference: spRef || undefined,
          notes: spNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to record supplier payment");
      }
      setIsPayModalOpen(false);
      setSpAmount("");
      setSpRef("");
      setSpNotes("");
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmittingSp(false);
    }
  };

  const filteredReceipts = receipts.filter(
    (r) =>
      r.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.transactionReference && r.transactionReference.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredDisbursements = disbursements.filter(
    (p) =>
      p.paymentNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier?.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.transactionReference && p.transactionReference.toLowerCase().includes(search.toLowerCase()))
  );

  const totalReceipts = receipts.reduce((sum, r) => sum + Number(r.amountReceived || 0), 0);
  const totalDisbursed = disbursements.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);

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
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Receipts & Payments</h1>
          <p className="text-sm text-slate-500">
            Cash & bank settlements with multi-invoice automated ledger allocation
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
          {activeTab === "RECEIPTS" ? (
            <Button
              size="sm"
              onClick={() => setIsReceiptModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ArrowDownLeft className="w-4 h-4 mr-2" />
              Record Customer Receipt
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsPayModalOpen(true)}
              className="bg-[#0B1E36] hover:bg-[#071322] text-white"
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Disburse Supplier Payment
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase">Total Inflows (Receipts)</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              ₹{totalReceipts.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{receipts.length} customer collections</div>
          </div>
          <div className="p-3 rounded-full bg-emerald-50 text-emerald-600">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase">Total Outflows (Payments)</span>
            <div className="text-2xl font-bold text-[#0B1E36] mt-1">
              ₹{totalDisbursed.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{disbursements.length} vendor disbursements</div>
          </div>
          <div className="p-3 rounded-full bg-slate-100 text-[#0B1E36]">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("RECEIPTS")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "RECEIPTS"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          Customer Receipts ({receipts.length})
        </button>
        <button
          onClick={() => setActiveTab("DISBURSEMENTS")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "DISBURSEMENTS"
              ? "border-[#0B1E36] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          Supplier Payments ({disbursements.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder={
              activeTab === "RECEIPTS"
                ? "Search receipts by number, customer, or transaction reference..."
                : "Search payments by number, supplier, or reference..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tab 1: Receipts Table */}
        {activeTab === "RECEIPTS" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Receipt #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Receipt Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Receiving Account</th>
                  <th className="px-4 py-3 text-right">Amount Received</th>
                  <th className="px-4 py-3 text-right">Advance / Unallocated</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      No customer receipts found
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">
                        {r.receiptNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{r.customer?.name}</div>
                        {r.transactionReference && (
                          <div className="text-xs text-slate-400">Ref: {r.transactionReference}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(r.receiptDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                          {r.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {r.receivingAccount?.accountName}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                        ₹{Number(r.amountReceived).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-amber-600">
                        ₹{Number(r.unallocatedAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tab 2: Disbursements Table */
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Payment #</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Disbursing Account</th>
                  <th className="px-4 py-3 text-right">Amount Paid</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDisbursements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No supplier payments found
                    </td>
                  </tr>
                ) : (
                  filteredDisbursements.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">
                        {p.paymentNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{p.supplier?.name}</div>
                        {p.transactionReference && (
                          <div className="text-xs text-slate-400">Ref: {p.transactionReference}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(p.paymentDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {p.disbursingAccount?.accountName}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                        ₹{Number(p.amountPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Receipt Modal */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-emerald-700 flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5" />
              Record Customer Payment Receipt
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateReceipt} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-600 rounded-md border border-red-200">
                {errorMsg}
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-slate-700">Customer *</Label>
              <select
                value={rcCustomerId}
                onChange={(e) => setRcCustomerId(e.target.value)}
                required
                className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B1E36]"
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.customerCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Payment Method *</Label>
                <select
                  value={rcMethod}
                  onChange={(e) => setRcMethod(e.target.value)}
                  className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Receiving Account *</Label>
                <select
                  value={rcAccountId}
                  onChange={(e) => setRcAccountId(e.target.value)}
                  required
                  className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountCode} - {a.accountName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Amount Received (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={rcAmount}
                onChange={(e) => setRcAmount(e.target.value)}
                required
                placeholder="0.00"
                className="mt-1 font-mono text-base font-bold text-emerald-600"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Transaction Reference / UTR / Cheque #</Label>
              <Input
                value={rcRef}
                onChange={(e) => setRcRef(e.target.value)}
                placeholder="e.g. UTR19028301982"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Notes / Remarks</Label>
              <Input
                value={rcNotes}
                onChange={(e) => setRcNotes(e.target.value)}
                placeholder="Optional notes..."
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReceiptModalOpen(false)}
                disabled={isSubmittingRc}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingRc}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmittingRc ? "Posting Receipt..." : "Record & Post Receipt"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36] flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5" />
              Disburse Supplier Payment
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDisbursement} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-600 rounded-md border border-red-200">
                {errorMsg}
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-slate-700">Supplier *</Label>
              <select
                value={spSupplierId}
                onChange={(e) => setSpSupplierId(e.target.value)}
                required
                className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B1E36]"
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.supplierCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Payment Method *</Label>
                <select
                  value={spMethod}
                  onChange={(e) => setSpMethod(e.target.value)}
                  className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Disbursing Account *</Label>
                <select
                  value={spAccountId}
                  onChange={(e) => setSpAccountId(e.target.value)}
                  required
                  className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountCode} - {a.accountName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Amount Paid (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={spAmount}
                onChange={(e) => setSpAmount(e.target.value)}
                required
                placeholder="0.00"
                className="mt-1 font-mono text-base font-bold text-slate-800"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Transaction Reference / UTR #</Label>
              <Input
                value={spRef}
                onChange={(e) => setSpRef(e.target.value)}
                placeholder="e.g. UTR98127391823"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Notes / Remarks</Label>
              <Input
                value={spNotes}
                onChange={(e) => setSpNotes(e.target.value)}
                placeholder="Optional notes..."
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPayModalOpen(false)}
                disabled={isSubmittingSp}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingSp}
                className="bg-[#0B1E36] hover:bg-[#071322] text-white"
              >
                {isSubmittingSp ? "Disbursing..." : "Record & Post Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

