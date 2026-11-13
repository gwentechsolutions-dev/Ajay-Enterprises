"use client";

import * as React from "react";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Building,
  TrendingDown,
  Trash2,
  DollarSign,
  AlertCircle,
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

export default function PurchaseBillsPage() {
  const [bills, setBills] = React.useState<any[]>([]);
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [materials, setMaterials] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  // Create Bill Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = React.useState("");
  const [billDate, setBillDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [itcEligibility, setItcEligibility] = React.useState("ELIGIBLE");
  const [tdsDeducted, setTdsDeducted] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<any[]>([
    {
      materialVariantId: "",
      itemDescription: "",
      hsnCode: "7308",
      quantity: 1,
      uom: "Nos.",
      unitPrice: 0,
      gstRatePercent: 18,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [billsRes, supRes, matRes] = await Promise.all([
        fetch("/api/v1/purchases/bills"),
        fetch("/api/v1/suppliers"),
        fetch("/api/v1/materials"),
      ]);
      const billsData = await billsRes.json();
      const supData = await supRes.json();
      const matData = await matRes.json();

      if (billsData.success) setBills(billsData.data || []);
      if (supData.success) setSuppliers(supData.data || []);
      if (matData.success) setMaterials(matData.data || []);
    } catch (err) {
      console.error("Failed to load bills data", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        materialVariantId: "",
        itemDescription: "",
        hsnCode: "7308",
        quantity: 1,
        uom: "Nos.",
        unitPrice: 0,
        gstRatePercent: 18,
      },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== idx));
    }
  };

  const handleItemChange = (idx: number, field: string, val: any) => {
    const updated = [...items];
    updated[idx][field] = val;
    if (field === "materialVariantId") {
      const mat = materials.find((m) => m.id === val);
      if (mat) {
        updated[idx].itemDescription = mat.name;
        updated[idx].uom = mat.uom || "Nos.";
      }
    }
    setItems(updated);
  };

  const calculatePreview = () => {
    let subtotal = 0;
    let totalTax = 0;
    items.forEach((it) => {
      const taxable = Number(it.quantity || 0) * Number(it.unitPrice || 0);
      const tax = taxable * (Number(it.gstRatePercent || 0) / 100);
      subtotal += taxable;
      totalTax += tax;
    });
    const grandTotal = subtotal + totalTax - Number(tdsDeducted || 0);
    return { subtotal, totalTax, grandTotal };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !supplierInvoiceNumber) {
      setErrorMsg("Supplier and Supplier Bill Number are required");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload = {
        supplierId,
        supplierInvoiceNumber,
        billDate,
        dueDate,
        itcEligibility,
        tdsDeducted: Number(tdsDeducted || 0),
        notes: notes || undefined,
        items: items.map((it) => ({
          materialVariantId: it.materialVariantId || undefined,
          itemDescription: it.itemDescription || "Materials / Centering Equipment Supply",
          hsnCode: it.hsnCode || "7308",
          quantity: Number(it.quantity),
          uom: it.uom,
          unitPrice: Number(it.unitPrice),
          gstRatePercent: Number(it.gstRatePercent),
        })),
      };

      const res = await fetch("/api/v1/purchases/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to record purchase bill");
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
    setSupplierId("");
    setSupplierInvoiceNumber("");
    setTdsDeducted("0");
    setNotes("");
    setItems([
      {
        materialVariantId: "",
        itemDescription: "",
        hsnCode: "7308",
        quantity: 1,
        uom: "Nos.",
        unitPrice: 0,
        gstRatePercent: 18,
      },
    ]);
  };

  const filteredBills = bills.filter((b) => {
    const matchesSearch =
      b.billNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.supplierInvoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.supplier?.name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || b.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPayable = bills.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
  const totalPaid = bills.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0);
  const totalOutstanding = bills.reduce((sum, b) => sum + Number(b.balanceAmount || 0), 0);

  const preview = calculatePreview();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Purchase Bills</h1>
          <p className="text-sm text-slate-500">
            Supplier invoices, Input Tax Credit (ITC) tracking, and Accounts Payable ledger
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
            onClick={() => setIsModalOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#071322] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Record Purchase Bill
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Total Bills</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-[#0B1E36] mt-2">{bills.length}</div>
          <div className="text-xs text-slate-500 mt-1">Recorded supplier bills</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Gross Purchases</span>
            <TrendingDown className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-[#0B1E36] mt-2">
            ₹{totalPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Total supplier payables</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Paid to Suppliers</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            ₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Total disbursements made</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase">Outstanding Payables</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">
            ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Accounts payable due</div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by bill number, supplier invoice #, or supplier name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Internal Bill #</th>
                <th className="px-4 py-3">Supplier & Invoice #</th>
                <th className="px-4 py-3">Bill Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-center">ITC Status</th>
                <th className="px-4 py-3 text-right">Taxable</th>
                <th className="px-4 py-3 text-right">GST Input</th>
                <th className="px-4 py-3 text-right">Total Bill</th>
                <th className="px-4 py-3 text-right">Balance Due</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No purchase bills found
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#0B1E36]">{b.billNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{b.supplier?.name}</div>
                      <div className="text-xs text-slate-500">Ref: {b.supplierInvoiceNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(b.billDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(b.dueDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          b.itcEligibility === "ELIGIBLE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {b.itcEligibility}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      ₹{Number(b.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">
                      ₹{Number(b.totalTax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#0B1E36]">
                      ₹{Number(b.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600">
                      ₹{Number(b.balanceAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          b.paymentStatus === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : b.paymentStatus === "PARTIALLY_PAID"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {b.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Purchase Bill Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36]">
              Record Supplier Purchase Bill
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-600 rounded-md border border-red-200">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-700">Supplier *</Label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
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

              <div>
                <Label className="text-xs font-medium text-slate-700">Supplier Invoice / Bill # *</Label>
                <Input
                  value={supplierInvoiceNumber}
                  onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                  required
                  placeholder="e.g. INV-SUP-2026-901"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Bill Date *</Label>
                <Input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
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

              <div>
                <Label className="text-xs font-medium text-slate-700">ITC Eligibility</Label>
                <select
                  value={itcEligibility}
                  onChange={(e) => setItcEligibility(e.target.value)}
                  className="w-full mt-1 h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-[#0B1E36]"
                >
                  <option value="ELIGIBLE">Eligible for Input Tax Credit</option>
                  <option value="INELIGIBLE">Ineligible</option>
                  <option value="BLOCKED">Blocked Credit (Sec 17(5))</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">TDS Deducted (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tdsDeducted}
                  onChange={(e) => setTdsDeducted(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-[#0B1E36] uppercase">Bill Line Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
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
                      <th className="p-2">Material / Description</th>
                      <th className="p-2 w-20">HSN</th>
                      <th className="p-2 w-20 text-right">Qty</th>
                      <th className="p-2 w-24 text-right">Rate (₹)</th>
                      <th className="p-2 w-20 text-center">GST %</th>
                      <th className="p-2 w-24 text-right">Total (₹)</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it, idx) => {
                      const lineTaxable = Number(it.quantity || 0) * Number(it.unitPrice || 0);
                      const lineTax = lineTaxable * (Number(it.gstRatePercent || 0) / 100);
                      const lineTotal = lineTaxable + lineTax;

                      return (
                        <tr key={idx}>
                          <td className="p-2">
                            <select
                              value={it.materialVariantId}
                              onChange={(e) => handleItemChange(idx, "materialVariantId", e.target.value)}
                              className="w-full h-8 px-2 text-xs border border-slate-300 rounded bg-white"
                            >
                              <option value="">-- Custom Supply Item --</option>
                              {materials.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            <Input
                              value={it.itemDescription}
                              onChange={(e) => handleItemChange(idx, "itemDescription", e.target.value)}
                              placeholder="Item description..."
                              className="h-7 text-xs mt-1"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={it.hsnCode}
                              onChange={(e) => handleItemChange(idx, "hsnCode", e.target.value)}
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={it.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                              className="h-8 text-xs text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.unitPrice}
                              onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                              className="h-8 text-xs text-right"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={it.gstRatePercent}
                              onChange={(e) => handleItemChange(idx, "gstRatePercent", e.target.value)}
                              className="w-full h-8 px-1 text-xs border border-slate-300 rounded bg-white"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td className="p-2 text-right font-semibold">₹{lineTotal.toFixed(2)}</td>
                          <td className="p-2 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations Summary */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1 text-right">
              <div className="flex justify-between">
                <span className="text-slate-500">Taxable Subtotal:</span>
                <span className="font-semibold">₹{preview.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GST Input Tax Credit:</span>
                <span className="font-semibold">₹{preview.totalTax.toFixed(2)}</span>
              </div>
              {Number(tdsDeducted) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Less: TDS Deducted:</span>
                  <span>-₹{Number(tdsDeducted).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold text-[#0B1E36]">
                <span>Net Payable to Supplier:</span>
                <span>₹{preview.grandTotal.toFixed(2)}</span>
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
                disabled={isSubmitting}
                className="bg-[#0B1E36] hover:bg-[#071322] text-white"
              >
                {isSubmitting ? "Recording Bill..." : "Record & Post to Ledger"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
