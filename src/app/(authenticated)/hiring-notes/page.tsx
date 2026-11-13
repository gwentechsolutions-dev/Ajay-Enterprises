"use client";

import * as React from "react";
import {
  Repeat,
  Plus,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  Factory,
  Warehouse as WarehouseIcon,
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

export default function HiringNotesPage() {
  const [activeTab, setActiveTab] = React.useState<"HDN" | "HRN">("HDN");
  const [hdns, setHdns] = React.useState<any[]>([]);
  const [hrns, setHrns] = React.useState<any[]>([]);
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [variants, setVariants] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  // Modals
  const [isHDNModalOpen, setIsHDNModalOpen] = React.useState(false);
  const [isHRNModalOpen, setIsHRNModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Forms
  const [hdnForm, setHdnForm] = React.useState({
    supplierId: "",
    receivingWarehouseId: "",
    receiptDate: new Date().toISOString().split("T")[0],
    supplierReference: "",
    notes: "",
    items: [
      {
        materialVariantId: "",
        quantity: 25,
        dailyHiringRate: 2.0,
        condition: "GOOD",
        remarks: "",
      },
    ],
  });

  const [hrnForm, setHrnForm] = React.useState({
    supplierId: "",
    sourceWarehouseId: "",
    returnDate: new Date().toISOString().split("T")[0],
    notes: "",
    items: [
      {
        materialVariantId: "",
        quantity: 25,
        condition: "GOOD",
        remarks: "",
      },
    ],
  });

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [hdnRes, hrnRes, supRes, whRes, varRes] = await Promise.all([
        fetch("/api/v1/hiring-notes/delivery"),
        fetch("/api/v1/hiring-notes/return"),
        fetch("/api/v1/suppliers"),
        fetch("/api/v1/warehouses"),
        fetch("/api/v1/materials/variants"),
      ]);

      const [hdnData, hrnData, supData, whData, varData] = await Promise.all([
        hdnRes.json(),
        hrnRes.json(),
        supRes.json(),
        whRes.json(),
        varRes.json(),
      ]);

      if (hdnData.success) setHdns(hdnData.data);
      if (hrnData.success) setHrns(hrnData.data);
      if (supData.success) setSuppliers(supData.data);
      if (whData.success) setWarehouses(whData.data);
      if (varData.success) setVariants(varData.data);
    } catch {
      toast.error("Failed to load hiring records.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateHDN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hdnForm.supplierId) return toast.error("Select supplier");
    if (!hdnForm.receivingWarehouseId) return toast.error("Select receiving yard");

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/hiring-notes/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hdnForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to post HDN");

      toast.success(`Hiring Delivery Note ${data.data.hdnNumber} posted! HIRED_IN stock credited.`);
      setIsHDNModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateHRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hrnForm.supplierId) return toast.error("Select supplier");
    if (!hrnForm.sourceWarehouseId) return toast.error("Select source yard");

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/hiring-notes/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hrnForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to post HRN");

      toast.success(`Hiring Return Note ${data.data.hrnNumber} posted! HIRED_IN stock deducted.`);
      setIsHRNModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Repeat className="h-7 w-7 text-[#F26522]" />
            Hired-In Material Operations (HDN & HRN)
          </h1>
          <p className="text-sm text-slate-500">
            Segregated third-party centering materials hired into AJAY ENTERPRISES yards (Ownership Pool: HIRED_IN)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsHDNModalOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white shadow-sm flex items-center gap-2"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Receive Hired-In (HDN)
          </Button>
          <Button
            onClick={() => setIsHRNModalOpen(true)}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Return Hired-In (HRN)
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab("HDN")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === "HDN"
              ? "border-[#F26522] text-[#F26522]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ArrowDownToLine className="h-4 w-4" />
          Hiring Delivery Notes ({hdns.length})
        </button>

        <button
          onClick={() => setActiveTab("HRN")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === "HRN"
              ? "border-[#F26522] text-[#F26522]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ArrowUpFromLine className="h-4 w-4" />
          Hiring Return Notes ({hrns.length})
        </button>
      </div>

      {/* Content */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === "HDN" ? (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">HDN Number</th>
                  <th className="px-6 py-4">Supplier / Owner</th>
                  <th className="px-6 py-4">Receiving Yard</th>
                  <th className="px-6 py-4">Receipt Date</th>
                  <th className="px-6 py-4">Items Received</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
                      Loading hiring receipts...
                    </td>
                  </tr>
                ) : hdns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      No Hiring Delivery Notes recorded.
                    </td>
                  </tr>
                ) : (
                  hdns.map((hdn) => (
                    <tr key={hdn.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-900">{hdn.hdnNumber}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{hdn.supplier?.name}</td>
                      <td className="px-6 py-4 text-slate-700">{hdn.receivingWarehouse?.name}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(hdn.receiptDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {hdn.items.length} materials ({hdn.items.reduce((s: number, i: any) => s + Number(i.quantity), 0)} units)
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                          {hdn.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">HRN Number</th>
                  <th className="px-6 py-4">Supplier / Owner</th>
                  <th className="px-6 py-4">Source Yard</th>
                  <th className="px-6 py-4">Return Date</th>
                  <th className="px-6 py-4">Items Returned</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
                      Loading hiring returns...
                    </td>
                  </tr>
                ) : hrns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      No Hiring Return Notes recorded.
                    </td>
                  </tr>
                ) : (
                  hrns.map((hrn) => (
                    <tr key={hrn.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-900">{hrn.hrnNumber}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{hrn.supplier?.name}</td>
                      <td className="px-6 py-4 text-slate-700">{hrn.sourceWarehouse?.name}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(hrn.returnDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {hrn.items.length} materials ({hrn.items.reduce((s: number, i: any) => s + Number(i.quantity), 0)} units)
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant="secondary" className="bg-sky-100 text-sky-800">
                          {hrn.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* CREATE HDN MODAL */}
      <Dialog open={isHDNModalOpen} onOpenChange={setIsHDNModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
              Receive Hired Material (HDN)
            </DialogTitle>
            <DialogDescription>
              Check-in hired centering material into company yard. Added to the segregated HIRED_IN stock pool.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateHDN} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Material Supplier / Owner *</Label>
                <SearchableCombobox
                  options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (${s.supplierCode})` }))}
                  value={hdnForm.supplierId}
                  onChange={(val) => setHdnForm({ ...hdnForm, supplierId: val })}
                  placeholder="Select Supplier"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Receiving Yard *</Label>
                <SearchableCombobox
                  options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.warehouseCode})` }))}
                  value={hdnForm.receivingWarehouseId}
                  onChange={(val) => setHdnForm({ ...hdnForm, receivingWarehouseId: val })}
                  placeholder="Select Yard"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Receipt Date *</Label>
                <Input
                  type="date"
                  value={hdnForm.receiptDate}
                  onChange={(e) => setHdnForm({ ...hdnForm, receiptDate: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Supplier DC / Challan Reference</Label>
                <Input
                  placeholder="e.g. DC-7621"
                  value={hdnForm.supplierReference}
                  onChange={(e) => setHdnForm({ ...hdnForm, supplierReference: e.target.value })}
                />
              </div>
            </div>

            {/* Line items */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase">Hired Materials</h4>
              {hdnForm.items.map((item, idx) => (
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
                        const updated = [...hdnForm.items];
                        updated[idx].materialVariantId = val;
                        setHdnForm({ ...hdnForm, items: updated });
                      }}
                      placeholder="Select Material"
                    />
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Qty *</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0.001"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...hdnForm.items];
                        updated[idx].quantity = parseFloat(e.target.value) || 0;
                        setHdnForm({ ...hdnForm, items: updated });
                      }}
                    />
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Hiring Rate/Day (₹)</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={item.dailyHiringRate}
                      onChange={(e) => {
                        const updated = [...hdnForm.items];
                        updated[idx].dailyHiringRate = parseFloat(e.target.value) || 0;
                        setHdnForm({ ...hdnForm, items: updated });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsHDNModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Post HDN & Credit HIRED_IN Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE HRN MODAL */}
      <Dialog open={isHRNModalOpen} onOpenChange={setIsHRNModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowUpFromLine className="h-5 w-5 text-sky-600" />
              Return Hired Material (HRN)
            </DialogTitle>
            <DialogDescription>
              Return hired material back to supplier. Deducts from HIRED_IN stock pool at source yard.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateHRN} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Material Supplier / Owner *</Label>
                <SearchableCombobox
                  options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (${s.supplierCode})` }))}
                  value={hrnForm.supplierId}
                  onChange={(val) => setHrnForm({ ...hrnForm, supplierId: val })}
                  placeholder="Select Supplier"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Source Yard *</Label>
                <SearchableCombobox
                  options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.warehouseCode})` }))}
                  value={hrnForm.sourceWarehouseId}
                  onChange={(val) => setHrnForm({ ...hrnForm, sourceWarehouseId: val })}
                  placeholder="Select Yard"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Return Date *</Label>
              <Input
                type="date"
                value={hrnForm.returnDate}
                onChange={(e) => setHrnForm({ ...hrnForm, returnDate: e.target.value })}
                required
              />
            </div>

            {/* Line items */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase">Materials to Return</h4>
              {hrnForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white p-2 rounded border border-slate-200">
                  <div className="col-span-12 md:col-span-8">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Material Variant *</Label>
                    <SearchableCombobox
                      options={variants.map((v) => ({
                        value: v.id,
                        label: `${v.name} ${v.size ? `(${v.size})` : ""} - ${v.materialCode}`,
                      }))}
                      value={item.materialVariantId}
                      onChange={(val) => {
                        const updated = [...hrnForm.items];
                        updated[idx].materialVariantId = val;
                        setHrnForm({ ...hrnForm, items: updated });
                      }}
                      placeholder="Select Material"
                    />
                  </div>

                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Return Qty *</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0.001"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...hrnForm.items];
                        updated[idx].quantity = parseFloat(e.target.value) || 0;
                        setHrnForm({ ...hrnForm, items: updated });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsHRNModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-sky-600 hover:bg-sky-700 text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Post HRN & Deduct Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

