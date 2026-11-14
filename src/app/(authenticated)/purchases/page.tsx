"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Plus,
  Search,
  CheckCircle2,
  PackageCheck,
  RotateCcw,
  Building2,
  Calendar,
  AlertCircle,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/loading-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { toast } from "sonner";

export default function PurchasesPage() {
  const [orders, setOrders] = React.useState<any[]>([]);
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [variants, setVariants] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  // Modals
  const [isPOModalOpen, setIsPOModalOpen] = React.useState(false);
  const [isGRNModalOpen, setIsGRNModalOpen] = React.useState(false);
  const [selectedPO, setSelectedPO] = React.useState<any>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // New PO Form State
  const [poForm, setPoForm] = React.useState({
    supplierId: "",
    branchId: "",
    deliveryWarehouseId: "",
    orderDate: new Date().toISOString().split("T")[0],
    expectedDeliveryDate: "",
    notes: "",
    items: [
      {
        materialVariantId: "",
        orderedQty: 10,
        unitRate: 100,
        taxPercent: 18,
        discountAmount: 0,
        remarks: "",
      },
    ],
  });

  // GRN Form State
  const [grnForm, setGrnForm] = React.useState({
    receivedDate: new Date().toISOString().split("T")[0],
    supplierInvoiceNo: "",
    supplierInvoiceDate: new Date().toISOString().split("T")[0],
    remarks: "",
    items: [] as Array<{
      poItemId: string;
      materialVariantId: string;
      materialName: string;
      orderedQty: number;
      alreadyReceivedQty: number;
      receivedQty: number;
      acceptedQty: number;
      damagedQty: number;
      rejectedQty: number;
      remarks: string;
    }>,
  });

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [poRes, supRes, brRes, whRes, varRes] = await Promise.all([
        fetch("/api/v1/purchases/orders"),
        fetch("/api/v1/suppliers"),
        fetch("/api/v1/branches"),
        fetch("/api/v1/warehouses"),
        fetch("/api/v1/materials/variants"),
      ]);

      const [poData, supData, brData, whData, varData] = await Promise.all([
        poRes.json(),
        supRes.json(),
        brRes.json(),
        whRes.json(),
        varRes.json(),
      ]);

      if (poData.success) setOrders(poData.data);
      if (supData.success) setSuppliers(supData.data);
      if (brData.success) setBranches(brData.data);
      if (whData.success) setWarehouses(whData.data);
      if (varData.success) setVariants(varData.data);
    } catch {
      toast.error("Failed to load purchase operations data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Helper calculation for PO totals
  const poCalculations = React.useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    let discountTotal = 0;

    poForm.items.forEach((item) => {
      const lineBase = (Number(item.orderedQty) || 0) * (Number(item.unitRate) || 0);
      const disc = Number(item.discountAmount) || 0;
      const taxable = Math.max(0, lineBase - disc);
      const tax = (taxable * (Number(item.taxPercent) || 0)) / 100;

      subtotal += lineBase;
      discountTotal += disc;
      taxAmount += tax;
    });

    const grandTotal = subtotal - discountTotal + taxAmount;
    return { subtotal, discountTotal, taxAmount, grandTotal };
  }, [poForm.items]);

  const handleAddPOLine = () => {
    setPoForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          materialVariantId: "",
          orderedQty: 10,
          unitRate: 100,
          taxPercent: 18,
          discountAmount: 0,
          remarks: "",
        },
      ],
    }));
  };

  const handleRemovePOLine = (index: number) => {
    setPoForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.supplierId) return toast.error("Please select a supplier");
    if (!poForm.branchId) return toast.error("Please select a branch");
    if (!poForm.deliveryWarehouseId) return toast.error("Please select receiving warehouse");
    if (poForm.items.some((i) => !i.materialVariantId || i.orderedQty <= 0)) {
      return toast.error("Ensure all line items have a valid variant and quantity > 0");
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/purchases/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(poForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create Purchase Order");

      toast.success(`Purchase Order ${data.data.poNumber} created successfully!`);
      setIsPOModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovePO = async (poId: string, poNumber: string) => {
    if (!confirm(`Are you sure you want to approve Purchase Order ${poNumber}?`)) return;

    try {
      const res = await fetch(`/api/v1/purchases/orders/${poId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to approve PO");

      toast.success(`Purchase Order ${poNumber} approved for receipt!`);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openGRNModal = (po: any) => {
    setSelectedPO(po);
    setGrnForm({
      receivedDate: new Date().toISOString().split("T")[0],
      supplierInvoiceNo: "",
      supplierInvoiceDate: new Date().toISOString().split("T")[0],
      remarks: "",
      items: po.items.map((it: any) => {
        const remaining = Math.max(0, Number(it.orderedQty) - Number(it.receivedQty || 0));
        return {
          poItemId: it.id,
          materialVariantId: it.materialVariantId,
          materialName: it.materialVariant?.name || "Centering Material",
          orderedQty: Number(it.orderedQty),
          alreadyReceivedQty: Number(it.receivedQty || 0),
          receivedQty: remaining,
          acceptedQty: remaining,
          damagedQty: 0,
          rejectedQty: 0,
          remarks: "",
        };
      }),
    });
    setIsGRNModalOpen(true);
  };

  const handlePostGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/purchases/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: selectedPO.id,
          receivingWarehouseId: selectedPO.deliveryWarehouseId,
          receiptDate: grnForm.receivedDate,
          supplierInvoiceNumber: grnForm.supplierInvoiceNo || undefined,
          supplierInvoiceDate: grnForm.supplierInvoiceDate || undefined,
          remarks: grnForm.remarks,
          items: grnForm.items
            .filter((i) => i.receivedQty > 0)
            .map((i) => ({
              purchaseOrderItemId: i.poItemId,
              materialVariantId: i.materialVariantId,
              receivedQty: i.receivedQty,
              acceptedQty: i.acceptedQty,
              damagedQty: i.damagedQty,
              rejectedQty: i.rejectedQty,
              remarks: i.remarks || undefined,
            })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to post Goods Receipt Note");

      toast.success(`GRN ${data.data.grnNumber} posted! Inventory ledger updated.`);
      setIsGRNModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((po) => {
    const matchesSearch =
      po.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      po.supplier.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 text-[#F26522]" />
            Purchase Orders & Goods Receipt Notes
          </h1>
          <p className="text-sm text-slate-500">
            Procurement workflow, vendor orders, and warehouse inventory receipt for AJAY ENTERPRISES
          </p>
        </div>
        <Button
          onClick={() => setIsPOModalOpen(true)}
          className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white shadow-sm flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Purchase Order
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Purchase Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{orders.length}</div>
            <p className="text-xs text-slate-400 mt-1">Recorded to date</p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/30 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Awaiting Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {orders.filter((p) => p.status === "SUBMITTED" || p.status === "DRAFT").length}
            </div>
            <p className="text-xs text-amber-600/80 mt-1">Pending authorization</p>
          </CardContent>
        </Card>

        <Card className="border-sky-100 bg-sky-50/30 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-sky-700 uppercase tracking-wider">
              Awaiting Goods Receipt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-700">
              {orders.filter((p) => p.status === "APPROVED" || p.status === "PARTIALLY_RECEIVED").length}
            </div>
            <p className="text-xs text-sky-600/80 mt-1">Ready for warehouse check-in</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/30 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Completed Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {orders.filter((p) => p.status === "COMPLETED").length}
            </div>
            <p className="text-xs text-emerald-600/80 mt-1">Fully received & ledgered</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card className="border-slate-200">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search PO # or supplier..."
                className="pl-9 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-medium text-slate-500">Status:</span>
              <div className="flex flex-wrap gap-1">
                {["ALL", "DRAFT", "APPROVED", "PARTIALLY_RECEIVED", "COMPLETED"].map((st) => (
                  <Button
                    key={st}
                    variant={statusFilter === st ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(st)}
                    className={
                      statusFilter === st
                        ? "bg-[#0B1E36] text-white text-xs h-8"
                        : "text-slate-600 text-xs h-8"
                    }
                  >
                    {st}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">PO Number</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Destination Yard</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Grand Total</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <TableSkeleton columns={7} rows={6} />
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No purchase orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">
                      {po.poNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{po.supplier?.name}</div>
                      <div className="text-xs text-slate-400">{po.supplier?.supplierCode}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {po.deliveryWarehouse?.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(po.orderDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-6 py-4 font-mono text-right font-semibold text-slate-900">
                      ₹{Number(po.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge
                        variant="secondary"
                        className={
                          po.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : po.status === "APPROVED"
                            ? "bg-sky-100 text-sky-800"
                            : po.status === "PARTIALLY_RECEIVED"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }
                      >
                        {po.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {po.status === "DRAFT" || po.status === "SUBMITTED" ? (
                        <Button
                          size="sm"
                          onClick={() => handleApprovePO(po.id, po.poNumber)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
                        >
                          Approve
                        </Button>
                      ) : null}

                      {po.status === "APPROVED" || po.status === "PARTIALLY_RECEIVED" ? (
                        <Button
                          size="sm"
                          onClick={() => openGRNModal(po)}
                          className="bg-[#F26522] hover:bg-[#EA580C] text-white text-xs h-7 px-3 flex items-center gap-1 inline-flex"
                        >
                          <PackageCheck className="h-3.5 w-3.5" />
                          Receive GRN
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CREATE PO MODAL */}
      <Dialog open={isPOModalOpen} onOpenChange={setIsPOModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-[#F26522]" />
              Create Purchase Order
            </DialogTitle>
            <DialogDescription>
              Issue official purchase order to supplier. Order lines will update company inventory once GRN is received.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePO} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Supplier *</Label>
                <SearchableCombobox
                  options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (${s.supplierCode})` }))}
                  value={poForm.supplierId}
                  onChange={(val) => setPoForm({ ...poForm, supplierId: val })}
                  placeholder="Select Supplier"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Branch *</Label>
                <SearchableCombobox
                  options={branches.map((b) => ({ value: b.id, label: `${b.name} (${b.branchCode})` }))}
                  value={poForm.branchId}
                  onChange={(val) => setPoForm({ ...poForm, branchId: val })}
                  placeholder="Select Branch"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Receiving Warehouse / Yard *</Label>
                <SearchableCombobox
                  options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.warehouseCode})` }))}
                  value={poForm.deliveryWarehouseId}
                  onChange={(val) => setPoForm({ ...poForm, deliveryWarehouseId: val })}
                  placeholder="Select Receiving Yard"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Order Date *</Label>
                <Input
                  type="date"
                  value={poForm.orderDate}
                  onChange={(e) => setPoForm({ ...poForm, orderDate: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Expected Delivery Date</Label>
                <Input
                  type="date"
                  value={poForm.expectedDeliveryDate}
                  onChange={(e) => setPoForm({ ...poForm, expectedDeliveryDate: e.target.value })}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800">Order Items</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddPOLine}
                  className="text-xs h-7"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                </Button>
              </div>

              {poForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white p-2.5 rounded border border-slate-200">
                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-[10px] text-slate-500 uppercase font-bold">Material Variant *</Label>
                    <SearchableCombobox
                      options={variants.map((v) => ({
                        value: v.id,
                        label: `${v.name} ${v.size ? `(${v.size})` : ""} - ${v.materialCode}`,
                      }))}
                      value={item.materialVariantId}
                      onChange={(val) => {
                        const updated = [...poForm.items];
                        updated[idx].materialVariantId = val;
                        const v = variants.find((x) => x.id === val);
                        if (v && v.purchaseCost) updated[idx].unitRate = Number(v.purchaseCost);
                        setPoForm({ ...poForm, items: updated });
                      }}
                      placeholder="Select Variant"
                    />
                  </div>

                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-[10px] text-slate-500 uppercase font-bold">Qty *</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0.001"
                      value={item.orderedQty}
                      onChange={(e) => {
                        const updated = [...poForm.items];
                        updated[idx].orderedQty = parseFloat(e.target.value) || 0;
                        setPoForm({ ...poForm, items: updated });
                      }}
                    />
                  </div>

                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-[10px] text-slate-500 uppercase font-bold">Rate (₹) *</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={item.unitRate}
                      onChange={(e) => {
                        const updated = [...poForm.items];
                        updated[idx].unitRate = parseFloat(e.target.value) || 0;
                        setPoForm({ ...poForm, items: updated });
                      }}
                    />
                  </div>

                  <div className="col-span-3 md:col-span-2">
                    <Label className="text-[10px] text-slate-500 uppercase font-bold">GST %</Label>
                    <Input
                      type="number"
                      value={item.taxPercent}
                      onChange={(e) => {
                        const updated = [...poForm.items];
                        updated[idx].taxPercent = parseFloat(e.target.value) || 0;
                        setPoForm({ ...poForm, items: updated });
                      }}
                    />
                  </div>

                  <div className="col-span-1 flex justify-center">
                    {poForm.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePOLine(idx)}
                        className="text-red-500 hover:text-red-700 h-9 w-9 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Totals Summary */}
              <div className="bg-slate-100 p-3 rounded flex justify-end text-right font-mono text-xs space-y-1">
                <div>
                  <div>Subtotal: ₹{poCalculations.subtotal.toFixed(2)}</div>
                  <div>GST Tax: ₹{poCalculations.taxAmount.toFixed(2)}</div>
                  <div className="font-bold text-sm text-[#0B1E36] pt-1 border-t border-slate-300">
                    Grand Total: ₹{poCalculations.grandTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Remarks & Notes</Label>
              <Input
                placeholder="Optional delivery terms or references"
                value={poForm.notes}
                onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPOModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting} loadingText="Generating PO..." className="bg-[#0B1E36] text-white">
                Generate PO
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RECEIVE GOODS (GRN) MODAL */}
      <Dialog open={isGRNModalOpen} onOpenChange={setIsGRNModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-emerald-600" />
              Goods Receipt Note (GRN) – {selectedPO?.poNumber}
            </DialogTitle>
            <DialogDescription>
              Verify received physical stock. Accepted materials will be credited to {selectedPO?.deliveryWarehouse?.name} inventory ledger.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePostGRN} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <Label className="text-xs font-semibold">Receipt Date *</Label>
                <Input
                  type="date"
                  value={grnForm.receivedDate}
                  onChange={(e) => setGrnForm({ ...grnForm, receivedDate: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Supplier Invoice No.</Label>
                <Input
                  placeholder="e.g. INV-9872"
                  value={grnForm.supplierInvoiceNo}
                  onChange={(e) => setGrnForm({ ...grnForm, supplierInvoiceNo: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Supplier Invoice Date</Label>
                <Input
                  type="date"
                  value={grnForm.supplierInvoiceDate}
                  onChange={(e) => setGrnForm({ ...grnForm, supplierInvoiceDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Line Item Inspection Breakdown
              </h4>

              {grnForm.items.map((item, idx) => (
                <div key={idx} className="bg-white border border-slate-200 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-slate-900">{item.materialName}</span>
                    <span className="text-xs text-slate-500 font-mono">
                      Ordered: {item.orderedQty} | Prev Received: {item.alreadyReceivedQty}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Received Qty</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={item.receivedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...grnForm.items];
                          updated[idx].receivedQty = val;
                          updated[idx].acceptedQty = Math.max(0, val - updated[idx].damagedQty);
                          setGrnForm({ ...grnForm, items: updated });
                        }}
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] uppercase font-bold text-emerald-600">Accepted (Good)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={item.acceptedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...grnForm.items];
                          updated[idx].acceptedQty = val;
                          setGrnForm({ ...grnForm, items: updated });
                        }}
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] uppercase font-bold text-amber-600">Damaged (Non-rentable)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={item.damagedQty}
                        onChange={(e) => {
                          const dmg = parseFloat(e.target.value) || 0;
                          const updated = [...grnForm.items];
                          updated[idx].damagedQty = dmg;
                          updated[idx].acceptedQty = Math.max(0, updated[idx].receivedQty - dmg);
                          setGrnForm({ ...grnForm, items: updated });
                        }}
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] uppercase font-bold text-red-600">Rejected (Return)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={item.rejectedQty}
                        onChange={(e) => {
                          const updated = [...grnForm.items];
                          updated[idx].rejectedQty = parseFloat(e.target.value) || 0;
                          setGrnForm({ ...grnForm, items: updated });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs font-semibold">Inspection Remarks</Label>
              <Input
                placeholder="Remarks on condition, yard unloading bay, or batch reference"
                value={grnForm.remarks}
                onChange={(e) => setGrnForm({ ...grnForm, remarks: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsGRNModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting} loadingText="Posting GRN..." className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Post GRN & Credit Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

