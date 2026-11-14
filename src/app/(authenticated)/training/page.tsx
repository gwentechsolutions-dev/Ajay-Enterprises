"use client";

import * as React from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  ShieldCheck,
  HardHat,
  Truck,
  Warehouse as WarehouseIcon,
  Calculator,
  Compass,
  Layers,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ROLE_ICONS: Record<string, React.ElementType> = {
  OWNER: ShieldCheck,
  ADMINISTRATOR: ShieldCheck,
  ACCOUNTANT: Calculator,
  WAREHOUSE_MANAGER: WarehouseIcon,
  WAREHOUSE_STAFF: Layers,
  DELIVERY_MANAGER: Truck,
  DELIVERY_PERSONNEL: Compass,
  LABOUR_SUPERVISOR: HardHat,
  AUDITOR: BookOpen,
};

export default function TrainingPage() {
  const [curricula, setCurricula] = React.useState<any[]>([]);
  const [selectedRole, setSelectedRole] = React.useState<string>("ACCOUNTANT");
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchTraining = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/training").then((r) => r.json());
      if (res.success) {
        setCurricula(res.data || []);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Failed to load training curricula" });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTraining();
  }, [fetchTraining]);

  const handleMarkComplete = async (moduleCode: string, role: string) => {
    setUpdating(moduleCode);
    try {
      const res = await fetch("/api/v1/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleCode, role }),
      }).then((r) => r.json());

      if (res.success) {
        setMessage({ type: "success", text: `Module ${moduleCode} marked as verified and completed!` });
        fetchTraining();
      } else {
        setMessage({ type: "error", text: res.error?.message || "Failed to update module" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: "Error updating training module" });
    } finally {
      setUpdating(null);
    }
  };

  const activeCurriculum = curricula.find((c) => c.role === selectedRole);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0B1E36] text-white p-6 rounded-lg shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#F26522] text-xs font-semibold px-2 py-0.5 rounded tracking-wide uppercase">
              Operational Readiness
            </span>
            <span className="text-xs text-slate-300">Staff Onboarding & Role SOPs • AJAY ENTERPRISES</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Onboarding & Workflow Training Hub</h1>
          <p className="text-sm text-slate-300 mt-1">
            Standard Operating Procedures (SOPs), role checklists, and step-by-step guidance across all 15 INVENTRA ERP modules.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md text-sm flex items-start justify-between ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold ml-4">×</button>
        </div>
      )}

      {/* Role Navigation Pills */}
      <div className="flex flex-wrap gap-2">
        {curricula.map((c) => {
          const Icon = ROLE_ICONS[c.role] || BookOpen;
          const isSelected = selectedRole === c.role;
          const completedCount = c.workflowModules.filter((m: any) => m.isCompleted).length;
          const totalCount = c.workflowModules.length;

          return (
            <button
              key={c.role}
              onClick={() => setSelectedRole(c.role)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-bold transition ${
                isSelected
                  ? "bg-[#0B1E36] text-white border-[#0B1E36] shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{c.roleTitle}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isSelected ? "bg-[#F26522] text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {completedCount}/{totalCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Role Details & Modules */}
      {activeCurriculum && (
        <div className="space-y-6">
          {/* Role Header Card */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                  {activeCurriculum.role}
                </span>
                <h2 className="text-lg font-bold text-slate-900">{activeCurriculum.roleTitle}</h2>
              </div>
              <p className="text-xs text-slate-600 mt-1">{activeCurriculum.description}</p>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Core Responsibilities</h3>
              <ul className="text-xs text-slate-600 grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeCurriculum.coreResponsibilities.map((resp: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Workflow Modules List */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Step-by-Step Operational Modules ({activeCurriculum.workflowModules.length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCurriculum.workflowModules.map((mod: any) => (
                <div
                  key={mod.moduleCode}
                  className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#F26522]">{mod.moduleCode}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                          mod.isCompleted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {mod.isCompleted ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Completed
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            In Progress
                          </>
                        )}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900">{mod.title}</h4>
                    <p className="text-xs text-slate-500">{mod.description}</p>

                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-700">Checklist & Procedure:</div>
                      {mod.steps.map((st: string, sIdx: number) => (
                        <div key={sIdx} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="text-[#0B1E36] font-bold font-mono text-[10px]">{sIdx + 1}.</span>
                          <span>{st}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                    {!mod.isCompleted ? (
                      <Button
                        onClick={() => handleMarkComplete(mod.moduleCode, activeCurriculum.role)}
                        isLoading={updating === mod.moduleCode}
                        loadingText="Updating..."
                        className="px-3 py-1.5 bg-[#0B1E36] hover:bg-slate-800 text-white rounded text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark Completed & Verified
                      </Button>
                    ) : (
                      <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Verified for Production
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
