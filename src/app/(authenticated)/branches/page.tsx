"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { branchSchema, BranchInput } from "@/lib/schemas/branch";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { StateCombobox } from "@/components/forms/state-combobox";
import { CityCombobox } from "@/components/forms/city-combobox";
import { GitBranch, Plus, Edit2, Trash2, Building2, MapPin, Phone, Mail, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { setReactHookFormErrors, formatValidationToast, parseApiValidationErrors } from "@/lib/forms/validation-mapper";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const BRANCH_TYPES = [
  { value: "MAIN_OFFICE", label: "Main Head Office" },
  { value: "REGIONAL_OFFICE", label: "Regional Operations Office" },
  { value: "YARD_BRANCH", label: "Centering Yard Branch" },
];

export default function BranchesPage() {
  const [branches, setBranches] = React.useState<any[]>([]);
  const [staffUsers, setStaffUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingBranch, setEditingBranch] = React.useState<any | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = React.useState<{
    isOpen: boolean;
    branchId: string | null;
  }>({
    isOpen: false,
    branchId: null,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BranchInput>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      branchCode: "",
      name: "",
      branchType: "MAIN_OFFICE",
      addressLine1: "",
      city: "Chennai",
      state: "Tamil Nadu",
      pinCode: "600001",
      contactPerson: "",
      mobile: "",
      isActive: true,
    },
  });

  const selectedType = watch("branchType");

  const contactPersonOptions = React.useMemo(() => {
    return staffUsers.map((u) => ({
      value: u.name,
      label: u.name,
      sublabel: u.mobile ? `${(u.role || "").replace(/_/g, " ")} • ${u.mobile}` : (u.role || "").replace(/_/g, " "),
      badge: u.userCode || undefined,
    }));
  }, [staffUsers]);

  const fetchBranches = React.useCallback(async () => {
    try {
      setLoading(true);
      const [res, uRes] = await Promise.all([
        fetch("/api/v1/branches"),
        fetch("/api/v1/users?limit=100&status=ACTIVE"),
      ]);
      const [data, uData] = await Promise.all([
        res.json(),
        uRes.ok ? uRes.json() : Promise.resolve({ success: false, data: [] }),
      ]);
      if (data.success) {
        setBranches(data.data);
      }
      if (uData.success && Array.isArray(uData.data)) {
        setStaffUsers(uData.data);
      }
    } catch {
      toast.error("Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleOpenCreate = () => {
    setEditingBranch(null);
    reset({
      branchCode: "",
      name: "",
      branchType: "MAIN_OFFICE",
      addressLine1: "",
      addressLine2: "",
      city: "Chennai",
      state: "Tamil Nadu",
      pinCode: "600001",
      contactPerson: "",
      mobile: "",
      email: "",
      isActive: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (branch: any) => {
    setEditingBranch(branch);
    reset({
      branchCode: branch.branchCode,
      name: branch.name,
      branchType: branch.branchType,
      addressLine1: branch.addressLine1,
      addressLine2: branch.addressLine2 || "",
      city: branch.city,
      state: branch.state,
      pinCode: branch.pinCode,
      contactPerson: branch.contactPerson,
      mobile: branch.mobile,
      email: branch.email || "",
      isActive: branch.isActive,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: BranchInput) => {
    try {
      const url = editingBranch ? `/api/v1/branches/${editingBranch.id}` : "/api/v1/branches";
      const method = editingBranch ? "PATCH" : "POST";

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

      toast.success(editingBranch ? "Branch updated successfully" : "Branch created successfully");
      setModalOpen(false);
      fetchBranches();
    } catch {
      toast.error("Failed to save branch");
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      branchId: id,
    });
  };

  const executeDelete = async () => {
    const id = deleteConfirmModal.branchId;
    if (!id) return;
    setDeleteConfirmModal({ isOpen: false, branchId: null });
    try {
      const res = await fetch(`/api/v1/branches/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message || "Failed to delete branch");
        return;
      }
      toast.success("Branch deleted successfully");
      fetchBranches();
    } catch {
      toast.error("Failed to delete branch");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Branch Master
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage operational offices and regional administrative branches for AJAY ENTERPRISES.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-primary-900 hover:bg-primary-800 text-white font-semibold text-xs gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add Branch
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-44 bg-slate-200/60 rounded-xl animate-pulse" />
          <div className="h-44 bg-slate-200/60 rounded-xl animate-pulse" />
        </div>
      ) : branches.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <GitBranch className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No Branches Configured</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Create your primary branch or head office to begin associating warehouses and personnel.
          </p>
          <Button onClick={handleOpenCreate} size="sm" className="bg-primary-900 text-white">
            <Plus className="h-3.5 w-3.5 mr-1" /> Create First Branch
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((b) => (
            <Card key={b.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-accent-600 bg-accent-50 px-2 py-0.5 rounded">
                      {b.branchCode}
                    </span>
                    <CardTitle className="text-base font-bold mt-2">{b.name}</CardTitle>
                    <p className="text-xs text-slate-500">{b.branchType.replace("_", " ")}</p>
                  </div>
                  <Badge variant={b.isActive ? "success" : "secondary"}>
                    {b.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {b.addressLine1}, {b.city}, {b.state} - {b.pinCode}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{b.contactPerson} ({b.mobile})</span>
                </div>

                {b.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{b.email}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-500 text-[11px]">
                  <span className="flex items-center gap-1">
                    <Warehouse className="h-3.5 w-3.5" /> {b._count?.warehouses || 0} Warehouses
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(b)}
                      className="p-1.5 hover:text-primary-900 rounded hover:bg-slate-100"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b.id)}
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
            <DialogTitle>{editingBranch ? "Edit Branch" : "Add New Branch"}</DialogTitle>
            <DialogDescription>
              Configure branch parameters and contact details
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="branchCode" required>Branch Code</Label>
                <Input
                  id="branchCode"
                  maxLength={20}
                  placeholder="BR-01"
                  className="uppercase font-mono"
                  {...register("branchCode")}
                  error={!!errors.branchCode}
                />
                {errors.branchCode && <p className="text-xs text-red-600">{errors.branchCode.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label required>Branch Type</Label>
                <SearchableCombobox
                  options={BRANCH_TYPES}
                  value={selectedType}
                  onChange={(val) => setValue("branchType", val as any)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" required>Branch Name</Label>
              <Input
                id="name"
                maxLength={100}
                placeholder="e.g. Chennai Central Branch"
                {...register("name")}
                error={!!errors.name}
              />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addressLine1" required>Address Line 1</Label>
              <Input
                id="addressLine1"
                maxLength={200}
                placeholder="Plot No., Industrial Area"
                {...register("addressLine1")}
                error={!!errors.addressLine1}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city" required>City</Label>
                <CityCombobox
                  id="city"
                  state={watch("state") || "Tamil Nadu"}
                  value={watch("city") || "Chennai"}
                  onChange={(val) => setValue("city", val, { shouldValidate: true })}
                  error={!!errors.city}
                />
                {errors.city && <p className="text-xs text-red-600">{errors.city.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state" required>State</Label>
                <StateCombobox
                  id="state"
                  value={watch("state") || "Tamil Nadu"}
                  onChange={(val) => setValue("state", val, { shouldValidate: true })}
                  error={!!errors.state}
                />
                {errors.state && <p className="text-xs text-red-600">{errors.state.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pinCode" required>PIN Code</Label>
                <Input
                  id="pinCode"
                  placeholder="600001"
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
                <Label htmlFor="contactPerson" required>Contact Person</Label>
                <SearchableCombobox
                  options={contactPersonOptions}
                  value={watch("contactPerson") || ""}
                  onChange={(val) => {
                    setValue("contactPerson", val, { shouldValidate: true });
                    const matched = staffUsers.find((u) => u.name.toLowerCase() === val.toLowerCase());
                    if (matched?.mobile) {
                      const cleanMobile = matched.mobile.replace(/\D/g, "").slice(0, 10);
                      setValue("mobile", cleanMobile, { shouldValidate: true });
                    }
                  }}
                  placeholder="Select or type contact..."
                  searchPlaceholder="Search registered staff / managers..."
                  emptyText="No registered staff found. Type custom name above."
                  allowCustomValue={true}
                  error={!!errors.contactPerson}
                />
                {errors.contactPerson && <p className="text-xs text-red-600">{errors.contactPerson.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mobile" required>Mobile Number</Label>
                <Input
                  id="mobile"
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

            <div className="space-y-1.5">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                maxLength={100}
                placeholder="branch@ajayenterprises.com"
                {...register("email")}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="branchIsActive" {...register("isActive")} className="rounded text-primary-900" />
              <Label htmlFor="branchIsActive" className="text-xs font-normal cursor-pointer">
                Branch is Active and available for dispatch staging
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={isSubmitting} loadingText="Saving Branch..." className="bg-primary-900 text-white">Save Branch</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, branchId: null })}
        onConfirm={executeDelete}
        title="Delete Branch"
        description="Are you sure you want to delete this branch? Operational and inventory records linked to this branch may be affected."
        confirmText="Delete Branch"
        variant="danger"
      />
    </div>
  );
}

