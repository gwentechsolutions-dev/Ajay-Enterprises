"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Plus,
  Search,
  CheckCircle2,
  Printer,
  PackageCheck,
  Send,
  Loader2,
  Trash2,
  Truck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

export default function StockTransfersPage() {
  const [transfers, setTransfers] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [variants, setVariants] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = React.useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState(false);
  const [dispatchTarget, setDispatchTarget] = React.useState<any>(null);
  const [dispatching, setDispatching] = React.useState(false);
  const [selectedSTN, setSelectedSTN] = React.useState<any>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Form states
  const [stnForm, setStnForm] = React.useState({
    sourceWarehouseId: "",
    destinationWarehouseId: "",
    transferDate: new Date().toISOString().split("T")[0],
    vehicleNumber: "KA-01-AB-1234",
    driverName: "",
    driverPhone: "",
    remarks: "",
    items: [
      {
        materialVariantId: "",
        ownershipType: "OWNED" as "OWNED" | "HIRED_IN",
        transferQty: 20,
        remarks: "",
      },
    ],
  });

  const [receiveForm, setReceiveForm] = React.useState({
    remarks: "",
    items: [] as Array<{
      itemId: string;
      materialName: string;
      transferQty: number;
      receivedQty: number;
      damagedQty: number;
      remarks: string;
    }>,
  });

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [stnRes, whRes, varRes] = await Promise.all([
        fetch("/api/v1/stock-transfers"),
        fetch("/api/v1/warehouses"),
        fetch("/api/v1/materials/variants"),
      ]);

      const [stnData, whData, varData] = await Promise.all([
        stnRes.json(),
        whRes.json(),
        varRes.json(),
      ]);

      if (stnData.success) setTransfers(Array.isArray(stnData.data) ? stnData.data : []);
      if (whData.success) setWarehouses(Array.isArray(whData.data) ? whData.data : []);
      if (varData.success) setVariants(Array.isArray(varData.data) ? varData.data : []);
    } catch {
      toast.error("Failed to load stock transfers.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "new") {
        setIsCreateModalOpen(true);
      }
    }
  }, [loadData]);

  const handleAddLine = () => {
    setStnForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          materialVariantId: "",
          ownershipType: "OWNED",
          transferQty: 20,
          remarks: "",
        },
      ],
    }));
  };

  const handleRemoveLine = (idx: number) => {
    setStnForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleCreateSTN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stnForm.sourceWarehouseId) return toast.error("Select source warehouse");
    if (!stnForm.destinationWarehouseId) return toast.error("Select destination warehouse");
    if (stnForm.sourceWarehouseId === stnForm.destinationWarehouseId) {
      return toast.error("Source and destination warehouse cannot be identical");
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/stock-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...stnForm,
          items: stnForm.items.map((it) => ({
            materialVariantId: it.materialVariantId,
            ownershipType: it.ownershipType,
            dispatchedQty: Number(it.transferQty),
            remarks: it.remarks || undefined,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create STN");

      toast.success(`STN ${data.data.stnNumber} created! Ready for dispatch.`);
      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDispatch = (stn: any) => {
    setDispatchTarget(stn);
    setIsDispatchModalOpen(true);
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchTarget) return;

    try {
      setDispatching(true);
      const res = await fetch(`/api/v1/stock-transfers/${dispatchTarget.id}/dispatch`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to dispatch STN");

      toast.success(`STN ${dispatchTarget.stnNumber} dispatched and in-transit!`);
      setIsDispatchModalOpen(false);
      setDispatchTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDispatching(false);
    }
  };

  const openReceiveModal = (stn: any) => {
    setSelectedSTN(stn);
    setReceiveForm({
      remarks: "Received and inspected at destination yard.",
      items: stn.items.map((it: any) => ({
        itemId: it.id,
        materialName: it.materialVariant?.name || "Centering Material",
        transferQty: Number(it.dispatchedQty || it.transferQty),
        receivedQty: Number(it.dispatchedQty || it.transferQty),
        damagedQty: 0,
        remarks: "",
      })),
    });
    setIsReceiveModalOpen(true);
  };

  const handleReceiveSTN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSTN) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/stock-transfers/${selectedSTN.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remarks: receiveForm.remarks,
          items: receiveForm.items.map((i) => ({
            itemId: i.itemId,
            receivedQty: i.receivedQty,
            damagedQty: i.damagedQty,
            remarks: i.remarks || undefined,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to receive transfer");

      toast.success(`STN ${selectedSTN.stnNumber} received! Destination stock credited.`);
      setIsReceiveModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSTNs = (transfers || []).filter((stn) => {
    if (!stn) return false;
    const stnNum = stn.stnNumber || "";
    const srcName = stn.sourceWarehouse?.name || "";
    const destName = stn.destinationWarehouse?.name || "";
    const q = (search || "").toLowerCase();
    return (
      stnNum.toLowerCase().includes(q) ||
      srcName.toLowerCase().includes(q) ||
      destName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="h-7 w-7 text-[#F26522]" />
            Stock Transfer Notes (STN)
          </h1>
          <p className="text-sm text-slate-500">
            Inter-warehouse and inter-yard inventory transfers across AJAY ENTERPRISES locations
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white shadow-sm flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Stock Transfer
        </Button>
      </div>

      {/* Table */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search STN # or yards..."
              className="pl-9 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">STN Number</th>
                <th className="px-6 py-4">Source Yard</th>
                <th className="px-6 py-4">Destination Yard</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
                    Loading transfers...
                  </td>
                </tr>
              ) : filteredSTNs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No stock transfers found.
                  </td>
                </tr>
              ) : (
                filteredSTNs.map((stn) => (
                  <tr key={stn.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">
                      {stn.stnNumber}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {stn.sourceWarehouse?.name}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {stn.destinationWarehouse?.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(stn.transferDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge
                        variant="secondary"
                        className={
                          stn.status === "RECEIVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : stn.status === "DISPATCHED"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-amber-100 text-amber-800"
                        }
                      >
                        {stn.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="text-xs h-7 px-2.5 inline-flex items-center gap-1 font-medium text-slate-700"
                        >
                          <a href={`/api/v1/stock-transfers/${stn.id}/print`} target="_blank" rel="noopener noreferrer">
                            <Printer className="h-3.5 w-3.5" />
                            <span>Print</span>
                          </a>
                        </Button>

                        {stn.status === "DRAFT" ? (
                          <Button
                            size="sm"
                            onClick={() => handleOpenDispatch(stn)}
                            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs h-7 px-2.5 inline-flex items-center gap-1 font-medium shadow-sm"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Dispatch</span>
                          </Button>
                        ) : null}

                        {stn.status === "DISPATCHED" ? (
                          <Button
                            size="sm"
                            onClick={() => openReceiveModal(stn)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 inline-flex items-center gap-1 font-medium shadow-sm"
                          >
                            <PackageCheck className="h-3.5 w-3.5" />
                            <span>Receive</span>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CREATE STN MODAL */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-[#F26522]" />
              New Inter-Yard Stock Transfer
            </DialogTitle>
            <DialogDescription>
              Transfer centering assets between company yards. Stock is validated against source yard inventory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSTN} className="space-y-4 pt-2">
            <fieldset
              disabled={submitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
            >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Source Yard *</Label>
                <SearchableCombobox
                  options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.warehouseCode})` }))}
                  value={stnForm.sourceWarehouseId}
                  onChange={(val) => setStnForm({ ...stnForm, sourceWarehouseId: val })}
                  placeholder="Select Source Yard"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Destination Yard *</Label>
                <SearchableCombobox
                  options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.warehouseCode})` }))}
                  value={stnForm.destinationWarehouseId}
                  onChange={(val) => setStnForm({ ...stnForm, destinationWarehouseId: val })}
                  placeholder="Select Destination Yard"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Transfer Date *</Label>
                <Input
                  type="date"
                  value={stnForm.transferDate}
                  onChange={(e) => setStnForm({ ...stnForm, transferDate: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Company Vehicle No. *</Label>
                <Input
                  value={stnForm.vehicleNumber}
                  onChange={(e) => setStnForm({ ...stnForm, vehicleNumber: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Driver Name</Label>
                <Input
                  placeholder="e.g. Ramesh"
                  value={stnForm.driverName}
                  onChange={(e) => setStnForm({ ...stnForm, driverName: e.target.value })}
                />
              </div>
            </div>

            {/* Line items */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-800 uppercase">Transfer Items</h4>
                <Button type="button" variant="outline" size="sm" onClick={handleAddLine} className="text-xs h-7">
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>

              {stnForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white p-2 rounded border border-slate-200">
                  <div className="col-span-12 md:col-span-6">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Material Variant *</Label>
                    <SearchableCombobox
                      options={variants.map((v) => ({
                        value: v.id,
                        label: `${v.name} ${v.size ? `(${v.size})` : ""} - ${v.materialCode}`,
                      }))}
                      value={item.materialVariantId}
                      onChange={(val) => {
                        const updated = [...stnForm.items];
                        updated[idx].materialVariantId = val;
                        setStnForm({ ...stnForm, items: updated });
                      }}
                      placeholder="Select Material"
                    />
                  </div>

                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Pool *</Label>
                    <SearchableCombobox
                      options={[
                        { value: "OWNED", label: "OWNED" },
                        { value: "HIRED_IN", label: "HIRED_IN" },
                      ]}
                      value={item.ownershipType}
                      onChange={(val) => {
                        const updated = [...stnForm.items];
                        updated[idx].ownershipType = val as "OWNED" | "HIRED_IN";
                        setStnForm({ ...stnForm, items: updated });
                      }}
                    />
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Qty *</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0.001"
                      value={item.transferQty}
                      onChange={(e) => {
                        const updated = [...stnForm.items];
                        updated[idx].transferQty = parseFloat(e.target.value) || 0;
                        setStnForm({ ...stnForm, items: updated });
                      }}
                    />
                  </div>

                  <div className="col-span-2 md:col-span-1 flex justify-center">
                    {stnForm.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLine(idx)}
                        className="text-red-500 h-9 w-9 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </fieldset>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#0B1E36] text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Transfer Note
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RECEIVE STN MODAL */}
      <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-emerald-600" />
              Receive Inter-Yard Transfer – {selectedSTN?.stnNumber}
            </DialogTitle>
            <DialogDescription>
              Check-in items at destination yard ({selectedSTN?.destinationWarehouse?.name}). Good stock is added to available pool.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReceiveSTN} className="space-y-4 pt-2">
            <fieldset
              disabled={submitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
            >
            <div className="space-y-3">
              {receiveForm.items.map((item, idx) => (
                <div key={idx} className="bg-white border border-slate-200 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-slate-900">{item.materialName}</span>
                    <span className="text-xs text-slate-500 font-mono">Dispatched: {item.transferQty}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-emerald-600">Received (Accepted)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={item.receivedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...receiveForm.items];
                          updated[idx].receivedQty = val;
                          setReceiveForm({ ...receiveForm, items: updated });
                        }}
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] uppercase font-bold text-amber-600">Transit Damaged</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={item.damagedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...receiveForm.items];
                          updated[idx].damagedQty = val;
                          setReceiveForm({ ...receiveForm, items: updated });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs font-semibold">Receiving Yard Remarks</Label>
              <Input
                value={receiveForm.remarks}
                onChange={(e) => setReceiveForm({ ...receiveForm, remarks: e.target.value })}
              />
            </div>
            </fieldset>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReceiveModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Confirm Receipt & Credit Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* IN-APP DISPATCH CONFIRMATION MODAL */}
      <Dialog open={isDispatchModalOpen} onOpenChange={setIsDispatchModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36] flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#F26522]" />
              Confirm Stock Transfer Dispatch
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Inter-yard transfer between storage yards.
            </DialogDescription>
          </DialogHeader>

          {dispatchTarget && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">STN Number:</span>
                  <span className="font-bold text-slate-900">{dispatchTarget.stnNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Source Yard:</span>
                  <span className="font-semibold text-slate-800">{dispatchTarget.sourceWarehouse?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Destination Yard:</span>
                  <span className="text-slate-700">{dispatchTarget.destinationWarehouse?.name}</span>
                </div>
                {dispatchTarget.vehicleNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Vehicle:</span>
                    <span className="text-slate-700">{dispatchTarget.vehicleNumber}</span>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs">
                  This action will deduct physical inventory from <strong>{dispatchTarget.sourceWarehouse?.name}</strong> and mark the transfer as in-transit.
                </p>
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDispatchModalOpen(false)}
                  disabled={dispatching}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmDispatch}
                  isLoading={dispatching}
                  loadingText="Dispatching..."
                  className="bg-[#0B1E36] hover:bg-[#071424] text-white font-semibold"
                >
                  Confirm & Dispatch
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

