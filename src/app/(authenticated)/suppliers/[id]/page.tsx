"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Factory,
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  FileText,
  Boxes,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function SupplierDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [supplier, setSupplier] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchSupplier = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/suppliers/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to load supplier");
      setSupplier(data.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchSupplier();
  }, [fetchSupplier]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#0B1E36] mb-3" />
        <p className="text-sm text-slate-500 font-medium">Loading supplier details...</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="py-12 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Supplier Not Found</h2>
        <Link href="/suppliers">
          <Button variant="outline" size="sm">Back to Suppliers</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/suppliers">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {supplier.name}
            </h1>
            <Badge variant="outline" className="font-mono text-xs bg-slate-100">
              {supplier.supplierCode}
            </Badge>
            <Badge variant="outline" className="bg-slate-100 text-slate-700">
              {supplier.supplierType}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Contact Person: {supplier.contactPerson} • {supplier.billingAddress}, {supplier.state} ({supplier.stateCode})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm p-5 bg-white space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact Information</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Phone className="h-4 w-4 text-slate-400" />
              <span className="font-mono font-medium">{supplier.primaryMobile}</span>
              {supplier.alternateMobile ? <span>/ {supplier.alternateMobile}</span> : null}
            </div>
            {supplier.email ? (
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{supplier.email}</span>
              </div>
            ) : null}
            <div className="flex items-start gap-2 text-slate-700 pt-2 border-t border-slate-100">
              <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <div>{supplier.billingAddress}</div>
                <div className="text-slate-400">{supplier.state} ({supplier.stateCode}) - {supplier.pinCode}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm p-5 bg-white space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tax Compliance & Terms</h3>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-slate-400">GST Registration:</span>{" "}
              <span className="font-semibold text-slate-800">{supplier.gstStatus}</span>
            </div>
            <div>
              <span className="text-slate-400">GSTIN:</span>{" "}
              <span className="font-mono font-bold text-slate-900">{supplier.gstin || "Unregistered"}</span>
            </div>
            <div>
              <span className="text-slate-400">PAN:</span>{" "}
              <span className="font-mono font-semibold text-slate-900">{supplier.pan || "—"}</span>
            </div>
            <div>
              <span className="text-slate-400">Credit Terms:</span>{" "}
              <span className="font-semibold text-slate-800">{supplier.creditTermsDays} Days</span>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm p-5 bg-white space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Bank & Remittance Details</h3>
          <div className="space-y-2 text-xs">
            {supplier.bankName ? (
              <>
                <div>
                  <span className="text-slate-400">Bank Name:</span>{" "}
                  <span className="font-semibold text-slate-800">{supplier.bankName}</span>
                </div>
                <div>
                  <span className="text-slate-400">Account Number:</span>{" "}
                  <span className="font-mono font-bold text-slate-900">{supplier.accountNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400">IFSC Code:</span>{" "}
                  <span className="font-mono font-semibold text-slate-900">{supplier.ifscCode}</span>
                </div>
              </>
            ) : (
              <div className="text-slate-400 italic py-2">No bank details recorded.</div>
            )}
          </div>
        </Card>
      </div>

      {/* Linked Materials & History Placeholder */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="py-3 px-4 border-b border-slate-200 bg-slate-50">
          <CardTitle className="text-xs font-bold uppercase tracking-wide text-slate-700">
            Supplied Materials & Inventory Purchase History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-slate-500 text-xs">
          <Boxes className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="font-medium text-slate-700">No Purchase Transactions Recorded Yet</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Supplier purchase receipts and hiring delivery notes will appear here when goods receipt notes are posted.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

