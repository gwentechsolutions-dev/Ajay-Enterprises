"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { documentSeriesSchema, financialYearSchema, DocumentSeriesInput, FinancialYearInput } from "@/lib/schemas/document-series";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { FileDigit, Plus, Edit2, Calendar, CheckCircle2, ShieldCheck, Hash, Activity, Lock, Search, RefreshCw, Zap, Server, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { formatDocumentNumber } from "@/lib/document-series";

export default function DocumentSettingsPage() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedFY, setSelectedFY] = React.useState<string>("2026-27");

  const [seriesModalOpen, setSeriesModalOpen] = React.useState(false);
  const [editingSeries, setEditingSeries] = React.useState<any | null>(null);

  const [fyModalOpen, setFyModalOpen] = React.useState(false);

  // E-Way Bill Provider & Diagnostics State
  const [ewbSettings, setEwbSettings] = React.useState<any>(null);
  const [testingConnection, setTestingConnection] = React.useState(false);
  const [connectionResult, setConnectionResult] = React.useState<any>(null);
  const [gstinQuery, setGstinQuery] = React.useState("33AAGCB1286Q003");
  const [lookingUpGstin, setLookingUpGstin] = React.useState(false);
  const [gstinResult, setGstinResult] = React.useState<any>(null);
  const [hsnQuery, setHsnQuery] = React.useState("7308");
  const [lookingUpHsn, setLookingUpHsn] = React.useState(false);
  const [hsnResult, setHsnResult] = React.useState<any>(null);

  const fetchEwbSettings = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/ewaybills/settings");
      const json = await res.json();
      if (json.success) {
        setEwbSettings(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    fetchEwbSettings();
  }, [fetchEwbSettings]);

  const handleSwitchProvider = async (newProvider: "WHITEBOOKS" | "FYN") => {
    try {
      const res = await fetch("/api/v1/ewaybills/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProvider: newProvider, environment: "SANDBOX" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Active statutory provider switched to ${newProvider}`);
        fetchEwbSettings();
      } else {
        toast.error(json.error?.message || "Failed to switch provider");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      setConnectionResult(null);
      const res = await fetch("/api/v1/ewaybills/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: ewbSettings?.activeProvider }),
      });
      const json = await res.json();
      setConnectionResult(json.data || { success: false, message: json.error?.message });
      if (json.success) {
        toast.success(`Connection verified (${json.data?.latencyMs || 0}ms)`);
      } else {
        toast.error(json.error?.message || "Connection test failed");
      }
    } catch (err: any) {
      toast.error(err.message);
      setConnectionResult({ success: false, message: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleLookupGstin = async () => {
    if (!gstinQuery || gstinQuery.length !== 15) {
      return toast.error("Enter a valid 15-character GSTIN");
    }
    try {
      setLookingUpGstin(true);
      setGstinResult(null);
      const res = await fetch(`/api/v1/ewaybills/lookup/gstin?gstin=${gstinQuery.trim()}`);
      const json = await res.json();
      if (json.success) {
        setGstinResult(json.data);
        toast.success("GSTIN details retrieved");
      } else {
        toast.error(json.error?.message || "GSTIN lookup failed");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLookingUpGstin(false);
    }
  };

  const handleLookupHsn = async () => {
    if (!hsnQuery || hsnQuery.length < 4) {
      return toast.error("Enter a valid HSN code (min 4 digits)");
    }
    try {
      setLookingUpHsn(true);
      setHsnResult(null);
      const res = await fetch(`/api/v1/ewaybills/lookup/hsn?hsn=${hsnQuery.trim()}`);
      const json = await res.json();
      if (json.success) {
        setHsnResult(json.data);
        toast.success("HSN details retrieved");
      } else {
        toast.error(json.error?.message || "HSN lookup failed");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLookingUpHsn(false);
    }
  };

  // Series Form
  const seriesForm = useForm<DocumentSeriesInput>({
    resolver: zodResolver(documentSeriesSchema),
    defaultValues: {
      documentType: "",
      prefix: "",
      fiscalYear: "2026-27",
      currentCounter: 0,
      padding: 4,
      suffix: "",
      isActive: true,
    },
  });

  // FY Form
  const fyForm = useForm<FinancialYearInput>({
    resolver: zodResolver(financialYearSchema),
    defaultValues: {
      yearCode: "2027-28",
      startDate: "2027-04-01",
      endDate: "2028-03-31",
      isCurrent: false,
      isClosed: false,
    },
  });

  const fetchSeries = React.useCallback(async (fy: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/document-series?fiscalYear=${fy}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.activeFiscalYear) {
          setSelectedFY(json.data.activeFiscalYear);
        }
      }
    } catch {
      toast.error("Failed to load document series");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSeries(selectedFY);
  }, [fetchSeries, selectedFY]);

  const fyOptions = React.useMemo(() => {
    if (!data?.fiscalYears) return [{ value: "2026-27", label: "FY 2026-27 (Current)" }];
    return data.fiscalYears.map((fy: any) => ({
      value: fy.yearCode,
      label: `FY ${fy.yearCode}${fy.isCurrent ? " (Current)" : ""}`,
      badge: fy.isClosed ? "Closed" : "Open",
    }));
  }, [data]);

  const handleOpenEditSeries = (s: any) => {
    setEditingSeries(s);
    seriesForm.reset({
      documentType: s.documentType,
      prefix: s.prefix,
      fiscalYear: s.fiscalYear,
      currentCounter: s.currentCounter,
      padding: s.padding,
      suffix: s.suffix || "",
      isActive: s.isActive,
    });
    setSeriesModalOpen(true);
  };

  const onSaveSeries = async (values: DocumentSeriesInput) => {
    try {
      const res = await fetch("/api/v1/document-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "Failed to update series");
        return;
      }

      toast.success("Document series updated successfully");
      setSeriesModalOpen(false);
      fetchSeries(selectedFY);
    } catch {
      toast.error("Operation failed");
    }
  };

  const onAddFY = async (values: FinancialYearInput) => {
    try {
      const res = await fetch("/api/v1/financial-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "Failed to create financial year");
        return;
      }

      toast.success("Financial year added successfully");
      setFyModalOpen(false);
      fetchSeries(values.yearCode);
    } catch {
      toast.error("Operation failed");
    }
  };

  // Live preview watch
  const watchedPrefix = seriesForm.watch("prefix");
  const watchedCounter = seriesForm.watch("currentCounter");
  const watchedPadding = seriesForm.watch("padding");
  const watchedSuffix = seriesForm.watch("suffix");

  const livePreview = formatDocumentNumber(
    watchedPrefix || "AE/DN/",
    (watchedCounter || 0) + 1,
    watchedPadding || 4,
    watchedSuffix || ""
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Document Numbering & Financial Year Settings
            </h1>
            <Badge variant="outline" className="bg-primary-50 text-primary-900 border-primary-200 font-semibold">
              Concurrency Safe
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage sequential document series prefixes, zero-padding, and Indian financial year boundaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFyModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Calendar className="h-3.5 w-3.5" /> Add Financial Year
          </Button>
        </div>
      </div>

      {/* Financial Year Selector Filter */}
      <Card className="p-4 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Financial Year</p>
              <p className="text-sm font-bold text-slate-900">1 April to 31 March Cycle</p>
            </div>
          </div>

          <div className="w-64">
            <SearchableCombobox
              options={fyOptions}
              value={selectedFY}
              onChange={(val) => {
                if (val) {
                  setSelectedFY(val);
                  fetchSeries(val);
                }
              }}
              allowClear={false}
            />
          </div>
        </div>
      </Card>

      {/* Series Grid / Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Document Type</th>
                <th className="py-3 px-4">Configured Prefix</th>
                <th className="py-3 px-4">Counter</th>
                <th className="py-3 px-4">Next Document Preview</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading document series...
                  </td>
                </tr>
              ) : !data?.series || data.series.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No series configured for this financial year.
                  </td>
                </tr>
              ) : (
                data.series.map((s: any) => {
                  const docMeta = data?.documentTypes?.find((d: any) => d.id === s.documentType);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-slate-900">
                            {docMeta?.label || s.documentType}
                          </p>
                          <span className="font-mono text-[10px] text-slate-400 uppercase">
                            {s.documentType}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {s.prefix}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600">
                        {s.currentCounter} (Pad: {s.padding})
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-accent-700 bg-accent-50 border border-accent-200 px-2.5 py-1 rounded-md text-[11px]">
                          {s.preview}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <Badge variant={s.isActive ? "success" : "secondary"}>
                          {s.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditSeries(s)}
                          className="h-8 gap-1 text-xs text-slate-600 hover:text-primary-900"
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* STATUTORY GST E-WAY BILL PROVIDER & GSP DIAGNOSTICS */}
      <Card className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-[#F26522]" />
              <h2 className="text-lg font-bold text-slate-900">
                Statutory GST E-Way Bill Integration & GSP Diagnostics
              </h2>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                Phase 6 GSP Architecture
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dual-provider statutory gateway: WhiteBooks GSP (Primary) + FYN Gateway (Backup). Configure provider routing, run live sandbox connection tests, and verify GSTIN/HSN masters.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="gap-1.5 text-xs font-semibold text-[#0B1E36] border-slate-300"
            >
              <Activity className={`h-3.5 w-3.5 text-[#F26522] ${testingConnection ? "animate-spin" : ""}`} />
              {testingConnection ? "Testing Connection..." : "Test Active Provider Connection"}
            </Button>
          </div>
        </div>

        {/* Provider Selection & Environment Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* WhiteBooks Primary Card */}
          <div
            onClick={() => handleSwitchProvider("WHITEBOOKS")}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer space-y-3 ${
              ewbSettings?.activeProvider === "WHITEBOOKS"
                ? "border-[#0B1E36] bg-blue-50/40 shadow-sm"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${ewbSettings?.activeProvider === "WHITEBOOKS" ? "bg-emerald-500" : "bg-slate-300"}`} />
                <h3 className="font-bold text-sm text-slate-900">WhiteBooks GSP (Primary)</h3>
              </div>
              <Badge className="bg-blue-100 text-blue-800 text-[10px] font-bold">
                DEFAULT / ACTIVE
              </Badge>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              BVM IT Consulting Services India Pvt. Ltd. Official GSP licensed APIs for direct statutory generation, vehicle Part-B updates, and cancellations.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-500 border-t border-slate-200/60 font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">Environment</span>
                <span className="font-semibold text-emerald-700">SANDBOX (Active)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Test GSTIN</span>
                <span>{ewbSettings?.whitebooks?.gstin || "33AAGCB1286Q003"}</span>
              </div>
            </div>
          </div>

          {/* FYN Gateway Backup Card */}
          <div
            onClick={() => handleSwitchProvider("FYN")}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer space-y-3 ${
              ewbSettings?.activeProvider === "FYN"
                ? "border-[#0B1E36] bg-purple-50/40 shadow-sm"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${ewbSettings?.activeProvider === "FYN" ? "bg-emerald-500" : "bg-slate-300"}`} />
                <h3 className="font-bold text-sm text-slate-900">FYN Gateway (Secondary / Backup)</h3>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold text-purple-700 border-purple-200">
                MANUAL BACKUP
              </Badge>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Fynamics Techno Solutions Pvt. Ltd. Preserved secondary provider for high-availability redundancy without automatic failover risk.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-500 border-t border-slate-200/60 font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">Environment</span>
                <span className="font-semibold text-purple-700">SANDBOX (Simulation)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Status</span>
                <span>AVAILABLE AS BACKUP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Connection Diagnostics Banner */}
        {connectionResult && (
          <div
            className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
              connectionResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            {connectionResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-bold">
                {connectionResult.success
                  ? `Connection Verified (${connectionResult.latencyMs || 0}ms)`
                  : "Connection Test Failed"}
              </p>
              <p className="text-[11px] opacity-90 leading-relaxed">{connectionResult.message}</p>
              {connectionResult.details && (
                <div className="flex gap-4 pt-1 font-mono text-[10px] text-emerald-800">
                  <span>GSTIN: {connectionResult.details.gstin}</span>
                  <span>Env: {connectionResult.details.environment}</span>
                  <span>User: {connectionResult.details.username}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Production Lock Guard Notice */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Lock className="w-4 h-4 text-slate-400" />
            <span>
              <strong>Production Mode Guard:</strong> Statutory live production transmission is permanently locked until authorized by management.
            </span>
          </div>
          <Badge variant="secondary" className="text-[10px] uppercase font-mono">
            Safety Lock Active
          </Badge>
        </div>

        {/* Diagnostic Lookup Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Tool 1: GSTIN Lookup */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#F26522]" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Diagnostic GSTIN Lookup</h4>
            </div>
            <div className="flex gap-2">
              <Input
                value={gstinQuery}
                onChange={(e) => setGstinQuery(e.target.value.toUpperCase())}
                placeholder="15-digit GSTIN"
                maxLength={15}
                className="font-mono uppercase text-xs h-9 bg-white"
              />
              <Button
                size="sm"
                onClick={handleLookupGstin}
                disabled={lookingUpGstin}
                className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs h-9 shrink-0"
              >
                {lookingUpGstin ? "Checking..." : "Verify"}
              </Button>
            </div>

            {gstinResult && (
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-900">{gstinResult.tradeName || gstinResult.legalName || "Active Taxpayer"}</p>
                <p className="text-[11px] text-slate-500 font-mono">GSTIN: {gstinResult.gstin} · Status: {gstinResult.status || "ACTIVE"}</p>
                {gstinResult.address?.location && (
                  <p className="text-[11px] text-slate-600">{gstinResult.address.location}, PIN: {gstinResult.address.pincode}</p>
                )}
              </div>
            )}
          </div>

          {/* Tool 2: HSN Lookup */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#F26522]" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Diagnostic HSN Tariff Lookup</h4>
            </div>
            <div className="flex gap-2">
              <Input
                value={hsnQuery}
                onChange={(e) => setHsnQuery(e.target.value)}
                placeholder="HSN Code (e.g. 7308)"
                maxLength={8}
                className="font-mono text-xs h-9 bg-white"
              />
              <Button
                size="sm"
                onClick={handleLookupHsn}
                disabled={lookingUpHsn}
                className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs h-9 shrink-0"
              >
                {lookingUpHsn ? "Checking..." : "Verify"}
              </Button>
            </div>

            {hsnResult && (
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-900">HSN {hsnResult.hsnCode} · GST Rate: {hsnResult.gstRate || 18}%</p>
                <p className="text-[11px] text-slate-600 leading-snug">{hsnResult.description}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* EDIT SERIES MODAL */}
      <Dialog open={seriesModalOpen} onOpenChange={setSeriesModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Document Series</DialogTitle>
            <DialogDescription>
              Adjust numbering prefix, zero padding, and sequential counters
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={seriesForm.handleSubmit(onSaveSeries)} className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Live Next Number Preview</span>
              <p className="font-mono text-base font-bold text-accent-600">{livePreview}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="serPrefix" required>Prefix Format</Label>
                <Input
                  id="serPrefix"
                  placeholder="AE/DN/2026-27/"
                  className="font-mono"
                  {...seriesForm.register("prefix")}
                  error={!!seriesForm.formState.errors.prefix}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="serFY" required>Financial Year</Label>
                <Input
                  id="serFY"
                  disabled
                  className="font-mono bg-slate-50"
                  {...seriesForm.register("fiscalYear")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="serCounter" required>Current / Starting Counter</Label>
                <Input
                  id="serCounter"
                  type="number"
                  min={0}
                  {...seriesForm.register("currentCounter", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="serPadding" required>Digits Padding Length</Label>
                <Input
                  id="serPadding"
                  type="number"
                  min={2}
                  max={8}
                  placeholder="4 (e.g. 0001)"
                  {...seriesForm.register("padding", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="serSuffix">Suffix (Optional)</Label>
              <Input
                id="serSuffix"
                placeholder="Optional suffix"
                {...seriesForm.register("suffix")}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="serIsActive" {...seriesForm.register("isActive")} className="rounded text-primary-900" />
              <Label htmlFor="serIsActive" className="text-xs font-normal cursor-pointer">
                Series is Active for transactions
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSeriesModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={seriesForm.formState.isSubmitting} loadingText="Saving Series..." className="bg-primary-900 text-white">Save Series</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ADD FY MODAL */}
      <Dialog open={fyModalOpen} onOpenChange={setFyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Future Financial Year</DialogTitle>
            <DialogDescription>
              Configure Indian financial year (1 April to 31 March)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={fyForm.handleSubmit(onAddFY)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="fyCode" required>Year Code (YYYY-YY)</Label>
              <Input
                id="fyCode"
                placeholder="2027-28"
                className="font-mono uppercase"
                {...fyForm.register("yearCode")}
                error={!!fyForm.formState.errors.yearCode}
              />
              {fyForm.formState.errors.yearCode && (
                <p className="text-xs text-red-600">{fyForm.formState.errors.yearCode.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fyStart" required>Start Date</Label>
                <Input id="fyStart" type="date" {...fyForm.register("startDate")} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fyEnd" required>End Date</Label>
                <Input id="fyEnd" type="date" {...fyForm.register("endDate")} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFyModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={fyForm.formState.isSubmitting} loadingText="Adding Financial Year..." className="bg-primary-900 text-white">Add Financial Year</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

