"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, ShieldAlert, Check, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function RolesPermissionsPage() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedRole, setSelectedRole] = React.useState("ADMIN");
  const [updatingKey, setUpdatingKey] = React.useState<string | null>(null);

  const fetchPermissions = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/roles");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const togglePermission = async (module: string, action: string, currentVal: boolean) => {
    if (selectedRole === "OWNER") {
      toast.error("Owner permissions are root-level and cannot be restricted.");
      return;
    }

    const key = `${selectedRole}_${module}_${action}`;
    setUpdatingKey(key);

    try {
      const res = await fetch("/api/v1/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole,
          module,
          action,
          isAllowed: !currentVal,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "Failed to update permission");
        return;
      }

      // Update local state
      setData((prev: any) => {
        const nextPerms = [...prev.permissions];
        const idx = nextPerms.findIndex(
          (p) => p.role === selectedRole && p.module === module && p.action === action
        );
        if (idx >= 0) {
          nextPerms[idx].isAllowed = !currentVal;
        } else {
          nextPerms.push({ role: selectedRole, module, action, isAllowed: !currentVal });
        }
        return { ...prev, permissions: nextPerms };
      });

      toast.success(`Permission updated for ${selectedRole}`);
    } catch {
      toast.error("Network error while updating permission");
    } finally {
      setUpdatingKey(null);
    }
  };

  const getPermission = (role: string, module: string, action: string): boolean => {
    if (role === "OWNER") return true;
    const item = data?.permissions?.find(
      (p: any) => p.role === role && p.module === module && p.action === action
    );
    return !!item?.isAllowed;
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4" />
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  const roleMeta = data?.roles?.find((r: any) => r.id === selectedRole);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Role-Based Access Control (RBAC) Matrix
          </h1>
          <Badge variant="outline" className="bg-primary-50 text-primary-900 border-primary-200 font-semibold">
            Server-Enforced
          </Badge>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Configure action-level permissions per module across 9 predefined corporate roles.
        </p>
      </div>

      {/* Role Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {data?.roles?.map((r: any) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedRole(r.id)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border",
              selectedRole === r.id
                ? "bg-[#0B1E36] text-white border-[#0B1E36] shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Role Overview Callout */}
      <Card className="p-4 bg-slate-50/50 border-slate-200">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">{roleMeta?.label}</span>
              <Badge variant={selectedRole === "OWNER" ? "accent" : "outline"} className="text-[10px]">
                {selectedRole}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">{roleMeta?.description}</p>
          </div>
          {selectedRole === "OWNER" && (
            <div className="flex items-center gap-1.5 text-xs text-accent-700 bg-accent-50 border border-accent-200 px-2.5 py-1 rounded-lg font-medium">
              <Lock className="h-3.5 w-3.5" /> Full Root Bypass
            </div>
          )}
        </div>
      </Card>

      {/* Permission Matrix Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 min-w-[200px]">Module</th>
                {data?.actions?.map((act: any) => (
                  <th key={act.id} className="py-3 px-3 text-center">
                    {act.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data?.modules?.map((mod: any) => (
                <tr key={mod.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {mod.label}
                  </td>
                  {data?.actions?.map((act: any) => {
                    const isAllowed = getPermission(selectedRole, mod.id, act.id);
                    const key = `${selectedRole}_${mod.id}_${act.id}`;
                    const isBusy = updatingKey === key;

                    return (
                      <td key={act.id} className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={selectedRole === "OWNER" || isBusy}
                          onClick={() => togglePermission(mod.id, act.id, isAllowed)}
                          className={cn(
                            "h-7 w-7 rounded-lg inline-flex items-center justify-center transition-all",
                            isAllowed
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                            selectedRole === "OWNER" && "cursor-not-allowed opacity-90",
                            isBusy && "animate-pulse"
                          )}
                          title={`${isAllowed ? "Revoke" : "Grant"} ${act.label} on ${mod.label}`}
                        >
                          {isAllowed ? (
                            <Check className="h-4 w-4 stroke-[2.5]" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

