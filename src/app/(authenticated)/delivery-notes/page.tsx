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
  Copy,
  Check,
  AlertTriangle,
  Pencil,
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
import { TableSkeleton } from "@/components/ui/loading-states";
import { fetchWithClientCache, invalidateClientCache } from "@/lib/client-cache";
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
  const [isDispatchModalOpen, setIsDispatchModalOpen] = React.useState(false);
  const [dispatchTarget, setDispatchTarget] = React.useState<any>(null);
  const [dispatching, setDispatching] = React.useState(false);
  const [selectedDN, setSelectedDN] = React.useState<any>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [editingDnId, setEditingDnId] = React.useState<string | null>(null);

  // Dispatch stock check state
  const [dispatchYardId, setDispatchYardId] = React.useState("");
  const [stockBalances, setStockBalances] = React.useState<any[]>([]);
  const [loadingBalances, setLoadingBalances] = React.useState(false);
  const [yardStocks, setYardStocks] = React.useState<Record<string, number>>({});

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

  const loadData = React.useCallback(async (forceRefresh = false) => {
    try {
      const [dnData, custData, whData, varData] = await Promise.all([
        fetchWithClientCache("/api/v1/delivery-notes", {
          forceRefresh,
          onBackgroundUpdate: (fresh) => setDeliveryNotes(Array.isArray(fresh) ? fresh : []),
        }),
        fetchWithClientCache("/api/v1/customers", {
          forceRefresh,
          onBackgroundUpdate: (fresh) => setCustomers(Array.isArray(fresh) ? fresh : []),
        }),
        fetchWithClientCache("/api/v1/warehouses", {
          forceRefresh,
          ttlMs: 60_000,
          onBackgroundUpdate: (fresh) => setWarehouses(Array.isArray(fresh) ? fresh : []),
        }),
        fetchWithClientCache("/api/v1/materials/variants", {
          forceRefresh,
          ttlMs: 60_000,
          onBackgroundUpdate: (fresh) => setVariants(Array.isArray(fresh) ? fresh : []),
        }),
      ]);

      if (dnData) setDeliveryNotes(Array.isArray(dnData) ? dnData : []);
      if (custData) setCustomers(Array.isArray(custData) ? custData : []);
      if (whData && Array.isArray(whData)) {
        setWarehouses(whData);
        setDnForm((prev) => {
          if (prev.sourceWarehouseId) return prev;
          const mainYard = whData.find((w: any) => w.warehouseType === "MAIN_YARD") || whData[0];
          return mainYard ? { ...prev, sourceWarehouseId: mainYard.id } : prev;
        });
      }
      if (varData) setVariants(Array.isArray(varData) ? varData : []);
    } catch {
      toast.error("Failed to load delivery notes.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stock balances for selected source yard in Create/Edit form
  React.useEffect(() => {
    if (!dnForm.sourceWarehouseId) return;
    async function fetchYardStock() {
      try {
        const res = await fetch(`/api/v1/inventory/stock-balances?warehouseId=${dnForm.sourceWarehouseId}&locationType=WAREHOUSE`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const map: Record<string, number> = {};
          for (const b of data.data) {
            map[b.materialVariantId] = (map[b.materialVariantId] || 0) + Number(b.availableQty);
          }
          setYardStocks(map);
        }
      } catch {
        // ignore
      }
    }
    fetchYardStock();
  }, [dnForm.sourceWarehouseId]);

  React.useEffect(() => {
    loadData();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "new") {
        setIsCreateModalOpen(true);
      }
    }
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
      const url = editingDnId ? `/api/v1/delivery-notes/${editingDnId}` : "/api/v1/delivery-notes";
      const method = editingDnId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
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
      if (!res.ok) throw new Error(data.error?.message || `Failed to ${editingDnId ? "update" : "create"} Delivery Note`);

      toast.success(`Delivery Note ${data.data.dnNumber} ${editingDnId ? "updated" : "created"}!`);
      setIsCreateModalOpen(false);
      setEditingDnId(null);
      invalidateClientCache("/api/v1/delivery-notes");
      loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = async (dn: any) => {
    setEditingDnId(dn.id);
    setDnForm({
      customerId: dn.customerId,
      customerSiteId: dn.customerSiteId,
      sourceWarehouseId: dn.sourceWarehouseId,
      deliveryDate: dn.deliveryDate ? dn.deliveryDate.split("T")[0] : new Date().toISOString().split("T")[0],
      includeDeliveryDate: dn.includeDeliveryDate ?? true,
      vehicleNumber: dn.vehicleNumber || "KA-01-AB-1234",
      driverName: dn.driverName || "",
      driverPhone: dn.driverPhone || "",
      notes: dn.notes || "",
      items: dn.items.map((it: any) => ({
        materialVariantId: it.materialVariantId,
        ownershipType: it.ownershipType,
        dispatchedQty: Number(it.quantity),
        dailyRentalRate: Number(it.dailyRate || 0),
        remarks: it.remarks || "",
      })),
    });

    if (dn.customerId) {
      try {
        const res = await fetch(`/api/v1/customers/${dn.customerId}/sites`);
        const data = await res.json();
        if (data.success) {
          setSites(data.data);
        }
      } catch {
        // ignore
      }
    }

    setIsCreateModalOpen(true);
  };

  const handleDiscardDraft = async (dn: any) => {
    if (!confirm(`Are you sure you want to discard draft Delivery Note ${dn.dnNumber}?`)) return;
    try {
      const res = await fetch(`/api/v1/delivery-notes/${dn.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to discard draft");
      toast.success(`Draft Delivery Note ${dn.dnNumber} discarded.`);
      invalidateClientCache("/api/v1/delivery-notes");
      loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleOpenDispatch = async (dn: any) => {
    setDispatchTarget(dn);
    setDispatchYardId(dn.sourceWarehouseId || "");
    setIsDispatchModalOpen(true);
    try {
      setLoadingBalances(true);
      const res = await fetch("/api/v1/inventory/stock-balances?locationType=WAREHOUSE");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setStockBalances(data.data);
      }
    } catch {
      // non-blocking
    } finally {
      setLoadingBalances(false);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchTarget) return;

    try {
      setDispatching(true);

      // If source yard was switched in the dispatch modal, update the draft Delivery Note first
      if (dispatchYardId && dispatchYardId !== dispatchTarget.sourceWarehouseId) {
        const patchRes = await fetch(`/api/v1/delivery-notes/${dispatchTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceWarehouseId: dispatchYardId }),
        });
        const patchData = await patchRes.json();
        if (!patchRes.ok) {
          throw new Error(patchData.error?.message || "Failed to update source yard on Delivery Note");
        }
      }

      const res = await fetch(`/api/v1/delivery-notes/${dispatchTarget.id}/dispatch`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to dispatch Delivery Note");

      toast.success(`Delivery Note ${dispatchTarget.dnNumber} marked DISPATCHED! Stock deducted.`);
      setIsDispatchModalOpen(false);
      setDispatchTarget(null);
      invalidateClientCache("/api/v1/delivery-notes");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDispatching(false);
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
      invalidateClientCache("/api/v1/delivery-notes");
      loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const [showRegenerateForm, setShowRegenerateForm] = React.useState(false);
  const [copiedEwb, setCopiedEwb] = React.useState(false);

  const openEwbModal = (dn: any) => {
    setSelectedDN(dn);
    setShowRegenerateForm(!dn.eWayBillNumber);
    setCopiedEwb(false);
    const latestEwb = dn.eWayBills?.[0];
    setEwbForm({
      vehicleNumber: latestEwb?.vehicleNumber || dn.vehicleNumber || "KA-01-AB-1234",
      fromPincode: latestEwb?.fromPincode || "560001",
      toPincode: latestEwb?.toPincode || "560068",
      distanceKm: latestEwb?.distanceKm || 30,
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
      setShowRegenerateForm(false);
      setSelectedDN(null);
      invalidateClientCache("/api/v1/delivery-notes");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDNs = (deliveryNotes || []).filter((dn) => {
    if (!dn) return false;
    const dnNum = dn.dnNumber || "";
    const custName = dn.customer?.name || "";
    const siteName = dn.customerSite?.siteName || "";
    const q = (search || "").toLowerCase();

    const matchesSearch =
      dnNum.toLowerCase().includes(q) ||
      custName.toLowerCase().includes(q) ||
      siteName.toLowerCase().includes(q);
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
                <TableSkeleton columns={7} rows={6} />
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
                      <div>{dn.dnNumber}</div>
                      {dn.eWayBillNumber ? (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => openEwbModal(dn)}
                            title={`Click to view E-Way Bill ${dn.eWayBillNumber}`}
                            className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <FileDigit className="h-3 w-3 text-blue-600" />
                            EWB: {dn.eWayBillNumber}
                          </button>
                        </div>
                      ) : null}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Print Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="text-xs h-7 px-2.5 inline-flex items-center gap-1 font-medium text-slate-700"
                        >
                          <a href={`/api/v1/delivery-notes/${dn.id}/print`} target="_blank" rel="noopener noreferrer">
                            <Printer className="h-3.5 w-3.5" />
                            <span>Print</span>
                          </a>
                        </Button>

                        {/* E-Way Bill */}
                        <Button
                          size="sm"
                          variant={dn.eWayBillNumber ? "secondary" : "outline"}
                          onClick={() => openEwbModal(dn)}
                          className={`text-xs h-7 px-2.5 inline-flex items-center gap-1 font-medium ${
                            dn.eWayBillNumber
                              ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                              : "text-slate-700"
                          }`}
                        >
                          <FileDigit className="h-3.5 w-3.5" />
                          <span>{dn.eWayBillNumber ? "View EWB" : "E-Way Bill"}</span>
                        </Button>

                        {/* Edit Action for DRAFT */}
                        {dn.status === "DRAFT" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(dn)}
                            className="text-xs h-7 px-2.5 inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900"
                            title="Edit Draft Delivery Note"
                          >
                            <Pencil className="h-3.5 w-3.5 text-slate-500" />
                            <span>Edit</span>
                          </Button>
                        ) : null}

                        {/* Dispatch Action */}
                        {dn.status === "DRAFT" ? (
                          <Button
                            size="sm"
                            onClick={() => handleOpenDispatch(dn)}
                            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs h-7 px-2.5 inline-flex items-center gap-1 font-medium shadow-sm"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Dispatch</span>
                          </Button>
                        ) : null}

                        {/* Discard Action for DRAFT */}
                        {dn.status === "DRAFT" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDiscardDraft(dn)}
                            className="text-xs h-7 px-2 inline-flex items-center text-red-500 hover:bg-red-50 hover:text-red-700"
                            title="Discard Draft Delivery Note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}

                        {/* Deliver Action */}
                        {dn.status === "DISPATCHED" ? (
                          <Button
                            size="sm"
                            onClick={() => openDeliverModal(dn)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 inline-flex items-center gap-1 font-medium shadow-sm"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Deliver</span>
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

      {/* CREATE / EDIT DELIVERY NOTE MODAL */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => { setIsCreateModalOpen(open); if (!open) setEditingDnId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#F26522]" />
              {editingDnId ? "Edit Delivery Note (DN)" : "Create Delivery Note (DN)"}
            </DialogTitle>
            <DialogDescription>
              {editingDnId
                ? "Update customer, site, source yard, or material line items for this draft delivery note."
                : "Material custody transfer note for centering equipment dispatched to customer construction site."}
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
                      options={variants.map((v) => {
                        const stock = yardStocks[v.id] ?? 0;
                        return {
                          value: v.id,
                          label: `${v.name} ${v.size ? `(${v.size})` : ""} - ${v.materialCode} [${stock > 0 ? `${stock} in yard` : "0 in yard"}]`,
                        };
                      })}
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

                  {item.materialVariantId && (
                    <div className="col-span-12 flex items-center justify-between text-[11px] pt-1 px-1 bg-slate-50/50 rounded">
                      <span className="text-slate-500">
                        Available in selected yard:{" "}
                        <strong className={(yardStocks[item.materialVariantId] ?? 0) >= item.dispatchedQty ? "text-emerald-700 font-mono" : "text-red-600 font-mono"}>
                          {yardStocks[item.materialVariantId] ?? 0} {variants.find((v) => v.id === item.materialVariantId)?.uom || "Nos."}
                        </strong>
                      </span>
                      {(yardStocks[item.materialVariantId] ?? 0) < item.dispatchedQty && (
                        <span className="text-amber-700 font-medium">
                          ⚠️ Insufficient stock in this yard for requested quantity ({item.dispatchedQty})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={submitting}
                loadingText={editingDnId ? "Saving Changes..." : "Saving Delivery Note..."}
                className="bg-[#0B1E36] text-white"
              >
                {editingDnId ? "Save Changes" : "Create Delivery Note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELIVER & SITE ACKNOWLEDGEMENT MODAL */}
      <Dialog open={isDeliverModalOpen} onOpenChange={setIsDeliverModalOpen}>
        <DialogContent className="max-w-xl overflow-x-hidden">
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
              <Button
                type="submit"
                isLoading={submitting}
                loadingText="Confirming Delivery..."
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Confirm Delivery & Lock Custody
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* E-WAY BILL MODAL (VIEW OR GENERATE) */}
      <Dialog open={isEwbModalOpen} onOpenChange={setIsEwbModalOpen}>
        <DialogContent className="max-w-lg sm:max-w-xl overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileDigit className="h-5 w-5 text-[#F26522]" />
              {selectedDN?.eWayBillNumber && !showRegenerateForm ? "Statutory E-Way Bill Details" : "Generate Statutory E-Way Bill"}
            </DialogTitle>
            <DialogDescription>
              {selectedDN?.eWayBillNumber && !showRegenerateForm
                ? `Active E-Way Bill issued via FYN Gateway for ${selectedDN?.dnNumber}.`
                : `Dispatches statutory E-Way Bill request to FYN Gateway for ${selectedDN?.dnNumber}.`}
            </DialogDescription>
          </DialogHeader>

          {selectedDN?.eWayBillNumber && !showRegenerateForm ? (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">E-Way Bill Number</span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-medium">
                    ACTIVE / VERIFIED
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-mono text-xl font-bold text-[#0B1E36] tracking-wider">
                    {selectedDN.eWayBillNumber}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (selectedDN?.eWayBillNumber) {
                        navigator.clipboard.writeText(selectedDN.eWayBillNumber);
                        setCopiedEwb(true);
                        setTimeout(() => setCopiedEwb(false), 2000);
                        toast.success("E-Way Bill number copied to clipboard!");
                      }
                    }}
                    className="h-8 px-2 text-slate-500 hover:text-slate-800"
                  >
                    {copiedEwb ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-600 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Vehicle Number</span>
                    <span className="font-semibold font-mono">{selectedDN.vehicleNumber || ewbForm.vehicleNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Delivery Note</span>
                    <span className="font-semibold font-mono">{selectedDN.dnNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Route</span>
                    <span>{ewbForm.fromPincode} &rarr; {ewbForm.toPincode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Distance</span>
                    <span>{ewbForm.distanceKm} KM</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  asChild
                  className="w-full bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white flex items-center justify-center gap-2"
                >
                  <a href={`/api/v1/delivery-notes/${selectedDN.id}/print`} target="_blank" rel="noopener noreferrer">
                    <Printer className="w-4 h-4" />
                    Open Printable Delivery Note (with E-Way Bill)
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRegenerateForm(true)}
                  className="w-full text-xs text-slate-600 border-slate-300"
                >
                  Update Vehicle / Re-generate E-Way Bill
                </Button>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEwbModalOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : (
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

              <DialogFooter className="flex-col sm:flex-row items-center sm:justify-end gap-2 pt-2">
                {selectedDN?.eWayBillNumber ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowRegenerateForm(false)}
                    className="w-full sm:w-auto sm:mr-auto text-xs text-slate-600"
                  >
                    &larr; Back to Details
                  </Button>
                ) : null}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEwbModalOpen(false)}
                    className="w-full sm:w-auto text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isLoading={submitting}
                    loadingText="Generating E-Way Bill..."
                    className="w-full sm:w-auto bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    Generate via FYN Gateway
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* IN-APP DISPATCH CONFIRMATION MODAL */}
      <Dialog open={isDispatchModalOpen} onOpenChange={setIsDispatchModalOpen}>
        <DialogContent className="max-w-lg sm:max-w-xl overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B1E36] flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#F26522]" />
              Confirm Material Dispatch
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Transfer custody of centering materials from yard to customer construction site.
            </DialogDescription>
          </DialogHeader>

          {dispatchTarget && (() => {
            // Check sufficiency for each line item
            const itemStatuses = dispatchTarget.items.map((it: any) => {
              const itemVariantId = it.materialVariantId || it.materialVariant?.id;
              const itemOwnership = it.ownershipType || "OWNED";
              const requestedQty = Number(it.quantity);

              const balanceRecord = stockBalances.find(
                (b) =>
                  b.warehouseId === dispatchYardId &&
                  b.materialVariantId === itemVariantId &&
                  b.ownershipType === itemOwnership
              );
              const availInSelected = balanceRecord ? Number(balanceRecord.availableQty) : 0;
              const isSufficient = availInSelected >= requestedQty;

              const alternatives = stockBalances
                .filter(
                  (b) =>
                    b.warehouseId !== dispatchYardId &&
                    b.materialVariantId === itemVariantId &&
                    b.ownershipType === itemOwnership &&
                    Number(b.availableQty) >= requestedQty
                )
                .map((b) => ({
                  warehouseId: b.warehouseId,
                  warehouseName: b.warehouse?.name || "Another Yard",
                  availableQty: Number(b.availableQty),
                }));

              return {
                ...it,
                requestedQty,
                availInSelected,
                isSufficient,
                alternatives,
              };
            });

            const allSufficient = itemStatuses.every((s: any) => s.isSufficient);

            return (
              <div className="space-y-3 pt-2 text-xs">
                {/* Delivery Note Info Header */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Document #:</span>
                    <span className="font-bold text-slate-900">{dispatchTarget.dnNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Customer:</span>
                    <span className="font-semibold text-slate-800">{dispatchTarget.customer?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Construction Site:</span>
                    <span className="text-slate-700">{dispatchTarget.customerSite?.siteName}</span>
                  </div>
                  {dispatchTarget.vehicleNumber && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Vehicle:</span>
                      <span className="text-slate-700">{dispatchTarget.vehicleNumber}</span>
                    </div>
                  )}
                </div>

                {/* Dispatch Yard Selector */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Source Dispatch Yard *</span>
                    {dispatchYardId !== dispatchTarget.sourceWarehouseId && (
                      <span className="text-[10px] text-[#F26522] font-semibold">
                        (Will switch Delivery Note yard on dispatch)
                      </span>
                    )}
                  </Label>
                  <SearchableCombobox
                    options={warehouses.map((w) => {
                      const yardSufficient = dispatchTarget.items.every((it: any) => {
                        const rec = stockBalances.find(
                          (b) =>
                            b.warehouseId === w.id &&
                            b.materialVariantId === (it.materialVariantId || it.materialVariant?.id) &&
                            b.ownershipType === (it.ownershipType || "OWNED")
                        );
                        return (rec ? Number(rec.availableQty) : 0) >= Number(it.quantity);
                      });
                      return {
                        value: w.id,
                        label: `${w.name} ${yardSufficient ? "✓ Stock Available" : "✗ Stock Insufficient"}`,
                      };
                    })}
                    value={dispatchYardId}
                    onChange={(val) => setDispatchYardId(val)}
                    placeholder="Select Dispatch Yard"
                    allowClear={false}
                  />
                </div>

                {/* Line Items Stock Check */}
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px] text-slate-700 uppercase">
                      Material Availability in Selected Yard
                    </span>
                    {loadingBalances && (
                      <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {itemStatuses.map((s: any) => (
                      <div key={s.id} className="bg-white p-2.5 rounded border border-slate-200 text-xs">
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-semibold text-slate-900 break-words flex-1 min-w-0">
                            {s.materialVariant?.name} {s.materialVariant?.size ? `(${s.materialVariant.size})` : ""}
                          </span>
                          <span className="font-mono text-slate-700 font-medium shrink-0 whitespace-nowrap">
                            Req: {s.requestedQty} {s.materialVariant?.uom || "Nos."}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">In selected yard:</span>
                          {s.isSufficient ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-mono text-[10px] px-1.5 py-0 whitespace-nowrap">
                              ✓ {s.availInSelected} available
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-red-200 font-mono text-[10px] px-1.5 py-0 whitespace-nowrap">
                              ✗ {s.availInSelected} available (Deficit: {s.requestedQty - s.availInSelected})
                            </Badge>
                          )}
                        </div>

                        {!s.isSufficient && s.alternatives.length > 0 && (
                          <div className="mt-2 pt-1.5 border-t border-slate-100 text-[11px] bg-amber-50/60 p-2 rounded flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5">
                            <span className="text-amber-800">
                              Available in: <strong>{s.alternatives[0].warehouseName}</strong> ({s.alternatives[0].availableQty} Nos.)
                            </span>
                            <button
                              type="button"
                              onClick={() => setDispatchYardId(s.alternatives[0].warehouseId)}
                              className="text-[#0B1E36] font-bold hover:underline cursor-pointer bg-white px-2 py-0.5 rounded border border-amber-200 shadow-xs shrink-0 whitespace-nowrap"
                            >
                              Switch to this Yard &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warning / Informational Alert */}
                {allSufficient ? (
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-xs">
                      All material quantities are verified in stock. Confirming dispatch will officially deduct physical stock and start customer site custody.
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 p-2.5 rounded-lg text-red-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs">
                      Cannot dispatch: One or more materials have insufficient stock in the selected yard. Please switch to a yard with available stock above.
                    </p>
                  </div>
                )}

                <DialogFooter className="pt-2 gap-2 flex-col sm:flex-row items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDispatchModalOpen(false)}
                    disabled={dispatching}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmDispatch}
                    disabled={!allSufficient || dispatching}
                    isLoading={dispatching}
                    loadingText="Dispatching..."
                    className="w-full sm:w-auto bg-[#0B1E36] hover:bg-[#071424] text-white font-semibold disabled:opacity-50 whitespace-nowrap"
                  >
                    Confirm & Dispatch
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

