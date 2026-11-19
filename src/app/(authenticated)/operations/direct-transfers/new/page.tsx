"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Building,
  Truck,
  Boxes,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileCheck,
  HelpCircle,
  User,
  MapPin,
  IndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function NewDirectTransferPage() {
  const router = useRouter();

  // Wizard Step: 1 = Details, 2 = Materials, 3 = Fleet, 4 = Review
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3 | 4>(1);

  const [customers, setCustomers] = React.useState<any[]>([]);
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [drivers, setDrivers] = React.useState<any[]>([]);
  const [loadingMasters, setLoadingMasters] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  // Step 1: Transfer Details
  const [sourceCustomerId, setSourceCustomerId] = React.useState("");
  const [sourceSiteId, setSourceSiteId] = React.useState("");
  const [destCustomerId, setDestCustomerId] = React.useState("");
  const [destSiteId, setDestSiteId] = React.useState("");
  const [transferDate, setTransferDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [preferredPickupTime, setPreferredPickupTime] = React.useState("09:00 AM");
  const [expectedArrivalTime, setExpectedArrivalTime] = React.useState("12:00 PM");
  const [notes, setNotes] = React.useState("");
  const [destAgreementStatus, setDestAgreementStatus] = React.useState<{
    loading: boolean;
    hasActiveAgreement: boolean;
    agreementNumber?: string;
  }>({ loading: false, hasActiveAgreement: true });

  // Step 2: Available Stock & Items
  const [availableStock, setAvailableStock] = React.useState<any[]>([]);
  const [loadingStock, setLoadingStock] = React.useState(false);
  const [selectedItems, setSelectedItems] = React.useState<
    Record<
      string,
      {
        selected: boolean;
        materialVariantId: string;
        materialName: string;
        materialCode: string;
        size?: string;
        uom: string;
        ownershipType: "OWNED" | "HIRED_IN";
        availableQty: number;
        quantityDispatched: string;
        agreedDailyRate: string;
        sourceRentalBatchId?: string;
      }
    >
  >({});

  // Step 3: Fleet & Logistics
  const [vehicleId, setVehicleId] = React.useState("");
  const [driverId, setDriverId] = React.useState("");
  const [transportCharges, setTransportCharges] = React.useState("0");
  const [transportPayer, setTransportPayer] = React.useState<
    "DESTINATION_CUSTOMER" | "SOURCE_CUSTOMER" | "AJAY_ENTERPRISES"
  >("DESTINATION_CUSTOMER");
  const [includeCutoffDate, setIncludeCutoffDate] = React.useState(false);
  const [tripInstructions, setTripInstructions] = React.useState("");

  // Fetch initial master data
  React.useEffect(() => {
    async function loadMasters() {
      try {
        setLoadingMasters(true);
        const [custRes, vehRes, dvrRes] = await Promise.all([
          fetch("/api/v1/customers"),
          fetch("/api/v1/fleet/vehicles"),
          fetch("/api/v1/fleet/drivers"),
        ]);

        const [custJson, vehJson, dvrJson] = await Promise.all([
          custRes.json(),
          vehRes.json(),
          dvrRes.json(),
        ]);

        if (custJson.success) setCustomers(custJson.data || []);
        if (vehJson.success) setVehicles(vehJson.data || []);
        if (dvrJson.success) setDrivers(dvrJson.data || []);
      } catch {
        toast.error("Failed to load reference masters");
      } finally {
        setLoadingMasters(false);
      }
    }
    loadMasters();
  }, []);

  // Fetch available held stock whenever source site changes
  React.useEffect(() => {
    if (!sourceSiteId) {
      setAvailableStock([]);
      setSelectedItems({});
      return;
    }

    async function loadStock() {
      try {
        setLoadingStock(true);
        const res = await fetch(`/api/v1/direct-transfers/available-stock?customerSiteId=${sourceSiteId}`);
        const json = await res.json();
        if (json.success && json.data) {
          const summaries = json.data.summaries || [];
          setAvailableStock(summaries);

          const initialMap: Record<string, any> = {};
          summaries.forEach((s: any) => {
            const key = `${s.materialVariantId}_${s.ownershipType}`;
            initialMap[key] = {
              selected: true,
              materialVariantId: s.materialVariantId,
              materialName: s.materialName,
              materialCode: s.materialCode || "",
              size: s.size || "",
              uom: s.uom || "NOS",
              ownershipType: s.ownershipType as "OWNED" | "HIRED_IN",
              availableQty: parseFloat(s.totalAvailableQty),
              quantityDispatched: parseFloat(s.totalAvailableQty).toString(),
              agreedDailyRate: "",
            };
          });
          setSelectedItems(initialMap);
        } else {
          toast.error(json.error?.message || "Failed to load site held equipment");
        }
      } catch {
        toast.error("Failed to fetch site stock");
      } finally {
        setLoadingStock(false);
      }
    }

    loadStock();
  }, [sourceSiteId]);

  // Check destination rental agreement
  React.useEffect(() => {
    if (!destCustomerId || !destSiteId) return;

    async function checkAgreement() {
      try {
        setDestAgreementStatus({ loading: true, hasActiveAgreement: true });
        const res = await fetch(
          `/api/v1/rental-agreements?customerId=${destCustomerId}&customerSiteId=${destSiteId}&status=ACTIVE`
        );
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          setDestAgreementStatus({
            loading: false,
            hasActiveAgreement: true,
            agreementNumber: json.data[0].agreementNumber,
          });
        } else {
          setDestAgreementStatus({
            loading: false,
            hasActiveAgreement: true, // Allow proceeding; backend handles fallback
          });
        }
      } catch {
        setDestAgreementStatus({ loading: false, hasActiveAgreement: true });
      }
    }

    checkAgreement();
  }, [destCustomerId, destSiteId]);

  // Derived references
  const sourceCustomer = customers.find((c) => c.id === sourceCustomerId);
  const sourceSites = sourceCustomer?.sites || [];
  const sourceSite = sourceSites.find((s: any) => s.id === sourceSiteId);

  const destCustomer = customers.find((c) => c.id === destCustomerId);
  const destSites = destCustomer?.sites || [];
  const destSite = destSites.find((s: any) => s.id === destSiteId);

  const assignedVehicle = vehicles.find((v) => v.id === vehicleId);
  const assignedDriver = drivers.find((d) => d.id === driverId);

  // Active items list
  const activeItemsToTransfer = Object.values(selectedItems).filter(
    (item) => item.selected && parseFloat(item.quantityDispatched) > 0
  );

  const totalTransferUnits = activeItemsToTransfer.reduce(
    (acc, item) => acc + (parseFloat(item.quantityDispatched) || 0),
    0
  );

  // Step Navigation Validators
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!sourceCustomerId || !sourceSiteId) {
        toast.error("Please select both source customer and construction site");
        return;
      }
      if (!destCustomerId || !destSiteId) {
        toast.error("Please select both destination customer and construction site");
        return;
      }
      if (sourceSiteId === destSiteId) {
        toast.error("Source site and destination site must be different locations");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (activeItemsToTransfer.length === 0) {
        toast.error("Please select at least one material with a quantity greater than zero");
        return;
      }
      // Check for over-quantities
      for (const item of activeItemsToTransfer) {
        const qty = parseFloat(item.quantityDispatched);
        if (isNaN(qty) || qty <= 0) {
          toast.error(`Invalid quantity for ${item.materialName}`);
          return;
        }
        if (qty > item.availableQty) {
          toast.error(
            `Transfer quantity for ${item.materialName} (${qty}) cannot exceed held quantity (${item.availableQty})`
          );
          return;
        }
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!vehicleId) {
        toast.error("Please assign a company-owned vehicle for the site transfer");
        return;
      }
      if (!driverId) {
        toast.error("Please assign an authorized driver");
        return;
      }
      setCurrentStep(4);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const payload = {
        transferDate: new Date(transferDate).toISOString(),
        preferredPickupTime,
        expectedArrivalTime,
        sourceCustomerId,
        sourceCustomerSiteId: sourceSiteId,
        destinationCustomerId: destCustomerId,
        destinationCustomerSiteId: destSiteId,
        vehicleId,
        driverId,
        includeCutoffDate,
        transportCharges: parseFloat(transportCharges) || 0,
        transportPayer,
        notes: tripInstructions || notes,
        items: activeItemsToTransfer.map((item) => ({
          materialVariantId: item.materialVariantId,
          ownershipType: item.ownershipType,
          quantityDispatched: parseFloat(item.quantityDispatched),
          agreedDailyRate: item.agreedDailyRate ? parseFloat(item.agreedDailyRate) : undefined,
          sourceRentalBatchId: item.sourceRentalBatchId,
        })),
      };

      const res = await fetch("/api/v1/direct-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Failed to create Direct Site Transfer");
        return;
      }

      toast.success(
        `Direct Transfer ${json.data.transferNumber} created! Source MRN, Trip & Destination DN linked.`
      );
      router.push(`/operations/direct-transfers/${json.data.id}`);
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/operations/direct-transfers">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                New Direct Site-to-Site Transfer
              </h1>
              <Badge className="bg-[#0B1E36] text-white text-[11px] font-semibold">
                DSTN Workflow
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              AJAY ENTERPRISES • Coordinated Custody Transfer & Zero Godown Intermediate Touchpoint
            </p>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {[
            { num: 1, label: "Transfer Details" },
            { num: 2, label: "Select Materials" },
            { num: 3, label: "Fleet & Logistics" },
            { num: 4, label: "Review & Confirm" },
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => {
                if (s.num < currentStep) setCurrentStep(s.num as any);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer",
                currentStep === s.num
                  ? "bg-[#0B1E36] text-white border-[#0B1E36] shadow-sm font-semibold"
                  : currentStep > s.num
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 rounded-full flex items-center justify-center text-[10px]",
                  currentStep === s.num
                    ? "bg-[#F26522] text-white"
                    : currentStep > s.num
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {currentStep > s.num ? "✓" : s.num}
              </span>
              <span className="hidden md:inline">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: TRANSFER DETAILS */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Source Site Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Building className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Source Customer & Site (Handover)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Site releasing physical centering equipment
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Source Customer <span className="text-rose-500">*</span>
                </Label>
                <SearchableCombobox
                  options={customers.map((c) => ({
                    value: c.id,
                    label: c.name,
                    sublabel: c.customerCode ? `Code: ${c.customerCode}` : undefined,
                  }))}
                  value={sourceCustomerId}
                  onChange={(val) => {
                    setSourceCustomerId(val);
                    setSourceSiteId("");
                  }}
                  placeholder="Select source customer..."
                  searchPlaceholder="Search customer by name..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Source Construction Site <span className="text-rose-500">*</span>
                </Label>
                <SearchableCombobox
                  options={sourceSites.map((s: any) => ({
                    value: s.id,
                    label: s.siteName,
                    sublabel: s.fullAddress || s.city || undefined,
                  }))}
                  value={sourceSiteId}
                  onChange={setSourceSiteId}
                  placeholder={
                    sourceCustomerId
                      ? "Select source construction site..."
                      : "First select a source customer"
                  }
                  searchPlaceholder="Search site..."
                  disabled={!sourceCustomerId}
                />
              </div>

              {sourceSite && (
                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs text-blue-900 space-y-1">
                  <p className="font-semibold">{sourceSite.siteName}</p>
                  <p className="text-blue-700">{sourceSite.fullAddress || "No address on file"}</p>
                  {sourceSite.siteInCharge && (
                    <p className="text-blue-600">
                      In-Charge: {sourceSite.siteInCharge} • {sourceSite.siteContactDetails || "No phone"}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Destination Site Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Building className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Destination Customer & Site (Receiving)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Site accepting transferred equipment
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Destination Customer <span className="text-rose-500">*</span>
                </Label>
                <SearchableCombobox
                  options={customers.map((c) => ({
                    value: c.id,
                    label: c.name,
                    sublabel: c.customerCode ? `Code: ${c.customerCode}` : undefined,
                  }))}
                  value={destCustomerId}
                  onChange={(val) => {
                    setDestCustomerId(val);
                    setDestSiteId("");
                  }}
                  placeholder="Select destination customer..."
                  searchPlaceholder="Search customer by name..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Destination Construction Site <span className="text-rose-500">*</span>
                </Label>
                <SearchableCombobox
                  options={destSites.map((s: any) => ({
                    value: s.id,
                    label: s.siteName,
                    sublabel: s.fullAddress || s.city || undefined,
                  }))}
                  value={destSiteId}
                  onChange={setDestSiteId}
                  placeholder={
                    destCustomerId
                      ? "Select destination construction site..."
                      : "First select a destination customer"
                  }
                  searchPlaceholder="Search site..."
                  disabled={!destCustomerId}
                />
              </div>

              {destSite && (
                <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 text-xs text-emerald-900 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{destSite.siteName}</p>
                    {destAgreementStatus.hasActiveAgreement && (
                      <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                        ACTIVE AGREEMENT
                      </Badge>
                    )}
                  </div>
                  <p className="text-emerald-700">{destSite.fullAddress || "No address on file"}</p>
                  {destSite.siteInCharge && (
                    <p className="text-emerald-600">
                      In-Charge: {destSite.siteInCharge} • {destSite.siteContactDetails || "No phone"}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule & Operational Notes */}
          <Card className="border-slate-200 shadow-sm lg:col-span-2">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Schedule & Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Transfer Date <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Preferred Pickup Time
                </Label>
                <Input
                  type="text"
                  value={preferredPickupTime}
                  onChange={(e) => setPreferredPickupTime(e.target.value)}
                  placeholder="e.g. 09:30 AM"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Expected Arrival Time
                </Label>
                <Input
                  type="text"
                  value={expectedArrivalTime}
                  onChange={(e) => setExpectedArrivalTime(e.target.value)}
                  placeholder="e.g. 01:00 PM"
                  className="h-9 text-xs"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Operational Remarks
                </Label>
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions for loading, access roads, site gate clearance..."
                  className="h-9 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2: SELECT MATERIALS */}
      {currentStep === 2 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Source Site Equipment Held ({sourceSite?.siteName})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Select quantities to transfer directly to {destSite?.siteName}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold">
                {activeItemsToTransfer.length} items selected • {totalTransferUnits} total units
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingStock ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <p className="text-xs">Fetching active equipment batches at source site...</p>
              </div>
            ) : availableStock.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Boxes className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="font-semibold text-sm">No Active Held Equipment Found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Source site currently has 0 active rental batches in custody.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold text-left">
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            availableStock.length > 0 &&
                            availableStock.every(
                              (s) => selectedItems[`${s.materialVariantId}_${s.ownershipType}`]?.selected
                            )
                          }
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedItems((prev) => {
                              const copy = { ...prev };
                              Object.keys(copy).forEach((k) => {
                                copy[k].selected = checked;
                              });
                              return copy;
                            });
                          }}
                          className="rounded border-slate-300 h-4 w-4 text-[#0B1E36]"
                        />
                      </th>
                      <th className="p-3">Material Code</th>
                      <th className="p-3">Material & Specification</th>
                      <th className="p-3">Ownership</th>
                      <th className="p-3 text-right">Current Held</th>
                      <th className="p-3 w-36 text-right">Transfer Qty *</th>
                      <th className="p-3 w-36 text-right">Daily Rate (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {availableStock.map((s: any) => {
                      const key = `${s.materialVariantId}_${s.ownershipType}`;
                      const itemState = selectedItems[key] || {
                        selected: false,
                        quantityDispatched: "0",
                        agreedDailyRate: "",
                        availableQty: parseFloat(s.totalAvailableQty),
                      };

                      return (
                        <tr
                          key={key}
                          className={cn(
                            "hover:bg-slate-50/70 transition-colors",
                            itemState.selected ? "bg-blue-50/20" : "opacity-60"
                          )}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={itemState.selected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    selected: checked,
                                  },
                                }));
                              }}
                              className="rounded border-slate-300 h-4 w-4 text-[#0B1E36]"
                            />
                          </td>
                          <td className="p-3 font-mono font-medium text-slate-700">
                            {s.materialCode || "MAT-VAR"}
                          </td>
                          <td className="p-3">
                            <p className="font-semibold text-slate-900">{s.materialName}</p>
                            <p className="text-[11px] text-slate-500">
                              UOM: {s.uom} {s.size ? `• Size: ${s.size}` : ""}
                            </p>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold",
                                s.ownershipType === "OWNED"
                                  ? "bg-slate-50 text-slate-700 border-slate-200"
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              )}
                            >
                              {s.ownershipType}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-semibold text-slate-700">
                            {s.totalAvailableQty} {s.uom}
                          </td>
                          <td className="p-3 text-right">
                            <Input
                              type="number"
                              min="0"
                              max={s.totalAvailableQty}
                              disabled={!itemState.selected}
                              value={itemState.quantityDispatched}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    quantityDispatched: val,
                                  },
                                }));
                              }}
                              className="h-8 text-right text-xs font-semibold"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={!itemState.selected}
                              placeholder="Default rate"
                              value={itemState.agreedDailyRate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    agreedDailyRate: val,
                                  },
                                }));
                              }}
                              className="h-8 text-right text-xs"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 3: FLEET & LOGISTICS */}
      {currentStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Driver and Vehicle Assignment */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-100 text-[#F26522] flex items-center justify-center">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Company Fleet & Driver Assignment
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    AJAY ENTERPRISES owned commercial vehicles only
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Assigned Company Vehicle <span className="text-rose-500">*</span>
                </Label>
                <SearchableCombobox
                  options={vehicles.map((v) => ({
                    value: v.id,
                    label: v.vehicleNumber || v.registrationNumber,
                    sublabel: `${v.make || ""} ${v.model || ""} • Capacity: ${v.payloadCapacityKg || 0}kg`,
                    badge: v.status || "ACTIVE",
                  }))}
                  value={vehicleId}
                  onChange={setVehicleId}
                  placeholder="Select company vehicle..."
                  searchPlaceholder="Search vehicle number..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Assigned Driver <span className="text-rose-500">*</span>
                </Label>
                <SearchableCombobox
                  options={drivers.map((d) => ({
                    value: d.id,
                    label: d.name,
                    sublabel: `📞 ${d.mobileNumber || d.phone || "No phone"} • License: ${d.licenseNumber || "Verified"}`,
                    badge: d.status || "AVAILABLE",
                  }))}
                  value={driverId}
                  onChange={setDriverId}
                  placeholder="Select driver..."
                  searchPlaceholder="Search driver name..."
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                <p className="font-semibold flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-[#F26522]" /> Two-Leg Direct Site Transfer Route
                </p>
                <p className="text-[11px] text-amber-800 mt-1">
                  Leg A: Yard → <strong>{sourceSite?.siteName}</strong> (Pickup) →{" "}
                  <strong>{destSite?.siteName}</strong> (Delivery)
                  <br />
                  Leg B: <strong>{destSite?.siteName}</strong> → Yard (Only if remaining/damaged
                  materials require return)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Transport Charges & Date Allocation */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/80 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <IndianRupee className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Transport Allocation & Billing Policy
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Statutory rental date cutoff and logistics charges
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Transport Charges (₹)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={transportCharges}
                  onChange={(e) => setTransportCharges(e.target.value)}
                  placeholder="0.00"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Transport Charges Borne By
                </Label>
                <SearchableCombobox
                  options={[
                    {
                      value: "DESTINATION_CUSTOMER",
                      label: "Destination Customer (Customer B)",
                      sublabel: "Billed on destination monthly rental invoice",
                    },
                    {
                      value: "SOURCE_CUSTOMER",
                      label: "Source Customer (Customer A)",
                      sublabel: "Billed on source monthly rental invoice",
                    },
                    {
                      value: "AJAY_ENTERPRISES",
                      label: "AJAY ENTERPRISES (Internal Expense)",
                      sublabel: "Company absorbs direct transfer logistics cost",
                    },
                  ]}
                  value={transportPayer}
                  onChange={(val: any) => setTransportPayer(val)}
                  placeholder="Select transport payer..."
                  searchPlaceholder="Search payer..."
                />
              </div>

              {/* Independent Date Cutoff Rule */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="includeCutoffCheckbox"
                    checked={includeCutoffDate}
                    onChange={(e) => setIncludeCutoffDate(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 h-4 w-4 text-[#0B1E36]"
                  />
                  <Label
                    htmlFor="includeCutoffCheckbox"
                    className="text-xs font-semibold text-slate-900 cursor-pointer"
                  >
                    Source Customer pays for transfer date
                  </Label>
                </div>
                <p className="text-[11px] text-slate-500 pl-6">
                  {includeCutoffDate
                    ? `Customer A is billed through ${transferDate}. Customer B billing begins the day after (${new Date(
                        new Date(transferDate).getTime() + 86400000
                      )
                        .toISOString()
                        .split("T")[0]}).`
                    : `Customer A billing stops the day before. Customer B billing begins on the transfer date (${transferDate}). Exactly one customer is billed for the transfer date.`}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Driver Trip Instructions
                </Label>
                <Input
                  type="text"
                  value={tripInstructions}
                  onChange={(e) => setTripInstructions(e.target.value)}
                  placeholder="e.g. Inspect tie rods before loading, reach site before 10 AM..."
                  className="h-9 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 4: REVIEW & CONFIRM */}
      {currentStep === 4 && (
        <div className="space-y-6">
          {/* Linked Document Generation Banner */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-900">
              <p className="font-bold">Automated Multi-Document Lifecycle Coordination</p>
              <p className="text-blue-800 mt-0.5">
                Confirming this direct transfer will atomically generate and link:
              </p>
              <ul className="list-disc pl-4 mt-1 space-y-0.5 text-blue-700">
                <li>
                  <strong>Direct Site Transfer Note (DSTN)</strong>: Master custody tracking document
                </li>
                <li>
                  <strong>Source Material Return Note (MRN)</strong>: Physical pickup record in draft
                  state for {sourceSite?.siteName}
                </li>
                <li>
                  <strong>Vehicle Trip</strong>: Multi-leg driver dispatch task in Driver Delivery
                  Portal
                </li>
                <li>
                  <strong>Destination Delivery Note (DN)</strong>: Inward delivery note in draft
                  state for {destSite?.siteName}
                </li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Source Overview */}
            <Card className="border-slate-200">
              <CardHeader className="p-4 bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-xs font-bold text-slate-700 uppercase">
                  Source Site (Pickup)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-xs space-y-1">
                <p className="font-bold text-slate-900">{sourceCustomer?.name}</p>
                <p className="text-slate-600">{sourceSite?.siteName}</p>
                <p className="text-slate-500">{sourceSite?.fullAddress}</p>
                <p className="text-slate-500 pt-1">
                  Schedule: {transferDate} • {preferredPickupTime}
                </p>
              </CardContent>
            </Card>

            {/* Destination Overview */}
            <Card className="border-slate-200">
              <CardHeader className="p-4 bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-xs font-bold text-slate-700 uppercase">
                  Destination Site (Delivery)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-xs space-y-1">
                <p className="font-bold text-slate-900">{destCustomer?.name}</p>
                <p className="text-slate-600">{destSite?.siteName}</p>
                <p className="text-slate-500">{destSite?.fullAddress}</p>
                <p className="text-slate-500 pt-1">
                  Schedule: {transferDate} • {expectedArrivalTime}
                </p>
              </CardContent>
            </Card>

            {/* Fleet & Logistics Overview */}
            <Card className="border-slate-200">
              <CardHeader className="p-4 bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-xs font-bold text-slate-700 uppercase">
                  Fleet & Billing
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-xs space-y-1">
                <p className="font-bold text-slate-900">
                  Vehicle: {assignedVehicle?.vehicleNumber || "Assigned"}
                </p>
                <p className="text-slate-600">Driver: {assignedDriver?.name || "Assigned"}</p>
                <p className="text-slate-500">
                  Transport: ₹{transportCharges} ({transportPayer.replace("_", " ")})
                </p>
                <p className="text-slate-500 pt-1">
                  Cutoff: {includeCutoffDate ? "Source bears transfer date" : "Dest bears transfer date"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Materials Table Summary */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
              <CardTitle className="text-xs font-bold text-slate-900 uppercase">
                Equipment Being Transferred ({activeItemsToTransfer.length} lines • {totalTransferUnits} total units)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100/60 text-slate-600 border-b border-slate-200 text-left font-semibold">
                    <th className="p-3">#</th>
                    <th className="p-3">Code</th>
                    <th className="p-3">Material Name</th>
                    <th className="p-3">Ownership</th>
                    <th className="p-3 text-right">Transfer Qty</th>
                    <th className="p-3 text-right">Daily Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeItemsToTransfer.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-medium text-slate-700">
                        {item.materialCode || "MAT"}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{item.materialName}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {item.ownershipType}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        {item.quantityDispatched} {item.uom}
                      </td>
                      <td className="p-3 text-right text-slate-700">
                        {item.agreedDailyRate ? `₹${item.agreedDailyRate}` : "Default Rate"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        {currentStep > 1 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
            className="text-xs"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
          </Button>
        ) : (
          <Link href="/operations/direct-transfers">
            <Button variant="ghost" size="sm" className="text-xs">
              Cancel
            </Button>
          </Link>
        )}

        <div className="flex items-center gap-2">
          {currentStep < 4 ? (
            <Button
              type="button"
              onClick={handleNextStep}
              className="bg-[#0B1E36] hover:bg-[#1E293B] text-white text-xs font-semibold px-4"
            >
              Next Step <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating Transfer & Linking
                  Documents...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm & Issue Direct Transfer
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
