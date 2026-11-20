"use client";

import * as React from "react";
import Link from "next/link";
import {
  HardHat,
  Users2,
  ClipboardCheck,
  Calculator,
  IndianRupee,
  Plus,
  RefreshCw,
  Calendar,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LabourOverviewPage() {
  const [workers, setWorkers] = React.useState<any[]>([]);
  const [advances, setAdvances] = React.useState<any[]>([]);
  const [settlements, setSettlements] = React.useState<any[]>([]);
  const [attendance, setAttendance] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const todayStr = new Date().toISOString().split("T")[0];

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [wRes, aRes, sRes, attRes] = await Promise.all([
        fetch("/api/v1/labour/workers"),
        fetch("/api/v1/labour/advances"),
        fetch("/api/v1/labour/wages/settlements"),
        fetch(`/api/v1/labour/attendance?date=${todayStr}`),
      ]);

      const [wData, aData, sData, attData] = await Promise.all([
        wRes.json(),
        aRes.json(),
        sRes.json(),
        attRes.json(),
      ]);

      if (wData.success) setWorkers(wData.data);
      if (aData.success) setAdvances(aData.data);
      if (sData.success) setSettlements(sData.data);
      if (attData.success) setAttendance(attData.data);
    } catch (err) {
      console.error("Failed to load labour overview data", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const activeWorkers = workers.filter((w) => w.status === "ACTIVE").length;
  const presentToday = attendance.filter((a) => a.status === "PRESENT").length;
  const halfDayToday = attendance.filter((a) => a.status === "HALF_DAY").length;
  const totalAdvancesOutstanding = workers.reduce(
    (acc, w) => acc + (Number(w.activeAdvanceBalance) || 0),
    0
  );
  const pendingSettlementWages = settlements
    .filter((s) => s.status === "DRAFT" || s.status === "APPROVED")
    .reduce((acc, s) => acc + (Number(s.netPayable) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1E36] break-words">Labour & Workforce Operations</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-orange-100 text-[#F26522] whitespace-nowrap">
              AJAY ENTERPRISES
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Workforce roster, daily attendance tracking, wage computations, worker advances & settlements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/labour/attendance">
            <Button size="sm" className="bg-[#0B1E36] hover:bg-[#1E293B] text-white">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Mark Attendance
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Workforce</div>
            <div className="text-2xl font-bold text-[#0B1E36] mt-1">{activeWorkers}</div>
            <div className="text-xs text-slate-500 mt-1">{workers.length} total registered</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <HardHat className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Attendance</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {presentToday} <span className="text-sm font-normal text-slate-500">({halfDayToday} Half-Day)</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">{attendance.length} marked today</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ClipboardCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding Advances</div>
            <div className="text-2xl font-bold text-[#F26522] mt-1">
              ₹{totalAdvancesOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 mt-1">Recoverable against wages</div>
          </div>
          <div className="p-3 bg-orange-50 text-[#F26522] rounded-xl">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Wage Payable</div>
            <div className="text-2xl font-bold text-[#0B1E36] mt-1">
              ₹{pendingSettlementWages.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 mt-1">Approved/Draft settlements</div>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Calculator className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/labour/workers"
          className="group p-5 bg-white rounded-xl border border-slate-200 hover:border-[#F26522] transition-colors shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 text-slate-700 rounded-xl group-hover:bg-orange-50 group-hover:text-[#F26522] transition-colors">
              <Users2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0B1E36] text-base group-hover:text-[#F26522] transition-colors">
                Workforce Register
              </h3>
              <p className="text-xs text-slate-500">Manage workers, trade skills, wage rates & bank details</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-[#F26522] transition-colors" />
        </Link>

        <Link
          href="/labour/attendance"
          className="group p-5 bg-white rounded-xl border border-slate-200 hover:border-[#F26522] transition-colors shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 text-slate-700 rounded-xl group-hover:bg-orange-50 group-hover:text-[#F26522] transition-colors">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0B1E36] text-base group-hover:text-[#F26522] transition-colors">
                Daily Attendance
              </h3>
              <p className="text-xs text-slate-500">Record yard attendance, overtime hours & supervisor sign-offs</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-[#F26522] transition-colors" />
        </Link>

        <Link
          href="/labour/wages"
          className="group p-5 bg-white rounded-xl border border-slate-200 hover:border-[#F26522] transition-colors shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 text-slate-700 rounded-xl group-hover:bg-orange-50 group-hover:text-[#F26522] transition-colors">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0B1E36] text-base group-hover:text-[#F26522] transition-colors">
                Wage Settlements
              </h3>
              <p className="text-xs text-slate-500">Calculate wages, overtime, advance recovery & general ledger postings</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-[#F26522] transition-colors" />
        </Link>
      </div>

      {/* Centering Material Repairs Banner */}
      <div className="p-5 bg-gradient-to-r from-[#0B1E36] to-[#1E293B] rounded-xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#F26522]" />
            <span className="font-bold text-lg">Centering Material Repairs & Reconditioning</span>
          </div>
          <p className="text-sm text-slate-300 mt-1">
            Track damaged scaffolding pipes, props, spans & plates returned from sites. Inspect, repair, or scrap unrepairable stock.
          </p>
        </div>
        <Link href="/material-maintenance">
          <Button className="bg-[#F26522] hover:bg-[#EA580C] text-white font-semibold">
            Manage Material Repairs
          </Button>
        </Link>
      </div>

      {/* Active Workforce Quick Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-[#0B1E36] text-sm">Active Workers Roster</h2>
          <Link href="/labour/workers" className="text-xs font-semibold text-[#F26522] hover:underline">
            View All ({workers.length})
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Worker Code</th>
                <th className="p-3">Full Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Trade / Skill</th>
                <th className="p-3">Wage Rate</th>
                <th className="p-3 text-right">Outstanding Advance</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.slice(0, 5).map((w) => (
                <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono font-medium text-[#0B1E36]">{w.workerCode}</td>
                  <td className="p-3 font-semibold text-slate-900">{w.fullName}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {w.category}
                    </span>
                  </td>
                  <td className="p-3">{w.skillTrade || "General Centering"}</td>
                  <td className="p-3 font-mono">
                    {w.wageType === "DAILY" ? `₹${Number(w.dailyWageRate || 0)} / day` : `₹${Number(w.monthlySalary || 0)} / mo`}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-[#F26522]">
                    ₹{Number(w.activeAdvanceBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        w.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {w.status}
                    </span>
                  </td>
                </tr>
              ))}
              {workers.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No workers registered yet. Click Workforce Register to add workers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

