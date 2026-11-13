"use client";

import * as React from "react";
import Link from "next/link";
import {
  Receipt,
  RefreshCw,
  Search,
  ArrowLeft,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GstCenterPage() {
  const [activeTab, setActiveTab] = React.useState<"GSTR1" | "GSTR3B">("GSTR1");
  const [gstData, setGstData] = React.useState<any | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/accounting/reports/gst");
      const data = await res.json();
      if (data.success) {
        setGstData(data.data);
      }
    } catch (err) {
      console.error("Failed to load GST reports", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const gstr1 = gstData?.gstr1;
  const gstr3b = gstData?.gstr3b;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/accounting"
              className="text-slate-400 hover:text-slate-600 transition-colors text-xs flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Accounting Hub
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">GST & Statutory Tax Center</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-orange-100 text-[#F26522]">
              State Code: 33 (Tamil Nadu)
            </span>
          </div>
          <p className="text-sm text-slate-500">
            GSTR-1 Outward Supplies, GSTR-3B Monthly Return Summaries & Input Tax Credit (ITC)
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("GSTR1")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "GSTR1"
              ? "border-[#F26522] text-[#F26522]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          GSTR-1 (Outward Supplies)
        </button>
        <button
          onClick={() => setActiveTab("GSTR3B")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "GSTR3B"
              ? "border-[#0B1E36] text-[#0B1E36]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Receipt className="w-4 h-4" />
          GSTR-3B (Monthly Summary)
        </button>
      </div>

      {/* Tab 1: GSTR-1 */}
      {activeTab === "GSTR1" && (
        <div className="space-y-6">
          {/* GSTR-1 KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 uppercase">Total Taxable Value</span>
              <div className="text-xl font-bold text-[#0B1E36] mt-1">
                ₹{gstr1 ? Number(gstr1.totalTaxableValue).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 uppercase">CGST (9%)</span>
              <div className="text-xl font-bold text-slate-800 mt-1">
                ₹{gstr1 ? Number(gstr1.totalCgst).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 uppercase">SGST (9%)</span>
              <div className="text-xl font-bold text-slate-800 mt-1">
                ₹{gstr1 ? Number(gstr1.totalSgst).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 uppercase">IGST (18%)</span>
              <div className="text-xl font-bold text-slate-800 mt-1">
                ₹{gstr1 ? Number(gstr1.totalIgst).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 uppercase">Total Output Tax</span>
              <div className="text-xl font-bold text-[#F26522] mt-1">
                ₹{gstr1 ? Number(gstr1.totalTax).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
            </div>
          </div>

          {/* Outward Invoices Table */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">Table 4A / 4B: Outward Supplies (B2B & B2C)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Invoice #</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Customer & GSTIN</th>
                    <th className="p-2.5 text-center">Place of Supply</th>
                    <th className="p-2.5 text-right">Taxable Value</th>
                    <th className="p-2.5 text-right">CGST</th>
                    <th className="p-2.5 text-right">SGST</th>
                    <th className="p-2.5 text-right">IGST</th>
                    <th className="p-2.5 text-right">Invoice Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!gstr1?.invoices || gstr1.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-400">
                        No outward supplies recorded in current period
                      </td>
                    </tr>
                  ) : (
                    gstr1.invoices.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold font-mono text-[#0B1E36]">{inv.invoiceNumber}</td>
                        <td className="p-2.5 text-slate-600">
                          {new Date(inv.invoiceDate).toLocaleDateString("en-IN")}
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-800">{inv.customer?.name}</div>
                          <div className="font-mono text-slate-400">{inv.customerGstin || "Unregistered (B2C)"}</div>
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {inv.placeOfSupply} {inv.isInterState ? "(Inter-State)" : "(Intra-State)"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-medium">
                          ₹{Number(inv.subtotal).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-600">
                          ₹{Number(inv.totalCgst).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-600">
                          ₹{Number(inv.totalSgst).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-600">
                          ₹{Number(inv.totalIgst).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-[#0B1E36]">
                          ₹{Number(inv.totalAmount).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: GSTR-3B */}
      {activeTab === "GSTR3B" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 3.1 Outward Taxable */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                3.1 Outward Taxable Supplies
              </span>
              <div className="text-2xl font-bold text-[#0B1E36]">
                ₹{gstr3b ? Number(gstr3b.outwardTaxableSupplies.taxableValue).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
                <span>Output Tax Liability:</span>
                <span className="font-bold text-[#F26522]">
                  ₹{gstr3b ? Number(gstr3b.outwardTaxableSupplies.totalTax).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
                </span>
              </div>
            </div>

            {/* 4.0 Eligible ITC */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                4.0 Eligible Input Tax Credit (ITC)
              </span>
              <div className="text-2xl font-bold text-emerald-600">
                ₹{gstr3b ? Number(gstr3b.eligibleItc.totalTax).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
                <span>Eligible Purchases:</span>
                <span className="font-semibold text-slate-700">
                  ₹{gstr3b ? Number(gstr3b.eligibleItc.taxableValue).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
                </span>
              </div>
            </div>

            {/* 5.1 Net Tax Payable */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                5.1 Net GST Payable in Cash
              </span>
              <div className="text-2xl font-bold text-[#0B1E36]">
                ₹{gstr3b ? Number(gstr3b.netTaxPayable).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
                <span>Output Tax less Eligible ITC:</span>
                <span className="font-bold text-emerald-600">
                  {gstr3b && Number(gstr3b.netTaxPayable) === 0 ? "Fully offset by ITC" : "Payable"}
                </span>
              </div>
            </div>
          </div>

          {/* GSTR-3B Detailed Breakdown Table */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">Monthly Return Tax Offsets Breakdown</h3>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Integrated Tax (IGST)</th>
                  <th className="p-3 text-right">Central Tax (CGST)</th>
                  <th className="p-3 text-right">State Tax (SGST)</th>
                  <th className="p-3 text-right">Total Tax (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 font-semibold text-slate-800">
                    (A) Outward Taxable Supplies (Output Tax)
                  </td>
                  <td className="p-3 text-right font-mono">
                    ₹{gstr3b ? Number(gstr3b.outwardTaxableSupplies.igst).toFixed(2) : "0.00"}
                  </td>
                  <td className="p-3 text-right font-mono">
                    ₹{gstr3b ? Number(gstr3b.outwardTaxableSupplies.cgst).toFixed(2) : "0.00"}
                  </td>
                  <td className="p-3 text-right font-mono">
                    ₹{gstr3b ? Number(gstr3b.outwardTaxableSupplies.sgst).toFixed(2) : "0.00"}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-[#F26522]">
                    ₹{gstr3b ? Number(gstr3b.outwardTaxableSupplies.totalTax).toFixed(2) : "0.00"}
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-800">
                    (B) Eligible Input Tax Credit (ITC Available)
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-600">
                    ₹{gstr3b ? Number(gstr3b.eligibleItc.igst).toFixed(2) : "0.00"}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-600">
                    ₹{gstr3b ? Number(gstr3b.eligibleItc.cgst).toFixed(2) : "0.00"}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-600">
                    ₹{gstr3b ? Number(gstr3b.eligibleItc.sgst).toFixed(2) : "0.00"}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-600">
                    ₹{gstr3b ? Number(gstr3b.eligibleItc.totalTax).toFixed(2) : "0.00"}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="p-3 text-slate-900">
                    (C) Net Tax Payable in Cash = (A - B)
                  </td>
                  <td className="p-3 text-right font-mono" colSpan={3}></td>
                  <td className="p-3 text-right font-mono text-base text-[#0B1E36]">
                    ₹{gstr3b ? Number(gstr3b.netTaxPayable).toFixed(2) : "0.00"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
