"use client";

import * as React from "react";
import Link from "next/link";
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  FileText,
  Printer,
  Navigation,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Trash2,
  FileDigit,
  Send,
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

export default function DeliveryNotesPage() {
  const [deliveryNotes, setDeliveryNotes] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [variants, setVariants] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [isDeliverModalOpen, setIsDeliverModalOpen] = React.useState(false);
  const [isEwbModalOpen, setIsEwbModalOpen] = React.useState(false);
  const [selectedDN, setSelectedDN] = React.useState<any>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // New DN Form State
  const [dnForm, setDnForm] = React.useState({
    customerId: "",
    customerSiteId: "",
    sourceWarehouseId: "",
    deliveryDate: new Date().toISOString().split("T")[0],
    includeDeliveryDate: true,
    vehicleNumber: "KA-01-AB-1234",
    driverName: "",
    driverPhone: "",
    notes: "",
    items: [
      {
        materialVariantId: "",
        ownershipType: "OWNED" as "OWNED" | "HIRED_IN",
        dispatchedQty: 50,
        dailyRentalRate: 2.5,
        remarks: "",
      },
    ],
  });

  // Delivery & Acknowledgement Form
  const [deliverForm, setDeliverForm] = React.useState({
    receiverName: "",
    receiverPhone: "",
    receiverDesignation: "Site Engineer",
    photoUrl: "https://storage.inventra.app/proofs/delivery-default.jpg",
    gpsLatitude: 12.9716,
    gpsLongitude: 77.5946,
    gpsAccuracy: 5.0,
    receiverSignatureUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNDAiPjxwYXRoIGQ9Ik0xMCwyMCBRNDAsNSA5MCwyMCIgc3Ryb2tlPSJibGFjayIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==",
    remarks: "Delivered in good condition and unloaded at site.",
  });

  // E-Way Bill Form
  const [ewbForm, setEwbForm] = React.useState({
    vehicleNumber: "",
    fromPincode: "560001",
    toPincode: "560068",
    distanceKm: 25,
  });

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [dnRes, custRes, whRes, varRes] = await Promise.all([
        fetch("/api/v1/delivery-notes"),
        fetch("/api/v1/customers"),
        fetch("/api/v1/warehouses"),
        fetch("/api/v1/materials/variants"),
      ]);

      const [dnData, custData, whData, varData] = await Promise.all([
        dnRes.json(),
        custRes.json(),
        whRes.json(),
        varRes.json(),
      ]);

      if (dnData.success) setDeliveryNotes(dnData.data);
      if (custData.success) setCustomers(custData.data);
      if (whData.success) setWarehouses(whData.data);
      if (varData.success) setVariants(varData.data);
    } catch {
      toast.error("Failed to load delivery notes.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Load sites when customer changes
  const handleCustomerChange = async (customerId: string) => {
    setDnForm((prev) => ({ ...prev, customerId, customerSiteId: "" }));
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
          setDnForm((prev) => ({ ...prev, customerSiteId: data.data[0].id }));
        }
      }
    } catch {
      toast.error("Failed to load customer sites");
    }
  };

  const handleAddLine = () => {
    setDnForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          materialVariantId: "",
          ownershipType: "OWNED",
          dispatchedQty: 50,
          dailyRentalRate: 2.5,
          remarks: "",
        },
      ],
    }));
  };

  const handleRemoveLine = (idx: number) => {
    setDnForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleCreateDN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dnForm.customerId) return toast.error("Please select a customer");
    if (!dnForm.customerSiteId) return toast.error("Please select a construction site");
    if (!dnForm.sourceWarehouseId) return toast.error("Please select dispatch yard");
    if (dnForm.items.some((i) => !i.materialVariantId || i.dispatchedQty <= 0)) {
      return toast.error("Ensure all items have a variant and dispatched quantity > 0");
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/delivery-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...dnForm,
          items: dnForm.items.map((it) => ({
            materialVariantId: it.materialVariantId,
            quantity: Number(it.dispatchedQty),
            ownershipType: it.ownershipType,
            dailyRate: Number(it.dailyRentalRate),
            remarks: it.remarks || undefined,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create Delivery Note");

      toast.success(`Delivery Note ${data.data.dnNumber} created!`);
      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatch = async (dnId: string, dnNumber: string) => {
    if (!confirm(`Dispatch Delivery Note ${dnNumber}? This will deduct warehouse stock and start site custody.`)) return;

    try {
      const res = await fetch(`/api/v1/delivery-notes/${dnId}/dispatch`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to dispatch Delivery Note");

      toast.success(`Delivery Note ${dnNumber} marked DISPATCHED! Stock deducted.`);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openDeliverModal = (dn: any) => {
    setSelectedDN(dn);
    setDeliverForm({
      receiverName: dn.customerSite?.siteInCharge || "",
      receiverPhone: dn.customerSite?.siteContactDetails || "",
      receiverDesignation: "Site In-Charge",
      photoUrl: "https://storage.inventra.app/proofs/delivery-proof.jpg",
      gpsLatitude: 12.9716,
      gpsLongitude: 77.5946,
      gpsAccuracy: 5.0,
      receiverSignatureUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNDAiPjxwYXRoIGQ9Ik0xMCwyMCBRNDAsNSA5MCwyMCIgc3Ryb2tlPSJibGFjayIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==",
      remarks: "Unloaded and physically verified at site.",
    });
    setIsDeliverModalOpen(true);
  };

  const handleCompleteDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDN) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/delivery-notes/${selectedDN.id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deliverForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to deliver note");

      toast.success(`Delivery Note ${selectedDN.dnNumber} marked DELIVERED with receiver acknowledgement!`);
      setIsDeliverModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEwbModal = (dn: any) => {
    setSelectedDN(dn);
    setEwbForm({
      vehicleNumber: dn.vehicleNumber || "KA-01-AB-1234",
      fromPincode: "560001",
      toPincode: "560068",
      distanceKm: 30,
    });
    setIsEwbModalOpen(true);
  };

  const handleGenerateEWB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDN) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/ewaybills/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: "DELIVERY_NOTE",
          documentId: selectedDN.id,
          ...ewbForm,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to generate E-Way Bill");

      toast.success(`E-Way Bill ${data.data.ewbNumber} generated via FYN Gateway!`);
      setIsEwbModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDNs = deliveryNotes.filter((dn) => {
    const matchesSearch =
      dn.dnNumber.toLowerCase().includes(search.toLowerCase()) ||
      dn.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      dn.customerSite?.siteName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || dn.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Truck className="h-7 w-7 text-[#F26522]" />
            Delivery Notes (DN)
          </h1>
          <p className="text-sm text-slate-500">
            Outward centering material custody transfer from AJAY ENTERPRISES yards to customer construction sites
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white shadow-sm flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Delivery Note
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Delivery Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{deliveryNotes.length}</div>
            <p className="text-xs text-slate-400 mt-1">Dispatches to date</p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/30 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Draft / Pending Loading
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {deliveryNotes.filter((d) => d.status === "DRAFT").length}
            </div>
            <p className="text-xs text-amber-600/80 mt-1">Ready for dispatch</p>
          </CardContent>
        </Card>

        <Card className="border-sky-100 bg-sky-50/30 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-sky-700 uppercase tracking-wider">
              In Transit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-700">
              {deliveryNotes.filter((d) => d.status === "DISPATCHED").length}
            </div>
            <p className="text-xs text-sky-600/80 mt-1">En route to customer site</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/30 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Delivered & Acknowledged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {deliveryNotes.filter((d) => d.status === "DELIVERED").length}
            </div>
            <p className="text-xs text-emerald-600/80 mt-1">Site custody active</p>
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
                placeholder="Search DN #, customer, or site..."
                className="pl-9 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-medium text-slate-500">Status:</span>
              <div className="flex flex-wrap gap-1">
                {["ALL", "DRAFT", "DISPATCHED", "DELIVERED"].map((st) => (
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

      {/* Delivery Notes Table */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">DN Number</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Construction Site</th>
                <th className="px-6 py-4">Source Yard</th>
                <th className="px-6 py-4">Dispatch Date</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
                    Loading delivery notes...
                  </td>
                </tr>
              ) : filteredDNs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No delivery notes found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredDNs.map((dn) => (
                  <tr key={dn.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">
                      {dn.dnNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{dn.customer?.name}</div>
                      <div className="text-xs text-slate-400">{dn.customer?.customerCode}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      <div className="font-medium text-slate-900">{dn.customerSite?.siteName}</div>
                      <div className="text-xs text-slate-400 truncate max-w-xs">
                        {dn.customerSite?.fullAddress || "Site location"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {dn.sourceWarehouse?.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(dn.deliveryDate || dn.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge
                        variant="secondary"
                        className={
                          dn.status === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800"
                            : dn.status === "DISPATCHED"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-amber-100 text-amber-800"
                        }
                      >
                        {dn.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                      {/* Print Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="text-xs h-7 px-2"
                      >
                        <a href={`/api/v1/delivery-notes/${dn.id}/print`} target="_blank" rel="noopener noreferrer">
                          <Printer className="h-3.5 w-3.5 mr-1" />
                          Print
                        </a>
                      </Button>

                      {/* E-Way Bill */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEwbModal(dn)}
                        className="text-xs h-7 px-2"
                      >
                        <FileDigit className="h-3.5 w-3.5 mr-1" />
                        E-Way Bill
                      </Button>

                      {/* Dispatch Action */}
                      {dn.status === "DRAFT" ? (
                        <Button
                          size="sm"
                          onClick={() => handleDispatch(dn.id, dn.dnNumber)}
                          className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white text-xs h-7 px-3"
                        >
                          Dispatch
                        </Button>
                      ) : null}

                      {/* Deliver Action */}
                      {dn.status === "DISPATCHED" ? (
                        <Button
                          size="sm"
                          onClick={() => openDeliverModal(dn)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3 inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Deliver
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

      {/* CREATE DELIVERY NOTE MODAL */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#F26522]" />
              Create Delivery Note (DN)
            </DialogTitle>
            <DialogDescription>
              Material custody transfer note for centering equipment dispatched to customer construction site.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDN} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Customer *</Label>
                <SearchableCombobox
                  options={customers.map((c) => ({ value: c.id, label: `${c.name} (${c.customerCode})` }))}
                  value={dnForm.customerId}
                  onChange={handleCustomerChange}
                  placeholder="Select Customer"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Construction Site *</Label>
                <SearchableCombobox
                  options={sites.map((s) => ({ value: s.id, label: `${s.siteName} (${s.siteCode})` }))}
                  value={dnForm.customerSiteId}
                  onChange={(val) => setDnForm({ ...dnForm, customerSiteId: val })}
                  placeholder={dnForm.customerId ? "Select Construction Site" : "Select Customer First"}
                  disabled={!dnForm.customerId}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Source Yard / Warehouse *</Label>
                <SearchableCombobox
                  options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.warehouseCode})` }))}
                  value={dnForm.sourceWarehouseId}
                  onChange={(val) => setDnForm({ ...dnForm, sourceWarehouseId: val })}
                  placeholder="Select Dispatch Yard"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs font-semibold">Delivery / Dispatch Date *</Label>
                <Input
                  type="date"
                  value={dnForm.deliveryDate}
                  onChange={(e) => setDnForm({ ...dnForm, deliveryDate: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Company Vehicle No. *</Label>
                <Input
                  placeholder="KA-01-AB-1234"
                  value={dnForm.vehicleNumber}
                  onChange={(e) => setDnForm({ ...dnForm, vehicleNumber: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Driver Name</Label>
                <Input
                  placeholder="e.g. Ramesh Kumar"
                  value={dnForm.driverName}
                  onChange={(e) => setDnForm({ ...dnForm, driverName: e.target.value })}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Driver Phone</Label>
                <Input
                  placeholder="9876543210"
                  value={dnForm.driverPhone}
                  onChange={(e) => setDnForm({ ...dnForm, driverPhone: e.target.value })}
                />
              </div>
            </div>

            {/* Independent Billing Option */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <input
                type="checkbox"
                id="includeDeliveryDate"
                checked={dnForm.includeDeliveryDate}
                onChange={(e) => setDnForm({ ...dnForm, includeDeliveryDate: e.target.checked })}
                className="h-4 w-4 text-[#F26522] rounded border-slate-300"
              />
              <label htmlFor="includeDeliveryDate" className="font-medium text-slate-700 cursor-pointer">
                Include Delivery Date in Rental Billing calculation (Per Business Rule #12)
              </label>
            </div>

            {/* Material Items */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800">Dispatched Materials</h4>
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

              {dnForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white p-2.5 rounded border border-slate-200">
                  <div className="col-span-12 md:col-span-5">
                    <Label className="text-[10px] text-slate-500 uppercase font-bold">Material Variant *</Label>
                    <SearchableCombobox
                      options={variants.map((v) => ({
                        value: v.id,
                        label: `${v.name} ${v.size ? `(${v.size})` : ""} - ${v.materialCode}`,
                      }))}
                      value={item.materialVariantId}
                      onChange={(val) => {
                        const updated = [...dnForm.items];
                        updated[idx].materialVariantId = val;
                        const v = variants.find((x) => x.id === val);
                        if (v && v.rentalRate) updated[idx].dailyRentalRate = Number(v.rentalRate);
                        setDnForm({ ...dnForm, items: updated });
                      }}
                      placeholder="Select Material"
                    />
                  </div>

                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-[10px] text-slate-500 uppercase font-bold">Pool *</Label>
                    <SearchableCombobox
                      options={[
                        { value: "OWNED", label: "OWNED" },
                        { value: "HIRED_IN", label: "HIRED_IN" },
                      ]}
                      value={item.ownershipType}
                      onChange={(val) => {
                        const updated = [...dnForm.items];
                        updated[idx].ownershipType = val as "OWNED" | "HIRED_IN";
                        setDnForm({ ...dnForm, items: updated });
                      }}
                    />
                  </div>

                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-[10px] text-slate-500 uppercase font-bold">Dispatch Qty *</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0.001"
                      value={item.dispatchedQty}
                      onChange={(e) => {
                        const updated = [...dnForm.items];
                        updated[idx].dispatchedQty = parseFloat(e.target.value) || 0;
                        setDnForm({ ...dnForm, items: updated });
                      }}
                    />
                  </div>

                  <div className="col-span-3 md:col-span-2">
                    <Label className="text-[10px] text-slate-500 uppercase font-bold">Daily Rate (₹)</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={item.dailyRentalRate}
                      onChange={(e) => {
                        const updated = [...dnForm.items];
                        updated[idx].dailyRentalRate = parseFloat(e.target.value) || 0;
                        setDnForm({ ...dnForm, items: updated });
                      }}
                    />
                  </div>

                  <div className="col-span-1 flex justify-center">
                    {dnForm.items.length > 1 && (
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
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#0B1E36] text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Delivery Note
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELIVER & SITE ACKNOWLEDGEMENT MODAL */}
      <Dialog open={isDeliverModalOpen} onOpenChange={setIsDeliverModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Site Delivery & Receiver Acknowledgement
            </DialogTitle>
            <DialogDescription>
              Complete custody transfer for {selectedDN?.dnNumber} at {selectedDN?.customerSite?.siteName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCompleteDelivery} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Receiver Full Name *</Label>
                <Input
                  value={deliverForm.receiverName}
                  onChange={(e) => setDeliverForm({ ...deliverForm, receiverName: e.target.value })}
                  placeholder="e.g. Suresh Kumar"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Receiver Mobile *</Label>
                <Input
                  value={deliverForm.receiverPhone}
                  onChange={(e) => setDeliverForm({ ...deliverForm, receiverPhone: e.target.value })}
                  placeholder="9876543210"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Designation</Label>
                <Input
                  value={deliverForm.receiverDesignation}
                  onChange={(e) => setDeliverForm({ ...deliverForm, receiverDesignation: e.target.value })}
                  placeholder="Site Supervisor / Engineer"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">GPS Coordinates (Auto-captured)</Label>
                <Input
                  disabled
                  value={`${deliverForm.gpsLatitude}, ${deliverForm.gpsLongitude} (±${deliverForm.gpsAccuracy}m)`}
                  className="bg-slate-100 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Delivery Proof Photo URL</Label>
              <Input
                value={deliverForm.photoUrl}
                onChange={(e) => setDeliverForm({ ...deliverForm, photoUrl: e.target.value })}
                placeholder="https://..."
                required
              />
              <p className="text-[11px] text-slate-400 mt-0.5">
                Timestamped site photograph with GPS watermark stored in Supabase private storage.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold">Receiver Notes / Remarks</Label>
              <Input
                value={deliverForm.remarks}
                onChange={(e) => setDeliverForm({ ...deliverForm, remarks: e.target.value })}
                placeholder="Unloading remarks"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDeliverModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Confirm Delivery & Lock Custody
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* GENERATE E-WAY BILL MODAL */}
      <Dialog open={isEwbModalOpen} onOpenChange={setIsEwbModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileDigit className="h-5 w-5 text-[#F26522]" />
              Generate Statutory E-Way Bill
            </DialogTitle>
            <DialogDescription>
              Dispatches statutory E-Way Bill request to FYN Gateway for {selectedDN?.dnNumber}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerateEWB} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold">Vehicle Number *</Label>
              <Input
                value={ewbForm.vehicleNumber}
                onChange={(e) => setEwbForm({ ...ewbForm, vehicleNumber: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Source Pincode *</Label>
                <Input
                  value={ewbForm.fromPincode}
                  onChange={(e) => setEwbForm({ ...ewbForm, fromPincode: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Destination Pincode *</Label>
                <Input
                  value={ewbForm.toPincode}
                  onChange={(e) => setEwbForm({ ...ewbForm, toPincode: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Transport Distance (KM) *</Label>
              <Input
                type="number"
                min="1"
                value={ewbForm.distanceKm}
                onChange={(e) => setEwbForm({ ...ewbForm, distanceKm: parseInt(e.target.value) || 1 })}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEwbModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#0B1E36] text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Generate via FYN Gateway
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

