"use client";

import * as React from "react";
import {
  Truck,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Boxes,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  History,
  FileDigit,
  Layers,
  Building2,
  Warehouse as WarehouseIcon,
  Loader2,
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
import { MOVEMENT_TYPES } from "@/lib/schemas/inventory";
import { toast } from "sonner";

export default function MovementsPage() {
  const [movements, setMovements] = React.useState<any[]>([]);
  const [variants, setVariants] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [ownershipFilter, setOwnershipFilter] = React.useState<string>("ALL");
  const [warehouseFilter, setWarehouseFilter] = React.useState<string>("");

  // Modals
  const [isMovementModalOpen, setIsMovementModalOpen] = React.useState(false);
  const [isOpeningStockModalOpen, setIsOpeningStockModalOpen] = React.useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = React.useState(false);
  const [selectedMovementForReversal, setSelectedMovementForReversal] = React.useState<any | null>(null);
  const [reversalReason, setReversalReason] = React.useState("");

  // Forms
  const [movementForm, setMovementForm] = React.useState({
    materialVariantId: "",
    quantity: "",
    ownershipType: "OWNED",
    movementType: "INTERNAL_TRANSFER",
    sourceLocationType: "WAREHOUSE",
    sourceWarehouseId: "",
    sourceSiteId: "",
    destinationLocationType: "WAREHOUSE",
    destinationWarehouseId: "",
    destinationSiteId: "",
    customerId: "",
    condition: "GOOD",
    notes: "",
  });

  const [openingForm, setOpeningForm] = React.useState({
    warehouseId: "",
    materialVariantId: "",
    ownershipType: "OWNED",
    quantity: "",
    unitCost: "",
    replacementValue: "",
    condition: "GOOD",
    remarks: "",
  });

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [mRes, vRes, wRes, cRes] = await Promise.all([
        fetch("/api/v1/inventory/movements"),
        fetch("/api/v1/materials/variants"),
        fetch("/api/v1/warehouses"),
        fetch("/api/v1/customers"),
      ]);
      const [mData, vData, wData, cData] = await Promise.all([
        mRes.json(),
        vRes.json(),
        wRes.json(),
        cRes.json(),
      ]);

      if (mData.success) setMovements(mData.data);
      if (vData.success) setVariants(vData.data);
      if (wData.success) setWarehouses(wData.data);
      if (cData.success) setCustomers(cData.data);
    } catch {
      toast.error("Failed to load inventory movement ledger.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Post Movement
  const handlePostMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...movementForm,
          quantity: Number(movementForm.quantity),
          sourceWarehouseId: movementForm.sourceWarehouseId || null,
          sourceSiteId: movementForm.sourceSiteId || null,
          destinationWarehouseId: movementForm.destinationWarehouseId || null,
          destinationSiteId: movementForm.destinationSiteId || null,
          customerId: movementForm.customerId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to post movement");
      toast.success(data.message || `Movement ${data.movementNumber} posted.`);
      setIsMovementModalOpen(false);
      setMovementForm({
        materialVariantId: "",
        quantity: "",
        ownershipType: "OWNED",
        movementType: "INTERNAL_TRANSFER",
        sourceLocationType: "WAREHOUSE",
        sourceWarehouseId: "",
        sourceSiteId: "",
        destinationLocationType: "WAREHOUSE",
        destinationWarehouseId: "",
        destinationSiteId: "",
        customerId: "",
        condition: "GOOD",
        notes: "",
      });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Handle Post Opening Stock
  const handlePostOpeningStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/inventory/opening-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: openingForm.warehouseId,
          ownershipType: openingForm.ownershipType,
          items: [
            {
              materialVariantId: openingForm.materialVariantId,
              quantity: Number(openingForm.quantity),
              condition: openingForm.condition,
              unitCost: openingForm.unitCost ? Number(openingForm.unitCost) : null,
              replacementValue: openingForm.replacementValue ? Number(openingForm.replacementValue) : null,
              remarks: openingForm.remarks,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to record opening stock");
      toast.success(data.message);
      setIsOpeningStockModalOpen(false);
      setOpeningForm({
        warehouseId: "",
        materialVariantId: "",
        ownershipType: "OWNED",
        quantity: "",
        unitCost: "",
        replacementValue: "",
        condition: "GOOD",
        remarks: "",
      });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Handle Reverse Movement
  const handleReverseMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovementForReversal) return;
    try {
      const res = await fetch(`/api/v1/inventory/movements/${selectedMovementForReversal.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reversalReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to reverse movement");
      toast.success(data.message);
      setIsReverseModalOpen(false);
      setSelectedMovementForReversal(null);
      setReversalReason("");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredMovements = React.useMemo(() => {
    return movements.filter((m) => {
      const matchesSearch =
        search === "" ||
        m.movementNumber.toLowerCase().includes(search.toLowerCase()) ||
        m.materialVariant?.name?.toLowerCase().includes(search.toLowerCase()) ||
        (m.notes && m.notes.toLowerCase().includes(search.toLowerCase()));

      const matchesType = typeFilter === "ALL" || m.movementType === typeFilter;
      const matchesOwnership = ownershipFilter === "ALL" || m.ownershipType === ownershipFilter;
      const matchesWarehouse =
        !warehouseFilter ||
        m.sourceWarehouseId === warehouseFilter ||
        m.destinationWarehouseId === warehouseFilter;

      return matchesSearch && matchesType && matchesOwnership && matchesWarehouse;
    });
  }, [movements, search, typeFilter, ownershipFilter, warehouseFilter]);

  // All Customer Sites across all customers
  const allCustomerSites = React.useMemo(() => {
    return customers.flatMap((c) =>
      c.sites?.map((s: any) => ({
        value: s.id,
        label: `${s.siteName} (${c.name})`,
        sublabel: s.siteCode,
      })) || []
    );
  }, [customers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Inventory Movement Ledger
            </h1>
            <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700">
              {movements.length} Ledger Entries
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Immutable, append-only material movements: Receipts, Dispatches, Returns, Transfers, Audits & Reversals
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpeningStockModalOpen(true)}
            className="border-amber-300 bg-amber-50/50 hover:bg-amber-100/60 text-amber-900 text-xs font-semibold"
          >
            <Boxes className="h-3.5 w-3.5 mr-1.5 text-amber-700" /> Opening Stock Entry
          </Button>

          <Button
            size="sm"
            onClick={() => setIsMovementModalOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> + Record Movement
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200 shadow-none bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search movement #, variant, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <SearchableCombobox
              options={[
                { value: "ALL", label: "All Movement Types" },
                ...MOVEMENT_TYPES.map((t) => ({ value: t, label: t })),
              ]}
              value={typeFilter}
              onChange={(val) => setTypeFilter(val || "ALL")}
              placeholder="Filter Movement Type..."
              className="h-9 text-xs"
              allowClear={false}
            />

            <SearchableCombobox
              options={[
                { value: "", label: "All Warehouses" },
                ...warehouses.map((w) => ({ value: w.id, label: w.name, sublabel: w.warehouseCode })),
              ]}
              value={warehouseFilter}
              onChange={(val) => setWarehouseFilter(val || "")}
              placeholder="Filter Warehouse..."
              className="h-9 text-xs"
            />

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={ownershipFilter === "ALL" ? "default" : "outline"}
                onClick={() => setOwnershipFilter("ALL")}
                className={`h-9 flex-1 text-xs ${ownershipFilter === "ALL" ? "bg-[#0B1E36]" : ""}`}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={ownershipFilter === "OWNED" ? "default" : "outline"}
                onClick={() => setOwnershipFilter("OWNED")}
                className={`h-9 flex-1 text-xs ${ownershipFilter === "OWNED" ? "bg-[#0B1E36]" : ""}`}
              >
                Owned
              </Button>
              <Button
                size="sm"
                variant={ownershipFilter === "HIRED_IN" ? "default" : "outline"}
                onClick={() => setOwnershipFilter("HIRED_IN")}
                className={`h-9 flex-1 text-xs ${ownershipFilter === "HIRED_IN" ? "bg-[#0B1E36]" : ""}`}
              >
                Hired-In
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movements Ledger Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Ref #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Material Variant & Size</th>
                <th className="py-3 px-4">Movement Type</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Source → Destination</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
                    Loading movement ledger...
                  </td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No inventory movements recorded</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Post opening stock or record transfers, receipts and customer dispatches.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isReversed = m.status === "REVERSED";
                  const isReversalEntry = m.movementType === "REVERSAL";

                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isReversed ? "bg-slate-50/50 opacity-70" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {m.movementNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                        {new Date(m.movementDate).toLocaleDateString("en-IN")}{" "}
                        <span className="text-slate-400">
                          {new Date(m.movementDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{m.materialVariant?.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {m.materialVariant?.materialCode} • {m.materialVariant?.size}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={
                            m.movementType === "OPENING_STOCK"
                              ? "bg-amber-50 text-amber-900 border-amber-200 font-semibold"
                              : m.movementType === "DELIVERY_TO_CUSTOMER"
                              ? "bg-blue-50 text-blue-900 border-blue-200 font-semibold"
                              : m.movementType === "CUSTOMER_RETURN"
                              ? "bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold"
                              : m.movementType === "REVERSAL"
                              ? "bg-purple-50 text-purple-900 border-purple-200 font-semibold"
                              : m.movementType === "DAMAGE" || m.movementType === "MISSING"
                              ? "bg-red-50 text-red-900 border-red-200 font-semibold"
                              : "bg-slate-100 text-slate-700"
                          }
                        >
                          {m.movementType}
                        </Badge>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {m.ownershipType} • {m.condition}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {Number(m.quantity).toFixed(0)}
                        </span>{" "}
                        <span className="text-slate-500 text-[11px]">{m.uom}</span>
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <span className="truncate max-w-[140px]">
                            {m.sourceWarehouse?.name || m.sourceSite?.siteName || m.sourceLocationType}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {m.destinationWarehouse?.name || m.destinationSite?.siteName || m.destinationLocationType}
                          </span>
                        </div>
                        {m.notes ? (
                          <div className="text-slate-400 italic text-[10px] truncate max-w-xs mt-0.5">
                            {m.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={
                            m.status === "POSTED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-red-50 text-red-800 border-red-200"
                          }
                        >
                          {m.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {!isReversed && !isReversalEntry ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedMovementForReversal(m);
                              setIsReverseModalOpen(true);
                            }}
                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Reverse posted movement"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" /> Reverse
                          </Button>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Immutable</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* RECORD MOVEMENT MODAL */}
      <Dialog open={isMovementModalOpen} onOpenChange={setIsMovementModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post Inventory Movement</DialogTitle>
            <DialogDescription>
              Record an auditable physical transfer, receipt, dispatch or condition change.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePostMovement} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label required>Movement Type</Label>
                <SearchableCombobox
                  options={[
                    { value: "INTERNAL_TRANSFER", label: "Internal Warehouse Transfer" },
                    { value: "DELIVERY_TO_CUSTOMER", label: "Delivery to Customer Site" },
                    { value: "CUSTOMER_RETURN", label: "Customer Material Return" },
                    { value: "DAMAGE", label: "Mark as Damaged" },
                    { value: "DAMAGE_RECOVERY", label: "Repaired / Recovered Stock" },
                    { value: "MISSING", label: "Mark as Missing / Shortage" },
                    { value: "FOUND_STOCK", label: "Found / Recovered Stock" },
                    { value: "SCRAP", label: "Authorized Material Scrap" },
                    { value: "STOCK_ADJUSTMENT", label: "Manual Stock Adjustment" },
                  ]}
                  value={movementForm.movementType}
                  onChange={(val) => {
                    const type = val || "INTERNAL_TRANSFER";
                    let srcType = "WAREHOUSE";
                    let dstType = "WAREHOUSE";
                    if (type === "DELIVERY_TO_CUSTOMER") {
                      srcType = "WAREHOUSE";
                      dstType = "CUSTOMER_SITE";
                    } else if (type === "CUSTOMER_RETURN") {
                      srcType = "CUSTOMER_SITE";
                      dstType = "WAREHOUSE";
                    } else if (type === "DAMAGE") {
                      srcType = "WAREHOUSE";
                      dstType = "WAREHOUSE";
                    }
                    setMovementForm({
                      ...movementForm,
                      movementType: type,
                      sourceLocationType: srcType,
                      destinationLocationType: dstType,
                    });
                  }}
                  allowClear={false}
                />
              </div>

              <div className="space-y-1.5">
                <Label required>Ownership</Label>
                <SearchableCombobox
                  options={[
                    { value: "OWNED", label: "Owned by AJAY ENTERPRISES" },
                    { value: "HIRED_IN", label: "Hired-In (Third Party)" },
                  ]}
                  value={movementForm.ownershipType}
                  onChange={(val) => setMovementForm({ ...movementForm, ownershipType: val || "OWNED" })}
                  allowClear={false}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label required>Material Variant</Label>
              <SearchableCombobox
                options={variants.map((v) => ({
                  value: v.id,
                  label: `${v.name} (${v.size})`,
                  sublabel: `${v.materialCode} • ${v.materialType?.category?.name || "Equipment"}`,
                }))}
                value={movementForm.materialVariantId}
                onChange={(val) => setMovementForm({ ...movementForm, materialVariantId: val })}
                placeholder="Select material variant..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="movQty" required>Quantity</Label>
                <Input
                  id="movQty"
                  type="number"
                  min="1"
                  placeholder="e.g. 50"
                  value={movementForm.quantity}
                  onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label required>Physical Condition</Label>
                <SearchableCombobox
                  options={[
                    { value: "GOOD", label: "Good / Ready to Use" },
                    { value: "FAIR", label: "Fair / Serviceable" },
                    { value: "DAMAGED", label: "Damaged / Needs Repair" },
                    { value: "SCRAP", label: "Condemned Scrap" },
                  ]}
                  value={movementForm.condition}
                  onChange={(val) => setMovementForm({ ...movementForm, condition: val || "GOOD" })}
                  allowClear={false}
                />
              </div>
            </div>

            {/* Source and Destination Pickers */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Routing / Origin & Destination
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Source */}
                <div className="space-y-1.5">
                  <Label>Source Location</Label>
                  {movementForm.sourceLocationType === "WAREHOUSE" ? (
                    <SearchableCombobox
                      options={warehouses.map((w) => ({ value: w.id, label: w.name, sublabel: w.warehouseCode }))}
                      value={movementForm.sourceWarehouseId}
                      onChange={(val) => setMovementForm({ ...movementForm, sourceWarehouseId: val })}
                      placeholder="Source warehouse..."
                    />
                  ) : (
                    <SearchableCombobox
                      options={allCustomerSites}
                      value={movementForm.sourceSiteId}
                      onChange={(val) => setMovementForm({ ...movementForm, sourceSiteId: val })}
                      placeholder="Source customer site..."
                    />
                  )}
                </div>

                {/* Destination */}
                <div className="space-y-1.5">
                  <Label>Destination Location</Label>
                  {movementForm.destinationLocationType === "WAREHOUSE" ? (
                    <SearchableCombobox
                      options={warehouses.map((w) => ({ value: w.id, label: w.name, sublabel: w.warehouseCode }))}
                      value={movementForm.destinationWarehouseId}
                      onChange={(val) => setMovementForm({ ...movementForm, destinationWarehouseId: val })}
                      placeholder="Destination warehouse..."
                    />
                  ) : (
                    <SearchableCombobox
                      options={allCustomerSites}
                      value={movementForm.destinationSiteId}
                      onChange={(val) => setMovementForm({ ...movementForm, destinationSiteId: val })}
                      placeholder="Destination customer site..."
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="movNotes">Operational Notes</Label>
              <Input
                id="movNotes"
                placeholder="Reason, dispatch notes, or lorry number"
                value={movementForm.notes}
                onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsMovementModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0B1E36] hover:bg-[#071424] text-white">
                Post Movement Entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* OPENING STOCK MODAL */}
      <Dialog open={isOpeningStockModalOpen} onOpenChange={setIsOpeningStockModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Opening Physical Inventory</DialogTitle>
            <DialogDescription>
              One-time initial stock entry for warehouse yard. Duplicate opening stock is prevented.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePostOpeningStock} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label required>Warehouse / Yard</Label>
              <SearchableCombobox
                options={warehouses.map((w) => ({ value: w.id, label: w.name, sublabel: w.warehouseCode }))}
                value={openingForm.warehouseId}
                onChange={(val) => setOpeningForm({ ...openingForm, warehouseId: val })}
                placeholder="Select yard..."
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label required>Material Variant</Label>
              <SearchableCombobox
                options={variants.map((v) => ({
                  value: v.id,
                  label: `${v.name} (${v.size})`,
                  sublabel: v.materialCode,
                }))}
                value={openingForm.materialVariantId}
                onChange={(val) => setOpeningForm({ ...openingForm, materialVariantId: val })}
                placeholder="Select material..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="opQty" required>Physical Count Quantity</Label>
                <Input
                  id="opQty"
                  type="number"
                  min="1"
                  placeholder="e.g. 200"
                  value={openingForm.quantity}
                  onChange={(e) => setOpeningForm({ ...openingForm, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label required>Ownership</Label>
                <SearchableCombobox
                  options={[
                    { value: "OWNED", label: "Owned by AJAY ENTERPRISES" },
                    { value: "HIRED_IN", label: "Hired-In" },
                  ]}
                  value={openingForm.ownershipType}
                  onChange={(val) => setOpeningForm({ ...openingForm, ownershipType: val || "OWNED" })}
                  allowClear={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="opCost">Unit Purchase Cost (₹)</Label>
                <Input
                  id="opCost"
                  type="number"
                  step="0.01"
                  placeholder="Optional"
                  value={openingForm.unitCost}
                  onChange={(e) => setOpeningForm({ ...openingForm, unitCost: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="opRepl">Replacement Value (₹)</Label>
                <Input
                  id="opRepl"
                  type="number"
                  step="0.01"
                  placeholder="Optional"
                  value={openingForm.replacementValue}
                  onChange={(e) => setOpeningForm({ ...openingForm, replacementValue: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="opRemarks">Verification Remarks</Label>
              <Input
                id="opRemarks"
                placeholder="Count verified by yard in-charge"
                value={openingForm.remarks}
                onChange={(e) => setOpeningForm({ ...openingForm, remarks: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpeningStockModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0B1E36] hover:bg-[#071424] text-white">
                Post Opening Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* REVERSAL CONFIRMATION MODAL */}
      <Dialog open={isReverseModalOpen} onOpenChange={setIsReverseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <RotateCcw className="h-5 w-5" />
              <span>Reverse Inventory Movement</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reverse movement{" "}
              <strong>{selectedMovementForReversal?.movementNumber}</strong>?
              <br />
              This will generate an equal and opposite reversal transaction in the ledger.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReverseMovement} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="revReason" required>Mandatory Reversal Reason</Label>
              <Input
                id="revReason"
                placeholder="e.g. Dispatched to wrong site / incorrect quantity entered"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsReverseModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                Confirm Reversal Entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

