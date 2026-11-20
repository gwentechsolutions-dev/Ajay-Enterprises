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
  RefreshCw,
  Ban,
  Camera,
  X,
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
import { fetchWithClientCache, invalidateClientCache } from "@/lib/client-cache";
import { useCurrentUser } from "@/lib/auth-context";
import { stampGpsWatermarkOnPhoto } from "@/lib/gps-watermark";
import { uploadEvidenceWithWatermark } from "@/lib/evidence-uploader";
import { FormFieldError } from "@/components/ui/form-field-error";
import { parseApiValidationErrors, formatValidationToast } from "@/lib/forms/validation-mapper";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { WhatsAppShareButton } from "@/components/ui/whatsapp-share-button";

export default function DeliveryNotesPage() {
  const { isDeliveryPerson, canCreateDeliveryNote } = useCurrentUser();
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
  const [deliverErrors, setDeliverErrors] = React.useState<Record<string, string>>({});
  const [dnErrors, setDnErrors] = React.useState<Record<string, string>>({});
  const [discardConfirmModal, setDiscardConfirmModal] = React.useState<{
    isOpen: boolean;
    dn: any | null;
  }>({
    isOpen: false,
    dn: null,
  });

  // Fleet vehicles state for registered company vehicles
  const [fleetVehicles, setFleetVehicles] = React.useState<any[]>([]);
  const [fleetDrivers, setFleetDrivers] = React.useState<any[]>([]);
  const [showDriverSuggestions, setShowDriverSuggestions] = React.useState(false);
  const driverSuggestionsRef = React.useRef<HTMLDivElement>(null);
  const [isCustomEwbVehicle, setIsCustomEwbVehicle] = React.useState(false);
  const [isCustomUpdateVehicle, setIsCustomUpdateVehicle] = React.useState(false);
  const [isCustomDnVehicle, setIsCustomDnVehicle] = React.useState(false);
  const [uploadingDeliveryPhoto, setUploadingDeliveryPhoto] = React.useState(false);
  const [deliverPhotoPreview, setDeliverPhotoPreview] = React.useState<string | null>(null);
  const [deliverPhotoPreviews, setDeliverPhotoPreviews] = React.useState<string[]>([]);
  const [deliverUploadedUrls, setDeliverUploadedUrls] = React.useState<string[]>([]);
  const deliverCameraInputRef = React.useRef<HTMLInputElement>(null);

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
    transportCharges: "",
    items: [
      {
        materialVariantId: "",
        selectedMaterialName: "",
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
      // 1. Primary: Fetch delivery notes
      const dnData = await fetchWithClientCache("/api/v1/delivery-notes", {
        forceRefresh,
        onBackgroundUpdate: (fresh) => setDeliveryNotes(Array.isArray(fresh) ? fresh : []),
      });
      if (dnData) setDeliveryNotes(Array.isArray(dnData) ? dnData : []);
    } catch (err) {
      console.error("Failed to load delivery notes:", err);
      toast.error("Failed to load delivery notes.");
    } finally {
      setLoading(false);
    }

    // 2. Auxiliary master data for Create/Edit Modal: Only needed if user can create/edit notes
    if (canCreateDeliveryNote) {
      try {
        const [custData, whData, varData, vehData, drvData] = await Promise.all([
          fetchWithClientCache("/api/v1/customers", {
            forceRefresh,
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
          fetchWithClientCache("/api/v1/fleet/drivers", {
            forceRefresh,
            ttlMs: 60_000,
            onBackgroundUpdate: (fresh) => {
              if (Array.isArray(fresh)) setFleetDrivers(fresh);
            },
          }).catch(() => null),
        ]);

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
        if (vehData && Array.isArray(vehData)) setFleetVehicles(vehData);
        if (drvData && Array.isArray(drvData)) setFleetDrivers(drvData);
      } catch (err) {
        console.warn("Could not pre-load auxiliary master data:", err);
      }
    }
  }, [canCreateDeliveryNote]);

  // Fetch stock balances for selected source yard in Create/Edit form
  React.useEffect(() => {
    if (!canCreateDeliveryNote || !dnForm.sourceWarehouseId) return;
    let isMounted = true;
    fetchWithClientCache(`/api/v1/inventory/stock-balances?warehouseId=${dnForm.sourceWarehouseId}&locationType=WAREHOUSE`, {
      ttlMs: 30_000,
      onBackgroundUpdate: (fresh) => {
        if (!isMounted || !Array.isArray(fresh)) return;
        const map: Record<string, number> = {};
        for (const b of fresh) {
          map[b.materialVariantId] = (map[b.materialVariantId] || 0) + Number(b.availableQty);
        }
        setYardStocks(map);
      },
    })
      .then((data) => {
        if (!isMounted || !Array.isArray(data)) return;
        const map: Record<string, number> = {};
        for (const b of data) {
          map[b.materialVariantId] = (map[b.materialVariantId] || 0) + Number(b.availableQty);
        }
        setYardStocks(map);
      })
      .catch(() => { });

    return () => {
      isMounted = false;
    };
  }, [dnForm.sourceWarehouseId]);

  React.useEffect(() => {
    loadData();
    if (typeof window !== "undefined" && canCreateDeliveryNote) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "new") {
        setIsCreateModalOpen(true);
      }
    }
  }, [loadData, canCreateDeliveryNote]);

  // Click outside to close driver suggestions popover
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (driverSuggestionsRef.current && !driverSuggestionsRef.current.contains(event.target as Node)) {
        setShowDriverSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter registered drivers for auto-suggestions
  const filteredDrivers = React.useMemo(() => {
    const q = (dnForm.driverName || "").toLowerCase().trim();
    if (!q) return fleetDrivers;
    return fleetDrivers.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.mobileNumber?.includes(q) ||
        d.driverCode?.toLowerCase().includes(q)
    );
  }, [fleetDrivers, dnForm.driverName]);

  // Group material variants under parent material name
  const materialGroups = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const v of variants) {
      const groupName = v.name?.trim() || "Uncategorized";
      if (!map.has(groupName)) {
        map.set(groupName, []);
      }
      map.get(groupName)!.push(v);
    }
    return Array.from(map.entries())
      .map(([name, groupVars]) => ({
        name,
        variants: groupVars,
        count: groupVars.length,
        category: groupVars[0]?.materialType?.name || groupVars[0]?.materialType?.category?.name || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [variants]);

  // Load sites when customer changes (instant from in-memory customer object)
  const handleCustomerChange = (customerId: string) => {
    setDnForm((prev) => ({ ...prev, customerId, customerSiteId: "" }));
    if (!customerId) {
      setSites([]);
      return;
    }

    // 1. Instant 0ms memory lookup from already-loaded customer tree
    const selectedCust = customers.find((c) => c.id === customerId);
    if (selectedCust?.sites && Array.isArray(selectedCust.sites) && selectedCust.sites.length > 0) {
      setSites(selectedCust.sites);
      setDnForm((prev) => ({ ...prev, customerId, customerSiteId: selectedCust.sites[0].id }));
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
            setDnForm((prev) => ({ ...prev, customerSiteId: data[0].id }));
          }
        }
      })
      .catch(() => {
        toast.error("Failed to load customer sites");
      });
  };

  const handleAddLine = () => {
    setDnForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          materialVariantId: "",
          selectedMaterialName: "",
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
          transportCharges: dnForm.transportCharges ? parseFloat(dnForm.transportCharges) : 0,
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
      invalidateClientCache("/api/v1/dashboard");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingDnId(null);
    setDnForm({
      customerId: "",
      customerSiteId: "",
      sourceWarehouseId: "",
      deliveryDate: new Date().toISOString().split("T")[0],
      includeDeliveryDate: true,
      vehicleNumber: fleetVehicles[0]?.vehicleNumber || "KA-01-AB-1234",
      driverName: fleetVehicles[0]?.defaultDriver?.name || "",
      driverPhone: fleetVehicles[0]?.defaultDriver?.mobileNumber || "",
      notes: "",
      transportCharges: "",
      items: [
        {
          materialVariantId: "",
          selectedMaterialName: "",
          ownershipType: "OWNED" as "OWNED" | "HIRED_IN",
          dispatchedQty: 50,
          dailyRentalRate: 2.5,
          remarks: "",
        },
      ],
    });
    setIsCreateModalOpen(true);
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
      transportCharges: dn.transportCharges ? Number(dn.transportCharges).toString() : "",
      items: dn.items.map((it: any) => {
        const v = variants.find((x) => x.id === it.materialVariantId);
        return {
          materialVariantId: it.materialVariantId,
          selectedMaterialName: v?.name?.trim() || "",
          ownershipType: it.ownershipType,
          dispatchedQty: Number(it.quantity),
          dailyRentalRate: Number(it.dailyRate || 0),
          remarks: it.remarks || "",
        };
      }),
    });

    if (dn.customerId) {
      const cust = customers.find((c) => c.id === dn.customerId);
      if (cust?.sites && Array.isArray(cust.sites) && cust.sites.length > 0) {
        setSites(cust.sites);
      } else {
        fetchWithClientCache(`/api/v1/customers/${dn.customerId}/sites`, {
          ttlMs: 60_000,
        })
          .then((data) => {
            if (Array.isArray(data)) setSites(data);
          })
          .catch(() => { });
      }
    }

    setIsCreateModalOpen(true);
  };

  const handleDiscardDraft = (dn: any) => {
    setDiscardConfirmModal({
      isOpen: true,
      dn,
    });
  };

  const executeDiscardDraft = async () => {
    const dn = discardConfirmModal.dn;
    if (!dn) return;
    setDiscardConfirmModal({ isOpen: false, dn: null });

    // 1. Optimistic UI removal (0ms): instantly remove from table and KPI cards so it never lingers
    setDeliveryNotes((prev) => prev.filter((d) => d.id !== dn.id));

    try {
      const res = await fetch(`/api/v1/delivery-notes/${dn.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to discard draft");
      toast.success(`Draft Delivery Note ${dn.dnNumber} discarded.`);
      invalidateClientCache("/api/v1/delivery-notes");
      invalidateClientCache("/api/v1/dashboard");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
      // Revert optimistic removal on server failure
      await loadData(true);
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
      invalidateClientCache("/api/v1/dashboard");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDispatching(false);
    }
  };

  const handleDeliverPhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (deliverUploadedUrls.length >= 10) {
      toast.error("Maximum 10 images allowed for Delivery Note");
      if (e.target) e.target.value = "";
      return;
    }

    try {
      setUploadingDeliveryPhoto(true);

      const res = await uploadEvidenceWithWatermark({
        file,
        latitude: deliverForm.gpsLatitude,
        longitude: deliverForm.gpsLongitude,
        accuracy: deliverForm.gpsAccuracy,
        documentType: "DELIVERY_NOTE",
        documentId: selectedDN?.id || "00000000-0000-0000-0000-000000000000",
        documentNumber: selectedDN?.dnNumber || "DELIVERY-NOTE",
        siteName: selectedDN?.customerSite?.siteName || "Construction Site",
        customerName: selectedDN?.customer?.name || "",
        evidenceCategory: "DELIVERY_PHOTO",
        timestamp: new Date(),
      });

      // Show watermarked photo immediately in the preview
      setDeliverPhotoPreview(res.dataUrl);
      setDeliverPhotoPreviews((prev) => [...prev, res.dataUrl]);
      setDeliverUploadedUrls((prev) => [...prev, res.watermarkedUrl]);
      setDeliverForm((prev) => ({ ...prev, photoUrl: res.watermarkedUrl }));
      toast.success("Delivery photo uploaded with GPS watermark!");
    } catch (err: any) {
      toast.error(`Photo upload error: ${err.message}`);
    } finally {
      setUploadingDeliveryPhoto(false);
      if (e.target) e.target.value = "";
    }
  };

  const removeDeliverPhoto = (index: number) => {
    setDeliverPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    setDeliverUploadedUrls((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      setDeliverForm((f) => ({ ...f, photoUrl: updated[0] || "" }));
      return updated;
    });
  };

  const openDeliverModal = (dn: any) => {
    setSelectedDN(dn);
    setDeliverPhotoPreview(null);
    setDeliverPhotoPreviews([]);
    setDeliverUploadedUrls([]);
    setDeliverErrors({});
    const initialPhone = (dn.customerSite?.siteContactDetails || "").replace(/\D/g, "").slice(0, 10);
    setDeliverForm({
      receiverName: (dn.customerSite?.siteInCharge || "").slice(0, 100),
      receiverPhone: initialPhone,
      receiverDesignation: "Site In-Charge",
      photoUrl: "",
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

    // Strict client-side validation
    const newErrors: Record<string, string> = {};
    if (!deliverForm.receiverName || deliverForm.receiverName.trim().length < 2) {
      newErrors.receiverName = "Receiver full name is required (minimum 2 characters)";
    }
    const cleanPhone = (deliverForm.receiverPhone || "").replace(/\D/g, "");
    if (!cleanPhone) {
      newErrors.receiverPhone = "Receiver mobile phone is required";
    } else if (cleanPhone.length !== 10) {
      newErrors.receiverPhone = `Must be exactly 10 digits (currently ${cleanPhone.length} digits)`;
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      newErrors.receiverPhone = "Must start with 6, 7, 8, or 9 (valid Indian mobile)";
    }

    if (deliverUploadedUrls.length === 0 && !deliverForm.photoUrl) {
      newErrors.photo = "Site delivery proof photo is required before confirming delivery";
    }

    if (Object.keys(newErrors).length > 0) {
      setDeliverErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      return toast.error(firstError);
    }

    setDeliverErrors({});

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/delivery-notes/${selectedDN.id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...deliverForm,
          photoUrl: deliverUploadedUrls[0] || deliverForm.photoUrl,
          additionalPhotoUrls: deliverUploadedUrls.slice(1),
          receiverName: deliverForm.receiverName.trim(),
          receiverPhone: cleanPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const parsed = parseApiValidationErrors(data);
        if (parsed.hasErrors) {
          setDeliverErrors(parsed.fieldErrors);
          toast.error(formatValidationToast(parsed));
          return;
        }
        throw new Error(data.error?.message || "Failed to deliver note");
      }

      toast.success(`Delivery Note ${selectedDN.dnNumber} marked DELIVERED with receiver acknowledgement!`);
      setIsDeliverModalOpen(false);
      invalidateClientCache("/api/v1/delivery-notes");
      invalidateClientCache("/api/v1/dashboard");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const [showRegenerateForm, setShowRegenerateForm] = React.useState(false);
  const [copiedEwb, setCopiedEwb] = React.useState(false);
  const [activeEwbProvider, setActiveEwbProvider] = React.useState<"WHITEBOOKS" | "FYN">("WHITEBOOKS");
  const [refreshingEwb, setRefreshingEwb] = React.useState(false);

  // Part-B Vehicle Update Modal State
  const [isUpdateVehicleModalOpen, setIsUpdateVehicleModalOpen] = React.useState(false);
  const [updateVehicleForm, setUpdateVehicleForm] = React.useState({
    newVehicleNumber: "",
    fromPlace: "Bengaluru",
    fromStateCode: 33,
    reasonCode: "3" as "1" | "2" | "3",
    reasonDescription: "Vehicle change during transit",
  });

  // Statutory Cancellation Modal State
  const [isCancelEwbModalOpen, setIsCancelEwbModalOpen] = React.useState(false);
  const [cancelEwbForm, setCancelEwbForm] = React.useState({
    cancelReason: "",
    cancelReasonCode: "4" as "1" | "2" | "3" | "4",
  });

  // Fetch active provider on mount
  React.useEffect(() => {
    fetch("/api/v1/ewaybills/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.activeProvider) {
          setActiveEwbProvider(data.data.activeProvider);
        }
      })
      .catch(() => { });
  }, []);

  const openEwbModal = (dn: any) => {
    setSelectedDN(dn);
    setShowRegenerateForm(!dn.eWayBillNumber);
    setCopiedEwb(false);
    const latestEwb = dn.eWayBills?.[0];
    const sourceYard = warehouses.find((w: any) => w.id === dn.sourceWarehouseId);

    const targetVehNo = latestEwb?.vehicleNumber || dn.vehicleNumber || "";
    const cleanTarget = targetVehNo.replace(/[\s\-_]/g, "").toUpperCase();
    const matchedVehicle = fleetVehicles.find(
      (v: any) => v.vehicleNumber.replace(/[\s\-_]/g, "").toUpperCase() === cleanTarget
    );
    const finalVehNo = matchedVehicle?.vehicleNumber || targetVehNo || fleetVehicles[0]?.vehicleNumber || "KA-01-EA-4412";
    const isFleet = fleetVehicles.some((v: any) => v.vehicleNumber === finalVehNo);
    setIsCustomEwbVehicle(!isFleet && !!finalVehNo && fleetVehicles.length > 0);
    setIsCustomUpdateVehicle(false);

    setEwbForm({
      vehicleNumber: finalVehNo,
      fromPincode: latestEwb?.fromPincode || sourceYard?.pincode || "560058",
      toPincode: latestEwb?.toPincode || dn.customerSite?.pincode || "560068",
      distanceKm: latestEwb?.distanceKm || 30,
    });

    setUpdateVehicleForm({
      newVehicleNumber: finalVehNo,
      fromPlace: sourceYard?.city || "Bengaluru",
      fromStateCode: parseInt(sourceYard?.stateCode || "33", 10) || 33,
      reasonCode: "3",
      reasonDescription: "Vehicle change during transit",
    });

    setCancelEwbForm({
      cancelReason: "",
      cancelReasonCode: "4",
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
          provider: activeEwbProvider,
          ...ewbForm,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to generate E-Way Bill");

      const providerLabel = data.data?.provider === "FYN" ? "FYN Gateway" : "WhiteBooks GSP (Sandbox)";
      toast.success(`E-Way Bill ${data.data.ewbNumber} generated via ${providerLabel}!`);
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

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDN?.eWayBillNumber) return;
    if (selectedDN?.status === "DELIVERED") {
      toast.error("Cannot update Part-B: Goods have already been delivered at site.");
      setIsUpdateVehicleModalOpen(false);
      return;
    }

    try {
      setSubmitting(true);
      const targetId = selectedDN.eWayBills?.[0]?.id || selectedDN.eWayBillNumber;
      const res = await fetch(`/api/v1/ewaybills/${targetId}/update-vehicle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateVehicleForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to update vehicle");

      toast.success(data.data?.message || `Part-B vehicle updated to ${updateVehicleForm.newVehicleNumber}!`);
      setIsUpdateVehicleModalOpen(false);
      setIsEwbModalOpen(false);
      invalidateClientCache("/api/v1/delivery-notes");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEwb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDN?.eWayBillNumber) return;
    if (selectedDN?.status === "DELIVERED") {
      toast.error("Cannot cancel E-Way Bill: Goods have already been delivered at site.");
      setIsCancelEwbModalOpen(false);
      return;
    }

    try {
      setSubmitting(true);
      const targetId = selectedDN.eWayBills?.[0]?.id || selectedDN.eWayBillNumber;
      const res = await fetch(`/api/v1/ewaybills/${targetId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cancelEwbForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to cancel E-Way Bill");

      toast.success(data.data?.message || `E-Way Bill ${selectedDN.eWayBillNumber} cancelled successfully!`);
      setIsCancelEwbModalOpen(false);
      setIsEwbModalOpen(false);
      invalidateClientCache("/api/v1/delivery-notes");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshEwb = async () => {
    if (!selectedDN?.eWayBillNumber) return;
    try {
      setRefreshingEwb(true);
      const targetId = selectedDN.eWayBills?.[0]?.id || selectedDN.eWayBillNumber;
      const res = await fetch(`/api/v1/ewaybills/${targetId}?refresh=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to refresh E-Way Bill details");
      toast.success("E-Way Bill details refreshed from statutory provider.");
      invalidateClientCache("/api/v1/delivery-notes");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRefreshingEwb(false);
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2 flex-wrap break-words">
            <Truck className="h-7 w-7 text-[#F26522]" />
            Delivery Notes (DN)
          </h1>
          <p className="text-sm text-slate-500">
            Outward centering material custody transfer from AJAY ENTERPRISES yards to customer construction sites
          </p>
        </div>
        {canCreateDeliveryNote && (
          <Button
            onClick={handleOpenCreate}
            className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white shadow-sm flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Delivery Note
          </Button>
        )}
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
          <table className="w-full text-left text-sm text-slate-600 min-w-[1050px]">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap min-w-[210px]">DN Number</th>
                <th className="px-6 py-4 min-w-[180px]">Customer</th>
                <th className="px-6 py-4 min-w-[180px]">Construction Site</th>
                <th className="px-6 py-4 min-w-[140px]">Source Yard</th>
                <th className="px-6 py-4 whitespace-nowrap min-w-[110px]">Dispatch Date</th>
                <th className="px-6 py-4 text-center whitespace-nowrap min-w-[100px]">Status</th>
                <th className="px-6 py-4 text-right whitespace-nowrap min-w-[160px]">Actions</th>
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
                    <td className="px-6 py-4 font-mono font-medium text-slate-900 whitespace-nowrap min-w-[210px]">
                      <div className="font-semibold text-slate-900 tracking-tight whitespace-nowrap">{dn.dnNumber}</div>
                      {dn.eWayBillNumber ? (
                        <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEwbModal(dn)}
                            title={`Manage E-Way Bill ${dn.eWayBillNumber}`}
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
                          >
                            <FileDigit className="h-3 w-3 text-blue-600 shrink-0" />
                            <span className="whitespace-nowrap">EWB: {dn.eWayBillNumber}</span>
                          </button>
                          <a
                            href={`/api/v1/ewaybills/${dn.eWayBillNumber}/print`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View Official Statutory Form GST EWB-01"
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full transition-colors whitespace-nowrap shrink-0"
                          >
                            <span>Slip</span>
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        </div>
                      ) : null}
                      {dn.transportCharges && Number(dn.transportCharges) > 0 ? (
                        <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                              dn.isTransportBilled
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                            title={
                              dn.isTransportBilled
                                ? "Freight has been billed on Tax Invoice"
                                : "Unbilled freight charges - will be auto-suggested on Tax Invoice"
                            }
                          >
                            <Truck className="h-3 w-3 shrink-0" />
                            <span>Freight: ₹{Number(dn.transportCharges).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            <span className="text-[9px] font-semibold">
                              {dn.isTransportBilled ? "(Billed)" : "(Unbilled)"}
                            </span>
                          </span>
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

                        {/* WhatsApp Share Button */}
                        <WhatsAppShareButton doc={dn} docType="DN" />

                        {/* E-Way Bill */}
                        <Button
                          size="sm"
                          variant={dn.eWayBillNumber ? "secondary" : "outline"}
                          onClick={() => openEwbModal(dn)}
                          className={`text-xs h-7 px-2.5 inline-flex items-center gap-1 font-medium ${dn.eWayBillNumber
                            ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                            : "text-slate-700"
                            }`}
                        >
                          <FileDigit className="h-3.5 w-3.5" />
                          <span>{dn.eWayBillNumber ? "View EWB" : "E-Way Bill"}</span>
                        </Button>

                        {/* Edit Action for DRAFT */}
                        {dn.status === "DRAFT" && !isDeliveryPerson ? (
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
                        {dn.status === "DRAFT" && !isDeliveryPerson ? (
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
                        {dn.status === "DRAFT" && !isDeliveryPerson ? (
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
            <fieldset
              disabled={submitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
            >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Customer *</Label>
                </div>
                <SearchableCombobox
                  options={customers.map((c) => ({ value: c.id, label: `${c.name} (${c.customerCode})` }))}
                  value={dnForm.customerId}
                  onChange={handleCustomerChange}
                  placeholder="Select Customer"
                  isLoading={loading && customers.length === 0}
                />
              </div>

              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Construction Site *</Label>
                </div>
                <SearchableCombobox
                  options={sites.map((s) => ({ value: s.id, label: `${s.siteName} (${s.siteCode})` }))}
                  value={dnForm.customerSiteId}
                  onChange={(val) => setDnForm({ ...dnForm, customerSiteId: val })}
                  placeholder={dnForm.customerId ? "Select Construction Site" : "Select Customer First"}
                  disabled={!dnForm.customerId}
                  isLoading={Boolean(dnForm.customerId && sites.length === 0)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Source Yard / Warehouse *</Label>
                </div>
                <SearchableCombobox
                  options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.warehouseCode})` }))}
                  value={dnForm.sourceWarehouseId}
                  onChange={(val) => setDnForm({ ...dnForm, sourceWarehouseId: val })}
                  placeholder="Select Dispatch Yard"
                  isLoading={loading && warehouses.length === 0}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Delivery Date *</Label>
                </div>
                <Input
                  type="date"
                  value={dnForm.deliveryDate}
                  onChange={(e) => setDnForm({ ...dnForm, deliveryDate: e.target.value })}
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Company Vehicle *</Label>
                  {fleetVehicles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsCustomDnVehicle(!isCustomDnVehicle)}
                      className="text-[11px] text-[#F26522] hover:underline font-semibold whitespace-nowrap shrink-0"
                    >
                      {isCustomDnVehicle ? "← Fleet List" : "+ Other Vehicle"}
                    </button>
                  )}
                </div>
                {!isCustomDnVehicle && fleetVehicles.length > 0 ? (
                  <SearchableCombobox
                    options={fleetVehicles.map((v) => ({
                      value: v.vehicleNumber,
                      label: v.vehicleNumber,
                      sublabel: `${v.make || ""} ${v.model || ""}`.trim() || undefined,
                      badge: v.status || "ACTIVE",
                    }))}
                    value={dnForm.vehicleNumber}
                    onChange={(val) => {
                      const veh = fleetVehicles.find((v) => v.vehicleNumber === val);
                      setDnForm({
                        ...dnForm,
                        vehicleNumber: val,
                        ...(veh?.defaultDriver?.name ? { driverName: veh.defaultDriver.name } : {}),
                        ...(veh?.defaultDriver?.mobileNumber ? { driverPhone: veh.defaultDriver.mobileNumber } : {}),
                      });
                    }}
                    placeholder="Select Vehicle"
                    searchPlaceholder="Search vehicle..."
                    allowClear={false}
                    allowCustomValue={true}
                    customBadge="CUSTOM"
                  />
                ) : (
                  <Input
                    placeholder="KA-01-AB-1234"
                    value={dnForm.vehicleNumber}
                    onChange={(e) => setDnForm({ ...dnForm, vehicleNumber: e.target.value.toUpperCase() })}
                    className="font-mono uppercase text-sm"
                    required
                  />
                )}
              </div>

              {/* Driver Name with Registered Auto-Suggestions + Manual Override */}
              <div className="relative" ref={driverSuggestionsRef}>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Driver Name</Label>
                  {fleetDrivers.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-normal whitespace-nowrap">
                      Auto-suggest ({fleetDrivers.length})
                    </span>
                  )}
                </div>
                <Input
                  placeholder="e.g. Ramesh Kumar"
                  value={dnForm.driverName}
                  onChange={(e) => {
                    setDnForm({ ...dnForm, driverName: e.target.value });
                    setShowDriverSuggestions(true);
                  }}
                  onFocus={() => setShowDriverSuggestions(true)}
                  autoComplete="off"
                />
                {showDriverSuggestions && filteredDrivers.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl py-1">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <span>Registered Drivers</span>
                      <span className="text-[9px] text-slate-400 font-normal">Click to auto-fill</span>
                    </div>
                    {filteredDrivers.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50/70 hover:text-[#0B1E36] flex items-center justify-between transition-colors border-b border-slate-50 last:border-b-0 group cursor-pointer"
                        onClick={() => {
                          setDnForm((prev) => ({
                            ...prev,
                            driverName: d.name,
                            driverPhone: d.mobileNumber || prev.driverPhone,
                          }));
                          setShowDriverSuggestions(false);
                        }}
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-semibold text-slate-900 group-hover:text-[#F26522] block truncate">
                            {d.name}
                          </span>
                          {d.driverCode && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {d.driverCode}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-slate-600 bg-slate-100 group-hover:bg-orange-100 px-2 py-0.5 rounded text-right shrink-0">
                          {d.mobileNumber || "No phone"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Driver Phone */}
              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Driver Phone</Label>
                </div>
                <Input
                  type="tel"
                  placeholder="10-digit mobile"
                  maxLength={10}
                  value={dnForm.driverPhone}
                  onChange={(e) => setDnForm({ ...dnForm, driverPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                />
              </div>
            </div>

            {/* Optional Logistics Freight & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Transportation / Freight Charges (₹) <span className="font-normal text-slate-400">(Optional)</span>
                  </Label>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={dnForm.transportCharges}
                  onChange={(e) => setDnForm({ ...dnForm, transportCharges: e.target.value })}
                  className="font-mono text-xs"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Trip freight / transport charge for this dispatch. Auto-suggested when converting rental statements to tax invoices.
                </span>
              </div>
              <div>
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Dispatch Notes / References <span className="font-normal text-slate-400">(Optional)</span>
                  </Label>
                </div>
                <Input
                  placeholder="Optional site delivery instructions or references..."
                  value={dnForm.notes}
                  onChange={(e) => setDnForm({ ...dnForm, notes: e.target.value })}
                  className="text-xs"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Optional gate pass or site delivery instructions.
                </span>
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
                Include Delivery Date in Rental Billing calculation
              </label>
            </div>

            {/* Material Items: Combined Material with Size Sub-Dropdown */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Dispatched Materials</h4>
                  <p className="text-[11px] text-slate-500">Select base material, then choose size/specification and quantities.</p>
                </div>
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

              {dnForm.items.map((item, idx) => {
                const currentVariant = variants.find((x) => x.id === item.materialVariantId);
                const currentMaterialName =
                  (item as any).selectedMaterialName || currentVariant?.name?.trim() || "";

                // Variants available for this specific material name
                const availableSizes = variants.filter(
                  (v) => v.name?.trim() === currentMaterialName
                );

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2.5 items-end bg-white p-3 rounded-lg border border-slate-200 shadow-2xs"
                  >
                    {/* 1. Combined Material Name Dropdown */}
                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">
                        Material *
                      </Label>
                      <SearchableCombobox
                        options={materialGroups.map((g) => ({
                          value: g.name,
                          label: g.name,
                          sublabel: g.category || undefined,
                          badge: g.count > 1 ? `${g.count} sizes` : "1 size",
                        }))}
                        value={currentMaterialName}
                        onChange={(val) => {
                          const updated = [...dnForm.items];
                          const group = materialGroups.find((g) => g.name === val);
                          (updated[idx] as any).selectedMaterialName = val;

                          if (group && group.variants.length === 1) {
                            // Only 1 size exists, auto-select it directly
                            const single = group.variants[0];
                            updated[idx].materialVariantId = single.id;
                            if (single.rentalRate || single.defaultRentalRate) {
                              updated[idx].dailyRentalRate = Number(
                                single.rentalRate || single.defaultRentalRate
                              );
                            }
                          } else {
                            // Multiple sizes exist: clear size so user selects from sub-dropdown
                            updated[idx].materialVariantId = "";
                          }
                          setDnForm({ ...dnForm, items: updated });
                        }}
                        placeholder="Select Material"
                        searchPlaceholder="Search material name..."
                      />
                    </div>

                    {/* 2. Size / Specification Sub-Dropdown */}
                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">
                        Size / Specification *
                      </Label>
                      <SearchableCombobox
                        options={availableSizes.map((v) => {
                          const stock = yardStocks[v.id] ?? 0;
                          return {
                            value: v.id,
                            label: `${v.size || "Standard"} (${v.materialCode})`,
                            badge: stock > 0 ? `${stock} in yard` : "0 in yard",
                          };
                        })}
                        value={item.materialVariantId}
                        onChange={(val) => {
                          const updated = [...dnForm.items];
                          updated[idx].materialVariantId = val;
                          const v = variants.find((x) => x.id === val);
                          if (v) {
                            (updated[idx] as any).selectedMaterialName = v.name?.trim();
                            if (v.rentalRate || v.defaultRentalRate) {
                              updated[idx].dailyRentalRate = Number(
                                v.rentalRate || v.defaultRentalRate
                              );
                            }
                          }
                          setDnForm({ ...dnForm, items: updated });
                        }}
                        placeholder={
                          currentMaterialName
                            ? availableSizes.length > 0
                              ? "Select Size / Spec"
                              : "No sizes found"
                            : "Select Material First"
                        }
                        searchPlaceholder="Search size or code..."
                        disabled={!currentMaterialName}
                      />
                    </div>

                    {/* 3. Pool (Visible without truncation) */}
                    <div className="col-span-6 sm:col-span-4 md:col-span-2 min-w-[125px]">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">
                        Pool *
                      </Label>
                      <SearchableCombobox
                        options={[
                          { value: "OWNED", label: "OWNED" },
                          { value: "HIRED_IN", label: "HIRED IN" },
                        ]}
                        value={item.ownershipType}
                        onChange={(val) => {
                          const updated = [...dnForm.items];
                          updated[idx].ownershipType = val as "OWNED" | "HIRED_IN";
                          setDnForm({ ...dnForm, items: updated });
                        }}
                        allowClear={false}
                        triggerClassName="font-semibold text-xs text-slate-800"
                      />
                    </div>

                    {/* 4. Dispatch Qty */}
                    <div className="col-span-6 sm:col-span-4 md:col-span-2">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">
                        Dispatch Qty *
                      </Label>
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
                        className="text-xs"
                      />
                    </div>

                    {/* 5. Daily Rate */}
                    <div className="col-span-9 sm:col-span-3 md:col-span-1">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">
                        Rate (₹)
                      </Label>
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
                        className="text-xs"
                      />
                    </div>

                    {/* 6. Delete Action */}
                    <div className="col-span-3 sm:col-span-1 md:col-span-1 flex justify-center pb-0.5">
                      {dnForm.items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {item.materialVariantId && (
                      <div className="col-span-12 flex items-center justify-between text-[11px] pt-1.5 px-2 bg-slate-50 rounded border border-slate-100 mt-1">
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
                );
              })}
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
              <Button
                type="submit"
                disabled={submitting}
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
            <fieldset
              disabled={submitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
            >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold" required>Receiver Full Name *</Label>
                <Input
                  value={deliverForm.receiverName}
                  maxLength={100}
                  error={!!deliverErrors.receiverName}
                  onChange={(e) => {
                    setDeliverForm({ ...deliverForm, receiverName: e.target.value.slice(0, 100) });
                    if (deliverErrors.receiverName) {
                      setDeliverErrors((prev) => {
                        const cp = { ...prev };
                        delete cp.receiverName;
                        return cp;
                      });
                    }
                  }}
                  placeholder="e.g. Suresh Kumar"
                  required
                />
                <FormFieldError error={deliverErrors.receiverName} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-xs font-semibold" required>Receiver Mobile *</Label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {deliverForm.receiverPhone.length}/10 digits
                  </span>
                </div>
                <Input
                  type="tel"
                  value={deliverForm.receiverPhone}
                  maxLength={10}
                  error={!!deliverErrors.receiverPhone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setDeliverForm({ ...deliverForm, receiverPhone: val });
                    if (deliverErrors.receiverPhone) {
                      setDeliverErrors((prev) => {
                        const cp = { ...prev };
                        delete cp.receiverPhone;
                        return cp;
                      });
                    }
                  }}
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  required
                />
                <FormFieldError error={deliverErrors.receiverPhone} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Designation</Label>
                <Input
                  value={deliverForm.receiverDesignation}
                  maxLength={100}
                  onChange={(e) => setDeliverForm({ ...deliverForm, receiverDesignation: e.target.value.slice(0, 100) })}
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
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">Delivery Proof Photos *</Label>
                <span className="text-[10px] font-semibold text-slate-500">
                  {deliverUploadedUrls.length}/10 photos
                </span>
              </div>
              <input
                ref={deliverCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleDeliverPhotoCapture}
                className="hidden"
              />

              {deliverPhotoPreviews.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {deliverPhotoPreviews.map((preview, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-900 group">
                      <img src={preview} alt={`Delivery Evidence ${i + 1}`} className="w-full h-28 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeDeliverPhoto(i)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700"
                        title="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                        GPS Watermarked
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {deliverUploadedUrls.length < 10 ? (
                <button
                  type="button"
                  onClick={() => deliverCameraInputRef.current?.click()}
                  disabled={uploadingDeliveryPhoto}
                  className="w-full border-2 border-dashed border-[#F26522]/40 hover:border-[#F26522] bg-orange-50/50 hover:bg-orange-50/80 rounded-xl p-3.5 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5"
                >
                  <div className="w-9 h-9 rounded-full bg-[#F26522]/10 flex items-center justify-center text-[#F26522]">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {uploadingDeliveryPhoto
                        ? "Uploading Photo..."
                        : deliverUploadedUrls.length > 0
                        ? `Add More Photos (${deliverUploadedUrls.length}/10)`
                        : "Tap to Open Camera & Upload Site Photo"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Site photograph with GPS watermark stored in Supabase private storage (Max 10 images)
                    </span>
                  </div>
                </button>
              ) : (
                <div className="text-xs text-center p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                  Maximum 10 delivery photos uploaded
                </div>
              )}
              <FormFieldError error={deliverErrors.photo} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-semibold">Receiver Notes / Remarks</Label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(deliverForm.remarks || "").length}/500
                </span>
              </div>
              <Input
                value={deliverForm.remarks}
                maxLength={500}
                onChange={(e) => setDeliverForm({ ...deliverForm, remarks: e.target.value.slice(0, 500) })}
                placeholder="Unloading remarks (max 500 characters)"
              />
            </div>
            </fieldset>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeliverModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
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
        <DialogContent className="max-w-lg sm:max-w-xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden p-6">
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileDigit className="h-5 w-5 text-[#F26522]" />
                {selectedDN?.eWayBillNumber && !showRegenerateForm
                  ? "Statutory E-Way Bill Details"
                  : "Generate Statutory E-Way Bill"}
              </DialogTitle>
              <Badge
                variant="outline"
                className={
                  activeEwbProvider === "WHITEBOOKS"
                    ? "bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-semibold"
                    : "bg-purple-50 text-purple-700 border-purple-200 text-[11px] font-semibold"
                }
              >
                {activeEwbProvider === "WHITEBOOKS" ? "WhiteBooks GSP · Sandbox" : "FYN Gateway · Backup"}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              {selectedDN?.eWayBillNumber && !showRegenerateForm
                ? `Active E-Way Bill linked to Delivery Note ${selectedDN?.dnNumber}.`
                : `Generates statutory Goods Movement E-Way Bill (Delivery Challan) for ${selectedDN?.dnNumber}.`}
            </DialogDescription>
          </DialogHeader>

          {selectedDN?.eWayBillNumber && !showRegenerateForm ? (
            <div className="space-y-4 pt-1">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">E-Way Bill Number</span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-medium">
                    {selectedDN.status === "DELIVERED" ? "ACTIVE · TRANSIT CONCLUDED" : "ACTIVE / VERIFIED"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-lg sm:text-xl font-bold text-[#0B1E36] tracking-wider whitespace-nowrap">
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

              {selectedDN.status === "DELIVERED" && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200/80 p-3 text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-emerald-900">Transit Concluded • Material Delivered</span>
                    <p className="text-[11px] text-emerald-700 leading-relaxed mt-0.5">
                      Physical custody handover is completed at customer construction site. In accordance with statutory E-Way Bill regulations, Part-B conveyance update and document cancellation are disabled once transit has terminated.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Button
                  asChild
                  className="w-full bg-[#F26522] hover:bg-[#ea580c] text-white flex items-center justify-center gap-2 text-xs font-semibold py-2.5 shadow-sm cursor-pointer"
                >
                  <a href={`/api/v1/ewaybills/${selectedDN.eWayBillNumber}/print`} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4" />
                    View / Print Official Statutory E-Way Bill (Form GST EWB-01)
                  </a>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="w-full border-slate-300 hover:bg-slate-100 text-slate-800 flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  <a href={`/api/v1/delivery-notes/${selectedDN.id}/print`} target="_blank" rel="noopener noreferrer">
                    <Printer className="w-4 h-4 text-slate-600" />
                    Print Material Delivery Note (DN)
                  </a>
                </Button>

                {selectedDN.status !== "DELIVERED" ? (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsUpdateVehicleModalOpen(true)}
                      className="text-xs text-slate-700 border-slate-300 flex items-center justify-center gap-1.5"
                    >
                      <Truck className="w-3.5 h-3.5 text-[#F26522]" />
                      Update Part-B
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRefreshEwb}
                      disabled={refreshingEwb}
                      className="text-xs text-slate-700 border-slate-300 flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${refreshingEwb ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCancelEwbModalOpen(true)}
                      className="text-xs text-red-600 border-red-200 hover:bg-red-50 flex items-center justify-center gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancel EWB
                    </Button>
                  </div>
                ) : (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRefreshEwb}
                      disabled={refreshingEwb}
                      className="w-full text-xs text-slate-700 border-slate-300 flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${refreshingEwb ? "animate-spin" : ""}`} />
                      Refresh E-Way Bill Status
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEwbModalOpen(false)} className="w-full text-xs">
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : selectedDN?.status === "DELIVERED" ? (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Delivery Already Concluded</span>
                </div>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  This delivery note ({selectedDN?.dnNumber}) has already been marked as DELIVERED at the customer site. Statutory E-Way Bills are movement transit documents and cannot be generated retrospectively once physical custody is locked.
                </p>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEwbModalOpen(false)} className="w-full text-xs">
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleGenerateEWB} className="space-y-4 pt-1">
              <fieldset
                disabled={submitting}
                className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
              >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between h-5 mb-1.5">
                  <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Vehicle Registration Number *</Label>
                  {fleetVehicles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsCustomEwbVehicle(!isCustomEwbVehicle)}
                      className="text-[11px] text-[#F26522] hover:underline font-semibold whitespace-nowrap shrink-0"
                    >
                      {isCustomEwbVehicle ? "← Fleet List" : "+ Other Vehicle"}
                    </button>
                  )}
                </div>

                {!isCustomEwbVehicle && fleetVehicles.length > 0 ? (
                  <SearchableCombobox
                    options={fleetVehicles.map((v) => ({
                      value: v.vehicleNumber,
                      label: v.vehicleNumber,
                      sublabel: `${v.make || ""} ${v.model || ""}`.trim() || undefined,
                      badge: v.status || "ACTIVE",
                    }))}
                    value={ewbForm.vehicleNumber}
                    onChange={(val) => setEwbForm({ ...ewbForm, vehicleNumber: val })}
                    placeholder="Select Company-Owned Vehicle..."
                    searchPlaceholder="Search vehicle number, make, model..."
                    allowClear={false}
                  />
                ) : (
                  <Input
                    value={ewbForm.vehicleNumber}
                    onChange={(e) => setEwbForm({ ...ewbForm, vehicleNumber: e.target.value.toUpperCase() })}
                    placeholder="e.g. KA01AB1234 or TN09Z1234"
                    className="font-mono uppercase text-sm mt-1"
                    required
                  />
                )}
                <p className="text-[11px] text-slate-400">
                  {!isCustomEwbVehicle && fleetVehicles.length > 0
                    ? `AJAY ENTERPRISES Company-Owned Fleet · ${fleetVehicles.length} vehicles registered`
                    : "Standard Indian RTO registration without spaces"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Source Pincode (Yard) *</Label>
                  <Input
                    value={ewbForm.fromPincode}
                    onChange={(e) => setEwbForm({ ...ewbForm, fromPincode: e.target.value })}
                    className="font-mono text-sm mt-1"
                    maxLength={6}
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Destination Pincode (Site) *</Label>
                  <Input
                    value={ewbForm.toPincode}
                    onChange={(e) => setEwbForm({ ...ewbForm, toPincode: e.target.value })}
                    className="font-mono text-sm mt-1"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Transport Distance (KM) *</Label>
                <Input
                  type="number"
                  min="1"
                  max="4000"
                  value={ewbForm.distanceKm}
                  onChange={(e) => setEwbForm({ ...ewbForm, distanceKm: parseInt(e.target.value) || 1 })}
                  className="font-mono text-sm mt-1"
                  required
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  Statutory Delivery Challan Compliance
                </p>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Generates an official Outward Delivery Challan (docType: CHL) under Rule 55 of CGST Rules for centering material rental custody transfer.
                </p>
              </div>
              </fieldset>

              <DialogFooter className="flex-col sm:flex-row items-center sm:justify-end gap-2 pt-2">
                {selectedDN?.eWayBillNumber ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowRegenerateForm(false)}
                    disabled={submitting}
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
                    disabled={submitting}
                    className="w-full sm:w-auto text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    isLoading={submitting}
                    loadingText="Generating E-Way Bill..."
                    className="w-full sm:w-auto bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    {activeEwbProvider === "WHITEBOOKS"
                      ? "Generate via WhiteBooks GSP"
                      : "Generate via FYN Gateway"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* PART-B VEHICLE UPDATE MODAL */}
      <Dialog open={isUpdateVehicleModalOpen} onOpenChange={setIsUpdateVehicleModalOpen}>
        <DialogContent className="max-w-md w-full p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#F26522]" />
              Update Part-B Vehicle Details
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update conveyance details for E-Way Bill {selectedDN?.eWayBillNumber}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateVehicle} className="space-y-4 pt-2">
            <fieldset
              disabled={submitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
            >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between h-5 mb-1.5">
                <Label className="text-xs font-semibold text-slate-700 whitespace-nowrap">New Vehicle Number *</Label>
                {fleetVehicles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCustomUpdateVehicle(!isCustomUpdateVehicle)}
                    className="text-[11px] text-[#F26522] hover:underline font-semibold whitespace-nowrap shrink-0"
                  >
                    {isCustomUpdateVehicle ? "← Fleet List" : "+ Other Vehicle"}
                  </button>
                )}
              </div>

              {!isCustomUpdateVehicle && fleetVehicles.length > 0 ? (
                <SearchableCombobox
                  options={fleetVehicles.map((v) => ({
                    value: v.vehicleNumber,
                    label: v.vehicleNumber,
                    sublabel: `${v.make || ""} ${v.model || ""}`.trim() || undefined,
                    badge: v.status || "ACTIVE",
                  }))}
                  value={updateVehicleForm.newVehicleNumber}
                  onChange={(val) => setUpdateVehicleForm({ ...updateVehicleForm, newVehicleNumber: val })}
                  placeholder="Select New Vehicle from Fleet..."
                  searchPlaceholder="Search vehicle number, make, model..."
                  allowClear={false}
                />
              ) : (
                <Input
                  value={updateVehicleForm.newVehicleNumber}
                  onChange={(e) => setUpdateVehicleForm({ ...updateVehicleForm, newVehicleNumber: e.target.value.toUpperCase() })}
                  placeholder="e.g. KA01AB1234"
                  className="font-mono uppercase text-sm mt-1"
                  required
                />
              )}
              <p className="text-[11px] text-slate-400">
                {!isCustomUpdateVehicle && fleetVehicles.length > 0
                  ? `Select replacement conveyance from AJAY ENTERPRISES fleet`
                  : "Standard Indian RTO registration without spaces"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Current Place *</Label>
                <Input
                  value={updateVehicleForm.fromPlace}
                  onChange={(e) => setUpdateVehicleForm({ ...updateVehicleForm, fromPlace: e.target.value })}
                  placeholder="e.g. Bengaluru"
                  className="text-sm mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Reason Code *</Label>
                <select
                  value={updateVehicleForm.reasonCode}
                  onChange={(e) => setUpdateVehicleForm({ ...updateVehicleForm, reasonCode: e.target.value as any })}
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs mt-1"
                >
                  <option value="1">1 - Vehicle Breakdown</option>
                  <option value="2">2 - Transshipment</option>
                  <option value="3">3 - Others</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Reason Remarks *</Label>
              <Input
                value={updateVehicleForm.reasonDescription}
                onChange={(e) => setUpdateVehicleForm({ ...updateVehicleForm, reasonDescription: e.target.value })}
                placeholder="Brief reason for vehicle change"
                className="text-sm mt-1"
                required
              />
            </div>
            </fieldset>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUpdateVehicleModalOpen(false)}
                disabled={submitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                isLoading={submitting}
                loadingText="Updating Part-B..."
                className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
              >
                Update Vehicle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* STATUTORY CANCELLATION MODAL */}
      <Dialog open={isCancelEwbModalOpen} onOpenChange={setIsCancelEwbModalOpen}>
        <DialogContent className="max-w-md w-full p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Cancel Statutory E-Way Bill
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Confirm cancellation of E-Way Bill {selectedDN?.eWayBillNumber}. This statutory action cannot be reversed.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCancelEwb} className="space-y-4 pt-2">
            <fieldset
              disabled={submitting}
              className={cn("space-y-4 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
            >
            <div>
              <Label className="text-xs font-semibold text-slate-700">Cancellation Reason Code *</Label>
              <select
                value={cancelEwbForm.cancelReasonCode}
                onChange={(e) => setCancelEwbForm({ ...cancelEwbForm, cancelReasonCode: e.target.value as any })}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs mt-1"
              >
                <option value="1">1 - Duplicate Document</option>
                <option value="2">2 - Order Cancelled</option>
                <option value="3">3 - Data Entry Error</option>
                <option value="4">4 - Others</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Detailed Remarks (Mandatory) *</Label>
              <Input
                value={cancelEwbForm.cancelReason}
                onChange={(e) => setCancelEwbForm({ ...cancelEwbForm, cancelReason: e.target.value })}
                placeholder="Explain why this E-Way Bill is being cancelled (min 5 chars)"
                className="text-sm mt-1"
                required
              />
            </div>
            </fieldset>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCancelEwbModalOpen(false)}
                disabled={submitting}
                className="text-xs"
              >
                Abort
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                isLoading={submitting}
                loadingText="Cancelling..."
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                Confirm Cancellation
              </Button>
            </DialogFooter>
          </form>
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

      <ConfirmModal
        isOpen={discardConfirmModal.isOpen}
        onClose={() => setDiscardConfirmModal({ isOpen: false, dn: null })}
        onConfirm={executeDiscardDraft}
        title="Discard Draft Delivery Note"
        description={`Are you sure you want to discard draft Delivery Note ${discardConfirmModal.dn?.dnNumber || ""}? This action cannot be undone.`}
        confirmText="Discard Draft"
        variant="danger"
      />
    </div>
  );
}

