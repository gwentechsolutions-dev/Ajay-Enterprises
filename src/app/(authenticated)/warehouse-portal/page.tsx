"use client";

import * as React from "react";
import Link from "next/link";
import {
  Warehouse as WarehouseIcon,
  PackageCheck,
  Truck,
  RotateCcw,
  ArrowLeftRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { toast } from "sonner";

export default function WarehousePortalPage() {
  const [data, setData] = React.useState<any>(null);
  const [warehouses, setWarehouses] = React.useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const loadWarehouses = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/warehouses");
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setWarehouses(json.data);
        setSelectedWarehouseId(json.data[0].id);
      }
    } catch {
      toast.error("Failed to load warehouses");
    }
  }, []);

  const loadDashboard = React.useCallback(async (whId?: string) => {
    try {
      setLoading(true);
      const url = whId ? `/api/v1/portals/warehouse?warehouseId=${whId}` : "/api/v1/portals/warehouse";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      toast.error("Failed to load warehouse operations data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  React.useEffect(() => {
    if (selectedWarehouseId) {
      loadDashboard(selectedWarehouseId);
    }
  }, [selectedWarehouseId, loadDashboard]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <WarehouseIcon className="h-7 w-7 text-[#F26522]" />
            Warehouse & Centering Yard Operations Portal
          </h1>
          <p className="text-sm text-slate-500">
            Live physical yard dispatch, return inspection, and receipt queue for AJAY ENTERPRISES
          </p>
        </div>

        <div className="w-full sm:w-72">
          <SearchableCombobox
            options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.warehouseCode})` }))}
            value={selectedWarehouseId}
            onChange={(val) => setSelectedWarehouseId(val)}
            placeholder="Select Yard Location"
          />
        </div>
      </div>

      {/* Operational KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-sky-100 bg-sky-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-sky-700 uppercase flex items-center gap-1.5">
              <Truck className="h-4 w-4" /> Dispatches to Load
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-900">
              {data?.summary?.pendingDispatchCount ?? 0}
            </div>
            <p className="text-xs text-sky-700/80 mt-1">Pending truck loading</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-700 uppercase flex items-center gap-1.5">
              <PackageCheck className="h-4 w-4" /> PO Goods Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">
              {data?.summary?.pendingPOCount ?? 0}
            </div>
            <p className="text-xs text-emerald-700/80 mt-1">Awaiting unloading</p>
          </CardContent>
        </Card>

        <Card className="border-purple-100 bg-purple-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-purple-700 uppercase flex items-center gap-1.5">
              <ArrowLeftRight className="h-4 w-4" /> In-Transit Transfers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">
              {data?.summary?.incomingTransferCount ?? 0}
            </div>
            <p className="text-xs text-purple-700/80 mt-1">Incoming from other yards</p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-amber-700 uppercase flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Damaged Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">
              {data?.summary?.damagedStockCount ?? 0}
            </div>
            <p className="text-xs text-amber-700/80 mt-1">Isolated non-rentable items</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#0B1E36]" />
          Loading yard operational feeds...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dispatches Awaiting Loading */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#F26522]" />
                Pending Delivery Dispatches (Loading Queue)
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs text-[#0B1E36]">
                <Link href="/delivery-notes">View All DNs</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-3 divide-y divide-slate-100">
              {data?.pendingDispatches?.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No pending dispatches queued.</p>
              ) : (
                data?.pendingDispatches?.map((dn: any) => (
                  <div key={dn.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-900">{dn.dnNumber}</div>
                      <div className="text-xs text-slate-700 font-medium">{dn.customer?.name}</div>
                      <div className="text-[11px] text-slate-400">Site: {dn.customerSite?.siteName}</div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant="secondary"
                        className={dn.status === "DISPATCHED" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}
                      >
                        {dn.status}
                      </Badge>
                      <div className="text-[11px] text-slate-400 mt-1">{dn.items?.length} items</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Incoming Inter-Yard Transfers */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-purple-600" />
                Incoming Transfers In-Transit
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs text-[#0B1E36]">
                <Link href="/stock-transfers">View All STNs</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-3 divide-y divide-slate-100">
              {data?.incomingTransfers?.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No incoming transfers in transit.</p>
              ) : (
                data?.incomingTransfers?.map((stn: any) => (
                  <div key={stn.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-900">{stn.stnNumber}</div>
                      <div className="text-xs text-slate-700">From: {stn.sourceWarehouse?.name}</div>
                      <div className="text-[11px] text-slate-400">Vehicle: {stn.vehicleNumber || "Assigned"}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        IN_TRANSIT
                      </Badge>
                      <Button size="sm" asChild className="text-xs h-7 ml-2 mt-1">
                        <Link href="/stock-transfers">Receive</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Returns Awaiting Check-In */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-emerald-600" />
                Recent Returns Processed at Yard
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs text-[#0B1E36]">
                <Link href="/return-notes">View All MRNs</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-3 divide-y divide-slate-100">
              {data?.recentReturns?.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No returns recorded recently.</p>
              ) : (
                data?.recentReturns?.map((mrn: any) => (
                  <div key={mrn.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-900">{mrn.mrnNumber}</div>
                      <div className="text-xs text-slate-700">{mrn.customer?.name}</div>
                      <div className="text-[11px] text-slate-400">Site: {mrn.customerSite?.siteName}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                        {mrn.status}
                      </Badge>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {new Date(mrn.returnDate).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Damaged Stock Pool Breakdown */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Yard Damaged Stock Storage (Non-Rentable)
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs text-[#0B1E36]">
                <Link href="/inventory">View Ledger</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-3 divide-y divide-slate-100">
              {data?.damagedStockBalances?.length === 0 ? (
                <p className="text-xs text-emerald-600 py-6 text-center flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Zero damaged stock registered at this yard.
                </p>
              ) : (
                data?.damagedStockBalances?.map((b: any) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        {b.materialVariant?.name} {b.materialVariant?.size ? `(${b.materialVariant.size})` : ""}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {b.materialVariant?.materialCode} | Pool: {b.ownershipType}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {Number(b.damagedQty)} {b.materialVariant?.uom}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

