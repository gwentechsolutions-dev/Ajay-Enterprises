"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  Printer,
  Calendar,
  Building,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  User,
  Phone,
  ShieldCheck,
  ExternalLink,
  Camera,
  Layers,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/loading-states";
import { WhatsAppShareButton } from "@/components/ui/whatsapp-share-button";
import { GpsCameraCaptureDialog } from "@/components/evidence/GpsCameraCaptureDialog";
import { ModalPortal } from "@/components/ui/portal";

export default function MaterialReturnNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [mrn, setMrn] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activePhoto, setActivePhoto] = React.useState<string | null>(null);
  const [isGpsCameraOpen, setIsGpsCameraOpen] = React.useState(false);

  const loadMrn = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/return-notes/${id}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to load Material Return Note");
      }
      setMrn(data.data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadMrn();
  }, [loadMrn]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-9 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
        <TableSkeleton columns={4} rows={6} />
      </div>
    );
  }

  if (error || !mrn) {
    return (
      <div className="max-w-xl mx-auto mt-12 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-center space-y-4">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Return Note Not Found</h2>
        <p className="text-xs text-slate-500">
          {error || "The requested material return note could not be retrieved or does not exist."}
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="text-xs">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Go Back
          </Button>
          <Link href="/return-notes">
            <Button size="sm" className="bg-[#0B1E36] text-white text-xs">
              Return Notes Register
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "POSTED":
      case "COMPLETED":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">POSTED / FINALIZED</Badge>;
      case "DRAFT":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">DRAFT / IN-TRANSIT</Badge>;
      case "CANCELLED":
        return <Badge className="bg-red-100 text-red-800 border-red-200">CANCELLED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalReturnedQty = (mrn.items || []).reduce(
    (sum: number, it: any) => sum + Number(it.returnedQuantity ?? it.quantity ?? 0),
    0
  );
  const totalAcceptedQty = (mrn.items || []).reduce(
    (sum: number, it: any) => sum + Number(it.acceptedQuantity ?? it.quantity ?? 0),
    0
  );
  const totalDamagedQty = (mrn.items || []).reduce(
    (sum: number, it: any) => sum + Number(it.damagedQuantity ?? 0),
    0
  );
  const totalMissingQty = (mrn.items || []).reduce(
    (sum: number, it: any) => sum + Number(it.missingQuantity ?? 0),
    0
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <button
            onClick={() => router.back()}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1.5 mb-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-[#0B1E36] tracking-tight font-mono">
              {mrn.mrnNumber}
            </h1>
            {getStatusBadge(mrn.status)}
            {mrn.isDirectTransfer && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                Direct Site Transfer Pickup
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Material Return & Custody Handover Note • Picked up on{" "}
            {new Date(mrn.returnDate || mrn.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <WhatsAppShareButton doc={mrn} docType="MRN" />
          <Button
            size="sm"
            onClick={() => window.open(`/api/v1/return-notes/${mrn.id}/print`, "_blank")}
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Note / PDF
          </Button>
        </div>
      </div>

      {/* Linked DSTN Banner */}
      {mrn.directSiteTransferId && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-purple-700" />
            <span>
              This Material Return Note was generated as a source pickup for <strong>Direct Site-to-Site Transfer</strong>.
            </span>
          </div>
          <Link
            href={`/operations/direct-transfers/${mrn.directSiteTransferId}`}
            className="font-bold text-purple-700 hover:underline inline-flex items-center gap-1"
          >
            View DSTN Master <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Source Site & Customer */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-[#F26522]" /> Source Customer & Site
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Customer:</span>
              <p className="font-bold text-slate-900 text-sm">{mrn.customer?.name}</p>
              <p className="font-mono text-slate-500 text-[11px]">{mrn.customer?.customerCode}</p>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 block text-[11px]">Released From Site:</span>
              <p className="font-semibold text-slate-800">{mrn.customerSite?.siteName}</p>
              <p className="text-slate-500 text-[11px] mt-0.5">{mrn.customerSite?.fullAddress || mrn.customerSite?.address}</p>
            </div>
            {mrn.receivingWarehouse && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[11px]">Receiving Depot / Yard:</span>
                <p className="font-medium text-slate-800">{mrn.receivingWarehouse.name}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transport & Vehicle */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-[#0B1E36]" /> Transport & Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Vehicle #:</span>
              <p className="font-mono font-bold text-slate-900 text-sm">{mrn.vehicleNumber || "Company Vehicle"}</p>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 block text-[11px]">Driver Name:</span>
              <p className="font-semibold text-slate-800">{mrn.driverName || "Assigned Driver"}</p>
              {mrn.driverPhone && <p className="font-mono text-slate-500 text-[11px]">{mrn.driverPhone}</p>}
            </div>
            {mrn.referenceDeliveryNote && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Ref Delivery Note:</span>
                <span className="font-mono font-semibold text-blue-700">
                  {mrn.referenceDeliveryNote.dnNumber}
                </span>
              </div>
            )}
            {mrn.pickupOdometer && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Pickup Odometer:</span>
                <span className="font-mono font-bold text-slate-800">{Number(mrn.pickupOdometer)} km</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Handover & GPS Evidence */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Customer Handover Proof
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Customer Representative:</span>
              <p className="font-bold text-slate-900 text-sm">
                {mrn.customerRepresentativeName || "Site Representative"}
              </p>
              {mrn.customerRepresentativeDesignation && (
                <p className="text-slate-500 text-[11px]">{mrn.customerRepresentativeDesignation}</p>
              )}
              {mrn.customerRepresentativePhone && (
                <p className="font-mono text-slate-500 text-[11px]">{mrn.customerRepresentativePhone}</p>
              )}
            </div>

            {mrn.siteArrivalGpsLat && mrn.siteArrivalGpsLng && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[11px]">Site GPS Coordinates:</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-mono text-[11px] text-slate-700">
                    {Number(mrn.siteArrivalGpsLat).toFixed(5)}, {Number(mrn.siteArrivalGpsLng).toFixed(5)}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${Number(mrn.siteArrivalGpsLat)},${Number(mrn.siteArrivalGpsLng)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline font-semibold text-[11px] inline-flex items-center gap-1"
                  >
                    Open Maps <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {mrn.customerSignatureUrl && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[11px]">Customer Handover Signature:</span>
                <div className="mt-1 bg-slate-50 p-1.5 rounded border border-slate-200 inline-block">
                  <img
                    src={mrn.customerSignatureUrl}
                    alt="Customer Handover Signature"
                    className="h-12 max-w-[160px] object-contain"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Returned Materials List */}
      <Card className="border-slate-200 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Returned Centering Equipment
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Material counts reconciled from source construction site
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded font-bold">
              Total Picked Up: {totalReturnedQty.toLocaleString("en-IN")}
            </span>
            {totalDamagedQty > 0 && (
              <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold">
                Damaged: {totalDamagedQty.toLocaleString("en-IN")}
              </span>
            )}
            {totalMissingQty > 0 && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded font-bold">
                Missing: {totalMissingQty.toLocaleString("en-IN")}
              </span>
            )}
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10">#</th>
                <th className="p-3">Material Code</th>
                <th className="p-3">Material Description</th>
                <th className="p-3 text-right">Collected Qty</th>
                <th className="p-3 text-right">Accepted (Good)</th>
                <th className="p-3 text-right">Damaged</th>
                <th className="p-3 text-right">Missing</th>
                <th className="p-3">UOM</th>
                <th className="p-3">Line Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(mrn.items || []).map((it: any, idx: number) => {
                const coll = Number(it.returnedQuantity ?? it.quantity ?? 0);
                const good = Number(it.acceptedQuantity ?? coll);
                const dmg = Number(it.damagedQuantity ?? 0);
                const miss = Number(it.missingQuantity ?? 0);

                return (
                  <tr key={it.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-[#0B1E36]">
                      {it.materialVariant?.materialCode || it.materialCode || "—"}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">
                        {it.materialVariant?.name || it.materialName || "Material Item"}
                      </div>
                      {it.materialVariant?.size && (
                        <div className="text-[11px] text-slate-500">Size: {it.materialVariant.size}</div>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {coll.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">
                      {good.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      {dmg > 0 ? (
                        <span className="text-amber-700">{dmg.toLocaleString("en-IN", { maximumFractionDigits: 3 })}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      {miss > 0 ? (
                        <span className="text-red-600">{miss.toLocaleString("en-IN", { maximumFractionDigits: 3 })}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{it.materialVariant?.uom || it.uom || "Nos."}</td>
                    <td className="p-3 text-slate-500 italic">{it.remarks || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Return Evidences & Photographs */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-[#F26522]" /> Pickup &amp; Handover GPS Photographs
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsGpsCameraOpen(true)}
            className="h-8 text-xs border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <Camera className="w-3.5 h-3.5 mr-1.5 text-[#F26522]" /> Snap GPS Photo
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {mrn.evidences && mrn.evidences.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {mrn.evidences.map((ev: any, idx: number) => {
                const imgUrl = ev.watermarkedPhotoUrl || ev.photoUrl || ev.fileUrl || ev.url;
                return (
                  <div
                    key={ev.id || idx}
                    onClick={() => setActivePhoto(imgUrl)}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:shadow-md transition-all"
                  >
                    <img
                      src={imgUrl}
                      alt={`Return Evidence ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl space-y-2">
              <Camera className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs text-slate-500">No pickup photographs recorded yet.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsGpsCameraOpen(true)}
                className="text-xs h-8"
              >
                <Camera className="w-3.5 h-3.5 mr-1 text-[#F26522]" /> Capture Pickup Photo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GPS Camera Dialog */}
      {isGpsCameraOpen && (
        <GpsCameraCaptureDialog
          open={isGpsCameraOpen}
          onOpenChange={setIsGpsCameraOpen}
          documentType="RETURN_NOTE"
          documentId={mrn.id}
          documentNumber={mrn.mrnNumber}
          siteName={mrn.customerSite?.siteName}
          customerName={mrn.customer?.name}
          defaultCategory="RETURN_PICKUP"
          onSuccess={() => {
            loadMrn();
          }}
        />
      )}

      {/* Photo Enlarge Modal */}
      {activePhoto && (
        <ModalPortal>
          <div
            onClick={() => setActivePhoto(null)}
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm cursor-pointer overflow-y-auto"
          >
            <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2 my-auto">
              <img src={activePhoto} alt="Return Evidence" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
