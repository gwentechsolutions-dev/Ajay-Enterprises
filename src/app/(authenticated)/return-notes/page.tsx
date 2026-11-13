"use client";

import * as React from "react";
import Link from "next/link";
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Printer,
  PackageMinus,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function MaterialReturnsPage() {
  const [returnNotes, setReturnNotes] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [variants, setVariants] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // New MRN Form
  const [mrnForm, setMrnForm] = React.useState({
    customerId: "",
    customerSiteId: "",
    receivingWarehouseId: "",
    returnDate: new Date().toISOString().split("T")[0],
    includeReturnDate: false,
    vehicleNumber: "KA-01-AB-1234",
    driverName: "",
    driverPhone: "",
    receiverName: "Yard Manager",
    receiverPhone: "9876543210",
    remarks: "",
    items: [
      {
        materialVariantId: "",
        returnedQty: 50,
        acceptedQty: 48,
        damagedQty: 2,
        missingQty: 0,
        condition: "GOOD",
        remarks: "",
      },
    ],
  });

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [mrnRes, custRes, whRes, varRes] = await Promise.all([
        fetch("/api/v1/return-notes"),
        fetch("/api/v1/customers"),
        fetch("/api/v1/warehouses"),
        fetch("/api/v1/materials/variants"),
      ]);

      const [mrnData, custData, whData, varData] = await Promise.all([
        mrnRes.json(),
        custRes.json(),
        whRes.json(),
        varRes.json(),
      ]);

      if (mrnData.success) setReturnNotes(mrnData.data);
      if (custData.success) setCustomers(custData.data);
      if (whData.success) setWarehouses(whData.data);
      if (varData.success) setVariants(varData.data);
    } catch {
      toast.error("Failed to load material return notes.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCustomerChange = async (customerId: string) => {
    setMrnForm((prev) => ({ ...prev, customerId, customerSiteId: "" }));
    if (!customerId) {
      setSites([]);
      return;
    }
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/sites`);
      const data = await res.json();
      if (data.success) {
        setSites(data.data);
        if (data.data.length > 0) {
          setMrnForm((prev) => ({ ...prev, customerSiteId: data.data[0].id }));
        }
      }
    } catch {
      toast.error("Failed to load customer sites");
    }
  };

  const handleAddLine = () => {
    setMrnForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          materialVariantId: "",
          returnedQty: 10,
          acceptedQty: 10,
          damagedQty: 0,
          missingQty: 0,
          condition: "GOOD",
          remarks: "",
        },
      ],
    }));
  };

  const handleRemoveLine = (idx: number) => {
    setMrnForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleCreateMRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mrnForm.customerId) return toast.error("Please select a customer");
    if (!mrnForm.customerSiteId) return toast.error("Please select returning construction site");
    if (!mrnForm.receivingWarehouseId) return toast.error("Please select receiving yard");
    if (mrnForm.items.some((i) => !i.materialVariantId || i.returnedQty <= 0)) {
      return toast.error("Ensure all items have a variant and returned quantity > 0");
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/return-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mrnForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to post Material Return Note");

      toast.success(`MRN ${data.data.mrnNumber} posted! Site stock deducted & yard stock credited.`);
      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMRNs = returnNotes.filter((mrn) => {
    return (
      mrn.mrnNumber.toLowerCase().includes(search.toLowerCase()) ||
      mrn.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      mrn.customerSite?.siteName?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <RotateCcw className="h-7 w-7 text-[#F26522]" />
            Material Return Notes (MRN)
          </h1>
          <p className="text-sm text-slate-500">
            Inward centering material return custody transfer from customer sites back to AJAY ENTERPRISES yards
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white shadow-sm flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Return Note
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Returns Processed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{returnNotes.length}</div>
            <p className="text-xs text-slate-400 mt-1">Completed check-ins</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/30 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Stock Re-credited to Yards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {returnNotes.reduce(
                (acc, m) => acc + m.items.reduce((sum: number, it: any) => sum + Number(it.acceptedQty), 0),
                0
              )}
            </div>
            <p className="text-xs text-emerald-600/80 mt-1">Available for new rental dispatches</p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/30 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Damaged / Missing Recorded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {returnNotes.reduce(
                (acc, m) =>
                  acc +
                  m.items.reduce(
                    (sum: number, it: any) => sum + Number(it.damagedQty) + Number(it.missingQty),
                    0
                  ),
                0
              )}
            </div>
            <p className="text-xs text-amber-600/80 mt-1">Isolated for repairs or damage claims</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="border-slate-200">
        <CardContent className="pt-6">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search MRN #, customer, or site..."
              className="pl-9 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">MRN Number</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Construction Site</th>
                <th className="px-6 py-4">Receiving Yard</th>
                <th className="px-6 py-4">Return Date</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
                    Loading material return notes...
                  </td>
                </tr>
              ) : filteredMRNs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No material return notes found.
                  </td>
                </tr>
              ) : (
                filteredMRNs.map((mrn) => (
                  <tr key={mrn.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">
                      {mrn.mrnNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{mrn.customer?.name}</div>
                      <div className="text-xs text-slate-400">{mrn.customer?.customerCode}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {mrn.customerSite?.siteName}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {mrn.receivingWarehouse?.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(mrn.returnDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                        {mrn.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="text-xs h-7 px-3"
                      >
                        <a href={`/api/v1/return-notes/${mrn.id}/print`} target="_blank" rel="noopener noreferrer">
                          <Printer className="h-3.5 w-3.5 mr-1" />
                          Print MRN
                        </a>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CREATE MRN MODAL */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-[#F26522]" />
              Record Material Return Note (MRN)
            </DialogTitle>
            <DialogDescription>
              Inspection and physical stock return from site. Accepted items credit warehouse available stock; damaged items are isolated in damaged pool.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateMRN} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Customer *</Label>
                <SearchableCombobox
                  options={customers.map((c) => ({ value: c.id, label: `${c.name} (${c.customerCode})` }))}
                  value={mrnForm.customerId}
                  onChange={handleCustomerChange}
                  placeholder="Select Customer"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Returning Construction Site *</Label>
                <SearchableCombobox
                  options={sites.map((s) => ({ value: s.id, label: `${s.siteName} (${s.siteCode})` }))}
                  value={mrnForm.customerSiteId}
                  onChange={(val) => setMrnForm({ ...mrnForm, customerSiteId: val })}
                  placeholder={mrnForm.customerId ? "Select Construction Site" : "Select Customer First"}
                  disabled={!mrnForm.customerId}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Receiving Yard / Warehouse *</Label>
                <SearchableCombobox
                  options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.warehouseCode})` }))}
                  value={mrnForm.receivingWarehouseId}
                  onChange={(val) => setMrnForm({ ...mrnForm, receivingWarehouseId: val })}
                  placeholder="Select Receiving Yard"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Return Date *</Label>
                <Input
                  type="date"
                  value={mrnForm.returnDate}
                  onChange={(e) => setMrnForm({ ...mrnForm, returnDate: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Company Vehicle No. *</Label>
                <Input
                  value={mrnForm.vehicleNumber}
                  onChange={(e) => setMrnForm({ ...mrnForm, vehicleNumber: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Yard Receiver Name *</Label>
                <Input
                  value={mrnForm.receiverName}
                  onChange={(e) => setMrnForm({ ...mrnForm, receiverName: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Independent Return Date Option */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <input
                type="checkbox"
                id="includeReturnDate"
                checked={mrnForm.includeReturnDate}
                onChange={(e) => setMrnForm({ ...mrnForm, includeReturnDate: e.target.checked })}
                className="h-4 w-4 text-[#F26522] rounded border-slate-300"
              />
              <label htmlFor="includeReturnDate" className="font-medium text-slate-700 cursor-pointer">
                Include Return Date in Rental Billing calculation (Per Business Rule #12)
              </label>
            </div>

            {/* Returned Items Breakdown */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800">Returned Materials Inspection</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLine}
                  className="text-xs h-7"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Material
                </Button>
              </div>

              {mrnForm.items.map((item, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 md:col-span-5">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">Material Variant *</Label>
                      <SearchableCombobox
                        options={variants.map((v) => ({
                          value: v.id,
                          label: `${v.name} ${v.size ? `(${v.size})` : ""} - ${v.materialCode}`,
                        }))}
                        value={item.materialVariantId}
                        onChange={(val) => {
                          const updated = [...mrnForm.items];
                          updated[idx].materialVariantId = val;
                          setMrnForm({ ...mrnForm, items: updated });
                        }}
                        placeholder="Select Material"
                      />
                    </div>

                    <div className="col-span-4 md:col-span-2">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">Returned Qty *</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.001"
                        value={item.returnedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...mrnForm.items];
                          updated[idx].returnedQty = val;
                          updated[idx].acceptedQty = Math.max(0, val - updated[idx].damagedQty);
                          setMrnForm({ ...mrnForm, items: updated });
                        }}
                      />
                    </div>

                    <div className="col-span-4 md:col-span-2">
                      <Label className="text-[10px] text-emerald-600 uppercase font-bold">Accepted (Good)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={item.acceptedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...mrnForm.items];
                          updated[idx].acceptedQty = val;
                          setMrnForm({ ...mrnForm, items: updated });
                        }}
                      />
                    </div>

                    <div className="col-span-3 md:col-span-2">
                      <Label className="text-[10px] text-amber-600 uppercase font-bold">Damaged</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={item.damagedQty}
                        onChange={(e) => {
                          const dmg = parseFloat(e.target.value) || 0;
                          const updated = [...mrnForm.items];
                          updated[idx].damagedQty = dmg;
                          updated[idx].acceptedQty = Math.max(0, updated[idx].returnedQty - dmg);
                          setMrnForm({ ...mrnForm, items: updated });
                        }}
                      />
                    </div>

                    <div className="col-span-1 flex justify-center">
                      {mrnForm.items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-red-500 hover:text-red-700 h-9 w-9 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs font-semibold">General Remarks / Inspection Notes</Label>
              <Input
                placeholder="Remarks regarding batch or condition"
                value={mrnForm.remarks}
                onChange={(e) => setMrnForm({ ...mrnForm, remarks: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#0B1E36] text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Post Return Note & Update Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

