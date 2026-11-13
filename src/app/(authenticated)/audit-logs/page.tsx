"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { History, Search, ShieldCheck, Eye, Clock, User, Terminal } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";

const MODULE_FILTERS = [
  { value: "ALL", label: "All Modules" },
  { value: "AUTH", label: "Authentication (AUTH)" },
  { value: "USERS", label: "Users Management" },
  { value: "ROLES", label: "Roles & RBAC" },
  { value: "COMPANY", label: "Company Profile" },
  { value: "BRANCHES", label: "Branches" },
  { value: "WAREHOUSES", label: "Warehouses / Yards" },
  { value: "SERIES", label: "Document Series" },
  { value: "STORAGE", label: "File Storage" },
];

const ACTION_FILTERS = [
  { value: "ALL", label: "All Actions" },
  { value: "LOGIN", label: "User Login" },
  { value: "LOGOUT", label: "User Logout" },
  { value: "FAILED_LOGIN", label: "Failed Login" },
  { value: "CREATE", label: "Create Record" },
  { value: "UPDATE", label: "Update Record" },
  { value: "DELETE", label: "Delete Record" },
  { value: "DEACTIVATE", label: "Deactivate Account" },
  { value: "PASSWORD_CHANGE", label: "Password Change" },
  { value: "UPLOAD", label: "File Upload" },
];

export default function AuditLogsPage() {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [moduleFilter, setModuleFilter] = React.useState("ALL");
  const [actionFilter, setActionFilter] = React.useState("ALL");
  const [page, setPage] = React.useState(1);
  const [meta, setMeta] = React.useState<any>({ totalPages: 1, total: 0 });

  const [selectedLog, setSelectedLog] = React.useState<any | null>(null);

  const fetchLogs = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        module: moduleFilter,
        action: actionFilter,
        page: page.toString(),
        limit: "25",
      });

      const res = await fetch(`/api/v1/audit-logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setMeta(data.meta);
      }
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [search, moduleFilter, actionFilter, page]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "LOGIN":
        return "success";
      case "FAILED_LOGIN":
        return "destructive";
      case "CREATE":
        return "accent";
      case "UPDATE":
        return "outline";
      case "DELETE":
      case "DEACTIVATE":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Audit Trail & Event Logs
          </h1>
          <Badge variant="outline" className="bg-primary-50 text-primary-900 border-primary-200 font-semibold">
            Append-Only
          </Badge>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Cryptographically timestamped, non-editable audit trail recording all administrative actions, logins, and state mutations.
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search actor, action, notes..."
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
              options={MODULE_FILTERS}
              value={moduleFilter}
              onChange={(val) => {
                setModuleFilter(val || "ALL");
                setPage(1);
              }}
              placeholder="Filter by module..."
            />
          </div>

          <div>
            <SearchableCombobox
              options={ACTION_FILTERS}
              value={actionFilter}
              onChange={(val) => {
                setActionFilter(val || "ALL");
                setPage(1);
              }}
              placeholder="Filter by action..."
            />
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading audit events...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No audit records match the criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {formatDateTime(log.createdAt)}
                    </td>

                    <td className="py-3 px-4">
                      {log.userName ? (
                        <div>
                          <p className="font-semibold text-slate-900">{log.userName}</p>
                          <span className="text-[10px] text-slate-400">{log.userRole}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">System / Anonymous</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant={getActionBadgeVariant(log.action) as any} className="text-[10px]">
                        {log.action}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 font-mono text-[10px] text-slate-600">
                      {log.module}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">{log.entityType}</span>
                      {log.entityId && (
                        <p className="font-mono text-[9px] text-slate-400 truncate max-w-[100px]">
                          {log.entityId}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {log.ipAddress || "127.0.0.1"}
                    </td>

                    <td className="py-3 px-4 max-w-xs truncate text-[11px] text-slate-600">
                      {log.notes || "-"}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {(log.beforeState || log.afterState) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-7 px-2 text-[11px] text-primary-900 hover:bg-slate-100"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View Diff
                        </Button>
                      )}
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
              Showing page {meta.page} of {meta.totalPages} ({meta.total} audit events)
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

      {/* AUDIT STATE DIFF DIALOG */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Event Inspection</DialogTitle>
            <DialogDescription>
              Action: <span className="font-bold text-slate-900">{selectedLog?.action}</span> on{" "}
              <span className="font-bold text-slate-900">{selectedLog?.entityType}</span> at{" "}
              {formatDateTime(selectedLog?.createdAt)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedLog?.notes && (
              <div className="p-3 bg-slate-50 border rounded-lg text-xs text-slate-700">
                <p className="font-semibold text-slate-900 mb-0.5">Notes:</p>
                <p>{selectedLog.notes}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase mb-1">State Before Mutation</p>
                <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto max-h-60">
                  {selectedLog?.beforeState
                    ? JSON.stringify(JSON.parse(selectedLog.beforeState), null, 2)
                    : "// No previous state (Record Created)"}
                </pre>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 uppercase mb-1">State After Mutation</p>
                <pre className="p-3 bg-slate-900 text-blue-400 font-mono text-[11px] rounded-lg overflow-x-auto max-h-60">
                  {selectedLog?.afterState
                    ? JSON.stringify(JSON.parse(selectedLog.afterState), null, 2)
                    : "// No subsequent state (Record Deleted)"}
                </pre>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setSelectedLog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

