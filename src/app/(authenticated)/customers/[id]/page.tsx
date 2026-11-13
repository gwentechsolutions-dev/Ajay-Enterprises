"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Users2,
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Plus,
  Compass,
  Calendar,
  Boxes,
  Truck,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Receipt,
  UserCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { toast } from "sonner";

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [customer, setCustomer] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("overview");

  // Modals
  const [isSiteModalOpen, setIsSiteModalOpen] = React.useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = React.useState(false);

  // Forms
  const [siteForm, setSiteForm] = React.useState({
    siteCode: "",
    siteName: "",
    fullAddress: "",
    district: "",
    city: "",
    state: "Karnataka",
    stateCode: "29",
    pinCode: "",
    gpsLatitude: "",
    gpsLongitude: "",
    siteOwnerName: "",
    siteOwnerContact: "",
    siteInCharge: "",
    siteContactDetails: "",
    projectType: "RESIDENTIAL",
    deliveryInstructions: "",
  });

  const [contactForm, setContactForm] = React.useState({
    name: "",
    mobile: "",
    alternateMobile: "",
    email: "",
    designation: "Site Supervisor",
    contactType: "SITE_INCHARGE",
    siteId: "",
    isPrimary: false,
    canReceiveDeliveryNotes: true,
    canAcknowledgeDeliveries: true,
    canReceiveReturnNotes: true,
    canReceiveInvoices: false,
    canReceivePaymentReminders: false,
    canReceiveWhatsApp: true,
  });

  const fetchCustomer = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/customers/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to load customer");
      setCustomer(data.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  // Handle Add Site
  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/v1/customers/${id}/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...siteForm,
          siteCode: siteForm.siteCode.trim() || "AUTO",
          gpsLatitude: siteForm.gpsLatitude ? Number(siteForm.gpsLatitude) : null,
          gpsLongitude: siteForm.gpsLongitude ? Number(siteForm.gpsLongitude) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to add site");
      toast.success(`Construction site '${data.data.siteName}' created.`);
      setIsSiteModalOpen(false);
      setSiteForm({
        siteCode: "",
        siteName: "",
        fullAddress: "",
        district: "",
        city: "",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "",
        gpsLatitude: "",
        gpsLongitude: "",
        siteOwnerName: "",
        siteOwnerContact: "",
        siteInCharge: "",
        siteContactDetails: "",
        projectType: "RESIDENTIAL",
        deliveryInstructions: "",
      });
      await fetchCustomer();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Handle Add Contact
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/v1/customers/${id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contactForm,
          siteId: contactForm.siteId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to add contact");
      toast.success(`Contact '${data.data.name}' added with configured authorizations.`);
      setIsContactModalOpen(false);
      setContactForm({
        name: "",
        mobile: "",
        alternateMobile: "",
        email: "",
        designation: "Site Supervisor",
        contactType: "SITE_INCHARGE",
        siteId: "",
        isPrimary: false,
        canReceiveDeliveryNotes: true,
        canAcknowledgeDeliveries: true,
        canReceiveReturnNotes: true,
        canReceiveInvoices: false,
        canReceivePaymentReminders: false,
        canReceiveWhatsApp: true,
      });
      await fetchCustomer();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#0B1E36] mb-3" />
        <p className="text-sm text-slate-500 font-medium">Loading customer profile & sites...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="py-12 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Customer Not Found</h2>
        <Link href="/customers">
          <Button variant="outline" size="sm">Back to Customer Directory</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/customers">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {customer.name}
              </h1>
              <Badge variant="outline" className="font-mono text-xs bg-slate-100">
                {customer.customerCode}
              </Badge>
              <Badge
                variant="outline"
                className={
                  customer.gstStatus === "REGISTERED"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-slate-100 text-slate-700"
                }
              >
                {customer.gstStatus}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {customer.customerType} • {customer.billingAddress}, {customer.state} ({customer.stateCode})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsSiteModalOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Construction Site
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsContactModalOpen(true)}
            className="text-xs border-slate-300"
          >
            <UserCheck className="h-3.5 w-3.5 mr-1" /> Add Contact Person
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="overview" className="text-xs font-semibold">Overview</TabsTrigger>
          <TabsTrigger value="sites" className="text-xs font-semibold">
            Sites ({customer.sites?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="stock" className="text-xs font-semibold">Live Site Stock</TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs font-semibold">
            Authorized Contacts ({customer.contacts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs font-semibold">Movement Activity</TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200 shadow-sm p-5 bg-white space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Contact & Communication
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="font-mono font-medium">{customer.primaryMobile}</span>
                  {customer.alternateMobile ? (
                    <span className="text-slate-400">/ {customer.alternateMobile}</span>
                  ) : null}
                </div>
                {customer.email ? (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span>{customer.email}</span>
                  </div>
                ) : null}
                {customer.whatsappNumber ? (
                  <div className="flex items-center gap-2 text-slate-700">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                    <span className="font-mono">{customer.whatsappNumber} (WhatsApp)</span>
                  </div>
                ) : null}
                <div className="flex items-start gap-2 text-slate-700 pt-2 border-t border-slate-100">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">{customer.billingAddress}</div>
                    <div className="text-slate-400">{customer.state} ({customer.stateCode}) - {customer.pinCode || "—"}</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-slate-200 shadow-sm p-5 bg-white space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Statutory & Tax Compliance
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">GST Status</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{customer.gstStatus}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">GSTIN</div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    {customer.gstin || "Unregistered / None"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">PAN</div>
                  <div className="font-mono font-semibold text-slate-900 mt-0.5">
                    {customer.pan || "Not Provided"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Legal Trade Name</div>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {customer.legalBusinessName || customer.name}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-slate-200 shadow-sm p-5 bg-white space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Commercial Terms & Balances
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">Credit Limit</div>
                  <div className="font-mono text-base font-bold text-slate-900 mt-0.5">
                    {customer.creditLimit ? `₹${Number(customer.creditLimit).toLocaleString("en-IN")}` : "Unrestricted"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Payment Terms</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {customer.paymentTermsDays} Days from Invoice Date
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Opening Ledger Balance</div>
                  <div className="font-mono font-semibold text-slate-900 mt-0.5">
                    ₹{Number(customer.openingBalance || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Internal Remarks</div>
                  <div className="text-slate-600 mt-0.5 italic">
                    {customer.notes || "No special notes recorded."}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: SITES */}
        <TabsContent value="sites" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customer.sites?.length === 0 ? (
              <div className="col-span-2 py-12 text-center bg-white border border-slate-200 rounded-xl p-8">
                <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-800">No Construction Sites Registered</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Each customer can have unlimited independent construction sites with unique delivery addresses and GPS tracking.
                </p>
                <Button size="sm" onClick={() => setIsSiteModalOpen(true)} className="bg-[#0B1E36] text-white text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add First Construction Site
                </Button>
              </div>
            ) : (
              customer.sites.map((site: any) => (
                <Card key={site.id} className="border-slate-200 shadow-sm p-5 bg-white space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{site.siteName}</span>
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {site.siteCode}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {site.projectType} Project • {site.city}, {site.district}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        site.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-slate-100 text-slate-600"
                      }
                    >
                      {site.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        {site.fullAddress}, {site.city} - {site.pinCode}
                      </div>
                    </div>

                    {site.gpsLatitude && site.gpsLongitude ? (
                      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                        <Compass className="h-3.5 w-3.5 text-[#F26522]" />
                        <span>GPS: {Number(site.gpsLatitude).toFixed(6)}, {Number(site.gpsLongitude).toFixed(6)}</span>
                      </div>
                    ) : null}

                    {site.siteInCharge ? (
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-slate-400">Site In-Charge:</span>
                        <span className="font-semibold">{site.siteInCharge}</span>
                        {site.siteContactDetails ? (
                          <span className="font-mono text-slate-500">({site.siteContactDetails})</span>
                        ) : null}
                      </div>
                    ) : null}

                    {site.deliveryInstructions ? (
                      <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 mt-2">
                        <strong>Delivery Instructions:</strong> {site.deliveryInstructions}
                      </div>
                    ) : null}
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 3: STOCK */}
        <TabsContent value="stock" className="space-y-4">
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="py-3 px-4 border-b border-slate-200 bg-slate-50">
              <CardTitle className="text-xs font-bold uppercase tracking-wide text-slate-700">
                Materials Currently In Custody At Customer Construction Sites
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Site</th>
                    <th className="py-2.5 px-4">Material Code</th>
                    <th className="py-2.5 px-4">Material Variant & Size</th>
                    <th className="py-2.5 px-4 text-right">Quantity On Site</th>
                    <th className="py-2.5 px-4 text-center">Ownership</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.sites?.flatMap((s: any) =>
                    s.stockBalances?.map((b: any) => ({ ...b, siteName: s.siteName, siteCode: s.siteCode }))
                  ).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No materials currently held on customer construction sites.
                      </td>
                    </tr>
                  ) : (
                    customer.sites?.flatMap((s: any) =>
                      s.stockBalances?.map((b: any) => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {s.siteName} <span className="font-mono text-slate-400 font-normal">({s.siteCode})</span>
                          </td>
                          <td className="py-2.5 px-4 font-mono">{b.materialVariant?.materialCode}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">
                            {b.materialVariant?.name} ({b.materialVariant?.size})
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                            {Number(b.availableQty)} {b.materialVariant?.uom}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge variant="outline" className="text-[10px]">
                              {b.ownershipType}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 4: CONTACTS */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customer.contacts?.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-400">
                No authorized contacts registered yet.
              </div>
            ) : (
              customer.contacts.map((contact: any) => (
                <Card key={contact.id} className="border-slate-200 shadow-sm p-4 bg-white space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        {contact.name}
                        {contact.isPrimary ? (
                          <Badge className="bg-blue-600 text-[10px] py-0 px-1.5">Primary</Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">{contact.designation}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {contact.contactType}
                    </Badge>
                  </div>

                  <div className="text-xs space-y-1 font-mono text-slate-700">
                    <div>📞 {contact.mobile}</div>
                    {contact.email ? <div>✉️ {contact.email}</div> : null}
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1">
                    <div className="font-bold text-slate-700 text-[10px] uppercase">
                      Operational Authorizations:
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-slate-600">
                      <div>{contact.canReceiveDeliveryNotes ? "✓ Delivery Notes" : "✗ Delivery Notes"}</div>
                      <div>{contact.canAcknowledgeDeliveries ? "✓ Sign-off / Ack" : "✗ Sign-off"}</div>
                      <div>{contact.canReceiveReturnNotes ? "✓ Return Notes" : "✗ Return Notes"}</div>
                      <div>{contact.canReceiveInvoices ? "✓ Invoices" : "✗ Invoices"}</div>
                      <div>{contact.canReceiveWhatsApp ? "✓ WhatsApp" : "✗ WhatsApp"}</div>
                      <div>{contact.canReceivePaymentReminders ? "✓ Payment Alerts" : "✗ Payment Alerts"}</div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 5: ACTIVITY */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Movement #</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Material Variant</th>
                    <th className="py-2.5 px-4">Movement Type</th>
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    <th className="py-2.5 px-4">Source / Destination</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.movements?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No material movement history found for this customer.
                      </td>
                    </tr>
                  ) : (
                    customer.movements?.map((m: any) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                          {m.movementNumber}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] whitespace-nowrap">
                          {new Date(m.movementDate).toLocaleDateString("en-IN")}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">
                          {m.materialVariant?.name} ({m.materialVariant?.size})
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant="outline" className="text-[10px]">
                            {m.movementType}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {Number(m.quantity)} {m.uom}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 text-[11px]">
                          {m.sourceWarehouse?.name || m.sourceSite?.siteName || "Yard"} →{" "}
                          {m.destinationSite?.siteName || m.destinationWarehouse?.name || "Customer Site"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ADD SITE MODAL */}
      <Dialog open={isSiteModalOpen} onOpenChange={setIsSiteModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Customer Construction Site</DialogTitle>
            <DialogDescription>
              Register an independent project location for {customer.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSite} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="siteCode">Site ID</Label>
                <Input
                  id="siteCode"
                  placeholder="Auto-generated if blank"
                  value={siteForm.siteCode}
                  onChange={(e) => setSiteForm({ ...siteForm, siteCode: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="siteName" required>Construction Site Name</Label>
                <Input
                  id="siteName"
                  placeholder="e.g. Prestige Tech Park Tower 3"
                  value={siteForm.siteName}
                  onChange={(e) => setSiteForm({ ...siteForm, siteName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="siteAddress" required>Full Site Address</Label>
              <Input
                id="siteAddress"
                placeholder="Plot #, Street, Landmark"
                value={siteForm.fullAddress}
                onChange={(e) => setSiteForm({ ...siteForm, fullAddress: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="siteCity" required>City</Label>
                <Input
                  id="siteCity"
                  placeholder="e.g. Bengaluru"
                  value={siteForm.city}
                  onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="siteDistrict" required>District</Label>
                <Input
                  id="siteDistrict"
                  placeholder="e.g. Bengaluru Urban"
                  value={siteForm.district}
                  onChange={(e) => setSiteForm({ ...siteForm, district: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sitePin" required>PIN Code</Label>
                <Input
                  id="sitePin"
                  placeholder="6 digits"
                  value={siteForm.pinCode}
                  onChange={(e) => setSiteForm({ ...siteForm, pinCode: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="siteLat">GPS Latitude</Label>
                <Input
                  id="siteLat"
                  type="number"
                  step="0.0000001"
                  placeholder="e.g. 12.9715987"
                  value={siteForm.gpsLatitude}
                  onChange={(e) => setSiteForm({ ...siteForm, gpsLatitude: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="siteLng">GPS Longitude</Label>
                <Input
                  id="siteLng"
                  type="number"
                  step="0.0000001"
                  placeholder="e.g. 77.5945627"
                  value={siteForm.gpsLongitude}
                  onChange={(e) => setSiteForm({ ...siteForm, gpsLongitude: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="siteInCharge">Site In-Charge / Supervisor</Label>
                <Input
                  id="siteInCharge"
                  placeholder="e.g. Suresh Kumar"
                  value={siteForm.siteInCharge}
                  onChange={(e) => setSiteForm({ ...siteForm, siteInCharge: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="siteContact">Supervisor Phone</Label>
                <Input
                  id="siteContact"
                  placeholder="e.g. 9845012345"
                  value={siteForm.siteContactDetails}
                  onChange={(e) => setSiteForm({ ...siteForm, siteContactDetails: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="siteInstructions">Delivery & Yard Access Instructions</Label>
              <Input
                id="siteInstructions"
                placeholder="Gate #, vehicle height limits, unloading timings"
                value={siteForm.deliveryInstructions}
                onChange={(e) => setSiteForm({ ...siteForm, deliveryInstructions: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsSiteModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0B1E36] hover:bg-[#071424] text-white">
                Save Construction Site
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ADD CONTACT MODAL */}
      <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Authorized Contact Person</DialogTitle>
            <DialogDescription>
              Specify individual operational authorizations for delivery sign-off, invoices & WhatsApp alerts.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddContact} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cntName" required>Full Name</Label>
                <Input
                  id="cntName"
                  placeholder="e.g. Ramesh Babu"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cntDesig" required>Designation</Label>
                <Input
                  id="cntDesig"
                  placeholder="e.g. Project Manager / Site Engineer"
                  value={contactForm.designation}
                  onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cntMobile" required>Mobile Number</Label>
                <Input
                  id="cntMobile"
                  placeholder="10 digits"
                  value={contactForm.mobile}
                  onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cntEmail">Email</Label>
                <Input
                  id="cntEmail"
                  type="email"
                  placeholder="ramesh@company.com"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Link to Specific Site (Optional)</Label>
              <SearchableCombobox
                options={[
                  { value: "", label: "Universal (All Customer Sites)" },
                  ...customer.sites.map((s: any) => ({
                    value: s.id,
                    label: s.siteName,
                    sublabel: s.siteCode,
                  })),
                ]}
                value={contactForm.siteId}
                onChange={(val) => setContactForm({ ...contactForm, siteId: val })}
                placeholder="Assign site..."
              />
            </div>

            {/* Granular Authorizations */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Operational Authorizations (Prompt 4.3)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactForm.canReceiveDeliveryNotes}
                    onChange={(e) => setContactForm({ ...contactForm, canReceiveDeliveryNotes: e.target.checked })}
                    className="rounded text-[#0B1E36]"
                  />
                  <span>Receive Delivery Notes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactForm.canAcknowledgeDeliveries}
                    onChange={(e) => setContactForm({ ...contactForm, canAcknowledgeDeliveries: e.target.checked })}
                    className="rounded text-[#0B1E36]"
                  />
                  <span>Acknowledge / Sign Deliveries</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactForm.canReceiveReturnNotes}
                    onChange={(e) => setContactForm({ ...contactForm, canReceiveReturnNotes: e.target.checked })}
                    className="rounded text-[#0B1E36]"
                  />
                  <span>Receive Return Notes (MRN)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactForm.canReceiveInvoices}
                    onChange={(e) => setContactForm({ ...contactForm, canReceiveInvoices: e.target.checked })}
                    className="rounded text-[#0B1E36]"
                  />
                  <span>Receive Invoices & Statements</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactForm.canReceiveWhatsApp}
                    onChange={(e) => setContactForm({ ...contactForm, canReceiveWhatsApp: e.target.checked })}
                    className="rounded text-[#0B1E36]"
                  />
                  <span>WhatsApp Notifications</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactForm.canReceivePaymentReminders}
                    onChange={(e) => setContactForm({ ...contactForm, canReceivePaymentReminders: e.target.checked })}
                    className="rounded text-[#0B1E36]"
                  />
                  <span>Payment Reminders</span>
                </label>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsContactModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0B1E36] hover:bg-[#071424] text-white">
                Save Contact
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
