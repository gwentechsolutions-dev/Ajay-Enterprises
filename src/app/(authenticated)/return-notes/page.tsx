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
  Sparkles,
  RefreshCw,
  UserCheck,
  Building2,
  ClipboardCheck,
  Clock,
  ShieldCheck,
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
  deliveryNotes?: Array<{ id: string; dnNumber: string; deliveryDate: string }>;
}

export default function MaterialReturnsPage() {
  const { user, isDeliveryPerson, canCreateReturnNote } = useCurrentUser();
  const [returnNotes, setReturnNotes] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [sites, setSites] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [variants, setVariants] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  // Fleet vehicles state for registered company vehicles
  const [fleetVehicles, setFleetVehicles] = React.useState<any[]>([]);
  const [isCustomVehicle, setIsCustomVehicle] = React.useState(false);
  const [isCustomReceiver, setIsCustomReceiver] = React.useState(false);

  // Modals & Submissions
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Inspection Modal State (for delayed inspection after initial handover)
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
      acceptedQty: number;
      damagedQty: number;
      missingQty: number;
      rejectedQty: number;
      condition: "GOOD" | "FAIR" | "DAMAGED" | "REPAIRABLE" | "SCRAP";
      inspectionRemarks: string;
    }>,
  });

  // Auto-Population & Site Stock State
  const [loadingSiteMaterials, setLoadingSiteMaterials] = React.useState(false);
  const [siteDeliveredMaterials, setSiteDeliveredMaterials] = React.useState<any[]>([]);
  const [siteDeliveryNotes, setSiteDeliveryNotes] = React.useState<any[]>([]);
  const [autoPopulatedCount, setAutoPopulatedCount] = React.useState(0);

  // New MRN Form
  const [mrnForm, setMrnForm] = React.useState({
    customerId: "",
    customerSiteId: "",
    receivingWarehouseId: "",
    referenceDeliveryNoteId: "",
    returnDate: new Date().toISOString().split("T")[0],
    includeReturnDate: false,
    vehicleNumber: "KA-01-AB-1234",
    driverName: "",
    driverPhone: "",

    // Customer / Site Representative - Material Handover
    customerRepresentativeName: "",
    customerRepresentativeDesignation: "Site Representative",
    customerRepresentativePhone: "",
    handoverAt: new Date().toISOString().split("T")[0],
    customerAgreedDamage: false,

    // AJAY ENTERPRISES - Receiving Acknowledgement
    receiverName: "Yard Manager",
    receiverDesignation: "Yard In-Charge",
    receiverPhone: "9876543210",
    receivedAt: new Date().toISOString().split("T")[0],

    // Material Inspection Mode
    inspectionStatus: "COMPLETED" as "COMPLETED" | "PENDING",
    inspectorName: "",
    inspectorDesignation: "Quality Inspector",
    inspectionRemarks: "",

    remarks: "",
    items: [] as MRNLineItem[],
  });

  const loadData = React.useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      // 1. Primary: Fetch Return Notes with cache
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

    // 2. Auxiliary master data: Only needed if user can create return notes
    if (canCreateReturnNote) {
      try {
        const [custData, whData, varData, vehData] = await Promise.all([
          fetchWithClientCache("/api/v1/customers", {
            forceRefresh,
            ttlMs: 60_000,
            onBackgroundUpdate: (fresh) => setCustomers(Array.isArray(fresh) ? fresh : []),
          }).catch(() => null),
          fetchWithClientCache("/api/v1/warehouses", {
            forceRefresh,
            ttlMs: 60_000,
            onBackgroundUpdate: (fresh) => setWarehouses(Array.isArray(fresh) ? fresh : []),
          }).catch(() => null),
          fetchWithClientCache("/api/v1/materials/variants", {
            forceRefresh,
            ttlMs: 60_000,
            onBackgroundUpdate: (fresh) => setVariants(Array.isArray(fresh) ? fresh : []),
          }).catch(() => null),
          fetchWithClientCache("/api/v1/fleet/vehicles", {
            forceRefresh,
            ttlMs: 60_000,
            onBackgroundUpdate: (fresh) => {
              if (Array.isArray(fresh)) setFleetVehicles(fresh);
            },
          }).catch(() => null),
        ]);

        if (custData && Array.isArray(custData)) {
          setCustomers(custData);
        }
        if (whData && Array.isArray(whData)) {
          setWarehouses(whData);
          setMrnForm((prev) => {
            const chosenWh = whData.find((w: any) => w.id === prev.receivingWarehouseId) || whData[0];
            return {
              ...prev,
              receivingWarehouseId: prev.receivingWarehouseId || whData[0]?.id || "",
              receiverName:
                prev.receiverName && prev.receiverName !== "Yard Manager"
                  ? prev.receiverName
                  : chosenWh?.contactPerson || user?.name || "Yard Manager",
              receiverPhone:
                prev.receiverPhone && prev.receiverPhone !== "9876543210"
                  ? prev.receiverPhone
                  : chosenWh?.mobile || "9876543210",
            };
          });
        }
        if (varData && Array.isArray(varData)) {
          setVariants(varData);
        }
        if (vehData && Array.isArray(vehData)) {
          setFleetVehicles(vehData);
          setMrnForm((prev) => ({
            ...prev,
            vehicleNumber:
              prev.vehicleNumber && prev.vehicleNumber !== "KA-01-AB-1234"
                ? prev.vehicleNumber
                : vehData[0]?.vehicleNumber || prev.vehicleNumber,
          }));
        }
      } catch (err) {
        console.warn("Could not pre-load auxiliary return note master data:", err);
      }
    }
  }, [canCreateReturnNote, user]);

  React.useEffect(() => {
    loadData();
    if (typeof window !== "undefined" && canCreateReturnNote) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "new") {
        setIsCreateModalOpen(true);
      }
    }
  }, [loadData, canCreateReturnNote]);

  // Memoized receiver options from active user, selected yard contact, all warehouses, and past MRNs
  const receiverOptions = React.useMemo(() => {
    const list: Array<{ value: string; label: string; sublabel?: string; badge?: string; phone?: string }> = [];
    const seenNames = new Set<string>();

    // 1. Current logged-in user
    if (user?.name && !seenNames.has(user.name.toLowerCase())) {
      seenNames.add(user.name.toLowerCase());
      list.push({
        value: user.name,
        label: user.name,
        sublabel: `${user.role || "Staff"} · Logged-in User`,
        badge: "CURRENT USER",
        phone: user.mobile || undefined,
      });
    }

    // 2. Selected warehouse contact person
    const selectedYard = warehouses.find((w) => w.id === mrnForm.receivingWarehouseId);
    if (selectedYard?.contactPerson && !seenNames.has(selectedYard.contactPerson.toLowerCase())) {
      seenNames.add(selectedYard.contactPerson.toLowerCase());
      list.push({
        value: selectedYard.contactPerson,
        label: selectedYard.contactPerson,
        sublabel: `${selectedYard.name} (${selectedYard.warehouseCode || "Yard In-Charge"})`,
        badge: "YARD IN-CHARGE",
        phone: selectedYard.mobile || undefined,
      });
    }

    // 3. Other warehouse contacts and assigned warehouse staff
    warehouses.forEach((w: any) => {
      if (w.contactPerson && !seenNames.has(w.contactPerson.toLowerCase())) {
        seenNames.add(w.contactPerson.toLowerCase());
        list.push({
          value: w.contactPerson,
          label: w.contactPerson,
          sublabel: `${w.name} · Contact`,
          badge: "YARD",
          phone: w.mobile || undefined,
        });
      }
      if (Array.isArray(w.users)) {
        w.users.forEach((u: any) => {
          if (u.name && !seenNames.has(u.name.toLowerCase())) {
            seenNames.add(u.name.toLowerCase());
            list.push({
              value: u.name,
              label: u.name,
              sublabel: `${w.name} · ${u.role || "Staff"}`,
              badge: "STAFF",
              phone: u.mobile || undefined,
            });
          }
        });
      }
    });

    // 4. Past receivers from return notes
    returnNotes.forEach((rn: any) => {
      if (rn.receiverName && !seenNames.has(rn.receiverName.toLowerCase())) {
        seenNames.add(rn.receiverName.toLowerCase());
        list.push({
          value: rn.receiverName,
          label: rn.receiverName,
          sublabel: "Past Yard Receiver",
          badge: "PAST",
          phone: rn.receiverPhone || undefined,
        });
      }
    });

    return list;
  }, [user, mrnForm.receivingWarehouseId, warehouses, returnNotes]);

  // Load delivered materials held at a specific customer site
  const loadSiteDeliveredMaterials = React.useCallback(
    async (siteId: string, deliveryNoteId?: string) => {
      if (!siteId) {
        setSiteDeliveredMaterials([]);
        setSiteDeliveryNotes([]);
        setAutoPopulatedCount(0);
        return;
      }

      try {
        setLoadingSiteMaterials(true);
        const queryParams = new URLSearchParams({ customerSiteId: siteId });
        if (deliveryNoteId) {
          queryParams.set("deliveryNoteId", deliveryNoteId);
        }

        const url = `/api/v1/return-notes/site-materials?${queryParams.toString()}`;
        const result = await fetchWithClientCache(url, {
          ttlMs: 30_000,
          onBackgroundUpdate: (fresh) => {
            if (fresh?.materials) {
              setSiteDeliveredMaterials(fresh.materials);
              setSiteDeliveryNotes(fresh.deliveryNotes || []);
            }
          },
        });

        if (result && result.materials) {
          const materials = result.materials || [];
          const dns = result.deliveryNotes || [];
          setSiteDeliveredMaterials(materials);
          setSiteDeliveryNotes(dns);

          if (materials.length > 0) {
            // Auto-populate form items with full current held quantity
            const autoPopulatedItems: MRNLineItem[] = materials.map((m: any) => ({
              materialVariantId: m.materialVariantId,
              ownershipType: m.ownershipType || "OWNED",
              returnedQty: m.currentHeldQty,
              acceptedQty: m.currentHeldQty,
              damagedQty: 0,
              missingQty: 0,
              condition: "GOOD",
              remarks: "",
              heldQty: m.currentHeldQty,
              materialName: m.materialName,
              materialCode: m.materialCode,
              uom: m.uom,
              size: m.size,
              deliveryNotes: m.deliveryNotes || [],
            }));

            setMrnForm((prev) => ({
              ...prev,
              customerSiteId: siteId,
              referenceDeliveryNoteId: deliveryNoteId || prev.referenceDeliveryNoteId || "",
              items: autoPopulatedItems,
            }));
            setAutoPopulatedCount(materials.length);
            toast.success(
              `Auto-populated ${materials.length} material line(s) delivered to ${result.site?.siteName || "site"}.`
            );
          } else {
            // No materials on site: provide one empty row for manual entry
            setMrnForm((prev) => ({
              ...prev,
              customerSiteId: siteId,
              referenceDeliveryNoteId: deliveryNoteId || "",
              items: [
                {
                  materialVariantId: "",
                  ownershipType: "OWNED",
                  returnedQty: 1,
                  acceptedQty: 1,
                  damagedQty: 0,
                  missingQty: 0,
                  condition: "GOOD",
                  remarks: "",
                  heldQty: 0,
                },
              ],
            }));
            setAutoPopulatedCount(0);
          }
        }
      } catch (err) {
        console.error("Failed to load site delivered materials:", err);
        toast.error("Failed to fetch site material stock.");
      } finally {
        setLoadingSiteMaterials(false);
      }
    },
    []
  );

  // When customer changes, load customer sites and trigger material fetch for initial site
  const handleCustomerChange = (customerId: string) => {
    setMrnForm((prev) => ({
      ...prev,
      customerId,
      customerSiteId: "",
      referenceDeliveryNoteId: "",
      items: [],
    }));
    setSiteDeliveredMaterials([]);
    setSiteDeliveryNotes([]);
    setAutoPopulatedCount(0);

    if (!customerId) {
      setSites([]);
      return;
    }

    // 1. Instant 0ms memory lookup from already-loaded customer tree
    const selectedCust = customers.find((c) => c.id === customerId);
    if (selectedCust?.sites && Array.isArray(selectedCust.sites) && selectedCust.sites.length > 0) {
      setSites(selectedCust.sites);
      const firstSite = selectedCust.sites[0];
      setMrnForm((prev) => ({ ...prev, customerId, customerSiteId: firstSite.id }));
      loadSiteDeliveredMaterials(firstSite.id);
      return;
    }

    // 2. Fallback to cached API request if not already embedded
    fetchWithClientCache(`/api/v1/customers/${customerId}/sites`, {
      ttlMs: 60_000,
    })
      .then((data) => {
        if (Array.isArray(data)) {
          setSites(data);
          if (data.length > 0) {
            const firstSite = data[0];
            setMrnForm((prev) => ({ ...prev, customerId, customerSiteId: firstSite.id }));
            loadSiteDeliveredMaterials(firstSite.id);
          }
        }
      })
      .catch(() => {
        toast.error("Failed to load customer construction sites.");
      });
  };

  // When construction site changes, auto-populate delivered materials for that site
  const handleSiteChange = (siteId: string) => {
    setMrnForm((prev) => ({
      ...prev,
      customerSiteId: siteId,
      referenceDeliveryNoteId: "",
    }));
    loadSiteDeliveredMaterials(siteId);
  };

  // Optional filter by a specific Delivery Note
  const handleDeliveryNoteFilterChange = (deliveryNoteId: string) => {
    setMrnForm((prev) => ({ ...prev, referenceDeliveryNoteId: deliveryNoteId }));
    if (mrnForm.customerSiteId) {
      loadSiteDeliveredMaterials(mrnForm.customerSiteId, deliveryNoteId || undefined);
    }
  };

  const handleAddLine = () => {
    setMrnForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          materialVariantId: "",
          ownershipType: "OWNED",
          returnedQty: 10,
          acceptedQty: 10,
          damagedQty: 0,
          missingQty: 0,
          condition: "GOOD",
          remarks: "",
          heldQty: 0,
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
    if (mrnForm.items.length === 0) {
      return toast.error("Please add at least one material to return.");
    }
    if (mrnForm.items.some((i) => !i.materialVariantId || i.returnedQty <= 0)) {
      return toast.error("Ensure all items have a variant and returned quantity > 0");
    }

    try {
      setSubmitting(true);
      const payload = {
        ...mrnForm,
        referenceDeliveryNoteId: mrnForm.referenceDeliveryNoteId || undefined,
        items: mrnForm.items.map((it) => ({
          materialVariantId: it.materialVariantId,
          ownershipType: it.ownershipType || "OWNED",
          returnedQty: Number(it.returnedQty),
          receivedQty: it.receivedQty !== undefined ? Number(it.receivedQty) : undefined,
          acceptedQty: Number(it.acceptedQty),
          damagedQty: Number(it.damagedQty || 0),
          missingQty: Number(it.missingQty || 0),
          rejectedQty: Number(it.rejectedQty || 0),
          condition: it.condition || "GOOD",
          remarks: it.remarks || null,
          inspectionRemarks: it.inspectionRemarks || null,
        })),
      };

      const res = await fetch("/api/v1/return-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Failed to post Material Return Note"));

      toast.success(`MRN ${data.data.mrnNumber} posted! Custody transfer & acknowledgements created.`);
      setIsCreateModalOpen(false);
      invalidateClientCache("/api/v1/return-notes");
      invalidateClientCache("/api/v1/delivery-notes");
      invalidateClientCache("/api/v1/inventory/stock-balances");
      invalidateClientCache("/api/v1/return-notes/site-materials");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openInspectionModal = (mrn: any) => {
    setInspectingMRN(mrn);
    setInspectionForm({
      inspectorName: user?.name || mrn.receiverName || "Yard Quality In-Charge",
      inspectorDesignation: "Quality Inspector",
      inspectionRemarks: mrn.inspectionRemarks || "",
      customerAgreedDamage: mrn.customerAgreedDamage || false,
      items: (mrn.items || []).map((it: any) => ({
        materialVariantId: it.materialVariantId,
        materialName: it.materialVariant?.name || "Material",
        materialCode: it.materialVariant?.materialCode || "",
        size: it.materialVariant?.size || "-",
        uom: it.materialVariant?.uom || "Nos.",
        returnedQty: Number(it.returnedQty),
        acceptedQty: Number(it.acceptedQty),
        damagedQty: Number(it.damagedQty || 0),
        missingQty: Number(it.missingQty || 0),
        rejectedQty: Number(it.rejectedQty || 0),
        condition: (it.condition as any) || "GOOD",
        inspectionRemarks: it.inspectionRemarks || it.remarks || "",
      })),
    });
    setIsInspectionModalOpen(true);
  };

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

      toast.success(`MRN ${inspectingMRN.mrnNumber} inspection successfully verified!`);
      setIsInspectionModalOpen(false);
      setInspectingMRN(null);
      invalidateClientCache("/api/v1/return-notes");
      invalidateClientCache("/api/v1/inventory/stock-balances");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingInspection(false);
    }
  };

  const filteredMRNs = (returnNotes || []).filter((mrn) => {
    if (!mrn) return false;
    const mrnNum = mrn.mrnNumber || "";
    const custName = mrn.customer?.name || "";
    const siteName = mrn.customerSite?.siteName || "";
    const q = (search || "").toLowerCase();
    return (
      mrnNum.toLowerCase().includes(q) ||
      custName.toLowerCase().includes(q) ||
      siteName.toLowerCase().includes(q)
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
        {canCreateReturnNote && (
          <Button
            onClick={() => {
              setIsCreateModalOpen(true);
              if (mrnForm.customerId && sites.length === 0) {
                const selectedCust = customers.find((c) => c.id === mrnForm.customerId);
                if (selectedCust?.sites && Array.isArray(selectedCust.sites) && selectedCust.sites.length > 0) {
                  setSites(selectedCust.sites);
                }
              }
              if (mrnForm.customerSiteId && mrnForm.items.length === 0) {
                loadSiteDeliveredMaterials(mrnForm.customerSiteId);
              }
            }}
            className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white shadow-sm flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Return Note
          </Button>
        )}
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
                (acc, m) =>
                  acc +
                  (m.items || []).reduce((sum: number, it: any) => sum + Number(it.acceptedQty || 0), 0),
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
                  (m.items || []).reduce(
                    (sum: number, it: any) =>
                      sum + Number(it.damagedQty || 0) + Number(it.missingQty || 0),
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
                <th className="px-6 py-4 text-center">Inspection</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <TableSkeleton columns={8} rows={6} />
              ) : filteredMRNs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
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
                    <td className="px-6 py-4 text-slate-700">{mrn.customerSite?.siteName}</td>
                    <td className="px-6 py-4 text-slate-700">{mrn.receivingWarehouse?.name}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(mrn.returnDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {mrn.inspectionStatus === "PENDING" ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-medium text-[11px] inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-amber-600" />
                          Pending Inspection
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-medium text-[11px] inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Verified
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                        {mrn.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {mrn.inspectionStatus === "PENDING" && canCreateReturnNote && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openInspectionModal(mrn)}
                            className="text-xs h-7 px-2.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 hover:border-amber-400 font-semibold"
                            title="Verify physical inspection and record discrepancies"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5 mr-1 text-amber-700" />
                            Record Inspection
                          </Button>
                        )}
                        <Button size="sm" variant="outline" asChild className="text-xs h-7 px-3">
                          <a
                            href={`/api/v1/return-notes/${mrn.id}/print`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Printer className="h-3.5 w-3.5 mr-1" />
                            Print MRN
                          </a>
                        </Button>
                        <WhatsAppShareButton doc={mrn} docType="MRN" />
                      </div>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-[#F26522]" />
              Record Material Return Note (MRN)
            </DialogTitle>
            <DialogDescription>
              Inspection and physical stock return from customer site. Delivered materials auto-populate
              when choosing a site so you can quickly review and modify return quantities.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateMRN} className="space-y-4 pt-2">
            <fieldset
              disabled={submitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
            >
            {/* Primary Selection: Customer & Site */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Customer *</Label>
                <SearchableCombobox
                  options={customers.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.customerCode})`,
                  }))}
                  value={mrnForm.customerId}
                  onChange={handleCustomerChange}
                  placeholder="Select Customer"
                  isLoading={loading && customers.length === 0}
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
                  value={mrnForm.customerSiteId}
                  onChange={handleSiteChange}
                  placeholder={mrnForm.customerId ? "Select Construction Site" : "Select Customer First"}
                  disabled={!mrnForm.customerId}
                  isLoading={Boolean(mrnForm.customerId && sites.length === 0)}
                  emptyText={mrnForm.customerId ? "No construction sites found for this customer." : "Please select a customer first."}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Receiving Yard / Warehouse *</Label>
                <SearchableCombobox
                  options={warehouses.map((w) => ({
                    value: w.id,
                    label: `${w.name} (${w.warehouseCode})`,
                    sublabel: w.contactPerson ? `In-Charge: ${w.contactPerson}` : undefined,
                  }))}
                  value={mrnForm.receivingWarehouseId}
                  onChange={(val) => {
                    const wh = warehouses.find((w) => w.id === val);
                    setMrnForm((prev) => ({
                      ...prev,
                      receivingWarehouseId: val,
                      ...(wh?.contactPerson && !isCustomReceiver ? { receiverName: wh.contactPerson } : {}),
                      ...(wh?.mobile && !isCustomReceiver ? { receiverPhone: wh.mobile } : {}),
                    }));
                  }}
                  placeholder="Select Receiving Yard"
                  isLoading={loading && warehouses.length === 0}
                  emptyText="No warehouses or yards found."
                />
              </div>
            </div>

            {/* Optional Filter by Delivery Note if multiple dispatches exist */}
            {siteDeliveryNotes.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-slate-700">
                    <Boxes className="h-3.5 w-3.5 text-[#F26522]" />
                    Filter by Delivery Note (Optional)
                  </Label>
                  <SearchableCombobox
                    options={[
                      {
                        value: "",
                        label: `All Delivered Materials on Site (${siteDeliveredMaterials.length} unique items)`,
                      },
                      ...siteDeliveryNotes.map((dn) => ({
                        value: dn.id,
                        label: `${dn.dnNumber} (${
                          dn.deliveryDate ? new Date(dn.deliveryDate).toLocaleDateString("en-IN") : ""
                        }) - ${dn.items?.length || 0} items`,
                      })),
                    ]}
                    value={mrnForm.referenceDeliveryNoteId}
                    onChange={handleDeliveryNoteFilterChange}
                    placeholder="All Site Deliveries"
                  />
                </div>
                <div className="flex items-center text-xs text-slate-500 pt-5">
                  Select a specific Delivery Note to narrow down return materials, or leave blank to return
                  from the site&apos;s total held stock.
                </div>
              </div>
            )}

            {/* Section 1: Customer / Site Representative – Material Handover */}
            <div className="border border-slate-200 rounded-lg p-4 bg-amber-50/20 space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-amber-100">
                <UserCheck className="h-4 w-4 text-[#F26522]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  1. Customer / Site Representative – Material Handover
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-1">
                  <div className="flex items-center h-5 mb-1.5">
                    <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Representative Name *</Label>
                  </div>
                  <Input
                    placeholder="e.g. Anand Sharma"
                    value={mrnForm.customerRepresentativeName}
                    onChange={(e) => setMrnForm({ ...mrnForm, customerRepresentativeName: e.target.value })}
                    className="text-sm bg-white"
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center h-5 mb-1.5">
                    <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Designation</Label>
                  </div>
                  <Input
                    placeholder="e.g. Site Supervisor / Engineer"
                    value={mrnForm.customerRepresentativeDesignation}
                    onChange={(e) => setMrnForm({ ...mrnForm, customerRepresentativeDesignation: e.target.value })}
                    className="text-sm bg-white"
                  />
                </div>
                <div>
                  <div className="flex items-center h-5 mb-1.5">
                    <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Mobile Number</Label>
                  </div>
                  <Input
                    placeholder="10-digit mobile"
                    value={mrnForm.customerRepresentativePhone}
                    onChange={(e) => setMrnForm({ ...mrnForm, customerRepresentativePhone: e.target.value })}
                    className="text-sm bg-white"
                  />
                </div>
                <div>
                  <div className="flex items-center h-5 mb-1.5">
                    <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Handover Date</Label>
                  </div>
                  <Input
                    type="date"
                    value={mrnForm.handoverAt}
                    onChange={(e) => setMrnForm({ ...mrnForm, handoverAt: e.target.value })}
                    className="text-sm bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: AJAY ENTERPRISES – Material Receiving Acknowledgement */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/60 space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                <Building2 className="h-4 w-4 text-[#0B1E36]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  2. AJAY ENTERPRISES – Material Receiving Acknowledgement
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between h-5 mb-1.5">
                    <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Received Date *</Label>
                  </div>
                  <Input
                    type="date"
                    value={mrnForm.returnDate}
                    onChange={(e) => setMrnForm({ ...mrnForm, returnDate: e.target.value, receivedAt: e.target.value })}
                    required
                    className="bg-white"
                  />
                </div>

                {/* Company Vehicle No. with Fleet Dropdown + Custom Text Entry */}
                <div>
                  <div className="flex items-center justify-between h-5 mb-1.5">
                    <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Company Vehicle *</Label>
                    {fleetVehicles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsCustomVehicle(!isCustomVehicle)}
                        className="text-[11px] text-[#F26522] hover:underline font-semibold whitespace-nowrap shrink-0"
                      >
                        {isCustomVehicle ? "← Fleet List" : "+ Other Vehicle"}
                      </button>
                    )}
                  </div>
                  {!isCustomVehicle && fleetVehicles.length > 0 ? (
                    <SearchableCombobox
                      options={fleetVehicles.map((v) => ({
                        value: v.vehicleNumber,
                        label: v.vehicleNumber,
                        sublabel: `${v.make || ""} ${v.model || ""}`.trim() || undefined,
                        badge: v.status || "ACTIVE",
                      }))}
                      value={mrnForm.vehicleNumber}
                      onChange={(val) => {
                        const veh = fleetVehicles.find((v) => v.vehicleNumber === val);
                        setMrnForm((prev) => ({
                          ...prev,
                          vehicleNumber: val,
                          ...(veh?.defaultDriver?.name ? { driverName: veh.defaultDriver.name } : {}),
                          ...(veh?.defaultDriver?.mobileNumber ? { driverPhone: veh.defaultDriver.mobileNumber } : {}),
                        }));
                      }}
                      placeholder="Select Vehicle"
                      searchPlaceholder="Search vehicle..."
                      allowClear={false}
                      allowCustomValue={true}
                      customBadge="CUSTOM"
                    />
                  ) : (
                    <Input
                      maxLength={20}
                      placeholder="KA-01-AB-1234"
                      value={mrnForm.vehicleNumber}
                      onChange={(e) => setMrnForm({ ...mrnForm, vehicleNumber: e.target.value.toUpperCase().slice(0, 20) })}
                      className="uppercase font-mono text-sm bg-white"
                      required
                    />
                  )}
                </div>

                {/* Yard Receiver Name with Registered Staff Dropdown + Custom Text Entry */}
                <div>
                  <div className="flex items-center justify-between h-5 mb-1.5">
                    <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Yard Receiver Name *</Label>
                    {receiverOptions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsCustomReceiver(!isCustomReceiver)}
                        className="text-[11px] text-[#F26522] hover:underline font-semibold whitespace-nowrap shrink-0"
                      >
                        {isCustomReceiver ? "← Staff List" : "+ Other Name"}
                      </button>
                    )}
                  </div>
                  {!isCustomReceiver && receiverOptions.length > 0 ? (
                    <SearchableCombobox
                      options={receiverOptions.map((r) => ({
                        value: r.value,
                        label: r.label,
                        sublabel: r.sublabel,
                        badge: r.badge,
                      }))}
                      value={mrnForm.receiverName}
                      onChange={(val) => {
                        const matched = receiverOptions.find((r) => r.value === val);
                        setMrnForm((prev) => ({
                          ...prev,
                          receiverName: val,
                          ...(matched?.phone ? { receiverPhone: matched.phone } : {}),
                        }));
                      }}
                      placeholder="Select Receiver"
                      searchPlaceholder="Search receiver..."
                      allowClear={false}
                      allowCustomValue={true}
                      customBadge="MANUAL"
                    />
                  ) : (
                    <Input
                      maxLength={100}
                      placeholder="e.g. Ramesh Kumar"
                      value={mrnForm.receiverName}
                      onChange={(e) => setMrnForm({ ...mrnForm, receiverName: e.target.value.slice(0, 100) })}
                      className="text-sm bg-white"
                      required
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-xs font-semibold">Receiver Designation</Label>
                  <Input
                    placeholder="e.g. Yard In-Charge / Store Manager"
                    value={mrnForm.receiverDesignation}
                    onChange={(e) => setMrnForm({ ...mrnForm, receiverDesignation: e.target.value })}
                    className="text-sm bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Receiver Contact Phone</Label>
                  <Input
                    placeholder="10-digit mobile"
                    value={mrnForm.receiverPhone}
                    onChange={(e) => setMrnForm({ ...mrnForm, receiverPhone: e.target.value })}
                    className="text-sm bg-white"
                  />
                </div>
              </div>

              {/* Independent Return Date Option */}
              <div className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-md text-xs mt-1">
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
            </div>

            {/* Section 3: Physical Inspection Timing Mode */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/40">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                3. Physical Inspection Timing Event
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setMrnForm({ ...mrnForm, inspectionStatus: "COMPLETED" })}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    mrnForm.inspectionStatus === "COMPLETED"
                      ? "bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Immediate Inspection
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200">
                      Verified Now
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Both parties inspect materials immediately upon handover. Accepted and damaged quantities are finalized together.
                  </p>
                </div>

                <div
                  onClick={() => setMrnForm({ ...mrnForm, inspectionStatus: "PENDING" })}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    mrnForm.inspectionStatus === "PENDING"
                      ? "bg-amber-50 border-amber-400 ring-1 ring-amber-400"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-amber-600" />
                      Inspection After Receipt
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">
                      Pending Verification
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Record handover and custody transfer first. Yard staff performs physical count and quality verification separately later.
                  </p>
                </div>
              </div>
            </div>

            {/* Returned Items Breakdown with Auto-Population */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    Returned Materials Inspection
                    {autoPopulatedCount > 0 && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-normal text-xs">
                        <Sparkles className="h-3 w-3 mr-1 text-emerald-600" />
                        {autoPopulatedCount} Auto-Populated
                      </Badge>
                    )}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Verify physical quantities returned from site. Edit quantities or remove items not included.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {mrnForm.customerSiteId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        loadSiteDeliveredMaterials(mrnForm.customerSiteId, mrnForm.referenceDeliveryNoteId)
                      }
                      disabled={loadingSiteMaterials}
                      className="text-xs h-7 text-slate-600 hover:text-slate-900"
                      title="Reload delivered materials from site"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${loadingSiteMaterials ? "animate-spin" : ""}`} />
                      Reload Site Stock
                    </Button>
                  )}
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
              </div>

              {/* Status / Guidance Banner */}
              {loadingSiteMaterials ? (
                <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-[#F26522]" />
                  <span>Fetching delivered centering materials currently held at this construction site...</span>
                </div>
              ) : autoPopulatedCount > 0 ? (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Delivered materials auto-populated from site custody.</strong> Quantities are prefilled with current site stock. You can edit any quantity for partial returns, report damaged units, or remove lines.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        loadSiteDeliveredMaterials(mrnForm.customerSiteId, mrnForm.referenceDeliveryNoteId)
                      }
                      className="text-xs h-6 px-2 text-emerald-700 hover:text-emerald-900"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Reset to Site Stock
                    </Button>
                  </div>
                </div>
              ) : mrnForm.customerSiteId ? (
                <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    No active delivered materials currently recorded at this construction site. You can manually
                    add items below using the <strong>+ Add Material</strong> button.
                  </span>
                </div>
              ) : (
                <div className="bg-slate-100/70 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>Select a customer and construction site above to automatically load delivered materials.</span>
                </div>
              )}

              {/* Items List */}
              {mrnForm.items.length === 0 && !loadingSiteMaterials && (
                <div className="text-center py-6 bg-white rounded-lg border border-dashed border-slate-300 text-xs text-slate-500">
                  No materials currently selected. Click <strong>&quot;+ Add Material&quot;</strong> to add items.
                </div>
              )}

              {mrnForm.items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2.5 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  {/* Top Item Summary Info */}
                  {(item.heldQty !== undefined && item.heldQty > 0) && (
                    <div className="flex flex-wrap items-center justify-between text-xs pb-1 border-b border-slate-100 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {item.materialName || variants.find((v) => v.id === item.materialVariantId)?.name || "Material"}
                        </span>
                        {item.materialCode && (
                          <span className="text-[11px] font-mono text-slate-400">
                            ({item.materialCode})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px] font-medium"
                        >
                          Held on Site: {item.heldQty} {item.uom || "Nos."}
                        </Badge>
                        {item.deliveryNotes && item.deliveryNotes.length > 0 && (
                          <span className="text-[10px] text-slate-400 hidden sm:inline">
                            via {item.deliveryNotes.map((d) => d.dnNumber).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-12 gap-2.5 items-end">
                    <div className="col-span-12 md:col-span-5">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">
                        Material Variant *
                      </Label>
                      <SearchableCombobox
                        options={variants.map((v) => ({
                          value: v.id,
                          label: `${v.name} ${v.size ? `(${v.size})` : ""} - ${v.materialCode}`,
                        }))}
                        value={item.materialVariantId}
                        onChange={(val) => {
                          const updated = [...mrnForm.items];
                          updated[idx].materialVariantId = val;
                          const foundVariant = variants.find((v) => v.id === val);
                          if (foundVariant) {
                            updated[idx].materialName = foundVariant.name;
                            updated[idx].materialCode = foundVariant.materialCode;
                            updated[idx].uom = foundVariant.uom;
                            updated[idx].size = foundVariant.size;
                          }
                          setMrnForm({ ...mrnForm, items: updated });
                        }}
                        placeholder="Select Material"
                        isLoading={loading && variants.length === 0}
                        emptyText="No materials found."
                      />
                    </div>

                    <div className="col-span-4 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold">
                          Returned Qty *
                        </Label>
                        {item.heldQty !== undefined && item.heldQty > 0 && item.returnedQty !== item.heldQty && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...mrnForm.items];
                              updated[idx].returnedQty = item.heldQty!;
                              updated[idx].acceptedQty = Math.max(0, item.heldQty! - (updated[idx].damagedQty || 0));
                              setMrnForm({ ...mrnForm, items: updated });
                            }}
                            className="text-[10px] text-[#F26522] hover:underline font-medium"
                            title="Fill maximum quantity held on site"
                          >
                            Fill Max
                          </button>
                        )}
                      </div>
                      <Input
                        type="number"
                        step="any"
                        min="0.001"
                        value={item.returnedQty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const updated = [...mrnForm.items];
                          updated[idx].returnedQty = val;
                          updated[idx].acceptedQty = Math.max(0, val - (updated[idx].damagedQty || 0));
                          setMrnForm({ ...mrnForm, items: updated });
                        }}
                      />
                      {item.heldQty !== undefined && item.heldQty > 0 && item.returnedQty > item.heldQty && (
                        <p className="text-[10px] text-amber-600 mt-0.5 leading-tight">
                          ⚠ Exceeds site stock ({item.heldQty})
                        </p>
                      )}
                    </div>

                    <div className="col-span-4 md:col-span-2">
                      <Label className="text-[10px] text-emerald-600 uppercase font-bold">
                        Accepted (Good)
                      </Label>
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
                          updated[idx].acceptedQty = Math.max(0, updated[idx].returnedQty - dmg - (updated[idx].missingQty || 0));
                          setMrnForm({ ...mrnForm, items: updated });
                        }}
                      />
                    </div>

                    <div className="col-span-3 md:col-span-2">
                      <Label className="text-[10px] text-red-600 uppercase font-bold">Missing</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={item.missingQty}
                        onChange={(e) => {
                          const mis = parseFloat(e.target.value) || 0;
                          const updated = [...mrnForm.items];
                          updated[idx].missingQty = mis;
                          updated[idx].acceptedQty = Math.max(0, updated[idx].returnedQty - (updated[idx].damagedQty || 0) - mis);
                          setMrnForm({ ...mrnForm, items: updated });
                        }}
                      />
                    </div>

                    <div className="col-span-1 flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLine(idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0"
                        title="Remove material from this return note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-100 flex items-center gap-2">
                    <Label className="text-[10px] text-slate-400 uppercase font-medium shrink-0">Line Notes:</Label>
                    <Input
                      placeholder="Specific physical defect or condition notes"
                      value={item.inspectionRemarks || item.remarks || ""}
                      onChange={(e) => {
                        const updated = [...mrnForm.items];
                        updated[idx].inspectionRemarks = e.target.value;
                        updated[idx].remarks = e.target.value;
                        setMrnForm({ ...mrnForm, items: updated });
                      }}
                      className="text-xs h-7 bg-slate-50/50"
                    />
                  </div>
                </div>
              ))}

              {/* Discrepancy & Customer Agreement Banner */}
              {mrnForm.items.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-start gap-2 p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs">
                    <input
                      type="checkbox"
                      id="customerAgreedDamage"
                      checked={mrnForm.customerAgreedDamage}
                      onChange={(e) => setMrnForm({ ...mrnForm, customerAgreedDamage: e.target.checked })}
                      className="h-4 w-4 text-[#F26522] rounded border-slate-300 mt-0.5"
                    />
                    <label htmlFor="customerAgreedDamage" className="text-slate-800 cursor-pointer">
                      <strong>Explicit Customer Acknowledgement:</strong> Customer site representative was present, inspected, and explicitly agrees to the recorded damage/shortage findings.
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">General Remarks / Inspection Notes</Label>
              <Input
                placeholder="Remarks regarding batch, vehicle, or returned condition"
                value={mrnForm.remarks}
                onChange={(e) => setMrnForm({ ...mrnForm, remarks: e.target.value })}
              />
            </div>
            </fieldset>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                isLoading={submitting}
                loadingText="Posting Return Note..."
                className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white"
              >
                Post Return Note &amp; Issue Acknowledgement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELAYED INSPECTION MODAL */}
      <Dialog open={isInspectionModalOpen} onOpenChange={setIsInspectionModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-[#F26522]" />
              Record Physical Yard Inspection · {inspectingMRN?.mrnNumber}
            </DialogTitle>
            <DialogDescription>
              Verify physical counts and quality of returned materials received at {inspectingMRN?.receivingWarehouse?.name || "yard"}.
              Original customer handover details will be strictly preserved.
            </DialogDescription>
          </DialogHeader>

          {inspectingMRN && (
            <form onSubmit={handleSaveInspection} className="space-y-4 pt-2">
              <fieldset
                disabled={submittingInspection}
                className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submittingInspection && "pointer-events-none opacity-60")}
              >
              {/* Preserved Customer Handover Details Card */}
              <div className="p-3.5 bg-amber-50/40 border border-amber-200 rounded-lg text-xs space-y-1.5">
                <div className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <ShieldCheck className="h-4 w-4 text-amber-700" />
                  Preserved Customer Handover Record (Immutable)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400">Representative:</span>{" "}
                    <strong>{inspectingMRN.customerRepresentativeName || inspectingMRN.customerSite?.siteInCharge || "Customer Representative"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Site / Project:</span>{" "}
                    <strong>{inspectingMRN.customerSite?.siteName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Handover Date:</span>{" "}
                    <strong>{new Date(inspectingMRN.handoverAt || inspectingMRN.returnDate).toLocaleDateString("en-IN")}</strong>
                  </div>
                </div>
              </div>

              {/* Inspector Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <Label className="text-xs font-semibold">Inspector Name *</Label>
                  <Input
                    placeholder="e.g. Ramesh Kumar"
                    value={inspectionForm.inspectorName}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, inspectorName: e.target.value })}
                    className="text-sm bg-white"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Inspector Designation</Label>
                  <Input
                    placeholder="e.g. Quality Controller / Yard In-Charge"
                    value={inspectionForm.inspectorDesignation}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, inspectorDesignation: e.target.value })}
                    className="text-sm bg-white"
                  />
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold uppercase text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5 text-right">Declared</th>
                      <th className="p-2.5 text-right w-24">Accepted (Good)</th>
                      <th className="p-2.5 text-right w-24 text-amber-700">Damaged</th>
                      <th className="p-2.5 text-right w-24 text-red-700">Missing</th>
                      <th className="p-2.5 text-right w-24 text-slate-700">Rejected</th>
                      <th className="p-2.5 w-36">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {inspectionForm.items.map((it, idx) => (
                      <tr key={it.materialVariantId} className="hover:bg-slate-50/50">
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-900">{it.materialName}</div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {it.materialCode} {it.size ? `• ${it.size}` : ""}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-800">
                          {it.returnedQty} {it.uom}
                        </td>
                        <td className="p-2.5 text-right">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={it.acceptedQty}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = [...inspectionForm.items];
                              updated[idx].acceptedQty = val;
                              setInspectionForm({ ...inspectionForm, items: updated });
                            }}
                            className="h-7 text-xs text-right bg-emerald-50/30 border-emerald-300 font-bold text-emerald-800"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={it.damagedQty}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = [...inspectionForm.items];
                              updated[idx].damagedQty = val;
                              updated[idx].acceptedQty = Math.max(0, updated[idx].returnedQty - val - (updated[idx].missingQty || 0) - (updated[idx].rejectedQty || 0));
                              setInspectionForm({ ...inspectionForm, items: updated });
                            }}
                            className="h-7 text-xs text-right bg-amber-50/40 border-amber-300 font-bold text-amber-800"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={it.missingQty}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = [...inspectionForm.items];
                              updated[idx].missingQty = val;
                              updated[idx].acceptedQty = Math.max(0, updated[idx].returnedQty - (updated[idx].damagedQty || 0) - val - (updated[idx].rejectedQty || 0));
                              setInspectionForm({ ...inspectionForm, items: updated });
                            }}
                            className="h-7 text-xs text-right bg-red-50/40 border-red-300 font-bold text-red-800"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={it.rejectedQty}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = [...inspectionForm.items];
                              updated[idx].rejectedQty = val;
                              updated[idx].acceptedQty = Math.max(0, updated[idx].returnedQty - (updated[idx].damagedQty || 0) - (updated[idx].missingQty || 0) - val);
                              setInspectionForm({ ...inspectionForm, items: updated });
                            }}
                            className="h-7 text-xs text-right bg-slate-50 border-slate-300 text-slate-800"
                          />
                        </td>
                        <td className="p-2.5">
                          <Input
                            placeholder="Condition notes"
                            value={it.inspectionRemarks}
                            onChange={(e) => {
                              const updated = [...inspectionForm.items];
                              updated[idx].inspectionRemarks = e.target.value;
                              setInspectionForm({ ...inspectionForm, items: updated });
                            }}
                            className="h-7 text-[11px]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Customer Agreed Damage Checkbox */}
              <div className="flex items-start gap-2 p-3 bg-amber-50/50 border border-amber-200 rounded-lg text-xs">
                <input
                  type="checkbox"
                  id="inspectCustomerAgreed"
                  checked={inspectionForm.customerAgreedDamage}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, customerAgreedDamage: e.target.checked })}
                  className="h-4 w-4 text-[#F26522] rounded border-slate-300 mt-0.5"
                />
                <label htmlFor="inspectCustomerAgreed" className="text-slate-800 cursor-pointer">
                  <strong>Customer Agreed Damage Findings:</strong> Check this only if the customer representative has explicitly reviewed and accepted the damaged and missing counts.
                </label>
              </div>

              <div>
                <Label className="text-xs font-semibold">General Inspection Remarks</Label>
                <Input
                  placeholder="Summary of inspection findings, lot quality, or repair requirements"
                  value={inspectionForm.inspectionRemarks}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, inspectionRemarks: e.target.value })}
                />
              </div>
              </fieldset>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInspectionModalOpen(false)}
                  disabled={submittingInspection}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingInspection}
                  isLoading={submittingInspection}
                  loadingText="Recording Inspection..."
                  className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white"
                >
                  <ClipboardCheck className="h-4 w-4 mr-1.5 text-[#F26522]" />
                  Save &amp; Verify Inspection
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
