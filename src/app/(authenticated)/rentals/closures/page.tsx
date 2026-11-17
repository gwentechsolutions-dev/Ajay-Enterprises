"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building,
  ShieldAlert,
  Scale,
  IndianRupee,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export default function SiteClosuresPage() {
  const [sites, setSites] = React.useState<any[]>([]);
  const [settlements, setSettlements] = React.useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = React.useState("");
  const [auditResult, setAuditResult] = React.useState<any>(null);
  const [isAuditing, setIsAuditing] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  // Execution state
  const [ownerOverride, setOwnerOverride] = React.useState(false);
  const [exceptionReason, setExceptionReason] = React.useState("");
  const [receiverName, setReceiverName] = React.useState("");
  const [receiverPhone, setReceiverPhone] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [isClosing, setIsClosing] = React.useState(false);
  const [confirmClosureOpen, setConfirmClosureOpen] = React.useState(false);

  const fetchSettlements = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/rentals/closures");
      const json = await res.json();
      if (json.success) {
        setSettlements(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSettlements();

    fetch("/api/v1/customers/sites")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          // Only show ACTIVE sites in closure dropdown
          const active = (j.data || []).filter((s: any) => s.status === "ACTIVE");
          setSites(active);
        }
      })
      .catch(() => {});
  }, [fetchSettlements]);

  const handleRunAudit = async () => {
    if (!selectedSiteId) return;
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const res = await fetch("/api/v1/rentals/closures/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerSiteId: selectedSiteId }),
      });
      const json = await res.json();
      if (json.success) {
        setAuditResult(json.data);
      } else {
        toast.error(json.error?.message || "Audit check failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Audit error");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleExecuteClosure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditResult) return;

    if (auditResult.hasOutstandingStock && !ownerOverride) {
      toast.error("Cannot close site with outstanding materials without Owner Exception Approval.");
      return;
    }

    setConfirmClosureOpen(true);
  };

  const executeFinalClosure = async () => {
    if (!auditResult) return;
    setConfirmClosureOpen(false);

    setIsClosing(true);
    try {
      const payload = {
        customerSiteId: auditResult.customerSiteId,
        ownerApprovedException: ownerOverride,
        exceptionReason: ownerOverride ? exceptionReason : null,
        customerAcknowledgement: receiverName
          ? {
              name: receiverName,
              phone: receiverPhone,
              date: new Date().toISOString(),
            }
          : null,
        remarks: remarks || null,
      };

      const res = await fetch("/api/v1/rentals/closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Closure failed");
        return;
      }

      toast.success(`Site closed successfully. Final settlement: ${json.data.settlementNumber}`);
      setAuditResult(null);
      setSelectedSiteId("");
      fetchSettlements();
    } catch (err: any) {
      toast.error(err.message || "Closure execution error");
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/rentals"
              className="text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              ← Rental Operations
            </Link>
          </div>
          <h1 className="text-2xl font-black text-[#0B1E36] tracking-tight mt-1">
            Site Closure & Final Settlements
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Pre-closure unreturned material audits, owner exception approvals, and final site accounts settlement.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSettlements}
          disabled={isLoading}
          className="text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Closure Audit Workflow Box */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div>
          <h2 className="font-bold text-sm text-[#0B1E36] uppercase tracking-wider flex items-center gap-2">
            <Building className="h-4 w-4 text-[#F26522]" />
            Step 1: Select Active Construction Site for Closure Audit
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            The system inspects active rental batches, unreturned equipment, damage claims, and deposit balances.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedSiteId}
            onChange={(e) => {
              setSelectedSiteId(e.target.value);
              setAuditResult(null);
            }}
            className="flex-1 h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs"
          >
            <option value="">-- Choose Active Site to Close --</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.siteName} ({s.siteCode})
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={handleRunAudit}
            disabled={!selectedSiteId || isAuditing}
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold h-10"
          >
            {isAuditing ? "Auditing Site..." : "Audit Site Pre-Closure"}
          </Button>
        </div>

        {/* Audit Results Presentation */}
        {auditResult && (
          <form onSubmit={handleExecuteClosure} className="pt-4 border-t border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-slate-900">{auditResult.siteName}</h3>
                <p className="text-xs text-slate-500">Customer: {auditResult.customerName} ({auditResult.siteCode})</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  auditResult.canCloseWithoutException
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {auditResult.canCloseWithoutException
                  ? "✓ Ready for Normal Closure"
                  : "⚠ Unreturned Stock Warning"}
              </span>
            </div>

            {/* Warning if unreturned materials exist */}
            {auditResult.hasOutstandingStock && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-red-950">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  <span>Unreturned Equipment on Site: {Number(auditResult.totalOutstandingQty).toFixed(2)} Nos.</span>
                </div>
                <p className="text-red-800 leading-relaxed">
                  Permanent Rule: Normal site closure is strictly prohibited when centering materials remain in customer custody. An authorized Owner must explicitly approve an exception.
                </p>
                <div className="bg-white p-3 rounded border border-red-200 space-y-1">
                  <div className="font-bold text-slate-800 mb-1">Unreturned Materials:</div>
                  {auditResult.unreturnedMaterials.map((m: any, i: number) => (
                    <div key={i} className="flex justify-between text-slate-700">
                      <span>• {m.materialName} ({m.materialCode})</span>
                      <strong className="font-mono text-red-700">{m.heldQty} {m.uom}</strong>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-2 cursor-pointer font-bold text-slate-900">
                    <input
                      type="checkbox"
                      checked={ownerOverride}
                      onChange={(e) => setOwnerOverride(e.target.checked)}
                      className="mt-0.5 text-[#0B1E36]"
                    />
                    <span>I am an authorized OWNER and hereby approve an exception to close this site with unreturned materials.</span>
                  </label>
                  {ownerOverride && (
                    <Input
                      placeholder="Mandatory exception reason (e.g. Legal dispute settlement, materials purchased by customer, loss agreed)..."
                      value={exceptionReason}
                      onChange={(e) => setExceptionReason(e.target.value)}
                      required
                      className="mt-2 h-9 text-xs bg-white"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Financial Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border">
                <span className="text-slate-500">Security Deposit Held</span>
                <p className="font-black text-slate-900 text-sm mt-1">₹{Number(auditResult.depositBalance).toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border">
                <span className="text-slate-500">Damage Claims Total</span>
                <p className="font-black text-red-600 text-sm mt-1">₹{Number(auditResult.damageChargesTotal).toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border">
                <span className="text-slate-500">Missing Stock Total</span>
                <p className="font-black text-red-600 text-sm mt-1">₹{Number(auditResult.missingChargesTotal).toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border">
                <span className="text-slate-500">Net Balance</span>
                <p className="font-black text-[#0B1E36] text-sm mt-1">
                  ₹{Number(Number(auditResult.damageChargesTotal) + Number(auditResult.missingChargesTotal) - Number(auditResult.depositBalance)).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Customer Acknowledgement Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <Label>Customer Signatory / In-charge Name</Label>
                <Input
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="e.g. R. Sundar (Project In-Charge)"
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label>Signatory Phone</Label>
                <Input
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Settlement Remarks / Notes</Label>
                <Input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Final settlement observations, agreement closure notes..."
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <Button
                type="submit"
                disabled={isClosing || (auditResult.hasOutstandingStock && !ownerOverride)}
                className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold h-10 px-6"
              >
                {isClosing ? "Executing Site Closure..." : "Execute Site Closure & Generate Final Settlement"}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Past Site Settlements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-[#0B1E36]" />
            <h2 className="font-bold text-sm text-slate-900">Final Site Settlements History</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Settlement #</th>
                <th className="p-3.5">Site & Customer</th>
                <th className="p-3.5">Closure Date</th>
                <th className="p-3.5 text-right">Outstanding Stock</th>
                <th className="p-3.5 text-right">Net Settlement</th>
                <th className="p-3.5">Exception Status</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Loading settlements...</td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">No site closures recorded yet.</td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-[#0B1E36]">{s.settlementNumber}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{s.customerSite?.siteName}</div>
                      <div className="text-[11px] text-slate-500">{s.customer?.name}</div>
                    </td>
                    <td className="p-3.5 text-slate-600">{new Date(s.closureDate).toLocaleDateString()}</td>
                    <td className="p-3.5 text-right font-mono font-bold">
                      {Number(s.outstandingHeldQty) > 0 ? (
                        <span className="text-red-600">{Number(s.outstandingHeldQty).toFixed(2)} Nos.</span>
                      ) : (
                        <span className="text-emerald-700">0.00 (Clean)</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-slate-900">
                      ₹{Number(s.netPayableOrRefundable).toFixed(2)}
                    </td>
                    <td className="p-3.5">
                      {s.ownerApprovedException ? (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          Owner Exception
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Standard</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmClosureOpen}
        onClose={() => setConfirmClosureOpen(false)}
        onConfirm={executeFinalClosure}
        title="Execute Site Closure & Settlement"
        description={`Are you sure you want to permanently close Site ${auditResult?.siteName || ""}? This action generates the final settlement invoice and terminates the site rental lifecycle.`}
        confirmText="Confirm Site Closure"
        variant="warning"
        isLoading={isClosing}
      />
    </div>
  );
}

