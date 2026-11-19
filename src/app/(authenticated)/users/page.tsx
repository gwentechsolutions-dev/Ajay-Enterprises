"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, updateUserSchema, CreateUserInput, UpdateUserInput } from "@/lib/schemas/user";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/loading-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  Users,
  Plus,
  Search,
  Filter,
  Shield,
  Phone,
  Mail,
  Edit2,
  UserX,
  Lock,
  Building,
  Warehouse,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";
import { setReactHookFormErrors, formatValidationToast, parseApiValidationErrors } from "@/lib/forms/validation-mapper";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const ROLE_OPTIONS = [
  { value: "ALL", label: "All Roles" },
  { value: "OWNER", label: "Owner / Super Admin" },
  { value: "ADMIN", label: "Administrator" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "WAREHOUSE_MANAGER", label: "Warehouse Manager" },
  { value: "WAREHOUSE_STAFF", label: "Warehouse Staff" },
  { value: "DELIVERY_MANAGER", label: "Delivery Manager" },
  { value: "DELIVERY_PERSONNEL", label: "Delivery Personnel" },
  { value: "LABOUR_SUPERVISOR", label: "Labour Supervisor" },
  { value: "READ_ONLY", label: "Read-Only / Auditor" },
];

const FORM_ROLE_OPTIONS = ROLE_OPTIONS.filter((r) => r.value !== "ALL");

const SCOPE_OPTIONS = [
  { value: "ALL_BUSINESS", label: "All Business (Full Scope)" },
  { value: "ASSIGNED_WAREHOUSE", label: "Assigned Yard / Warehouse Only" },
  { value: "ASSIGNED_SITE", label: "Assigned Customer Construction Sites" },
  { value: "ASSIGNED_DELIVERY", label: "Assigned Delivery Trips Only" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "ACTIVE", label: "Active Accounts" },
  { value: "INACTIVE", label: "Deactivated Accounts" },
];

export default function UsersPage() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState<any>({ totalPages: 1, total: 0 });

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<any | null>(null);
  const [deactivateModal, setDeactivateModal] = React.useState<{
    isOpen: boolean;
    userId: string | null;
    userName: string;
  }>({
    isOpen: false,
    userId: null,
    userName: "",
  });

  // Create/Edit Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<any>({
    resolver: zodResolver(editingUser ? updateUserSchema : createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      mobile: "",
      password: "",
      role: "READ_ONLY",
      scope: "ALL_BUSINESS",
      branchId: null,
      warehouseId: null,
      isActive: true,
    },
  });

  const selectedRole = watch("role");
  const selectedScope = watch("scope");
  const selectedBranchId = watch("branchId");
  const selectedWarehouseId = watch("warehouseId");

  const branchOptions = React.useMemo(() => {
    return [
      { value: "", label: "None / Not Assigned" },
      ...branches.map((b) => ({ value: b.id, label: b.name, sublabel: b.branchCode })),
    ];
  }, [branches]);

  const warehouseOptions = React.useMemo(() => {
    return [
      { value: "", label: "None / Not Assigned" },
      ...warehouses.map((w) => ({ value: w.id, label: w.name, sublabel: w.warehouseCode })),
    ];
  }, [warehouses]);

  const fetchUsers = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        role: roleFilter,
        status: statusFilter,
        page: page.toString(),
        limit: "15",
      });

      const res = await fetch(`/api/v1/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
        setMeta(data.meta);
      }
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page]);

  // Load auxiliary data
  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  React.useEffect(() => {
    async function loadAux() {
      try {
        const [bRes, wRes] = await Promise.all([
          fetch("/api/v1/branches"),
          fetch("/api/v1/warehouses"),
        ]);
        const [bData, wData] = await Promise.all([bRes.json(), wRes.json()]);
        if (bData.success) setBranches(bData.data);
        if (wData.success) setWarehouses(wData.data);
      } catch {
        // ignore
      }
    }
    loadAux();
  }, []);

  const handleOpenCreate = () => {
    setEditingUser(null);
    reset({
      name: "",
      email: "",
      username: "",
      mobile: "",
      password: "",
      role: "READ_ONLY",
      scope: "ALL_BUSINESS",
      branchId: null,
      warehouseId: null,
      isActive: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    reset({
      name: user.name,
      email: user.email,
      username: user.username || "",
      mobile: user.mobile,
      password: "",
      role: user.role,
      scope: user.scope,
      branchId: user.branch?.id || null,
      warehouseId: user.warehouse?.id || null,
      isActive: user.isActive,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: any) => {
    try {
      const url = editingUser ? `/api/v1/users/${editingUser.id}` : "/api/v1/users";
      const method = editingUser ? "PATCH" : "POST";

      const payload = { ...values };
      if (editingUser && !payload.password) {
        delete payload.password;
      }
      if (!payload.branchId) payload.branchId = null;
      if (!payload.warehouseId) payload.warehouseId = null;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setReactHookFormErrors(setError, data);
        toast.error(formatValidationToast(parseApiValidationErrors(data)));
        return;
      }

      toast.success(editingUser ? "User updated successfully" : "User created successfully");
      setModalOpen(false);
      fetchUsers();
    } catch {
      toast.error("Operation failed");
    }
  };

  const handleDeactivate = (id: string, name: string) => {
    setDeactivateModal({
      isOpen: true,
      userId: id,
      userName: name,
    });
  };

  const executeDeactivate = async () => {
    const { userId, userName } = deactivateModal;
    if (!userId) return;
    setDeactivateModal({ isOpen: false, userId: null, userName: "" });
    try {
      const res = await fetch(`/api/v1/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message || "Failed to deactivate user");
        return;
      }
      toast.success(`User ${userName} deactivated successfully`);
      fetchUsers();
    } catch {
      toast.error("Failed to deactivate user");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            User Administration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage corporate users, credentials, role assignments, and branch/yard scopes.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-primary-900 hover:bg-primary-800 text-white font-semibold text-xs gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add User
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, email, code or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 text-xs"
            />
          </div>

          <div>
            <SearchableCombobox
              options={ROLE_OPTIONS}
              value={roleFilter}
              onChange={(val) => {
                setRoleFilter(val || "ALL");
                setPage(1);
              }}
              placeholder="Filter by role..."
            />
          </div>

          <div>
            <SearchableCombobox
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val || "ALL");
                setPage(1);
              }}
              placeholder="Filter by status..."
            />
          </div>
        </div>
      </Card>

      {/* Users Table / Grid */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">User</th>
                <th className="py-3 px-4 whitespace-nowrap">Role & Scope</th>
                <th className="py-3 px-4 whitespace-nowrap">Assignment</th>
                <th className="py-3 px-4 whitespace-nowrap">Mobile</th>
                <th className="py-3 px-4 whitespace-nowrap">Last Login</th>
                <th className="py-3 px-4 whitespace-nowrap">Status</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <TableSkeleton columns={7} rows={6} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No users matching the selected criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{u.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                          <span className="text-[10px] font-mono text-slate-400">{u.userCode}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <Badge
                          variant={u.role === "OWNER" ? "accent" : "outline"}
                          className="font-semibold text-[10px]"
                        >
                          {u.role}
                        </Badge>
                        <p className="text-[10px] text-slate-400">{u.scope.replace("_", " ")}</p>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-[11px]">
                      {u.branch && (
                        <p className="flex items-center gap-1 text-slate-800">
                          <Building className="h-3 w-3 text-slate-400" /> {u.branch.name}
                        </p>
                      )}
                      {u.warehouse && (
                        <p className="flex items-center gap-1 text-slate-600">
                          <Warehouse className="h-3 w-3 text-slate-400" /> {u.warehouse.name}
                        </p>
                      )}
                      {!u.branch && !u.warehouse && (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-800">
                      {u.mobile}
                    </td>

                    <td className="py-3 px-4 text-[11px] text-slate-500">
                      {formatDateTime(u.lastLogin)}
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant={u.isActive ? "success" : "secondary"}>
                        {u.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 text-slate-500 hover:text-primary-900 hover:bg-slate-100 rounded"
                          title="Edit User"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {u.isActive && u.role !== "OWNER" && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(u.id, u.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Deactivate Account"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {meta.page} of {meta.totalPages} ({meta.total} users)
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-7 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage(page + 1)}
                className="h-7 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* CREATE / EDIT USER MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User Account" : "Add New Corporate User"}</DialogTitle>
            <DialogDescription>
              Assign role credentials and branch/yard operational scopes
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="uFullName" required>Full Name</Label>
                <Input
                  id="uFullName"
                  maxLength={100}
                  placeholder="e.g. Ramesh Kumar"
                  {...register("name")}
                  error={!!errors.name}
                />
                {errors.name && <p className="text-xs text-red-600">{String(errors.name.message)}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="uUsername">Username (Optional)</Label>
                <Input
                  id="uUsername"
                  maxLength={50}
                  placeholder="e.g. ramesh"
                  {...register("username")}
                  error={!!errors.username}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="uEmail" required>Corporate Email</Label>
                <Input
                  id="uEmail"
                  type="email"
                  maxLength={100}
                  placeholder="ramesh@ajayenterprises.com"
                  {...register("email")}
                  error={!!errors.email}
                />
                {errors.email && <p className="text-xs text-red-600">{String(errors.email.message)}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="uMobile" required>Indian Mobile</Label>
                <Input
                  id="uMobile"
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
                {errors.mobile && <p className="text-xs text-red-600">{String(errors.mobile.message)}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="uPassword" required={!editingUser}>
                {editingUser ? "Password (Leave blank to keep unchanged)" : "Password"}
              </Label>
              <Input
                id="uPassword"
                type="password"
                maxLength={100}
                placeholder={editingUser ? "••••••••••••" : "Min 8 chars, 1 uppercase, 1 digit"}
                {...register("password")}
                error={!!errors.password}
              />
              {errors.password && <p className="text-xs text-red-600">{String(errors.password.message)}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label required>Role Assignment</Label>
                <SearchableCombobox
                  options={FORM_ROLE_OPTIONS}
                  value={selectedRole}
                  onChange={(val) => setValue("role", val)}
                />
                {errors.role && <p className="text-xs text-red-600">{String(errors.role.message)}</p>}
              </div>

              <div className="space-y-1.5">
                <Label required>Record Scope</Label>
                <SearchableCombobox
                  options={SCOPE_OPTIONS}
                  value={selectedScope}
                  onChange={(val) => setValue("scope", val)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assigned Branch</Label>
                <SearchableCombobox
                  options={branchOptions}
                  value={selectedBranchId || ""}
                  onChange={(val) => setValue("branchId", val || null)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Assigned Yard / Warehouse</Label>
                <SearchableCombobox
                  options={warehouseOptions}
                  value={selectedWarehouseId || ""}
                  onChange={(val) => setValue("warehouseId", val || null)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="userIsActive" {...register("isActive")} className="rounded text-primary-900" />
              <Label htmlFor="userIsActive" className="text-xs font-normal cursor-pointer">
                User Account is Active and allowed to sign in
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={isSubmitting} loadingText="Saving User..." className="bg-primary-900 text-white">Save User</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={deactivateModal.isOpen}
        onClose={() => setDeactivateModal({ isOpen: false, userId: null, userName: "" })}
        onConfirm={executeDeactivate}
        title="Deactivate User Account"
        description={`Are you sure you want to deactivate ${deactivateModal.userName}? The user will no longer be able to log in or perform system actions.`}
        confirmText="Deactivate User"
        variant="danger"
      />
    </div>
  );
}
