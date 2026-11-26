"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  Eye,
  Send,
  Building,
  RefreshCw,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/loading-states";
import { toast } from "sonner";

export default function DirectTransfersPage() {
  const [transfers, setTransfers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/direct-transfers");
      const json = await res.json();
      if (json.success) {
        setTransfers(json.data || []);
      } else {
        toast.error(json.error?.message || "Failed to load direct transfers");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = transfers.filter((t) => {
    const matchesSearch =
      t.transferNumber?.toLowerCase().includes(search.toLowerCase()) ||
      t.sourceCustomer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.destinationCustomer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.sourceCustomerSite?.siteName?.toLowerCase().includes(search.toLowerCase()) ||
      t.destinationCustomerSite?.siteName?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">Completed</Badge>;
      case "PARTIALLY_RECEIVED":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-medium">Partial Discrepancy</Badge>;
      case "DISPATCHED":
      case "IN_TRANSIT":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-medium">In Transit</Badge>;
      case "DRAFT":
        return <Badge variant="outline" className="text-slate-600 font-medium">Draft</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive" className="font-medium">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-[#F26522]" />
            Direct Site-to-Site Material Transfers
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AJAY ENTERPRISES • Custody transfer between customer job sites without warehouse intermediate handling
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/operations/direct-transfers/new">
            <Button size="sm" className="bg-[#0B1E36] hover:bg-[#0B1E36]/90 text-white">
              <Plus className="h-4 w-4 mr-2" />
              New Site Transfer
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Transfers</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{transfers.length}</p>
              </div>
              <ArrowLeftRight className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Dispatched / Transit</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {transfers.filter((t) => ["DISPATCHED", "IN_TRANSIT"].includes(t.status)).length}
                </p>
              </div>
              <Truck className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {transfers.filter((t) => t.status === "COMPLETED").length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">With Discrepancy</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {transfers.filter((t) => t.status === "PARTIALLY_RECEIVED").length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search DSTN #, customer, site..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {["ALL", "DRAFT", "DISPATCHED", "COMPLETED", "PARTIALLY_RECEIVED"].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className={statusFilter === status ? "bg-[#0B1E36] text-white" : "text-xs"}
                >
                  {status === "ALL" ? "All" : status.replace("_", " ")}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-slate-400">
                No direct site-to-site transfers found matching criteria.
              </div>
            ) : (
              filtered.map((t) => (
                <div key={t.id} className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/operations/direct-transfers/${t.id}`}
                        className="font-mono font-bold text-slate-900 hover:text-[#F26522] text-sm"
                      >
                        {t.transferNumber}
                      </Link>
                      <div className="text-[11px] text-slate-400">
                        {new Date(t.transferDate).toLocaleDateString()} • {t.items?.length || 0} variants
                      </div>
                    </div>
                    {getStatusBadge(t.status)}
                  </div>
                  <div className="text-xs space-y-0.5 text-slate-600">
                    <div>
                      <span className="font-semibold text-slate-900">{t.sourceCustomer?.name}</span>{" "}
                      <span className="text-slate-400">({t.sourceCustomerSite?.siteName})</span>
                    </div>
                    <div className="text-slate-500">
                      → <span className="font-semibold text-slate-900">{t.destinationCustomer?.name}</span>{" "}
                      <span className="text-slate-400">({t.destinationCustomerSite?.siteName})</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {t.vehicle?.vehicleNumber || "Company Vehicle"} • {t.driver?.name || "Assigned Driver"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Link href={`/operations/direct-transfers/${t.id}`}>
                      <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" asChild className="h-8 px-3 text-xs">
                      <a href={`/api/v1/direct-transfers/${t.id}/print`} target="_blank" rel="noopener noreferrer">
                        <Printer className="h-3.5 w-3.5 mr-1" /> Slip
                      </a>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[850px]">
              <thead className="bg-slate-50 text-slate-500 text-xs font-medium border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Transfer #</th>
                  <th className="py-3 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3 px-4 whitespace-nowrap">Source Job Site (Customer A)</th>
                  <th className="py-3 px-4 whitespace-nowrap">Destination Job Site (Customer B)</th>
                  <th className="py-3 px-4 whitespace-nowrap">Vehicle / Driver</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Items</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <TableSkeleton columns={8} rows={5} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No direct site-to-site transfers found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                        <Link
                          href={`/operations/direct-transfers/${t.id}`}
                          className="hover:text-[#F26522] hover:underline"
                        >
                          {t.transferNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(t.transferDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{t.sourceCustomer?.name}</div>
                        <div className="text-xs text-slate-500">{t.sourceCustomerSite?.siteName}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{t.destinationCustomer?.name}</div>
                        <div className="text-xs text-slate-500">{t.destinationCustomerSite?.siteName}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        <div>{t.vehicle?.vehicleNumber || "Company Vehicle"}</div>
                        <div className="text-slate-400">{t.driver?.name || "Assigned Driver"}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant="outline" className="font-mono">
                          {t.items?.length || 0} variants
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center">{getStatusBadge(t.status)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/operations/direct-transfers/${t.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-700 hover:text-slate-900">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                          <Button variant="outline" size="sm" asChild className="h-8 px-2 text-xs">
                            <a
                              href={`/api/v1/direct-transfers/${t.id}/print`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Print Direct Site Transfer Note (DSTN)"
                            >
                              <Printer className="h-3.5 w-3.5 mr-1" />
                              Slip
                            </a>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
