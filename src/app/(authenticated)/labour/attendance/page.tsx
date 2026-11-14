"use client";

import * as React from "react";
import {
  ClipboardCheck,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  Save,
  CheckCheck,
  AlertCircle,
  HardHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/loading-states";

export default function LabourAttendancePage() {
  const [selectedDate, setSelectedDate] = React.useState(
    new Date().toISOString().split("T")[0]
  );
  const [workers, setWorkers] = React.useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = React.useState<any[]>([]);
  const [rowStates, setRowStates] = React.useState<{
    [workerId: string]: {
      id?: string;
      status: string;
      overtimeHours: number;
      supervisorRemarks: string;
      isApproved: boolean;
    };
  }>({});

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isApproving, setIsApproving] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async (date: string) => {
    setIsLoading(true);
    setMessage(null);
    try {
      const [wRes, aRes] = await Promise.all([
        fetch("/api/v1/labour/workers?status=ACTIVE"),
        fetch(`/api/v1/labour/attendance?date=${date}`),
      ]);

      const [wData, aData] = await Promise.all([wRes.json(), aRes.json()]);

      const activeWorkers = wData.success ? wData.data : [];
      const records = aData.success ? aData.data : [];

      setWorkers(activeWorkers);
      setAttendanceRecords(records);

      const mapping: typeof rowStates = {};
      const recordMap = new Map<string, any>();
      records.forEach((r: any) => recordMap.set(r.workerId, r));

      activeWorkers.forEach((w: any) => {
        const existing = recordMap.get(w.id);
        if (existing) {
          mapping[w.id] = {
            id: existing.id,
            status: existing.status,
            overtimeHours: Number(existing.overtimeHours) || 0,
            supervisorRemarks: existing.supervisorRemarks || "",
            isApproved: existing.isApproved || false,
          };
        } else {
          mapping[w.id] = {
            status: "PRESENT",
            overtimeHours: 0,
            supervisorRemarks: "",
            isApproved: false,
          };
        }
      });

      setRowStates(mapping);
    } catch (err: any) {
      console.error("Error loading attendance", err);
      setMessage({ type: "error", text: "Failed to load attendance data" });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  const handleStatusChange = (workerId: string, status: string) => {
    setRowStates((prev) => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        status,
      },
    }));
  };

  const handleOvertimeChange = (workerId: string, hours: number) => {
    setRowStates((prev) => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        overtimeHours: Math.max(0, Math.min(16, hours)),
      },
    }));
  };

  const handleRemarksChange = (workerId: string, remarks: string) => {
    setRowStates((prev) => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        supervisorRemarks: remarks,
      },
    }));
  };

  const setAllStatus = (status: string) => {
    setRowStates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        next[id] = { ...next[id], status };
      });
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const records = workers.map((w) => ({
        workerId: w.id,
        attendanceDate: selectedDate,
        status: rowStates[w.id]?.status || "PRESENT",
        overtimeHours: Number(rowStates[w.id]?.overtimeHours) || 0,
        supervisorRemarks: rowStates[w.id]?.supervisorRemarks || undefined,
      }));

      const res = await fetch("/api/v1/labour/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceDate: selectedDate,
          records,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to save attendance");
      }

      setMessage({ type: "success", text: `Successfully saved attendance for ${records.length} workers.` });
      await loadData(selectedDate);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save attendance" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAll = async () => {
    setIsApproving(true);
    setMessage(null);

    try {
      const unapprovedIds = attendanceRecords
        .filter((r) => !r.isApproved)
        .map((r) => r.id);

      if (unapprovedIds.length === 0) {
        setMessage({ type: "error", text: "No unapproved saved attendance records found for this date. Please save first." });
        setIsApproving(false);
        return;
      }

      const res = await fetch("/api/v1/labour/attendance/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceIds: unapprovedIds }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to approve attendance");
      }

      setMessage({ type: "success", text: `Approved ${unapprovedIds.length} attendance records.` });
      await loadData(selectedDate);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to approve attendance" });
    } finally {
      setIsApproving(false);
    }
  };

  // Counts
  const counts = Object.values(rowStates).reduce(
    (acc, curr) => {
      if (curr.status === "PRESENT") acc.present++;
      else if (curr.status === "HALF_DAY") acc.halfDay++;
      else if (curr.status === "ABSENT") acc.absent++;
      else acc.leave++;
      acc.totalOvertime += Number(curr.overtimeHours) || 0;
      if (curr.isApproved) acc.approved++;
      return acc;
    },
    { present: 0, halfDay: 0, absent: 0, leave: 0, totalOvertime: 0, approved: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Daily Labour Attendance</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-orange-100 text-[#F26522]">
              AJAY ENTERPRISES
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Yard muster roll, full/half day tracking, overtime recording and supervisor sign-offs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm font-semibold text-slate-800 focus:outline-none"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(selectedDate)}
            isLoading={isLoading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2 border ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* KPI & Quick Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Present:</span>
            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              {counts.present}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Half-Day:</span>
            <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              {counts.halfDay}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Absent:</span>
            <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
              {counts.absent}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Leave/Off:</span>
            <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
              {counts.leave}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Total OT:</span>
            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-mono">
              {counts.totalOvertime} hrs
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Approved:</span>
            <span className="font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
              {counts.approved} / {workers.length}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAllStatus("PRESENT")}
            className="text-xs border-slate-300"
          >
            Mark All Present
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAllStatus("ABSENT")}
            className="text-xs border-slate-300"
          >
            Mark All Absent
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={workers.length === 0}
            isLoading={isSaving}
            loadingText="Saving..."
            className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
          >
            <Save className="w-4 h-4 mr-1.5" />
            Save Attendance
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApproveAll}
            disabled={attendanceRecords.length === 0}
            isLoading={isApproving}
            loadingText="Approving..."
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCheck className="w-4 h-4 mr-1.5" />
            Approve Records
          </Button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Worker</th>
                <th className="p-3">Category</th>
                <th className="p-3">Wage Type</th>
                <th className="p-3">Attendance Status</th>
                <th className="p-3">OT (Hours)</th>
                <th className="p-3">Supervisor Remarks</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableSkeleton columns={7} rows={6} />
              ) : workers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No active workers found. Add active workers in the Workforce Register first.
                  </td>
                </tr>
              ) : (
                workers.map((w) => {
                  const row = rowStates[w.id] || {
                    status: "PRESENT",
                    overtimeHours: 0,
                    supervisorRemarks: "",
                    isApproved: false,
                  };

                  return (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{w.name}</div>
                        <div className="text-xs font-mono text-slate-500">{w.workerCode}</div>
                      </td>
                      <td className="p-3">
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-700">
                          {w.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {w.wageType === "DAILY" ? `₹${Number(w.dailyWage || 0)}/day` : `₹${Number(w.monthlySalary || 0)}/mo`}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(["PRESENT", "HALF_DAY", "ABSENT", "PAID_LEAVE", "UNPAID_LEAVE", "HOLIDAY"] as const).map(
                            (st) => {
                              const isSelected = row.status === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleStatusChange(w.id, st)}
                                  className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
                                    isSelected
                                      ? st === "PRESENT"
                                        ? "bg-emerald-600 text-white"
                                        : st === "HALF_DAY"
                                        ? "bg-amber-500 text-white"
                                        : st === "ABSENT"
                                        ? "bg-red-600 text-white"
                                        : "bg-slate-800 text-white"
                                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  }`}
                                >
                                  {st === "PRESENT"
                                    ? "Present (1.0)"
                                    : st === "HALF_DAY"
                                    ? "Half (0.5)"
                                    : st === "ABSENT"
                                    ? "Absent (0)"
                                    : st.replace("_", " ")}
                                </button>
                              );
                            }
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          max="16"
                          step="0.5"
                          value={row.overtimeHours}
                          onChange={(e) => handleOvertimeChange(w.id, parseFloat(e.target.value) || 0)}
                          className="w-20 px-2.5 py-1 text-xs border border-slate-300 rounded font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#0B1E36]"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="Work area or notes..."
                          value={row.supervisorRemarks}
                          onChange={(e) => handleRemarksChange(w.id, e.target.value)}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0B1E36]"
                        />
                      </td>
                      <td className="p-3 text-center">
                        {row.isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved
                          </span>
                        ) : row.id ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                            Saved
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Not Saved</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

