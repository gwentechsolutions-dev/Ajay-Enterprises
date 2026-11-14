"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { warehouseSchema, WarehouseInput } from "@/lib/schemas/branch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Warehouse as WarehouseIcon, Plus, Edit2, Trash2, MapPin, Phone, Compass, GitBranch } from "lucide-react";
import { toast } from "sonner";

const WAREHOUSE_TYPES = [
  { value: "MAIN_YARD", label: "Main Centering Storage Yard" },
  { value: "SECONDARY_YARD", label: "Secondary Distribution Yard" },
  { value: "SATELLITE_YARD", label: "Satellite / Transit Yard" },
];

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingWarehouse, setEditingWarehouse] = React.useState<any | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<WarehouseInput>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      warehouseCode: "",
      name: "",
      branchId: "",
      warehouseType: "MAIN_YARD",
      addressLine1: "",
      city: "",
      state: "Karnataka",
      pinCode: "",
      contactPerson: "",
      mobile: "",
      isActive: true,
    },
  });

  const selectedBranchId = watch("branchId");
  const selectedType = watch("warehouseType");

  const branchOptions = React.useMemo(() => {
    return branches.map((b) => ({
      value: b.id,
      label: b.name,
      sublabel: b.branchCode,
    }));
  }, [branches]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [wRes, bRes] = await Promise.all([
        fetch("/api/v1/warehouses"),
        fetch("/api/v1/branches"),
      ]);
      const [wData, bData] = await Promise.all([wRes.json(), bRes.json()]);

      if (wData.success) setWarehouses(wData.data);
      if (bData.success) setBranches(bData.data);
    } catch {
      toast.error("Failed to load warehouses");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreate = () => {
    setEditingWarehouse(null);
    reset({
      warehouseCode: "",
      name: "",
      branchId: branches[0]?.id || "",
      warehouseType: "MAIN_YARD",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "Karnataka",
      pinCode: "",
      contactPerson: "",
      mobile: "",
      gpsLatitude: undefined,
      gpsLongitude: undefined,
      isActive: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (w: any) => {
    setEditingWarehouse(w);
    reset({
      warehouseCode: w.warehouseCode,
      name: w.name,
      branchId: w.branchId,
      warehouseType: w.warehouseType,
      addressLine1: w.addressLine1,
      addressLine2: w.addressLine2 || "",
      city: w.city,
      state: w.state,
      pinCode: w.pinCode,
      contactPerson: w.contactPerson,
      mobile: w.mobile,
      gpsLatitude: w.gpsLatitude || undefined,
      gpsLongitude: w.gpsLongitude || undefined,
      isActive: w.isActive,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: WarehouseInput) => {
    try {
      const url = editingWarehouse ? `/api/v1/warehouses/${editingWarehouse.id}` : "/api/v1/warehouses";
      const method = editingWarehouse ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message || "Operation failed");
        return;
      }

      toast.success(editingWarehouse ? "Warehouse updated" : "Warehouse created");
      setModalOpen(false);
      fetchData();
    } catch {
      toast.error("Failed to save warehouse");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this warehouse?")) return;
    try {
      const res = await fetch(`/api/v1/warehouses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message || "Failed to delete warehouse");
        return;
      }
      toast.success("Warehouse deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete warehouse");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Centering Yards & Warehouses
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Physical stock storage locations, dispatch loading docks, and return inspection yards.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          disabled={branches.length === 0}
          className="bg-primary-900 hover:bg-primary-800 text-white font-semibold text-xs gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add Warehouse / Yard
        </Button>
      </div>

      {branches.length === 0 && (
        <Card className="p-4 bg-amber-50 border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <span>You must create at least one Branch before configuring storage yards.</span>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-44 bg-slate-200/60 rounded-xl animate-pulse" />
          <div className="h-44 bg-slate-200/60 rounded-xl animate-pulse" />
        </div>
      ) : warehouses.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <WarehouseIcon className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No Yards Configured</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Create your primary centering material yard for storing props, sapan, and scaffolding sheets.
          </p>
          <Button onClick={handleOpenCreate} size="sm" className="bg-primary-900 text-white" disabled={branches.length === 0}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create First Yard
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {warehouses.map((w) => (
            <Card key={w.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-accent-600 bg-accent-50 px-2 py-0.5 rounded">
                      {w.warehouseCode}
                    </span>
                    <CardTitle className="text-base font-bold mt-2">{w.name}</CardTitle>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                      <GitBranch className="h-3 w-3" />
                      <span>{w.branch?.name}</span>
                    </div>
                  </div>
                  <Badge variant={w.isActive ? "success" : "secondary"}>
                    {w.isActive ? "Active Yard" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {w.addressLine1}, {w.city}, {w.state} - {w.pinCode}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{w.contactPerson} ({w.mobile})</span>
                </div>

                {(w.gpsLatitude || w.gpsLongitude) && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <Compass className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>GPS: {w.gpsLatitude}, {w.gpsLongitude}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-500 text-[11px]">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                    {w.warehouseType.replace("_", " ")}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(w)}
                      className="p-1.5 hover:text-primary-900 rounded hover:bg-slate-100"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(w.id)}
                      className="p-1.5 hover:text-red-600 rounded hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? "Edit Yard / Warehouse" : "Add New Yard / Warehouse"}</DialogTitle>
            <DialogDescription>
              Configure storage yard details and dispatch location coordinates
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="warehouseCode" required>Yard Code</Label>
                <Input
                  id="warehouseCode"
                  placeholder="WH-01"
                  className="uppercase font-mono"
                  {...register("warehouseCode")}
                  error={!!errors.warehouseCode}
                />
                {errors.warehouseCode && <p className="text-xs text-red-600">{errors.warehouseCode.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label required>Parent Branch</Label>
                <SearchableCombobox
                  options={branchOptions}
                  value={selectedBranchId}
                  onChange={(val) => setValue("branchId", val)}
                  placeholder="Select branch..."
                />
                {errors.branchId && <p className="text-xs text-red-600">{errors.branchId.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wName" required>Yard / Warehouse Name</Label>
              <Input
                id="wName"
                placeholder="e.g. Whitefield Centering Yard"
                {...register("name")}
                error={!!errors.name}
              />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label required>Yard Classification</Label>
              <SearchableCombobox
                options={WAREHOUSE_TYPES}
                value={selectedType}
                onChange={(val) => setValue("warehouseType", val as any)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wAddress" required>Address Line 1</Label>
              <Input id="wAddress" placeholder="Survey No., Industrial Zone" {...register("addressLine1")} error={!!errors.addressLine1} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wCity" required>City</Label>
                <Input id="wCity" placeholder="Bengaluru" {...register("city")} error={!!errors.city} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wState" required>State</Label>
                <Input id="wState" placeholder="Karnataka" {...register("state")} error={!!errors.state} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wPin" required>PIN Code</Label>
                <Input id="wPin" placeholder="560066" maxLength={6} className="font-mono" {...register("pinCode")} error={!!errors.pinCode} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wContact" required>Yard In-Charge</Label>
                <Input id="wContact" placeholder="Yard Supervisor" {...register("contactPerson")} error={!!errors.contactPerson} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wMobile" required>Mobile Number</Label>
                <Input id="wMobile" placeholder="9876543210" {...register("mobile")} error={!!errors.mobile} />
                {errors.mobile && <p className="text-xs text-red-600">{errors.mobile.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lat">GPS Latitude (Optional)</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  placeholder="12.9716"
                  {...register("gpsLatitude", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lng">GPS Longitude (Optional)</Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  placeholder="77.5946"
                  {...register("gpsLongitude", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="wIsActive" {...register("isActive")} className="rounded text-primary-900" />
              <Label htmlFor="wIsActive" className="text-xs font-normal cursor-pointer">
                Storage Yard is Active for operations
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={isSubmitting} loadingText="Saving Yard..." className="bg-primary-900 text-white">Save Yard</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

