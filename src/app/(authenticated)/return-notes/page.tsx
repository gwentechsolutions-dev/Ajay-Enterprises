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
  Loader2,
  Trash2,
  Boxes,
  Truck,
  UserCheck,
  Building2,
  ClipboardCheck,
  Clock,
  ShieldCheck,
  Calendar,
  Navigation,
  FileCheck,
  Eye,
  Check,
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
import { TableSkeleton } from "@/components/ui/loading-states";
import { WhatsAppShareButton } from "@/components/ui/whatsapp-share-button";
import { fetchWithClientCache, invalidateClientCache } from "@/lib/client-cache";
import { useCurrentUser } from "@/lib/auth-context";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/forms/validation-mapper";

interface MRNLineItem {
  materialVariantId: string;
  ownershipType: "OWNED" | "HIRED_IN";
  returnedQty: number;
  expectedQty?: number;
  receivedQty?: number;
  acceptedQty: number;
  damagedQty: number;
  missingQty: number;
  rejectedQty?: number;
  condition: "GOOD" | "FAIR" | "DAMAGED" | "REPAIRABLE" | "SCRAP";
  remarks?: string;
  inspectionRemarks?: string;
  heldQty?: number;
  materialName?: string;
  materialCode?: string;
  uom?: string;
  size?: string | null;
  isSelected?: boolean;
}

export default function MaterialReturnsPage() {
  const { user, canCreateReturnNote } = useCurrentUser();
  const [returnNotes, setReturnNotes] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [variants, setVariants] = React.useState<any[]>([]);
  const [fleetVehicles, setFleetVehicles] = React.useState<any[]>([]);
  const [drivers, setDrivers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusTab, setStatusTab] = React.useState<"ALL" | "REQUESTED" | "IN_TRANSIT" | "AWAITING_INSPECTION" | "FINALIZED">("ALL");

  // Stage 1 & 2: Create Return Pickup Request Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [loadingSiteMaterials, setLoadingSiteMaterials] = React.useState(false);
  const [siteDeliveredMaterials, setSiteDeliveredMaterials] = React.useState<any[]>([]);
  const [siteDeliveryNotes, setSiteDeliveryNotes] = React.useState<any[]>([]);

  const [pickupRequestForm, setPickupRequestForm] = React.useState({
    customerId: "",
    customerSiteId: "",
    receivingWarehouseId: "",
    referenceDeliveryNoteId: "",
    preferredPickupDate: new Date().toISOString().split("T")[0],
    preferredPickupTime: "10:00 AM",
    pickupInstructions: "",
    remarks: "",
    vehicleId: "",
    driverId: "",
    items: [] as MRNLineItem[],
  });

  // Stage 2: Schedule Trip Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = React.useState(false);
  const [schedulingMRN, setSchedulingMRN] = React.useState<any | null>(null);
  const [submittingSchedule, setSubmittingSchedule] = React.useState(false);
  const [scheduleForm, setScheduleForm] = React.useState({
    vehicleId: "",
    driverId: "",
    pickupDate: new Date().toISOString().split("T")[0],
    pickupTime: "10:00 AM",
    tripInstructions: "",
  });

  // Stage 10: Warehouse QC Inspection Modal State
  const [isInspectionModalOpen, setIsInspectionModalOpen] = React.useState(false);
  const [inspectingMRN, setInspectingMRN] = React.useState<any | null>(null);
  const [submittingInspection, setSubmittingInspection] = React.useState(false);
  const [inspectionForm, setInspectionForm] = React.useState({
    inspectorName: "",
    inspectorDesignation: "Quality Inspector",
    inspectionRemarks: "",
    customerAgreedDamage: false,
    items: [] as Array<{
      materialVariantId: string;
      materialName: string;
      materialCode: string;
      size?: string;
      uom?: string;
      returnedQty: number;
      expectedQty: number;
      driverCollectedQty: number;
      receivedQty: number;
      acceptedQty: number;
      damagedQty: number;
      missingQty: number;
      rejectedQty: number;
      condition: "GOOD" | "FAIR" | "DAMAGED" | "REPAIRABLE" | "SCRAP";
      inspectionRemarks: string;
    }>,
  });

  // Stage 11: Finalize MRN Confirmation Dialog State
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = React.useState(false);
  const [finalizingMRN, setFinalizingMRN] = React.useState<any | null>(null);
  const [submittingFinalize, setSubmittingFinalize] = React.useState(false);
  const [includeReturnDate, setIncludeReturnDate] = React.useState(false);
  const [finalizeRemarks, setFinalizeRemarks] = React.useState("");

  const loadData = React.useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      const mrnData = await fetchWithClientCache("/api/v1/return-notes", {
        forceRefresh,
        onBackgroundUpdate: (fresh) => setReturnNotes(Array.isArray(fresh) ? fresh : []),
      });
      if (mrnData) setReturnNotes(Array.isArray(mrnData) ? mrnData : []);
    } catch {
      toast.error("Failed to load material return notes.");
    } finally {
      setLoading(false);
    }

    if (canCreateReturnNote) {
      try {
        const [custData, whData, varData, vehData, driverData] = await Promise.all([
          fetchWithClientCache("/api/v1/customers", { forceRefresh, ttlMs: 60_000 }).catch(() => null),
          fetchWithClientCache("/api/v1/warehouses", { forceRefresh, ttlMs: 60_000 }).catch(() => null),
          fetchWithClientCache("/api/v1/materials/variants", { forceRefresh, ttlMs: 60_000 }).catch(() => null),
          fetchWithClientCache("/api/v1/fleet/vehicles", { forceRefresh, ttlMs: 60_000 }).catch(() => null),
          fetchWithClientCache("/api/v1/fleet/drivers", { forceRefresh, ttlMs: 60_000 }).catch(() => null),
        ]);

        if (custData && Array.isArray(custData)) setCustomers(custData);
        if (whData && Array.isArray(whData)) {
          setWarehouses(whData);
          setPickupRequestForm((prev) => ({
            ...prev,
            receivingWarehouseId: prev.receivingWarehouseId || whData[0]?.id || "",
          }));
        }
        if (varData && Array.isArray(varData)) setVariants(varData);
        if (vehData && Array.isArray(vehData)) setFleetVehicles(vehData);
        if (driverData && Array.isArray(driverData)) setDrivers(driverData);
      } catch (err) {
        console.warn("Could not pre-load return note auxiliary master data:", err);
      }
    }
  }, [canCreateReturnNote]);

  React.useEffect(() => {
    loadData();
    if (typeof window !== "undefined" && canCreateReturnNote) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "new") {
        setIsCreateModalOpen(true);
      }
    }

    // Auto-refresh return notes when data changes across portals
    const handleCacheInvalidated = (e: any) => {
      const prefix = e?.detail?.prefix || "";
      if (prefix === "*" || prefix.includes("return") || prefix.includes("dashboard")) {
        loadData(true);
      }
    };
    window.addEventListener("inventra:cache-invalidated", handleCacheInvalidated);
    return () => {
      window.removeEventListener("inventra:cache-invalidated", handleCacheInvalidated);
    };
  }, [loadData, canCreateReturnNote]);

  // Load site delivered materials when site is selected
  const loadSiteDeliveredMaterials = React.useCallback(
    async (siteId: string, deliveryNoteId?: string) => {
      if (!siteId) {
        setSiteDeliveredMaterials([]);
        setSiteDeliveryNotes([]);
        return;
      }

      try {
        setLoadingSiteMaterials(true);
        const queryParams = new URLSearchParams({ customerSiteId: siteId });
        if (deliveryNoteId) queryParams.set("deliveryNoteId", deliveryNoteId);

        const url = `/api/v1/return-notes/site-materials?${queryParams.toString()}`;
        const result = await fetchWithClientCache(url, { ttlMs: 30_000 });

        if (result && result.materials) {
          const materials = result.materials || [];
          const dns = result.deliveryNotes || [];
          setSiteDeliveredMaterials(materials);
          setSiteDeliveryNotes(dns);

          if (materials.length > 0) {
            const autoPopulatedItems: MRNLineItem[] = materials.map((m: any) => ({
              materialVariantId: m.materialVariantId,
              ownershipType: m.ownershipType || "OWNED",
              returnedQty: m.currentHeldQty,
              expectedQty: m.currentHeldQty,
              acceptedQty: 0,
              damagedQty: 0,
              missingQty: 0,
              condition: "GOOD",
              remarks: "",
              heldQty: m.currentHeldQty,
              materialName: m.materialName,
              materialCode: m.materialCode,
              uom: m.uom,
              size: m.size,
              isSelected: true,
            }));

            setPickupRequestForm((prev) => ({
              ...prev,
              customerSiteId: siteId,
              referenceDeliveryNoteId: deliveryNoteId || prev.referenceDeliveryNoteId || "",
              items: autoPopulatedItems,
            }));
            toast.success(`Loaded ${materials.length} material(s) held at ${result.site?.siteName || "site"}.`);
          } else {
            setPickupRequestForm((prev) => ({
              ...prev,
              customerSiteId: siteId,
              referenceDeliveryNoteId: deliveryNoteId || "",
              items: [],
            }));
            toast.info("No active material batches currently held on this construction site.");
          }
        }
      } catch (err: any) {
        toast.error(`Error loading site stock: ${err.message}`);
      } finally {
        setLoadingSiteMaterials(false);
      }
    },
    []
  );

  const handleCustomerChange = (customerId: string) => {
    setPickupRequestForm((prev) => ({
      ...prev,
      customerId,
      customerSiteId: "",
      referenceDeliveryNoteId: "",
      items: [],
    }));
    setSiteDeliveredMaterials([]);
    setSiteDeliveryNotes([]);

    const selectedCust = customers.find((c) => c.id === customerId);
    if (selectedCust?.sites && Array.isArray(selectedCust.sites) && selectedCust.sites.length > 0) {
      setSites(selectedCust.sites);
      const firstSite = selectedCust.sites[0];
      setPickupRequestForm((prev) => ({ ...prev, customerId, customerSiteId: firstSite.id }));
      loadSiteDeliveredMaterials(firstSite.id);
      return;
    }

    fetchWithClientCache(`/api/v1/customers/${customerId}/sites`, { ttlMs: 60_000 })
      .then((data) => {
        if (Array.isArray(data)) {
          setSites(data);
          if (data.length > 0) {
            const firstSite = data[0];
            setPickupRequestForm((prev) => ({ ...prev, customerId, customerSiteId: firstSite.id }));
            loadSiteDeliveredMaterials(firstSite.id);
          }
        }
      })
      .catch(() => toast.error("Failed to load customer construction sites."));
  };

  const handleSiteChange = (siteId: string) => {
    setPickupRequestForm((prev) => ({ ...prev, customerSiteId: siteId, referenceDeliveryNoteId: "" }));
    loadSiteDeliveredMaterials(siteId);
  };

  const handleAddLine = () => {
    setPickupRequestForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          materialVariantId: "",
          ownershipType: "OWNED",
          returnedQty: 10,
          expectedQty: 10,
          acceptedQty: 0,
          damagedQty: 0,
          missingQty: 0,
          condition: "GOOD",
          remarks: "",
          heldQty: 0,
          isSelected: true,
        },
      ],
    }));
  };

  const handleRemoveLine = (idx: number) => {
    setPickupRequestForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  // Toggle selection of all items
  const handleToggleSelectAll = (select: boolean) => {
    setPickupRequestForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => ({ ...it, isSelected: select })),
    }));
  };

  // Submit Stage 1 / Stage 2: Create Return Pickup Request
  const handleCreatePickupRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupRequestForm.customerId) return toast.error("Please select a customer");
    if (!pickupRequestForm.customerSiteId) return toast.error("Please select returning construction site");
    if (!pickupRequestForm.receivingWarehouseId) return toast.error("Please select destination yard");

    const selectedItems = pickupRequestForm.items.filter((it) => it.isSelected);
    if (selectedItems.length === 0) {
      return toast.error("Please select at least one material expected to be returned.");
    }
    if (selectedItems.some((i) => !i.materialVariantId || (i.expectedQty || i.returnedQty) <= 0)) {
      return toast.error("Ensure all selected items have a valid variant and expected quantity > 0");
    }

    try {
      setSubmitting(true);
      const payload = {
        customerId: pickupRequestForm.customerId,
        customerSiteId: pickupRequestForm.customerSiteId,
        receivingWarehouseId: pickupRequestForm.receivingWarehouseId,
        referenceDeliveryNoteId: pickupRequestForm.referenceDeliveryNoteId || undefined,
        preferredPickupDate: pickupRequestForm.preferredPickupDate,
        preferredPickupTime: pickupRequestForm.preferredPickupTime || undefined,
        pickupInstructions: pickupRequestForm.pickupInstructions || undefined,
        remarks: pickupRequestForm.remarks || undefined,
        vehicleId: pickupRequestForm.vehicleId || undefined,
        driverId: pickupRequestForm.driverId || undefined,
        items: selectedItems.map((it) => ({
          materialVariantId: it.materialVariantId,
          ownershipType: it.ownershipType || "OWNED",
          expectedQty: Number(it.expectedQty || it.returnedQty),
          returnedQty: Number(it.expectedQty || it.returnedQty),
          condition: it.condition || "GOOD",
          remarks: it.remarks || null,
        })),
      };

      const res = await fetch("/api/v1/return-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to create return pickup request"));

      toast.success(data.message || `Return Pickup Request ${data.data?.mrnNumber} created successfully!`);
      setIsCreateModalOpen(false);

      // Instant optimistic UI update (0ms) - displays new note at the top immediately
      if (data.data) {
        setReturnNotes((prev) => [data.data, ...prev]);
      }

      invalidateClientCache("/api/v1/return-notes");
      invalidateClientCache("/api/v1/fleet/trips");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Stage 2: Schedule Trip Dialog
  const openScheduleTripModal = (mrn: any) => {
    setSchedulingMRN(mrn);
    setScheduleForm({
      vehicleId: mrn.vehicleTrip?.vehicleId || fleetVehicles[0]?.id || "",
      driverId: mrn.vehicleTrip?.driverId || drivers[0]?.id || "",
      pickupDate: mrn.preferredPickupDate
        ? new Date(mrn.preferredPickupDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      pickupTime: mrn.preferredPickupTime || "10:00 AM",
      tripInstructions: mrn.pickupInstructions || `Material Return Pickup for ${mrn.mrnNumber}`,
    });
    setIsScheduleModalOpen(true);
  };

  // Submit Stage 2: Schedule Trip
  const handleScheduleTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingMRN) return;
    if (!scheduleForm.vehicleId) return toast.error("Please select a company vehicle.");

    try {
      setSubmittingSchedule(true);
      const res = await fetch(`/api/v1/return-notes/${schedulingMRN.id}/schedule-trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to schedule vehicle trip"));

      toast.success(data.message || `Trip scheduled for ${schedulingMRN.mrnNumber}!`);
      setIsScheduleModalOpen(false);

      // Instant optimistic UI update (0ms)
      setReturnNotes((prev) =>
        prev.map((r) =>
          r.id === schedulingMRN.id
            ? { ...r, status: "SCHEDULED_FOR_PICKUP" }
            : r
        )
      );

      setSchedulingMRN(null);
      invalidateClientCache("/api/v1/return-notes");
      invalidateClientCache("/api/v1/fleet/trips");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingSchedule(false);
    }
  };

  // Open Stage 10: Warehouse QC Inspection Dialog
  const openInspectionModal = (mrn: any) => {
    setInspectingMRN(mrn);
    setInspectionForm({
      inspectorName: user?.name || mrn.inspectorName || mrn.receiverName || "Quality Inspector",
      inspectorDesignation: mrn.inspectorDesignation || "Quality Inspector",
      inspectionRemarks: mrn.inspectionRemarks || "",
      customerAgreedDamage: mrn.customerAgreedDamage || false,
      items: (mrn.items || []).map((it: any) => {
        const declared = Number(it.returnedQty || it.expectedQty || 0);
        const collected = it.driverCollectedQty !== null && it.driverCollectedQty !== undefined
          ? Number(it.driverCollectedQty)
          : declared;
        const received = it.receivedQty !== null && it.receivedQty !== undefined ? Number(it.receivedQty) : collected;
        const accepted = it.acceptedQty ? Number(it.acceptedQty) : (it.driverGoodQty ? Number(it.driverGoodQty) : received);
        const damaged = Number(it.damagedQty || it.driverDamagedQty || 0);
        const missing = Number(it.missingQty || it.driverMissingQty || 0);
        const rejected = Number(it.rejectedQty || 0);

        return {
          materialVariantId: it.materialVariantId,
          materialName: it.materialVariant?.name || "Centering Material",
          materialCode: it.materialVariant?.materialCode || "",
          size: it.materialVariant?.size || "-",
          uom: it.materialVariant?.uom || "Nos.",
          returnedQty: declared,
          expectedQty: Number(it.expectedQty || declared),
          driverCollectedQty: collected,
          receivedQty: received,
          acceptedQty: accepted,
          damagedQty: damaged,
          missingQty: missing,
          rejectedQty: rejected,
          condition: (it.condition as any) || "GOOD",
          inspectionRemarks: it.inspectionRemarks || it.remarks || "",
        };
      }),
    });
    setIsInspectionModalOpen(true);
  };

  // Submit Stage 10: Save QC Inspection
  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingMRN) return;
    if (!inspectionForm.inspectorName.trim()) {
      return toast.error("Please enter inspector name.");
    }

    try {
      setSubmittingInspection(true);
      const res = await fetch(`/api/v1/return-notes/${inspectingMRN.id}/inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inspectionForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to record physical inspection"));

      toast.success(`MRN ${inspectingMRN.mrnNumber} physical QC inspection verified!`);
      setIsInspectionModalOpen(false);
      setInspectingMRN(null);
      invalidateClientCache("/api/v1/return-notes");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingInspection(false);
    }
  };

  // Open Stage 11: Finalize MRN Dialog
  const openFinalizeModal = (mrn: any) => {
    setFinalizingMRN(mrn);
    setIncludeReturnDate(mrn.includeReturnDate || false);
    setFinalizeRemarks("");
    setIsFinalizeModalOpen(true);
  };

  // Submit Stage 11: Finalize MRN & Post to Inventory
  const handleConfirmFinalize = async () => {
    if (!finalizingMRN) return;
    try {
      setSubmittingFinalize(true);
      const res = await fetch(`/api/v1/return-notes/${finalizingMRN.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeReturnDate,
          remarks: finalizeRemarks || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to finalize MRN"));

      toast.success(`MRN ${finalizingMRN.mrnNumber} finalized! Warehouse stock re-credited and rental return calculations applied.`);
      setIsFinalizeModalOpen(false);

      // Instant optimistic UI update (0ms)
      setReturnNotes((prev) =>
        prev.map((r) =>
          r.id === finalizingMRN.id
            ? { ...r, status: "COMPLETED" }
            : r
        )
      );

      setFinalizingMRN(null);
      invalidateClientCache("/api/v1/return-notes");
      invalidateClientCache("/api/v1/inventory/stock-balances");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingFinalize(false);
    }
  };

  // Filter return notes based on search query and status tabs (latest created first)
  const filteredMRNs = React.useMemo(() => {
    return (returnNotes || [])
      .filter((mrn) => {
        if (!mrn) return false;
        const mrnNum = mrn.mrnNumber || "";
        const custName = mrn.customer?.name || "";
        const siteName = mrn.customerSite?.siteName || "";
        const q = (search || "").toLowerCase();
        const matchesSearch =
          mrnNum.toLowerCase().includes(q) ||
          custName.toLowerCase().includes(q) ||
          siteName.toLowerCase().includes(q);

        if (!matchesSearch) return false;

        if (statusTab === "ALL") return true;
        if (statusTab === "REQUESTED") return mrn.status === "PICKUP_REQUESTED";
        if (statusTab === "IN_TRANSIT") {
          return ["ASSIGNED", "EN_ROUTE", "ARRIVED_AT_SITE", "PICKUP_COMPLETED", "IN_TRANSIT"].includes(mrn.status);
        }
        if (statusTab === "AWAITING_INSPECTION") {
          return ["AWAITING_INSPECTION", "ARRIVED_AT_YARD", "INSPECTION_COMPLETED"].includes(mrn.status) && mrn.status !== "POSTED";
        }
        if (statusTab === "FINALIZED") return ["POSTED", "FINALIZED"].includes(mrn.status);

        return true;
      })
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        const dateA = a.returnDate ? new Date(a.returnDate).getTime() : 0;
        const dateB = b.returnDate ? new Date(b.returnDate).getTime() : 0;
        return dateB - dateA;
      });
  }, [returnNotes, search, statusTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2 flex-wrap break-words">
            <RotateCcw className="h-7 w-7 text-[#F26522]" />
            Material Return Notes (MRN)
          </h1>
          <p className="text-sm text-slate-500">
            Driver-assisted centering equipment return pickup, fleet transport & warehouse verification
          </p>
        </div>
        {canCreateReturnNote && (
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white shadow-sm flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Return Pickup Request
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Returns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{returnNotes.length}</div>
            <p className="text-xs text-slate-400 mt-0.5">Return records in system</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40 shadow-xs">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Pickups In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-800">
              {returnNotes.filter((m) =>
                ["PICKUP_REQUESTED", "ASSIGNED", "ARRIVED_AT_SITE", "PICKUP_COMPLETED", "IN_TRANSIT"].includes(m.status)
              ).length}
            </div>
            <p className="text-xs text-amber-600 mt-0.5">Assigned or in vehicle transit</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/40 shadow-xs">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Awaiting Yard QC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">
              {returnNotes.filter((m) =>
                ["AWAITING_INSPECTION", "ARRIVED_AT_YARD", "INSPECTION_COMPLETED"].includes(m.status) &&
                m.status !== "POSTED"
              ).length}
            </div>
            <p className="text-xs text-blue-600 mt-0.5">Arrived at yard; pending finalization</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40 shadow-xs">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Finalized & Re-credited
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-800">
              {returnNotes.filter((m) => ["POSTED", "FINALIZED"].includes(m.status)).length}
            </div>
            <p className="text-xs text-emerald-600 mt-0.5">Inventory re-credited & billing stopped</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 w-full sm:w-auto">
          <button
            onClick={() => setStatusTab("ALL")}
            className={`py-1.5 px-3 rounded-lg transition whitespace-nowrap ${statusTab === "ALL" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"}`}
          >
            All ({returnNotes.length})
          </button>
          <button
            onClick={() => setStatusTab("REQUESTED")}
            className={`py-1.5 px-3 rounded-lg transition whitespace-nowrap ${statusTab === "REQUESTED" ? "bg-amber-50 text-amber-900 shadow-sm" : "hover:text-slate-900"}`}
          >
            Requested
          </button>
          <button
            onClick={() => setStatusTab("IN_TRANSIT")}
            className={`py-1.5 px-3 rounded-lg transition whitespace-nowrap ${statusTab === "IN_TRANSIT" ? "bg-sky-50 text-sky-900 shadow-sm" : "hover:text-slate-900"}`}
          >
            In Transit
          </button>
          <button
            onClick={() => setStatusTab("AWAITING_INSPECTION")}
            className={`py-1.5 px-3 rounded-lg transition whitespace-nowrap ${statusTab === "AWAITING_INSPECTION" ? "bg-purple-50 text-purple-900 shadow-sm" : "hover:text-slate-900"}`}
          >
            Yard QC
          </button>
          <button
            onClick={() => setStatusTab("FINALIZED")}
            className={`py-1.5 px-3 rounded-lg transition whitespace-nowrap ${statusTab === "FINALIZED" ? "bg-emerald-50 text-emerald-900 shadow-sm" : "hover:text-slate-900"}`}
          >
            Finalized
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search MRN #, customer, or site..."
            className="pl-9 bg-white h-9 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 min-w-[900px]">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">MRN Number</th>
                <th className="px-4 py-3 whitespace-nowrap">Customer & Site</th>
                <th className="px-4 py-3 whitespace-nowrap">Fleet Vehicle & Trip</th>
                <th className="px-4 py-3 whitespace-nowrap">Destination Yard</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Material Qty</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <TableSkeleton columns={7} rows={6} />
              ) : filteredMRNs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No material return notes matching criteria.
                  </td>
                </tr>
              ) : (
                filteredMRNs.map((mrn) => {
                  const status = mrn.status;
                  const totalExpected = (mrn.items || []).reduce(
                    (s: number, it: any) => s + Number(it.expectedQty || it.returnedQty || 0),
                    0
                  );
                  const totalAccepted = (mrn.items || []).reduce(
                    (s: number, it: any) => s + Number(it.acceptedQty || 0),
                    0
                  );

                  return (
                    <tr key={mrn.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 text-xs">
                        <div>{mrn.mrnNumber}</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {new Date(mrn.returnDate).toLocaleDateString("en-IN")}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        <div className="font-bold text-slate-900">{mrn.customer?.name}</div>
                        <div className="text-slate-500">{mrn.customerSite?.siteName}</div>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {mrn.vehicleTrip ? (
                          <div>
                            <div className="font-mono font-semibold text-slate-900">
                              {mrn.vehicleTrip.vehicle?.vehicleNumber || mrn.vehicleNumber}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <span className="font-mono font-bold text-blue-700">{mrn.vehicleTrip.tripNumber}</span>
                              {mrn.vehicleTrip.driver?.name && (
                                <span>&bull; {mrn.vehicleTrip.driver.name}</span>
                              )}
                            </div>
                          </div>
                        ) : mrn.vehicleNumber ? (
                          <div className="font-mono text-slate-700">{mrn.vehicleNumber}</div>
                        ) : (
                          <span className="text-[11px] text-amber-700 italic">Not Scheduled</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-700">
                        {mrn.receivingWarehouse?.name || "Main Centering Yard"}
                      </td>

                      <td className="px-4 py-3 text-center text-xs">
                        {status === "POSTED" || status === "FINALIZED" ? (
                          <span className="font-mono font-bold text-emerald-700">{totalAccepted} Nos.</span>
                        ) : (
                          <span className="font-mono text-slate-700">{totalExpected} Nos.</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {status === "PICKUP_REQUESTED" && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                            PICKUP REQUESTED
                          </Badge>
                        )}
                        {status === "ASSIGNED" && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-300 text-[10px]">
                            DRIVER ASSIGNED
                          </Badge>
                        )}
                        {status === "ARRIVED_AT_SITE" && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]">
                            ARRIVED AT SITE
                          </Badge>
                        )}
                        {(status === "PICKUP_COMPLETED" || status === "IN_TRANSIT") && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-300 text-[10px]">
                            IN TRANSIT TO YARD
                          </Badge>
                        )}
                        {status === "AWAITING_INSPECTION" && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-300 text-[10px]">
                            AWAITING QC
                          </Badge>
                        )}
                        {status === "INSPECTION_COMPLETED" && (
                          <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-300 text-[10px]">
                            QC VERIFIED
                          </Badge>
                        )}
                        {(status === "POSTED" || status === "FINALIZED") && (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            FINALIZED
                          </Badge>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Action 1: Assign trip if in requested status */}
                          {status === "PICKUP_REQUESTED" && canCreateReturnNote && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openScheduleTripModal(mrn)}
                              className="text-xs h-7 px-2.5 bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100 font-semibold"
                            >
                              <Truck className="h-3.5 w-3.5 mr-1 text-blue-700" />
                              Assign Trip
                            </Button>
                          )}

                          {/* Action 2: Inspect if awaiting inspection */}
                          {(status === "AWAITING_INSPECTION" || status === "INSPECTION_COMPLETED") && canCreateReturnNote && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openInspectionModal(mrn)}
                              className="text-xs h-7 px-2.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-semibold"
                            >
                              <ClipboardCheck className="h-3.5 w-3.5 mr-1 text-amber-700" />
                              QC Inspect
                            </Button>
                          )}

                          {/* Action 3: Finalize MRN if inspection verified */}
                          {status === "INSPECTION_COMPLETED" && canCreateReturnNote && (
                            <Button
                              size="sm"
                              onClick={() => openFinalizeModal(mrn)}
                              className="text-xs h-7 px-2.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold shadow-xs"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Finalize MRN
                            </Button>
                          )}

                          {/* Action 4: Print Slip */}
                          <Button size="sm" variant="outline" asChild className="text-xs h-7 px-2.5">
                            <a href={`/api/v1/return-notes/${mrn.id}/print`} target="_blank" rel="noopener noreferrer">
                              <Printer className="h-3.5 w-3.5 mr-1" />
                              Slip
                            </a>
                          </Button>

                          <WhatsAppShareButton doc={mrn} docType="MRN" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* STAGE 1 & 2: CREATE RETURN PICKUP REQUEST MODAL */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-[#F26522]" />
              Create Return Pickup Request (Stage 1 & 2)
            </DialogTitle>
            <DialogDescription>
              Initiate driver-assisted material return pickup. Materials held on site are auto-populated so you can choose which items and quantities are being returned.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePickupRequest} className="space-y-4 pt-1">
            <fieldset
              disabled={submitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
            >
              {/* Customer, Site, Yard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Customer *</Label>
                  <SearchableCombobox
                    options={customers.map((c) => ({
                      value: c.id,
                      label: `${c.name} (${c.customerCode})`,
                    }))}
                    value={pickupRequestForm.customerId}
                    onChange={handleCustomerChange}
                    placeholder="Select Customer"
                    emptyText="No customers found."
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Returning Construction Site *</Label>
                  <SearchableCombobox
                    options={sites.map((s) => ({
                      value: s.id,
                      label: `${s.siteName} (${s.siteCode})`,
                    }))}
                    value={pickupRequestForm.customerSiteId}
                    onChange={handleSiteChange}
                    placeholder={pickupRequestForm.customerId ? "Select Construction Site" : "Select Customer First"}
                    disabled={!pickupRequestForm.customerId}
                    emptyText="No sites found."
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Destination Yard / Warehouse *</Label>
                  <SearchableCombobox
                    options={warehouses.map((w) => ({
                      value: w.id,
                      label: `${w.name} (${w.warehouseCode})`,
                    }))}
                    value={pickupRequestForm.receivingWarehouseId}
                    onChange={(val) => setPickupRequestForm((prev) => ({ ...prev, receivingWarehouseId: val }))}
                    placeholder="Select Receiving Yard"
                  />
                </div>
              </div>

              {/* Schedule & Pickup Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <Label className="text-xs font-semibold">Preferred Pickup Date *</Label>
                  <Input
                    type="date"
                    value={pickupRequestForm.preferredPickupDate}
                    onChange={(e) => setPickupRequestForm({ ...pickupRequestForm, preferredPickupDate: e.target.value })}
                    className="h-9 text-xs bg-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Preferred Pickup Time</Label>
                  <Input
                    placeholder="e.g. 10:00 AM / Afternoon"
                    value={pickupRequestForm.preferredPickupTime}
                    onChange={(e) => setPickupRequestForm({ ...pickupRequestForm, preferredPickupTime: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Pickup Instructions / Gate Contact</Label>
                  <Input
                    placeholder="e.g. Contact Site Engr Suresh at Gate 2"
                    value={pickupRequestForm.pickupInstructions}
                    onChange={(e) => setPickupRequestForm({ ...pickupRequestForm, pickupInstructions: e.target.value })}
                    className="h-9 text-xs bg-white"
                  />
                </div>
              </div>

              {/* STAGE 2: FLEET VEHICLE & DRIVER ASSIGNMENT */}
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-blue-700" />
                    Trip Scheduling & Company Fleet Assignment (Optional)
                  </Label>
                  <span className="text-[10px] text-blue-700 font-semibold">
                    Company-Owned Fleet Only
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Company Vehicle</Label>
                    <SearchableCombobox
                      options={fleetVehicles.map((v) => ({
                        value: v.id,
                        label: `${v.vehicleNumber} (${v.make} ${v.model})`,
                      }))}
                      value={pickupRequestForm.vehicleId}
                      onChange={(val) => {
                        const veh = fleetVehicles.find((v) => v.id === val);
                        setPickupRequestForm((prev) => ({
                          ...prev,
                          vehicleId: val,
                          driverId: veh?.defaultDriverId || prev.driverId,
                        }));
                      }}
                      placeholder="Select Company Vehicle (or assign later)"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Assigned Driver</Label>
                    <SearchableCombobox
                      options={drivers.map((d) => ({
                        value: d.id,
                        label: `${d.name} (${d.mobileNumber})`,
                      }))}
                      value={pickupRequestForm.driverId}
                      onChange={(val) => setPickupRequestForm((prev) => ({ ...prev, driverId: val }))}
                      placeholder="Select Driver"
                    />
                  </div>
                </div>
              </div>

              {/* MATERIALS EXPECTED FOR RETURN SECTION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-[#F26522]" />
                    <Label className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Materials Expected for Return
                    </Label>
                    {loadingSiteMaterials && <Loader2 className="h-3 w-3 animate-spin text-[#F26522]" />}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(true)}
                      className="text-[#F26522] font-semibold hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(false)}
                      className="text-slate-500 font-semibold hover:underline"
                    >
                      Deselect All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="text-blue-700 font-semibold hover:underline flex items-center gap-1"
                    >
                      + Add Material
                    </button>
                  </div>
                </div>

                {pickupRequestForm.items.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                    Select a customer and construction site above to auto-populate materials held on site.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pickupRequestForm.items.map((item, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "p-3 rounded-xl border transition-colors",
                          item.isSelected
                            ? "bg-white border-amber-300 shadow-2xs"
                            : "bg-slate-50 border-slate-200 opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={item.isSelected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPickupRequestForm((prev) => ({
                                ...prev,
                                items: prev.items.map((it, i) =>
                                  i === idx ? { ...it, isSelected: checked } : it
                                ),
                              }));
                            }}
                            className="h-4 w-4 rounded text-[#F26522] focus:ring-[#F26522] border-slate-300 cursor-pointer"
                          />

                          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                            <div className="md:col-span-2">
                              {item.materialName ? (
                                <div>
                                  <span className="font-bold text-slate-900 text-xs">{item.materialName}</span>
                                  <span className="text-slate-500 text-[11px] ml-1">({item.size || "Standard"})</span>
                                  {item.heldQty !== undefined && (
                                    <span className="ml-2 text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-semibold">
                                      Held on Site: {item.heldQty} {item.uom || "Nos."}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <SearchableCombobox
                                  options={variants.map((v) => ({
                                    value: v.id,
                                    label: `${v.name} (${v.size || "Standard"})`,
                                  }))}
                                  value={item.materialVariantId}
                                  onChange={(val) => {
                                    const v = variants.find((x) => x.id === val);
                                    setPickupRequestForm((prev) => ({
                                      ...prev,
                                      items: prev.items.map((it, i) =>
                                        i === idx
                                          ? {
                                              ...it,
                                              materialVariantId: val,
                                              materialName: v?.name,
                                              materialCode: v?.materialCode,
                                              uom: v?.uom || "Nos.",
                                              size: v?.size,
                                            }
                                          : it
                                      ),
                                    }));
                                  }}
                                  placeholder="Select Variant"
                                />
                              )}
                            </div>

                            <div>
                              <Label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                                Expected Return Qty *
                              </Label>
                              <Input
                                type="number"
                                min={1}
                                max={item.heldQty || 99999}
                                value={item.expectedQty}
                                onChange={(e) => {
                                  const val = Math.max(1, Number(e.target.value));
                                  setPickupRequestForm((prev) => ({
                                    ...prev,
                                    items: prev.items.map((it, i) =>
                                      i === idx ? { ...it, expectedQty: val, returnedQty: val } : it
                                    ),
                                  }));
                                }}
                                className="h-8 text-xs font-mono font-bold"
                                disabled={!item.isSelected}
                                required
                              />
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <select
                                value={item.ownershipType}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  setPickupRequestForm((prev) => ({
                                    ...prev,
                                    items: prev.items.map((it, i) =>
                                      i === idx ? { ...it, ownershipType: val } : it
                                    ),
                                  }));
                                }}
                                className="h-8 text-xs rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700"
                                disabled={!item.isSelected}
                              >
                                <option value="OWNED">OWNED</option>
                                <option value="HIRED_IN">HIRED-IN</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="text-slate-400 hover:text-red-600 p-1"
                                title="Remove item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* General Remarks */}
              <div>
                <Label className="text-xs font-semibold">General Remarks / Notes</Label>
                <Input
                  placeholder="Optional internal remarks..."
                  value={pickupRequestForm.remarks}
                  onChange={(e) => setPickupRequestForm({ ...pickupRequestForm, remarks: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#0B1E36] hover:bg-[#071424] text-white font-bold"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Creating Pickup Request...
                    </>
                  ) : pickupRequestForm.vehicleId ? (
                    "Create Request & Schedule Trip"
                  ) : (
                    "Create Return Pickup Request"
                  )}
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>

      {/* STAGE 2: SCHEDULE TRIP MODAL */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-700" />
              Schedule Vehicle Trip – {schedulingMRN?.mrnNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign company vehicle and driver for material return pickup from {schedulingMRN?.customerSite?.siteName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleScheduleTrip} className="space-y-3 pt-1">
            <div>
              <Label className="text-xs font-semibold" required>Company Vehicle *</Label>
              <SearchableCombobox
                options={fleetVehicles.map((v) => ({
                  value: v.id,
                  label: `${v.vehicleNumber} (${v.make} ${v.model})`,
                }))}
                value={scheduleForm.vehicleId}
                onChange={(val) => {
                  const veh = fleetVehicles.find((v) => v.id === val);
                  setScheduleForm((prev) => ({
                    ...prev,
                    vehicleId: val,
                    driverId: veh?.defaultDriverId || prev.driverId,
                  }));
                }}
                placeholder="Select Vehicle"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Assigned Driver</Label>
              <SearchableCombobox
                options={drivers.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.mobileNumber})`,
                }))}
                value={scheduleForm.driverId}
                onChange={(val) => setScheduleForm((prev) => ({ ...prev, driverId: val }))}
                placeholder="Select Driver"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold" required>Pickup Date *</Label>
                <Input
                  type="date"
                  value={scheduleForm.pickupDate}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, pickupDate: e.target.value })}
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Pickup Time</Label>
                <Input
                  value={scheduleForm.pickupTime}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, pickupTime: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Trip Instructions</Label>
              <Input
                value={scheduleForm.tripInstructions}
                onChange={(e) => setScheduleForm({ ...scheduleForm, tripInstructions: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsScheduleModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingSchedule}
                className="bg-blue-700 hover:bg-blue-800 text-white font-bold"
              >
                {submittingSchedule ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Scheduling Trip...
                  </>
                ) : (
                  "Confirm & Schedule Trip"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* STAGE 10: WAREHOUSE PHYSICAL QC INSPECTION MODAL */}
      <Dialog open={isInspectionModalOpen} onOpenChange={setIsInspectionModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-[#F26522]" />
              Physical QC Inspection & Reconciliation – {inspectingMRN?.mrnNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Verify driver collected quantities against yard physical receipt. Record accepted good stock, damages, shortages, and discrepancies.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveInspection} className="space-y-4 pt-1">
            {/* Custody Summary Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">Customer Handover</div>
                <div className="font-bold text-slate-800">{inspectingMRN?.customerRepresentativeName || "Site Rep"}</div>
                <div className="text-slate-500">{inspectingMRN?.customerRepresentativePhone || "No phone"}</div>
                {inspectingMRN?.customerSignatureUrl && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[9px] mt-1">
                    Signature Captured
                  </Badge>
                )}
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">Driver & Vehicle</div>
                <div className="font-bold text-slate-800">{inspectingMRN?.driverName || inspectingMRN?.vehicleTrip?.driver?.name || "Driver"}</div>
                <div className="font-mono text-slate-600">{inspectingMRN?.vehicleNumber}</div>
                {inspectingMRN?.yardOdometer && (
                  <div className="text-[10px] text-slate-500 font-mono">End Odo: {Number(inspectingMRN.yardOdometer)} KM</div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">Yard Receiving</div>
                <div className="font-bold text-slate-800">{inspectingMRN?.receiverName || "Yard Manager"}</div>
                <div className="text-slate-500">{inspectingMRN?.receivingWarehouse?.name}</div>
                {inspectingMRN?.yardArrivedAt && (
                  <div className="text-[10px] text-slate-500 font-mono">
                    Arrived: {new Date(inspectingMRN.yardArrivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
            </div>

            {/* Verification & Discrepancy Table */}
            <div className="space-y-3">
              <Label className="text-xs font-bold text-slate-900 uppercase tracking-wide block">
                Line-by-Line Physical QC Count & Reconciled Stock
              </Label>

              {inspectionForm.items.map((item, idx) => {
                const hasDiscrepancy = Number(item.receivedQty) !== Number(item.driverCollectedQty);

                return (
                  <div
                    key={item.materialVariantId}
                    className={cn(
                      "p-3 rounded-xl border space-y-2 text-xs",
                      hasDiscrepancy ? "bg-amber-50/70 border-amber-300" : "bg-white border-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{item.materialName}</span>
                        <span className="text-slate-500 text-[11px] ml-1">({item.size || "Standard"})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                          Driver Collected: <strong>{item.driverCollectedQty}</strong>
                        </span>
                        {hasDiscrepancy && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] font-bold">
                            Discrepancy Detected
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      <div>
                        <Label className="text-[10px] text-slate-600 font-semibold block mb-0.5">Yard Received *</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.receivedQty}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setInspectionForm((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) =>
                                i === idx ? { ...it, receivedQty: val, acceptedQty: Math.min(val, it.acceptedQty) } : it
                              ),
                            }));
                          }}
                          className="h-8 text-xs font-bold font-mono"
                          required
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] text-emerald-700 font-semibold block mb-0.5">Accepted (Good) *</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.acceptedQty}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setInspectionForm((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) =>
                                i === idx ? { ...it, acceptedQty: val } : it
                              ),
                            }));
                          }}
                          className="h-8 text-xs font-mono text-emerald-700 font-bold"
                          required
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] text-amber-700 font-semibold block mb-0.5">Damaged</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.damagedQty}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setInspectionForm((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) =>
                                i === idx ? { ...it, damagedQty: val } : it
                              ),
                            }));
                          }}
                          className="h-8 text-xs font-mono text-amber-700 font-semibold"
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] text-red-700 font-semibold block mb-0.5">Missing</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.missingQty}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setInspectionForm((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) =>
                                i === idx ? { ...it, missingQty: val } : it
                              ),
                            }));
                          }}
                          className="h-8 text-xs font-mono text-red-700 font-semibold"
                        />
                      </div>

                      <div>
                        <Label className="text-[10px] text-slate-600 font-semibold block mb-0.5">QC Condition</Label>
                        <select
                          value={item.condition}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setInspectionForm((prev) => ({
                              ...prev,
                              items: prev.items.map((it, i) => (i === idx ? { ...it, condition: val } : it)),
                            }));
                          }}
                          className="h-8 text-xs w-full rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-slate-700"
                        >
                          <option value="GOOD">GOOD</option>
                          <option value="FAIR">FAIR</option>
                          <option value="DAMAGED">DAMAGED</option>
                          <option value="REPAIRABLE">REPAIRABLE</option>
                          <option value="SCRAP">SCRAP</option>
                        </select>
                      </div>
                    </div>

                    <Input
                      placeholder="Inspection remarks / specific damage notes..."
                      value={item.inspectionRemarks}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInspectionForm((prev) => ({
                          ...prev,
                          items: prev.items.map((it, i) => (i === idx ? { ...it, inspectionRemarks: val } : it)),
                        }));
                      }}
                      className="h-7 text-[11px]"
                    />
                  </div>
                );
              })}
            </div>

            {/* Inspector Identity */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <Label className="text-xs font-semibold" required>Inspector Full Name *</Label>
                <Input
                  value={inspectionForm.inspectorName}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, inspectorName: e.target.value })}
                  placeholder="e.g. Anand Sharma (Quality In-Charge)"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Inspector Designation</Label>
                <Input
                  value={inspectionForm.inspectorDesignation}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, inspectorDesignation: e.target.value })}
                  placeholder="e.g. Quality Inspector"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsInspectionModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingInspection}
                className="bg-[#0B1E36] hover:bg-[#071424] text-white font-bold"
              >
                {submittingInspection ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Recording Inspection...
                  </>
                ) : (
                  "Save & Verify Physical Inspection"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* STAGE 11: FINALIZE MRN CONFIRMATION DIALOG */}
      <Dialog open={isFinalizeModalOpen} onOpenChange={setIsFinalizeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Finalize Material Return Note – {finalizingMRN?.mrnNumber}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Posting will execute double-entry inventory ledger movements, re-credit accepted centering stock to {finalizingMRN?.receivingWarehouse?.name || "Yard"}, and update rental accrual batches.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
                Double-Entry Inventory & Billing Updates
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-emerald-800">
                <li>Accepted good units will return to available warehouse rental stock.</li>
                <li>Damaged units will be segregated in quarantine for repairs/claims.</li>
                <li>Missing units will be recorded as site shortage scrap.</li>
                <li>Rental billing daily accrual will stop on the return date.</li>
              </ul>
            </div>

            {/* Include Return Date */}
            <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                id="includeReturnDateFinalize"
                checked={includeReturnDate}
                onChange={(e) => setIncludeReturnDate(e.target.checked)}
                className="h-4 w-4 rounded text-[#F26522] focus:ring-[#F26522] border-slate-300 cursor-pointer"
              />
              <label htmlFor="includeReturnDateFinalize" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Include Return Date in Rental Billing
              </label>
            </div>

            <div>
              <Label className="text-xs font-semibold">Finalization Remarks</Label>
              <Input
                value={finalizeRemarks}
                onChange={(e) => setFinalizeRemarks(e.target.value)}
                placeholder="Optional final audit notes..."
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => setIsFinalizeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmFinalize}
              disabled={submittingFinalize}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {submittingFinalize ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Posting Movements...
                </>
              ) : (
                "Finalize & Post to Inventory"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
