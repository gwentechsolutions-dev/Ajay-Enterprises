"use client";

import * as React from "react";
import {
  Layers,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  FileText,
  Clock,
  X,
  Hammer,
  ShieldAlert,
  ArrowRight,
  Warehouse,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/loading-states";
import { toast } from "sonner";

export default function MaterialMaintenancePage() {
  const [jobs, setJobs] = React.useState<any[]>([]);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [materials, setMaterials] = React.useState<any[]>([]);
  const [technicians, setTechnicians] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [ownershipFilter, setOwnershipFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  // Create Job Modal
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    warehouseId: "",
    materialVariantId: "",
    ownershipType: "OWNED",
    totalQuantity: 10,
    damageDescription: "Bent pipes / damaged threading from site return",
    priority: "MEDIUM",
    assignedTechnicianId: "",
    targetDate: "",
    remarks: "",
  });
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Complete Repair Modal (Partial or Full)
  const [completeModalOpen, setCompleteModalOpen] = React.useState(false);
  const [selectedJob, setSelectedJob] = React.useState<any | null>(null);
  const [completeForm, setCompleteForm] = React.useState({
    repairedQuantity: 0,
    partsCost: 0,
    labourCost: 0,
    externalVendorCost: 0,
    repairVendor: "",
    notes: "",
  });

  // Scrap Modal
  const [scrapModalOpen, setScrapModalOpen] = React.useState(false);
  const [scrapForm, setScrapForm] = React.useState({
    scrappedQuantity: 0,
    reason: "Damaged beyond economic repair / cracked weld",
    scrapValueRecovered: 0,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [jRes, wRes, mRes, tRes] = await Promise.all([
        fetch("/api/v1/material-maintenance/jobs"),
        fetch("/api/v1/warehouses"),
        fetch("/api/v1/materials/variants"),
        fetch("/api/v1/labour/workers?category=REPAIR_MAINTENANCE"),
      ]);

      const [jData, wData, mData, tData] = await Promise.all([
        jRes.json(),
        wRes.json(),
        mRes.json(),
        tRes.json(),
      ]);

      if (jData.success) setJobs(jData.data);
      if (wData.success) setWarehouses(wData.data);
      if (mData.success) setMaterials(mData.data);
      if (tData.success) setTechnicians(tData.data);
    } catch (err) {
      console.error("Failed to load material repair data", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/v1/material-maintenance/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: createForm.warehouseId,
          materialVariantId: createForm.materialVariantId,
          ownershipType: createForm.ownershipType,
          totalQuantity: Number(createForm.totalQuantity),
          damageDescription: createForm.damageDescription,
          priority: createForm.priority,
          assignedTechnicianId: createForm.assignedTechnicianId || undefined,
          targetDate: createForm.targetDate || undefined,
          remarks: createForm.remarks || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to create repair job");
      }

      setIsCreateOpen(false);
      setCreateForm({
        warehouseId: "",
        materialVariantId: "",
        ownershipType: "OWNED",
        totalQuantity: 10,
        damageDescription: "Bent pipes / damaged threading from site return",
        priority: "MEDIUM",
        assignedTechnicianId: "",
        targetDate: "",
        remarks: "",
      });
      loadData();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create repair job");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/material-maintenance/jobs/${selectedJob.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repairedQuantity: Number(completeForm.repairedQuantity),
          partsCost: Number(completeForm.partsCost) || 0,
          labourCost: Number(completeForm.labourCost) || 0,
          externalVendorCost: Number(completeForm.externalVendorCost) || 0,
          repairVendor: completeForm.repairVendor || undefined,
          notes: completeForm.notes || undefined,
          postToInventory: true,
          postToAccounts: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to complete repair");
      }

      setCompleteModalOpen(false);
      setSelectedJob(null);
      toast.success("Maintenance repair completed successfully");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete repair");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/material-maintenance/jobs/${selectedJob.id}/scrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scrappedQuantity: Number(scrapForm.scrappedQuantity),
          reason: scrapForm.reason,
          scrapValueRecovered: Number(scrapForm.scrapValueRecovered) || 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to scrap items");
      }

      setScrapModalOpen(false);
      setSelectedJob(null);
      toast.success("Scrap items recorded successfully");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to scrap items");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      j.jobCode?.toLowerCase().includes(q) ||
      j.materialVariant?.name?.toLowerCase().includes(q) ||
      j.warehouse?.name?.toLowerCase().includes(q) ||
      j.damageDescription?.toLowerCase().includes(q);

    const matchesOwnership = ownershipFilter === "ALL" || j.ownershipType === ownershipFilter;
    const matchesStatus = statusFilter === "ALL" || j.status === statusFilter;

    return matchesSearch && matchesOwnership && matchesStatus;
  });

  const totalInRepair = jobs.reduce((sum, j) => {
    const remaining = Number(j.totalQuantity) - Number(j.repairedQuantity || 0) - Number(j.scrappedQuantity || 0);
    return sum + (remaining > 0 ? remaining : 0);
  }, 0);
  const totalRepaired = jobs.reduce((sum, j) => sum + Number(j.repairedQuantity || 0), 0);
  const totalScrapped = jobs.reduce((sum, j) => sum + Number(j.scrappedQuantity || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">
              Centering Material Maintenance & Repairs
            </h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-orange-100 text-[#F26522]">
              AJAY ENTERPRISES
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Reconditioning damaged scaffolding pipes, props, spans & plates with inventory stock release & repair expenses (Account 5020)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            loadingText="Refreshing..."
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Repair Job
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jobs Logged</div>
            <div className="text-2xl font-bold text-[#0B1E36] mt-1">{jobs.length}</div>
            <div className="text-xs text-slate-500 mt-1">Total repair orders</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Units In Repair</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{totalInRepair}</div>
            <div className="text-xs text-slate-500 mt-1">Pending reconditioning</div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Hammer className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Repaired & Released</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{totalRepaired}</div>
            <div className="text-xs text-slate-500 mt-1">Returned to available stock</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Scrapped / Written Off</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{totalScrapped}</div>
            <div className="text-xs text-slate-500 mt-1">Unrepairable material loss</div>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <Trash2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search job # or material..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Ownership:</span>
            <select
              value={ownershipFilter}
              onChange={(e) => setOwnershipFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
            >
              <option value="ALL">All Ownerships</option>
              <option value="OWNED">OWNED (Ajay Enterprises)</option>
              <option value="HIRED_IN">HIRED_IN (Third Party)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="IN_REPAIR">In Repair</option>
              <option value="REPORTED">Reported</option>
              <option value="RETURNED_TO_AVAILABLE_STOCK">Returned To Stock</option>
              <option value="WRITTEN_OFF">Written Off</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Job Code</th>
                <th className="p-3">Material Variant</th>
                <th className="p-3">Warehouse / Yard</th>
                <th className="p-3">Ownership</th>
                <th className="p-3 text-center">Qty Logged</th>
                <th className="p-3 text-center">Repaired</th>
                <th className="p-3 text-center">Scrapped</th>
                <th className="p-3 text-center">Pending</th>
                <th className="p-3">Priority</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeleton columns={11} rows={6} />
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    No material maintenance jobs found. Click Create Repair Job to record damaged centering material.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((j) => {
                const total = Number(j.totalQuantity);
                const repaired = Number(j.repairedQuantity || 0);
                const scrapped = Number(j.scrappedQuantity || 0);
                const pending = Math.max(0, total - repaired - scrapped);

                return (
                  <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#0B1E36]">{j.jobCode}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{j.materialVariant?.name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {j.materialVariant?.materialCode}
                      </div>
                    </td>
                    <td className="p-3 font-medium text-slate-700">
                      {j.warehouse?.name || "Main Yard"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                          j.ownershipType === "OWNED"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {j.ownershipType}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-semibold text-slate-900">{total}</td>
                    <td className="p-3 text-center font-mono text-emerald-600 font-bold">{repaired}</td>
                    <td className="p-3 text-center font-mono text-red-600 font-bold">{scrapped}</td>
                    <td className="p-3 text-center font-mono text-amber-600 font-bold">{pending}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          j.priority === "URGENT" || j.priority === "HIGH"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {j.priority}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          j.status === "RETURNED_TO_AVAILABLE_STOCK"
                            ? "bg-emerald-100 text-emerald-800"
                            : j.status === "WRITTEN_OFF"
                            ? "bg-slate-200 text-slate-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {j.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {pending > 0 && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedJob(j);
                              setCompleteForm({
                                repairedQuantity: pending,
                                partsCost: 0,
                                labourCost: 0,
                                externalVendorCost: 0,
                                repairVendor: "",
                                notes: "Reconditioned and verified",
                              });
                              setCompleteModalOpen(true);
                            }}
                            className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-7 px-2"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Repair
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedJob(j);
                              setScrapForm({
                                scrappedQuantity: pending,
                                reason: "Unrepairable cracked metal",
                                scrapValueRecovered: 0,
                              });
                              setScrapModalOpen(true);
                            }}
                            className="text-xs text-red-700 border-red-300 hover:bg-red-50 h-7 px-2"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Scrap
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Repair Job Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0B1E36]">Create Material Repair Job</h2>
                <p className="text-xs text-slate-500">Record damaged scaffolding material for yard maintenance</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Warehouse / Yard <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={createForm.warehouseId}
                    onChange={(e) => setCreateForm({ ...createForm, warehouseId: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  >
                    <option value="">-- Choose Yard --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.warehouseCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Material Variant <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={createForm.materialVariantId}
                    onChange={(e) => setCreateForm({ ...createForm, materialVariantId: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  >
                    <option value="">-- Choose Material --</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.materialCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ownership Bucket <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createForm.ownershipType}
                    onChange={(e) => setCreateForm({ ...createForm, ownershipType: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  >
                    <option value="OWNED">OWNED (Ajay Enterprises)</option>
                    <option value="HIRED_IN">HIRED_IN (Third Party)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Damaged Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={createForm.totalQuantity}
                    onChange={(e) => setCreateForm({ ...createForm, totalQuantity: Number(e.target.value) })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Damage Description & Required Work <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Describe damage (e.g. threading stripped, welded plate detached, pipe bent)"
                  value={createForm.damageDescription}
                  onChange={(e) => setCreateForm({ ...createForm, damageDescription: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assigned Technician
                  </label>
                  <select
                    value={createForm.assignedTechnicianId}
                    onChange={(e) => setCreateForm({ ...createForm, assignedTechnicianId: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  >
                    <option value="">-- Unassigned / Yard Pool --</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.workerCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={createForm.targetDate}
                    onChange={(e) => setCreateForm({ ...createForm, targetDate: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Logging Job..."
                  className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
                >
                  Log Repair Job
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Repair Modal (Partial / Full) */}
      {completeModalOpen && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0B1E36]">Complete Material Repair</h2>
                <p className="text-xs text-slate-500">
                  Job {selectedJob.jobCode}: {selectedJob.materialVariant?.name} ({selectedJob.ownershipType})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompleteModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteRepair} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Repaired Units Ready for Stock Release <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={Number(selectedJob.totalQuantity) - Number(selectedJob.repairedQuantity || 0) - Number(selectedJob.scrappedQuantity || 0)}
                  required
                  value={completeForm.repairedQuantity}
                  onChange={(e) => setCompleteForm({ ...completeForm, repairedQuantity: Number(e.target.value) })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                />
                <span className="text-[11px] text-slate-500">
                  Partial completion supported. Repaired units will automatically increment available {selectedJob.ownershipType} stock via MAINTENANCE_RETURN movement.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Parts Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={completeForm.partsCost}
                    onChange={(e) => setCompleteForm({ ...completeForm, partsCost: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Labour Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={completeForm.labourCost}
                    onChange={(e) => setCompleteForm({ ...completeForm, labourCost: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Vendor Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={completeForm.externalVendorCost}
                    onChange={(e) => setCompleteForm({ ...completeForm, externalVendorCost: Number(e.target.value) })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  External Workshop / Vendor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Modern Welding Works"
                  value={completeForm.repairVendor}
                  onChange={(e) => setCompleteForm({ ...completeForm, repairVendor: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                />
              </div>

              <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-200">
                Posting automatically debits Material Repair Expense (Account 5020) and credits Cash/Bank in the General Ledger.
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCompleteModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Releasing..."
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Release to Stock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scrap Modal */}
      {scrapModalOpen && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-red-700">Write Off / Scrap Material</h2>
                <p className="text-xs text-slate-500">
                  Job {selectedJob.jobCode}: {selectedJob.materialVariant?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScrapModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScrap} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Scrapped Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={Number(selectedJob.totalQuantity) - Number(selectedJob.repairedQuantity || 0) - Number(selectedJob.scrappedQuantity || 0)}
                  required
                  value={scrapForm.scrappedQuantity}
                  onChange={(e) => setScrapForm({ ...scrapForm, scrappedQuantity: Number(e.target.value) })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason for Write-Off <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={scrapForm.reason}
                  onChange={(e) => setScrapForm({ ...scrapForm, reason: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Scrap Value Recovered (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={scrapForm.scrapValueRecovered}
                  onChange={(e) => setScrapForm({ ...scrapForm, scrapValueRecovered: Number(e.target.value) })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]"
                />
              </div>

              <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200">
                Posts an immutable SCRAP movement to remove the damaged inventory from custody.
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setScrapModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Processing..."
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Confirm Scrap
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
