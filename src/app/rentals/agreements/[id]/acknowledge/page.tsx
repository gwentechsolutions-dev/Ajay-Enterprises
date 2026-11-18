"use client";

import React, { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  MapPin,
  Calendar,
  ShieldCheck,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  Phone,
  User,
  Info,
} from "lucide-react";
import { STANDARD_RENTAL_CONDITIONS } from "@/lib/rentals/agreement-terms";

interface AgreementData {
  id: string;
  agreementNumber: string;
  version: number;
  orderReference?: string | null;
  startDate: string;
  endDate?: string | null;
  status: string;
  whatsAppStatus: string;
  termsAndConditions?: string | null;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  acknowledgedPhone?: string | null;
  acknowledgedDesignation?: string | null;
  acknowledgedIp?: string | null;
  rejectionReason?: string | null;
  tokenExpiresAt?: string | null;
  isExpired?: boolean;
  customer: {
    id: string;
    name: string;
    customerCode: string;
    billingAddress?: string | null;
    gstin?: string | null;
    pan?: string | null;
    primaryMobile?: string | null;
    whatsappNumber?: string | null;
  };
  customerSite: {
    id: string;
    siteName: string;
    siteCode: string;
    fullAddress?: string | null;
    siteInCharge?: string | null;
    siteContactDetails?: string | null;
  };
  items: Array<{
    id: string;
    quantity: number | string;
    dailyRentalRate: number | string;
    materialVariant: {
      id: string;
      name: string;
      materialCode: string;
      size: string;
      uom: string;
    };
  }>;
}

export default function CustomerAgreementAcknowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const agreementId = resolvedParams.id;
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [agreement, setAgreement] = useState<AgreementData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [signerName, setSignerName] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [signerDesignation, setSignerDesignation] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Accordion state
  const [termsOpen, setTermsOpen] = useState(true);

  const fetchAgreement = async () => {
    if (!token) {
      setError("Acknowledgement token is missing from the URL link. Please use the complete link provided in your WhatsApp message.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/rentals/agreements/${agreementId}/acknowledge?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to load rental agreement details.");
      }

      setAgreement(data.data);
      if (data.data.customer?.name) {
        setSignerName(data.data.customer.name);
      }
      if (data.data.customer?.whatsappNumber || data.data.customer?.primaryMobile) {
        setSignerPhone(data.data.customer.whatsappNumber || data.data.customer.primaryMobile || "");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while loading agreement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreement();
  }, [agreementId, token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim()) {
      alert("Please enter the authorized representative's full name.");
      return;
    }
    if (!agreedToTerms) {
      alert("Please check the confirmation box agreeing to the rental terms.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/rentals/agreements/${agreementId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "ACCEPT",
          signerName: signerName.trim(),
          signerPhone: signerPhone.trim() || undefined,
          signerDesignation: signerDesignation.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to accept rental agreement.");
      }

      setActionSuccess(data.message || "Rental Agreement acknowledged and accepted successfully!");
      fetchAgreement();
    } catch (err: any) {
      alert(err.message || "Failed to submit acknowledgement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim()) {
      alert("Please enter the representative name.");
      return;
    }
    if (!rejectionReason.trim()) {
      alert("Please specify the reason for rejecting or disputing the agreement.");
      return;
    }

    try {
      setRejecting(true);
      const res = await fetch(`/api/v1/rentals/agreements/${agreementId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "REJECT",
          signerName: signerName.trim(),
          signerPhone: signerPhone.trim() || undefined,
          signerDesignation: signerDesignation.trim() || undefined,
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to record agreement rejection.");
      }

      setShowRejectModal(false);
      setActionSuccess("Agreement rejection and feedback recorded. Our operations team will contact you promptly.");
      fetchAgreement();
    } catch (err: any) {
      alert(err.message || "Failed to submit rejection.");
    } finally {
      setRejecting(false);
    }
  };

  const printUrl = `/api/v1/rentals/agreements/${agreementId}/print`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#F26522] mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">Verifying Rental Agreement...</h2>
          <p className="text-sm text-slate-500">
            Please wait while we validate your secure security link and retrieve contractual terms.
          </p>
        </div>
      </div>
    );
  }

  if (error || !agreement) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-200 max-w-lg w-full text-center space-y-4">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Restricted / Error</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{error}</p>
          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
            If you believe this is an error, please contact AJAY ENTERPRISES customer desk at +91 94440 12345 or reply to your WhatsApp notification.
          </div>
        </div>
      </div>
    );
  }

  const isAlreadyAcknowledged = Boolean(agreement.acknowledgedAt && agreement.status === "ACTIVE");
  const isRejected = agreement.status === "REJECTED";
  const isExpired = Boolean(agreement.isExpired);

  const totalDailyEstimate = agreement.items.reduce(
    (acc, it) => acc + Number(it.quantity || 0) * Number(it.dailyRentalRate || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Brand Banner */}
        <div className="bg-[#0B1E36] text-white p-6 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-[#F26522] font-black text-2xl border border-white/20">
              AE
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#F26522] font-bold">
                Material Rental & Formwork ERP
              </div>
              <h1 className="text-2xl font-black tracking-tight">AJAY ENTERPRISES</h1>
              <div className="text-xs text-slate-300">
                Centering Sheets, Props, Column Boxes & Construction Scaffolding
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={printUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/20"
            >
              <Printer className="w-4 h-4" />
              Print / PDF Slip
            </a>
          </div>
        </div>

        {/* Status Alerts */}
        {actionSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl flex items-start gap-3 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Status Updated</div>
              <div className="text-xs text-emerald-700">{actionSuccess}</div>
            </div>
          </div>
        )}

        {isAlreadyAcknowledged && (
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm text-emerald-950 space-y-1">
            <div className="flex items-center gap-2 font-black text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              AGREEMENT DIGITALLY ACKNOWLEDGED & ACCEPTED
            </div>
            <p className="text-xs text-emerald-700">
              Confirmed on {new Date(agreement.acknowledgedAt!).toLocaleString("en-IN")} by{" "}
              <strong>{agreement.acknowledgedBy}</strong>
              {agreement.acknowledgedDesignation ? ` (${agreement.acknowledgedDesignation})` : ""}.
              {agreement.acknowledgedPhone ? ` Contact: ${agreement.acknowledgedPhone}.` : ""}
            </p>
          </div>
        )}

        {isRejected && (
          <div className="bg-red-50 border border-red-200 p-5 rounded-2xl shadow-sm text-red-950 space-y-1">
            <div className="flex items-center gap-2 font-black text-red-800">
              <XCircle className="w-5 h-5 text-red-600" />
              AGREEMENT REJECTED / DISPUTED
            </div>
            <p className="text-xs text-red-700">
              Rejected on {new Date(agreement.acknowledgedAt || Date.now()).toLocaleDateString("en-IN")}.
              {agreement.rejectionReason && (
                <span className="block mt-1 italic">Reason: &ldquo;{agreement.rejectionReason}&rdquo;</span>
              )}
            </p>
          </div>
        )}

        {isExpired && !isAlreadyAcknowledged && !isRejected && (
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl shadow-sm text-amber-950 space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <Clock className="w-5 h-5 text-amber-600" />
              Acknowledgement Token Expired
            </div>
            <p className="text-xs text-amber-700">
              This acknowledgement link has expired. Please contact AJAY ENTERPRISES to generate a renewed token.
            </p>
          </div>
        )}

        {/* Agreement Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Official Centering Material Rental Agreement
              </div>
              <h2 className="text-2xl font-black text-slate-900 mt-0.5">
                {agreement.agreementNumber}
                {agreement.version > 1 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    Version {agreement.version}
                  </span>
                )}
              </h2>
              {agreement.orderReference && (
                <div className="text-xs text-slate-600 mt-1">
                  Linked Order / Delivery Ref: <span className="font-semibold text-slate-800">{agreement.orderReference}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[11px] uppercase font-bold text-slate-400">Effective Date</div>
                <div className="text-sm font-bold text-slate-800">
                  {new Date(agreement.startDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100">
            {/* Customer Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Building2 className="w-4 h-4 text-[#F26522]" />
                Customer / Hirer Details
              </div>
              <div className="font-black text-base text-slate-900">{agreement.customer.name}</div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>Customer Code: <span className="font-mono font-medium text-slate-800">{agreement.customer.customerCode}</span></div>
                {agreement.customer.gstin && <div>GSTIN: <span className="font-mono font-medium text-slate-800">{agreement.customer.gstin}</span></div>}
                {agreement.customer.billingAddress && (
                  <div className="line-clamp-2">Billing: {agreement.customer.billingAddress}</div>
                )}
                {agreement.customer.whatsappNumber && (
                  <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <Phone className="w-3.5 h-3.5" />
                    WhatsApp: {agreement.customer.whatsappNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Site Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <MapPin className="w-4 h-4 text-[#0B1E36]" />
                Construction Site Details
              </div>
              <div className="font-black text-base text-slate-900">{agreement.customerSite.siteName}</div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>Site Code: <span className="font-mono font-medium text-slate-800">{agreement.customerSite.siteCode}</span></div>
                {agreement.customerSite.fullAddress && (
                  <div className="line-clamp-2">Address: {agreement.customerSite.fullAddress}</div>
                )}
                {agreement.customerSite.siteInCharge && (
                  <div>Site In-Charge: <span className="font-medium text-slate-800">{agreement.customerSite.siteInCharge}</span></div>
                )}
                {agreement.customerSite.siteContactDetails && (
                  <div>Contact: <span className="font-medium text-slate-800">{agreement.customerSite.siteContactDetails}</span></div>
                )}
              </div>
            </div>
          </div>

          {/* Materials Table */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Centering Material Specifications & Daily Rental Rates
              </h3>
              <div className="text-xs text-slate-500">
                {agreement.items.length} {agreement.items.length === 1 ? "Line Item" : "Line Items"}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">Material Description</th>
                    <th className="py-2.5 px-3">Size / Spec</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-center">UOM</th>
                    <th className="py-2.5 px-3 text-right">Agreed Rate (₹/Day)</th>
                    <th className="py-2.5 px-3 text-right">Daily Commitment (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agreement.items.map((item, idx) => {
                    const qty = Number(item.quantity || 0);
                    const rate = Number(item.dailyRentalRate || 0);
                    const lineTotal = qty * rate;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{item.materialVariant.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {item.materialVariant.materialCode}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{item.materialVariant.size || "Standard"}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {qty.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{item.materialVariant.uom}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                          ₹{rate.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#F26522]">
                          ₹{lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
                    <td colSpan={6} className="py-3 px-3 text-right text-xs uppercase tracking-wide">
                      Estimated Total Daily Rental Accrual:
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sm text-[#0B1E36]">
                      ₹{totalDailyEstimate.toFixed(2)} / Day
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * Daily charges accrue only for material actually held in customer custody per authorized Delivery Notes (DN) and Material Return Notes (MRN). Daily commitment is exclusive of statutory GST (CGST/SGST/IGST).
            </p>
          </div>

          {/* Contractual Terms Accordion */}
          <div className="p-6 border-t border-slate-100 bg-slate-50/40">
            <button
              type="button"
              onClick={() => setTermsOpen(!termsOpen)}
              className="w-full flex items-center justify-between text-left font-bold text-sm text-slate-800 hover:text-[#F26522] transition"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#F26522]" />
                Standard Contractual Terms & Operational Conditions (12 Articles)
              </div>
              {termsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {termsOpen && (
              <div className="mt-4 space-y-3 pt-3 border-t border-slate-200/80 text-xs text-slate-700">
                {STANDARD_RENTAL_CONDITIONS.map((c) => (
                  <div key={c.number} className="p-3 bg-white rounded-lg border border-slate-200/60 space-y-1">
                    <div className="font-bold text-slate-900 text-xs">
                      {c.number}. {c.title}
                    </div>
                    <div className="text-slate-600 leading-relaxed text-[11px]">{c.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Acknowledgement Form (Only if pending and not expired) */}
          {!isAlreadyAcknowledged && !isRejected && !isExpired && (
            <div className="p-6 bg-white border-t border-slate-200 space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Customer Authorization & Digital Acknowledgement
                  </h3>
                  <p className="text-xs text-slate-500">
                    By submitting this form, you confirm receipt, specifications, daily rental rates, and contractual acceptance on behalf of {agreement.customer.name}.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAccept} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Authorised Signatory Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Signatory Designation / Role
                    </label>
                    <input
                      type="text"
                      value={signerDesignation}
                      onChange={(e) => setSignerDesignation(e.target.value)}
                      placeholder="e.g. Site In-Charge / Project Manager"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Signatory Contact Mobile
                    </label>
                    <input
                      type="tel"
                      value={signerPhone}
                      onChange={(e) => setSignerPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F26522]"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-[#F26522] rounded border-slate-300 focus:ring-[#F26522]"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      I confirm that I am an authorized representative of <strong>{agreement.customer.name}</strong>, and hereby accept the centering materials, quantities, daily rental rates, and 12 standard contractual terms set forth herein.
                    </span>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject / Dispute Agreement
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || !agreedToTerms}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#F26522] hover:bg-[#EA580C] disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Recording Acceptance...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm & Accept Agreement
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <div>Operated by <strong>AJAY ENTERPRISES</strong> &bull; Powered by INVENTRA ERP</div>
          <div>Chennai, Tamil Nadu, India &bull; GST Registered Commercial Operations</div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">Reject / Dispute Rental Agreement</h3>
            </div>
            <p className="text-xs text-slate-600">
              Please let us know why this agreement is being rejected so AJAY ENTERPRISES can revise rates, quantities, or terms immediately.
            </p>

            <form onSubmit={handleReject} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Representative Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Rate for Props differs from quotation; incorrect site address..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejecting}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {rejecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Rejection"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
