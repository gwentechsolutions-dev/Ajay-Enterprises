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
import { StateCombobox } from "@/components/forms/state-combobox";
import { CityCombobox } from "@/components/forms/city-combobox";
import { GoogleMapsLocationInput } from "@/components/forms/google-maps-location-input";
import { Warehouse as WarehouseIcon, Plus, Edit2, Trash2, MapPin, Phone, Compass, GitBranch, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { setReactHookFormErrors, formatValidationToast, parseApiValidationErrors } from "@/lib/forms/validation-mapper";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const WAREHOUSE_TYPES = [
  { value: "MAIN_YARD", label: "Main Centering Storage Yard" },
  { value: "SECONDARY_YARD", label: "Secondary Distribution Yard" },
  { value: "SATELLITE_YARD", label: "Satellite / Transit Yard" },
];

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [staffUsers, setStaffUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingWarehouse, setEditingWarehouse] = React.useState<any | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = React.useState<{
    isOpen: boolean;
    warehouseId: string | null;
  }>({
    isOpen: false,
    warehouseId: null,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WarehouseInput>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      warehouseCode: "",
      name: "",
      branchId: "",
      warehouseType: "MAIN_YARD",
      addressLine1: "",
      city: "Chennai",
      state: "Tamil Nadu",
      pinCode: "600058",
      contactPerson: "",
      mobile: "",
      gpsLatitude: null,
      gpsLongitude: null,
      mapsUrl: "",
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

  const yardInChargeOptions = React.useMemo(() => {
    return staffUsers.map((u) => ({
      value: u.name,
      label: u.name,
      sublabel: u.mobile ? `${(u.role || "").replace(/_/g, " ")} • ${u.mobile}` : (u.role || "").replace(/_/g, " "),
      badge: u.userCode || undefined,
    }));
  }, [staffUsers]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [wRes, bRes, uRes] = await Promise.all([
        fetch("/api/v1/warehouses"),
        fetch("/api/v1/branches"),
        fetch("/api/v1/users?limit=100&status=ACTIVE"),
      ]);
      const [wData, bData, uData] = await Promise.all([
        wRes.json(),
        bRes.json(),
        uRes.ok ? uRes.json() : Promise.resolve({ success: false, data: [] }),
      ]);

      if (wData.success) setWarehouses(wData.data);
      if (bData.success) setBranches(bData.data);
      if (uData.success && Array.isArray(uData.data)) setStaffUsers(uData.data);
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
      city: "Chennai",
      state: "Tamil Nadu",
      pinCode: "600058",
      contactPerson: "",
      mobile: "",
      gpsLatitude: null,
      gpsLongitude: null,
      mapsUrl: "",
      isActive: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (w: any) => {
    setEditingWarehouse(w);
    const existingLat = w.gpsLatitude !== null && w.gpsLatitude !== undefined ? Number(w.gpsLatitude) : null;
    const existingLng = w.gpsLongitude !== null && w.gpsLongitude !== undefined ? Number(w.gpsLongitude) : null;
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
      gpsLatitude: existingLat,
      gpsLongitude: existingLng,
      mapsUrl: existingLat && existingLng ? `https://www.google.com/maps?q=${existingLat},${existingLng}` : "",
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
        setReactHookFormErrors(setError, data);
        toast.error(formatValidationToast(parseApiValidationErrors(data)));
        return;
      }

      toast.success(editingWarehouse ? "Warehouse updated" : "Warehouse created");
      setModalOpen(false);
      fetchData();
    } catch {
      toast.error("Failed to save warehouse");
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      warehouseId: id,
    });
  };

  const executeDelete = async () => {
    const id = deleteConfirmModal.warehouseId;
    if (!id) return;
    setDeleteConfirmModal({ isOpen: false, warehouseId: null });
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

                {(w.gpsLatitude && w.gpsLongitude) ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                    <MapPin className="h-3.5 w-3.5 text-[#F26522] shrink-0" />
                    <a
                      href={`https://www.google.com/maps?q=${w.gpsLatitude},${w.gpsLongitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline inline-flex items-center gap-1"
                    >
                      <span>View on Google Maps ({Number(w.gpsLatitude).toFixed(4)}, {Number(w.gpsLongitude).toFixed(4)})</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ) : null}

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
                  maxLength={20}
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
                maxLength={100}
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
              <Input
                id="wAddress"
                maxLength={200}
                placeholder="Survey No., Industrial Zone"
                {...register("addressLine1")}
                error={!!errors.addressLine1}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wCity" required>City</Label>
                <CityCombobox
                  id="wCity"
                  state={watch("state") || "Tamil Nadu"}
                  value={watch("city") || "Chennai"}
                  onChange={(val) => setValue("city", val, { shouldValidate: true })}
                  error={!!errors.city}
                />
                {errors.city && <p className="text-xs text-red-600">{errors.city.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wState" required>State</Label>
                <StateCombobox
                  id="wState"
                  value={watch("state") || "Tamil Nadu"}
                  onChange={(val) => setValue("state", val, { shouldValidate: true })}
                  error={!!errors.state}
                />
                {errors.state && <p className="text-xs text-red-600">{errors.state.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wPin" required>PIN Code</Label>
                <Input
                  id="wPin"
                  placeholder="600058"
                  maxLength={6}
                  className="font-mono"
                  {...register("pinCode", {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    },
                  })}
                  error={!!errors.pinCode}
                />
                {errors.pinCode && <p className="text-xs text-red-600">{errors.pinCode.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wContact" required>Yard In-Charge</Label>
                <SearchableCombobox
                  options={yardInChargeOptions}
                  value={watch("contactPerson") || ""}
                  onChange={(val) => {
                    setValue("contactPerson", val, { shouldValidate: true });
                    const matched = staffUsers.find((u) => u.name.toLowerCase() === val.toLowerCase());
                    if (matched?.mobile) {
                      const cleanMobile = matched.mobile.replace(/\D/g, "").slice(0, 10);
                      setValue("mobile", cleanMobile, { shouldValidate: true });
                    }
                  }}
                  placeholder="Select or type in-charge..."
                  searchPlaceholder="Search registered staff / managers..."
                  emptyText="No registered staff found. Type custom name above."
                  allowCustomValue={true}
                  error={!!errors.contactPerson}
                />
                {errors.contactPerson && <p className="text-xs text-red-600">{errors.contactPerson.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wMobile" required>Mobile Number</Label>
                <Input
                  id="wMobile"
                  maxLength={10}
                  placeholder="9876543210"
                  {...register("mobile", {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
                    },
                  })}
                  className="font-mono"
                  error={!!errors.mobile}
                />
                {errors.mobile && <p className="text-xs text-red-600">{errors.mobile.message}</p>}
              </div>
            </div>

            {/* SINGLE GOOGLE MAPS LOCATION LINK (REPLACES SEPARATE LAT/LNG BOXES) */}
            <GoogleMapsLocationInput
              id="warehouseMapsUrl"
              label="Storage Yard Location (Google Maps Link)"
              value={watch("mapsUrl") || ""}
              latitude={watch("gpsLatitude")}
              longitude={watch("gpsLongitude")}
              required={false}
              onChange={({ latitude, longitude, mapsUrl }) => {
                setValue("gpsLatitude", latitude, { shouldValidate: true });
                setValue("gpsLongitude", longitude, { shouldValidate: true });
                setValue("mapsUrl", mapsUrl, { shouldValidate: true });
              }}
            />

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

      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, warehouseId: null })}
        onConfirm={executeDelete}
        title="Delete Centering Yard"
        description="Are you sure you want to delete this storage yard? Yard stock and location records linked to this yard may be affected."
        confirmText="Delete Yard"
        variant="danger"
      />
    </div>
  );
}

