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
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/loading-states";
import { WhatsAppShareButton } from "@/components/ui/whatsapp-share-button";
import { GpsCameraCaptureDialog } from "@/components/evidence/GpsCameraCaptureDialog";
import { ModalPortal } from "@/components/ui/portal";

export default function DeliveryNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [dn, setDn] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activePhoto, setActivePhoto] = React.useState<string | null>(null);
  const [isGpsCameraOpen, setIsGpsCameraOpen] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function loadDn() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/v1/delivery-notes/${id}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || "Failed to load Delivery Note");
        }

        if (isMounted) {
          setDn(data.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "An error occurred");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDn();
    return () => {
      isMounted = false;
    };
  }, [id]);

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

  if (error || !dn) {
    return (
      <div className="max-w-xl mx-auto mt-12 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-center space-y-4">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Delivery Note Not Found</h2>
        <p className="text-xs text-slate-500">
          {error || "The requested delivery note could not be retrieved or does not exist."}
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="text-xs">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Go Back
          </Button>
          <Link href="/delivery-notes">
            <Button size="sm" className="bg-[#0B1E36] text-white text-xs">
              Delivery Notes Register
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">DELIVERED</Badge>;
      case "DISPATCHED":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">DISPATCHED</Badge>;
      case "DRAFT":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">DRAFT</Badge>;
      case "CANCELLED":
        return <Badge className="bg-red-100 text-red-800 border-red-200">CANCELLED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalQuantity = (dn.items || []).reduce(
    (sum: number, it: any) => sum + Number(it.quantity || 0),
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
              {dn.dnNumber}
            </h1>
            {getStatusBadge(dn.status)}
            {dn.isDirectTransfer && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                Direct Site Transfer (DSTN)
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Material Delivery & Custody Transfer Note • Dispatched on{" "}
            {new Date(dn.deliveryDate || dn.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <WhatsAppShareButton doc={dn} docType="DN" />
          <Button
            size="sm"
            onClick={() => window.open(`/api/v1/delivery-notes/${dn.id}/print`, "_blank")}
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Note / PDF
          </Button>
        </div>
      </div>

      {/* Linked DSTN Banner */}
      {dn.directSiteTransferId && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-purple-700" />
            <span>
              This Delivery Note was generated as part of <strong>Direct Site-to-Site Transfer</strong>.
            </span>
          </div>
          <Link
            href={`/operations/direct-transfers/${dn.directSiteTransferId}`}
            className="font-bold text-purple-700 hover:underline inline-flex items-center gap-1"
          >
            View DSTN Master <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer & Destination Site */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-[#F26522]" /> Customer & Delivery Site
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Customer:</span>
              <p className="font-bold text-slate-900 text-sm">{dn.customer?.name}</p>
              <p className="font-mono text-slate-500 text-[11px]">{dn.customer?.customerCode}</p>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-400 block text-[11px]">Construction Site:</span>
              <p className="font-semibold text-slate-800">{dn.customerSite?.siteName}</p>
              <p className="text-slate-500 text-[11px] mt-0.5">{dn.customerSite?.fullAddress || dn.customerSite?.address}</p>
            </div>
            {dn.contactPerson && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Site Contact:</span>
                <span className="font-medium text-slate-800">
                  {dn.contactPerson.name} ({dn.contactPerson.phone})
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source & Logistics */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-[#0B1E36]" /> Source & Transport
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Dispatched From:</span>
              <p className="font-semibold text-slate-900">
                {dn.sourceWarehouse?.name || "Main Godown / Source Yard"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div>
                <span className="text-slate-400 block text-[11px]">Vehicle #:</span>
                <p className="font-mono font-bold text-slate-800">{dn.vehicleNumber || "Company Vehicle"}</p>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Driver:</span>
                <p className="font-medium text-slate-800">{dn.driverName || "Assigned Driver"}</p>
                {dn.driverPhone && <p className="font-mono text-slate-500 text-[11px]">{dn.driverPhone}</p>}
              </div>
            </div>
            {Number(dn.transportCharges) > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Transport Charges:</span>
                <span className="font-bold font-mono text-slate-900">
                  ₹{Number(dn.transportCharges).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {dn.eWayBillNumber && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">E-Way Bill:</span>
                <span className="font-mono font-bold text-blue-700">{dn.eWayBillNumber}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receiver Acknowledgement */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Receiver Proof
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Received By:</span>
              <p className="font-bold text-slate-900 text-sm">
                {dn.receiverName || "Pending Delivery"}
              </p>
              {dn.receiverDesignation && (
                <p className="text-slate-500 text-[11px]">{dn.receiverDesignation}</p>
              )}
              {dn.receiverPhone && (
                <p className="font-mono text-slate-500 text-[11px]">{dn.receiverPhone}</p>
              )}
            </div>

            {dn.gpsLatitude && dn.gpsLongitude && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[11px]">GPS Location Evidence:</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-mono text-[11px] text-slate-700">
                    {Number(dn.gpsLatitude).toFixed(5)}, {Number(dn.gpsLongitude).toFixed(5)}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${Number(dn.gpsLatitude)},${Number(dn.gpsLongitude)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline font-semibold text-[11px] inline-flex items-center gap-1"
                  >
                    Open Maps <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {dn.receiverSignatureUrl && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[11px]">Customer Signature:</span>
                <div className="mt-1 bg-slate-50 p-1.5 rounded border border-slate-200 inline-block">
                  <img
                    src={dn.receiverSignatureUrl}
                    alt="Customer Handover Signature"
                    className="h-12 max-w-[160px] object-contain"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Materials List Table */}
      <Card className="border-slate-200 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Dispatched Centering Materials
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              {(dn.items || []).length} equipment line item(s) included in this transfer note
            </p>
          </div>
          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg">
            Total: {totalQuantity.toLocaleString("en-IN")} Units
          </span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10">#</th>
                <th className="p-3">Material Code</th>
                <th className="p-3">Material Description</th>
                <th className="p-3">Ownership</th>
                <th className="p-3 text-right">Dispatched Qty</th>
                <th className="p-3">UOM</th>
                <th className="p-3">Condition</th>
                <th className="p-3">Line Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(dn.items || []).map((it: any, idx: number) => (
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
                  <td className="p-3">
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {it.ownershipType || "OWNED"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900 text-sm">
                    {Number(it.quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                  </td>
                  <td className="p-3 text-slate-600">{it.materialVariant?.uom || it.uom || "Nos."}</td>
                  <td className="p-3">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                      {it.condition || "GOOD"}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500 italic">{it.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delivery Photographs & GPS Evidences */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-[#F26522]" /> Delivery Photographs &amp; Site Proof
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
          {(() => {
            const photos: Array<{ url: string; originalUrl?: string; isPrimary: boolean; label: string }> = [];
            const seen = new Set<string>();

            // Add from evidences first
            (dn.evidences || []).forEach((ev: any, idx: number) => {
              const u = ev.watermarkedPhotoUrl || ev.photoUrl || ev.url;
              if (u && !seen.has(u)) {
                seen.add(u);
                photos.push({
                  url: u,
                  originalUrl: ev.originalPhotoUrl,
                  isPrimary: idx === 0,
                  label: ev.evidenceCategory ? ev.evidenceCategory.replace(/_/g, " ") : `Photo #${photos.length + 1}`,
                });
              }
            });

            // Add primary photoUrl if not already in list
            if (dn.photoUrl && !seen.has(dn.photoUrl)) {
              seen.add(dn.photoUrl);
              photos.unshift({
                url: dn.photoUrl,
                isPrimary: true,
                label: "Primary Delivery Proof",
              });
            }

            if (photos.length === 0) {
              return (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl space-y-2">
                  <Camera className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs text-slate-500">No delivery proof photographs recorded yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsGpsCameraOpen(true)}
                    className="text-xs h-8"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1 text-[#F26522]" /> Capture Delivery Photo
                  </Button>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {photos.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActivePhoto(p.url)}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:shadow-md transition-all"
                  >
                    <img
                      src={p.url}
                      alt={`Delivery Evidence ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                      {p.isPrimary ? "Primary" : `#${idx + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* GPS Camera Dialog */}
      {isGpsCameraOpen && (
        <GpsCameraCaptureDialog
          open={isGpsCameraOpen}
          onOpenChange={setIsGpsCameraOpen}
          documentType="DELIVERY_NOTE"
          documentId={dn.id}
          documentNumber={dn.dnNumber}
          siteName={dn.customerSite?.siteName}
          customerName={dn.customer?.name}
          defaultCategory="DELIVERY_PHOTO"
          onSuccess={() => {
            router.refresh();
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
              <img src={activePhoto} alt="Delivery Evidence" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
