"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  Plus,
  Trash2,
  Building,
  Truck,
  Boxes,
  Calendar,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function NewDirectTransferPage() {
  const router = useRouter();

  const [customers, setCustomers] = React.useState<any[]>([]);
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [drivers, setDrivers] = React.useState<any[]>([]);
  const [loadingMasters, setLoadingMasters] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  // Form State
  const [sourceCustomerId, setSourceCustomerId] = React.useState("");
  const [sourceSiteId, setSourceSiteId] = React.useState("");
  const [destCustomerId, setDestCustomerId] = React.useState("");
  const [destSiteId, setDestSiteId] = React.useState("");
  const [vehicleId, setVehicleId] = React.useState("");
  const [driverId, setDriverId] = React.useState("");
  const [transferDate, setTransferDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [includeCutoffDate, setIncludeCutoffDate] = React.useState(false);
  const [transportCharges, setTransportCharges] = React.useState("0");
  const [payerAllocation, setPayerAllocation] = React.useState("AJAY_ENTERPRISES");
  const [notes, setNotes] = React.useState("");

  // Available stock at source site
  const [availableStock, setAvailableStock] = React.useState<any[]>([]);
  const [loadingStock, setLoadingStock] = React.useState(false);

  // Transfer Items
  const [items, setItems] = React.useState<
    Array<{
      materialVariantId: string;
      materialName: string;
      uom: string;
      ownershipType: "OWNED" | "HIRED_IN";
      availableQty: number;
      quantityDispatched: string;
      agreedDailyRate: string;
      sourceRentalBatchId?: string;
    }>
  >([]);

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
      setItems([]);
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

          // Populate initial transfer items from available stock
          setItems(
            summaries.map((s: any) => ({
              materialVariantId: s.materialVariantId,
              materialName: s.materialName,
              uom: s.uom,
              ownershipType: s.ownershipType as "OWNED" | "HIRED_IN",
              availableQty: parseFloat(s.totalAvailableQty),
              quantityDispatched: "",
              agreedDailyRate: "",
            }))
          );
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

  // Source & Destination Sites lists
  const sourceCustomer = customers.find((c) => c.id === sourceCustomerId);
  const sourceSites = sourceCustomer?.sites || [];

  const destCustomer = customers.find((c) => c.id === destCustomerId);
  const destSites = destCustomer?.sites || [];

  const handleItemQuantityChange = (idx: number, val: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx].quantityDispatched = val;
      return copy;
    });
  };

  const handleItemRateChange = (idx: number, val: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx].agreedDailyRate = val;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sourceCustomerId || !sourceSiteId) {
      toast.error("Please select source customer and job site");
      return;
    }
    if (!destCustomerId || !destSiteId) {
      toast.error("Please select destination customer and job site");
      return;
    }
    if (sourceSiteId === destSiteId) {
      toast.error("Source and destination sites must be different");
      return;
    }

    // Filter active items with quantity > 0
    const activeItems = items
      .filter((i) => parseFloat(i.quantityDispatched) > 0)
      .map((i) => ({
        materialVariantId: i.materialVariantId,
        ownershipType: i.ownershipType,
        quantityDispatched: parseFloat(i.quantityDispatched),
        agreedDailyRate: i.agreedDailyRate ? parseFloat(i.agreedDailyRate) : undefined,
      }));

    if (activeItems.length === 0) {
      toast.error("Please enter a transfer quantity for at least one material variant");
      return;
    }

    for (const item of activeItems) {
      const stock = items.find((i) => i.materialVariantId === item.materialVariantId);
      if (stock && item.quantityDispatched > stock.availableQty) {
        toast.error(
          `Cannot dispatch ${item.quantityDispatched} units of ${stock.materialName}. Available held at source site is only ${stock.availableQty}`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        sourceCustomerId,
        sourceCustomerSiteId: sourceSiteId,
        destinationCustomerId: destCustomerId,
        destinationCustomerSiteId: destSiteId,
        vehicleId: vehicleId || undefined,
        driverId: driverId || undefined,
        transferDate,
        includeCutoffDate,
        transportCharges: parseFloat(transportCharges || "0"),
        payerAllocation,
        notes,
        items: activeItems,
      };

      const res = await fetch("/api/v1/direct-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Direct Site Transfer ${json.data.transferNumber} created successfully!`);
        router.push(`/operations/direct-transfers/${json.data.id}`);
      } else {
        toast.error(json.error?.message || "Failed to create transfer");
      }
    } catch {
      toast.error("Server connection failure");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/operations/direct-transfers">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Register
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Create Direct Site-to-Site Transfer (DSTN)
          </h1>
          <p className="text-xs text-slate-500">
            AJAY ENTERPRISES Centering & Scaffolding Operations
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset
          disabled={submitting}
          className={cn("space-y-6 border-0 p-0 m-0 min-w-0 transition-opacity", submitting && "pointer-events-none opacity-60")}
        >
        {/* Step 1: Sites Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source Job Site */}
          <Card className="border-slate-200">
            <CardHeader className="bg-slate-50 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-600" />
                Source Customer & Site (Releasing)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label className="text-xs font-medium">Source Customer *</Label>
                <SearchableCombobox
                  options={customers.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.customerCode})`,
                  }))}
                  value={sourceCustomerId}
                  onChange={(val) => {
                    setSourceCustomerId(val);
                    setSourceSiteId("");
                  }}
                  placeholder="Select source customer..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Source Construction Site *</Label>
                <SearchableCombobox
                  options={sourceSites.map((s: any) => ({
                    value: s.id,
                    label: `${s.siteName} (${s.siteCode})`,
                  }))}
                  value={sourceSiteId}
                  onChange={(val) => setSourceSiteId(val)}
                  placeholder={sourceCustomerId ? "Select source site..." : "First select customer"}
                  disabled={!sourceCustomerId}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Destination Job Site */}
          <Card className="border-slate-200">
            <CardHeader className="bg-slate-50 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Building className="h-4 w-4 text-[#F26522]" />
                Destination Customer & Site (Receiving)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <Label className="text-xs font-medium">Destination Customer *</Label>
                <SearchableCombobox
                  options={customers.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.customerCode})`,
                  }))}
                  value={destCustomerId}
                  onChange={(val) => {
                    setDestCustomerId(val);
                    setDestSiteId("");
                  }}
                  placeholder="Select destination customer..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Destination Construction Site *</Label>
                <SearchableCombobox
                  options={destSites
                    .filter((s: any) => s.id !== sourceSiteId)
                    .map((s: any) => ({
                      value: s.id,
                      label: `${s.siteName} (${s.siteCode})`,
                    }))}
                  value={destSiteId}
                  onChange={(val) => setDestSiteId(val)}
                  placeholder={destCustomerId ? "Select destination site..." : "First select customer"}
                  disabled={!destCustomerId}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 2: Logistics & Rental Date Policy */}
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Truck className="h-4 w-4 text-slate-600" />
              Logistics, Date Policy & Transport Allocation
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-medium">Transfer Date *</Label>
              <Input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Company Fleet Vehicle</Label>
              <SearchableCombobox
                options={vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.vehicleNumber} (${v.model || v.category})`,
                }))}
                value={vehicleId}
                onChange={(val) => setVehicleId(val)}
                placeholder="Select company vehicle..."
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Company Driver</Label>
              <SearchableCombobox
                options={drivers.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.driverCode || d.mobileNumber})`,
                }))}
                value={driverId}
                onChange={(val) => setDriverId(val)}
                placeholder="Select driver..."
                className="mt-1"
              />
            </div>

            <div className="sm:col-span-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="includeCutoffDate"
                  checked={includeCutoffDate}
                  onChange={(e) => setIncludeCutoffDate(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0B1E36] focus:ring-[#F26522]"
                />
                <div>
                  <Label htmlFor="includeCutoffDate" className="text-xs font-semibold text-slate-900 cursor-pointer">
                    Include Cutoff Date in Source Customer Billing
                  </Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {includeCutoffDate
                      ? "Source Customer A WILL be charged for the transfer date. Destination Customer B's billing will begin the NEXT day."
                      : "Source Customer A will NOT be charged for the transfer date. Destination Customer B's billing begins on the transfer date."}
                    <span className="block font-medium text-emerald-600 mt-0.5">
                      Zero Double-Billing Guarantee: Exactly one customer pays for the transfer day.
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Transport Charges (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={transportCharges}
                onChange={(e) => setTransportCharges(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Transport Payer Allocation</Label>
              <select
                value={payerAllocation}
                onChange={(e) => setPayerAllocation(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[#F26522]"
              >
                <option value="AJAY_ENTERPRISES">AJAY ENTERPRISES (Internal Cost)</option>
                <option value="SOURCE_CUSTOMER">Source Customer A</option>
                <option value="DESTINATION_CUSTOMER">Destination Customer B</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-medium">Operational Remarks</Label>
              <Input
                placeholder="E.g. Direct shift requested by site engineer..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Material Variants Table */}
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Boxes className="h-4 w-4 text-emerald-600" />
              Centering Equipment Held at Source Site
            </CardTitle>
            {loadingStock && (
              <div className="flex items-center text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Reading site custody stock...
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {!sourceSiteId ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                Please select a source customer and construction site above to view available equipment.
              </div>
            ) : items.length === 0 && !loadingStock ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No active equipment held at the selected source site.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/80 text-slate-500 text-xs font-medium border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Material Variant</th>
                      <th className="py-2.5 px-4">Ownership</th>
                      <th className="py-2.5 px-4 text-right">Held at Site</th>
                      <th className="py-2.5 px-4 text-right w-44">Transfer Qty *</th>
                      <th className="py-2.5 px-4 text-right w-44">Agreed Daily Rate (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={item.materialVariantId} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {item.materialName}
                          <span className="text-xs text-slate-400 ml-1.5 font-normal">({item.uom})</span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs font-normal">
                            {item.ownershipType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {item.availableQty}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Input
                            type="number"
                            min="0"
                            max={item.availableQty}
                            step="0.001"
                            placeholder="0"
                            value={item.quantityDispatched}
                            onChange={(e) => handleItemQuantityChange(idx, e.target.value)}
                            className="text-right h-8 text-sm"
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Destination rate"
                            value={item.agreedDailyRate}
                            onChange={(e) => handleItemRateChange(idx, e.target.value)}
                            className="text-right h-8 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          </Card>
        </fieldset>

        <Card className="border-slate-200">
          <CardFooter className="py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
            <div className="text-xs text-slate-500">
              * Units will transfer directly without godown entry. Physical custody shifts upon destination acceptance.
            </div>
            <div className="flex gap-2">
              <Link href="/operations/direct-transfers">
                <Button type="button" variant="outline" size="sm" disabled={submitting}>
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || loadingMasters || items.length === 0}
                className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating Transfer Note...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Direct Transfer Note
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
