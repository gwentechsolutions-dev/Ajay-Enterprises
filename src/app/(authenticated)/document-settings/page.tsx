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
import { FileDigit, Plus, Edit2, Calendar, CheckCircle2, ShieldCheck, Hash } from "lucide-react";
import { toast } from "sonner";
import { formatDocumentNumber } from "@/lib/document-series";

export default function DocumentSettingsPage() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedFY, setSelectedFY] = React.useState<string>("2026-27");

  const [seriesModalOpen, setSeriesModalOpen] = React.useState(false);
  const [editingSeries, setEditingSeries] = React.useState<any | null>(null);

  const [fyModalOpen, setFyModalOpen] = React.useState(false);

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
              <Button type="submit" className="bg-primary-900 text-white">Save Series</Button>
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
              <Button type="submit" className="bg-primary-900 text-white">Add Financial Year</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

