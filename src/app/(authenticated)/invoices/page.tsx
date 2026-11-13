"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Receipt,
  ArrowRight,
  Filter,
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

export default function InvoicesPage() {
  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [statements, setStatements] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [typeFilter, setTypeFilter] = React.useState("ALL");

  // Convert Statement Modal
  const [isStatementModalOpen, setIsStatementModalOpen] = React.useState(false);
  const [selectedStatementId, setSelectedStatementId] = React.useState("");
  const [invDate, setInvDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  });
  const [invNotes, setInvNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // View Invoice Detail Modal
  const [activeInvoice, setActiveInvoice] = React.useState<any | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invRes, stmtRes] = await Promise.all([
        fetch("/api/v1/invoices"),
        fetch("/api/v1/rentals/statements?status=APPROVED,FINALIZED"),
      ]);
      const invData = await invRes.json();
      const stmtData = await stmtRes.json();

      if (invData.success) {
        setInvoices(invData.data || []);
      }
      if (stmtData.success) {
        setStatements(stmtData.data || []);
      }
    } catch (err) {
      console.error("Failed to load invoices", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleConvertStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatementId) {
      setErrorMsg("Please select an approved statement");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/invoices/from-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statementId: selectedStatementId,
          invoiceDate: invDate,
          dueDate,
          notes: invNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to generate invoice");
      }
      setIsStatementModalOpen(false);
      setSelectedStatementId("");
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      (inv.customerGstin && inv.customerGstin.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || inv.paymentStatus === statusFilter;
    const matchesType = typeFilter === "ALL" || inv.invoiceType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate totals
  const totalBilled = invoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + Number(i.paidAmount || 0), 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + Number(i.balanceAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Tax Invoices</h1>
          <p className="text-sm text-slate-500">
            GST-compliant sales and monthly rental invoices with automated double-entry ledger posting
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
            onClick={() => setIsStatementModalOpen(true)}
            className="bg-[#F26522] hover:bg-[#EA580C] text-white"
          >
            <Receipt className="w-4 h-4 mr-2" />
            Convert Statement to Invoice
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Total Invoices</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-[#0B1E36] mt-2">{invoices.length}</div>
          <div className="text-xs text-slate-500 mt-1">Generated tax invoices</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Total Billed</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-[#0B1E36] mt-2">
            ₹{totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Gross revenue invoiced</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Total Collected</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            ₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Customer receipts applied</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Outstanding Balance</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">
            ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Accounts receivable balance</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by invoice number, customer name, or GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
            >
              <option value="ALL">All Invoice Types</option>
              <option value="RENTAL">Rental Invoice</option>
              <option value="SALES">Sales Invoice</option>
              <option value="SERVICE">Service Invoice</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer & Site</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Taxable</th>
                <th className="px-4 py-3 text-right">GST</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No tax invoices found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#0B1E36]">
                      {inv.invoiceNumber}
                      {inv.rentalStatement && (
                        <span className="block text-[11px] font-normal text-sky-600">
                          Ref: {inv.rentalStatement.statementNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{inv.customer?.name}</div>
                      <div className="text-xs text-slate-500">
                        {inv.customerSite?.siteName || "Consolidated / Multiple Sites"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(inv.invoiceDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                        {inv.invoiceType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      ₹{Number(inv.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">
                      <div>₹{Number(inv.totalTax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                      <div className="text-[10px] text-slate-400">
                        {inv.isInterState ? "IGST" : "CGST+SGST"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#0B1E36]">
                      ₹{Number(inv.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          inv.paymentStatus === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.paymentStatus === "PARTIALLY_PAID"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/api/v1/invoices/${inv.id}/print`, "_blank")}
                          title="Print A4 Tax Invoice"
                          className="h-8 w-8 p-0 text-slate-600 hover:text-[#F26522]"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveInvoice(inv)}
                          className="h-8 px-2 text-xs text-[#0B1E36] hover:bg-slate-100"
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Convert Statement to Invoice Modal */}
      <Dialog open={isStatementModalOpen} onOpenChange={setIsStatementModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36]">
              Convert Rental Statement to Tax Invoice
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConvertStatement} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-600 rounded-md border border-red-200">
                {errorMsg}
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-slate-700">
                Select Approved Statement *
              </Label>
              <select
                value={selectedStatementId}
                onChange={(e) => setSelectedStatementId(e.target.value)}
                required
                className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B1E36]"
              >
                <option value="">-- Choose Approved Statement --</option>
                {statements.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.statementNumber} — {st.customer?.name} (₹{Number(st.netPayableAmount).toFixed(2)})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Only statements in APPROVED or FINALIZED status can be invoiced.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-700">Invoice Date *</Label>
                <Input
                  type="date"
                  value={invDate}
                  onChange={(e) => setInvDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Due Date *</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Invoice Notes / Remarks</Label>
              <Input
                placeholder="Optional notes to appear on invoice..."
                value={invNotes}
                onChange={(e) => setInvNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="bg-slate-50 p-3 rounded-md text-xs text-slate-600 border border-slate-200 space-y-1">
              <div className="font-semibold text-slate-700">Automated Accounting & Tax Posting:</div>
              <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                <li>Generates sequential tax invoice number (INV-YYYY-NNNN).</li>
                <li>Calculates CGST/SGST (intra-state) or IGST (inter-state) with paise round-off.</li>
                <li>Posts General Ledger journal: Debits Accounts Receivable (1050), Credits Rental Income (4010), Credits GST Output Liability (2030/2031/2032).</li>
                <li>Freezes finalized snapshot payload ensuring immutable financial records.</li>
              </ul>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStatementModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#F26522] hover:bg-[#EA580C] text-white"
              >
                {isSubmitting ? "Generating Tax Invoice..." : "Generate Tax Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail View Modal */}
      {activeInvoice && (
        <Dialog open={!!activeInvoice} onOpenChange={() => setActiveInvoice(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg font-bold text-[#0B1E36]">
                  Invoice {activeInvoice.invoiceNumber}
                </DialogTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`/api/v1/invoices/${activeInvoice.id}/print`, "_blank")}
                  className="text-xs"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print A4
                </Button>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Customer:</span>
                  <span className="font-semibold text-slate-800">{activeInvoice.customer?.name}</span>
                  <span className="block text-slate-500 mt-1">GSTIN: {activeInvoice.customerGstin || "Unregistered"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Site / Destination:</span>
                  <span className="font-semibold text-slate-800">
                    {activeInvoice.customerSite?.siteName || "Consolidated / Multiple Sites"}
                  </span>
                  <span className="block text-slate-500 mt-1">
                    Place of Supply: State {activeInvoice.placeOfSupply} ({activeInvoice.isInterState ? "Inter-State" : "Intra-State"})
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2">Item Description</th>
                      <th className="p-2 text-center">HSN/SAC</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Taxable</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeInvoice.items?.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium">{item.itemDescription}</td>
                        <td className="p-2 text-center text-slate-500">{item.hsnSacCode}</td>
                        <td className="p-2 text-right">{Number(item.quantity).toFixed(2)} {item.uom}</td>
                        <td className="p-2 text-right">₹{Number(item.unitRate).toFixed(2)}</td>
                        <td className="p-2 text-right font-medium">₹{Number(item.taxableValue).toFixed(2)}</td>
                        <td className="p-2 text-right font-bold">₹{Number(item.totalAmount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-right">
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxable Subtotal:</span>
                  <span className="font-semibold">₹{Number(activeInvoice.subtotal).toFixed(2)}</span>
                </div>
                {Number(activeInvoice.totalCgst) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>CGST (9%):</span>
                    <span>₹{Number(activeInvoice.totalCgst).toFixed(2)}</span>
                  </div>
                )}
                {Number(activeInvoice.totalSgst) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>SGST (9%):</span>
                    <span>₹{Number(activeInvoice.totalSgst).toFixed(2)}</span>
                  </div>
                )}
                {Number(activeInvoice.totalIgst) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>IGST (18%):</span>
                    <span>₹{Number(activeInvoice.totalIgst).toFixed(2)}</span>
                  </div>
                )}
                {Number(activeInvoice.roundOffAmount) !== 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Round Off:</span>
                    <span>₹{Number(activeInvoice.roundOffAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold text-[#0B1E36]">
                  <span>Grand Total:</span>
                  <span>₹{Number(activeInvoice.totalAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                  <span>Amount Paid:</span>
                  <span>₹{Number(activeInvoice.paidAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-amber-600 font-bold">
                  <span>Balance Due:</span>
                  <span>₹{Number(activeInvoice.balanceAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveInvoice(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
