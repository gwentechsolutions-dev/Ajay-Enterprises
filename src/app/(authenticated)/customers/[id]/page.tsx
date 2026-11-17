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
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { PageSkeleton } from "@/components/ui/loading-states";
import { FormFieldError } from "@/components/ui/form-field-error";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { GoogleMapsLocationInput } from "@/components/forms/google-maps-location-input";
import { useFormValidation } from "@/lib/forms";
import { formatValidationToast, parseApiValidationErrors } from "@/lib/forms/validation-mapper";
import { fetchWithClientCache, invalidateClientCache } from "@/lib/client-cache";
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
  const [editingSiteId, setEditingSiteId] = React.useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = React.useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = React.useState(false);
  const [isSiteSubmitting, setIsSiteSubmitting] = React.useState(false);
  const [isContactSubmitting, setIsContactSubmitting] = React.useState(false);
  const [isCustomerSubmitting, setIsCustomerSubmitting] = React.useState(false);

  const siteModalRef = React.useRef<HTMLDivElement>(null);
  const contactModalRef = React.useRef<HTMLDivElement>(null);
  const customerModalRef = React.useRef<HTMLDivElement>(null);

  const siteValidation = useFormValidation({ containerRef: siteModalRef });
  const contactValidation = useFormValidation({ containerRef: contactModalRef });
  const customerValidation = useFormValidation({ containerRef: customerModalRef });

  const initialCustomerForm = {
    name: "",
    customerType: "COMPANY",
    legalBusinessName: "",
    primaryMobile: "",
    alternateMobile: "",
    whatsappNumber: "",
    email: "",
    gstStatus: "UNREGISTERED",
    gstin: "",
    pan: "",
    billingAddress: "",
    state: "Karnataka",
    stateCode: "29",
    pinCode: "",
    businessType: "",
    creditLimit: "",
    paymentTermsDays: "30",
    isActive: true,
    notes: "",
  };

  const initialSiteForm = {
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
    mapsUrl: "",
    siteOwnerName: "",
    siteOwnerContact: "",
    siteInCharge: "",
    siteContactDetails: "",
    projectType: "RESIDENTIAL",
    deliveryInstructions: "",
  };

  const initialContactForm = {
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
  };

  // Forms
  const [siteForm, setSiteForm] = React.useState(initialSiteForm);
  const [contactForm, setContactForm] = React.useState(initialContactForm);
  const [customerForm, setCustomerForm] = React.useState(initialCustomerForm);

  const fetchCustomer = React.useCallback(async (forceRefresh = false) => {
    if (!id) return;
    try {
      const data = await fetchWithClientCache(`/api/v1/customers/${id}`, {
        forceRefresh,
        onBackgroundUpdate: (fresh) => setCustomer(fresh),
      });
      setCustomer(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const handleOpenAddSite = () => {
    setEditingSiteId(null);
    siteValidation.clearErrors();
    setSiteForm(initialSiteForm);
    setIsSiteModalOpen(true);
  };

  const handleOpenEditSite = (site: any) => {
    setEditingSiteId(site.id);
    siteValidation.clearErrors();
    setSiteForm({
      siteCode: site.siteCode || "",
      siteName: site.siteName || "",
      fullAddress: site.fullAddress || "",
      district: site.district || "",
      city: site.city || "",
      state: site.state || "Karnataka",
      stateCode: site.stateCode || "29",
      pinCode: site.pinCode || "",
      gpsLatitude:
        site.gpsLatitude !== null && site.gpsLatitude !== undefined ? String(site.gpsLatitude) : "",
      gpsLongitude:
        site.gpsLongitude !== null && site.gpsLongitude !== undefined ? String(site.gpsLongitude) : "",
      mapsUrl: "",
      siteOwnerName: site.siteOwnerName || "",
      siteOwnerContact: site.siteOwnerContact || "",
      siteInCharge: site.siteInCharge || "",
      siteContactDetails: site.siteContactDetails || "",
      projectType: site.projectType || "RESIDENTIAL",
      deliveryInstructions: site.deliveryInstructions || "",
    });
    setIsSiteModalOpen(true);
  };

  const handleOpenAddContact = () => {
    contactValidation.clearErrors();
    setContactForm(initialContactForm);
    setIsContactModalOpen(true);
  };

  // Handle Save Site (Add or Edit)
  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSiteSubmitting(true);
    try {
      const isEdit = Boolean(editingSiteId);
      const url = isEdit
        ? `/api/v1/customers/sites/${editingSiteId}`
        : `/api/v1/customers/${id}/sites`;
      const method = isEdit ? "PUT" : "POST";

      const payload: any = {
        ...siteForm,
        siteCode: siteForm.siteCode.trim() || (isEdit ? undefined : "AUTO"),
      };

      // Handle GPS coordinates:
      // If coordinates are set in form, pass numeric values.
      // If editing an existing site that already has coordinates and user hasn't changed or cleared them, preserve existing.
      if (siteForm.gpsLatitude && siteForm.gpsLongitude) {
        payload.gpsLatitude = Number(siteForm.gpsLatitude);
        payload.gpsLongitude = Number(siteForm.gpsLongitude);
      } else if (isEdit && !siteForm.mapsUrl) {
        // Keep existing database coordinates untouched when link field is empty
        delete payload.gpsLatitude;
        delete payload.gpsLongitude;
      } else {
        payload.gpsLatitude = null;
        payload.gpsLongitude = null;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!siteValidation.handleApiResponse(res, data, siteModalRef.current)) {
        toast.error(formatValidationToast(parseApiValidationErrors(data)));
        return;
      }

      toast.success(
        isEdit
          ? `Construction site '${data.data?.siteName || siteForm.siteName}' updated.`
          : `Construction site '${data.data?.siteName || siteForm.siteName}' created.`
      );
      setIsSiteModalOpen(false);
      setEditingSiteId(null);
      siteValidation.clearErrors();
      setSiteForm(initialSiteForm);
      invalidateClientCache(`/api/v1/customers/${id}`);
      await fetchCustomer(true);
    } catch (err: any) {
      toast.error(err.message || (editingSiteId ? "Failed to update site" : "Failed to add site"));
    } finally {
      setIsSiteSubmitting(false);
    }
  };

  // Handle Add Contact
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsContactSubmitting(true);
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

      if (!contactValidation.handleApiResponse(res, data, contactModalRef.current)) {
        toast.error(formatValidationToast(parseApiValidationErrors(data)));
        return;
      }

      toast.success(`Contact '${data.data.name}' added with configured authorizations.`);
      setIsContactModalOpen(false);
      contactValidation.clearErrors();
      setContactForm(initialContactForm);
      invalidateClientCache(`/api/v1/customers/${id}`);
      await fetchCustomer(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to add contact");
    } finally {
      setIsContactSubmitting(false);
    }
  };

  const handleOpenEditCustomer = () => {
    if (!customer) return;
    customerValidation.clearErrors();
    setCustomerForm({
      name: customer.name || "",
      customerType: customer.customerType || "COMPANY",
      legalBusinessName: customer.legalBusinessName || "",
      primaryMobile: customer.primaryMobile || "",
      alternateMobile: customer.alternateMobile || "",
      whatsappNumber: customer.whatsappNumber || "",
      email: customer.email || "",
      gstStatus: customer.gstStatus || "UNREGISTERED",
      gstin: customer.gstin || "",
      pan: customer.pan || "",
      billingAddress: customer.billingAddress || "",
      state: customer.state || "Karnataka",
      stateCode: customer.stateCode || "29",
      pinCode: customer.pinCode || "",
      businessType: customer.businessType || "",
      creditLimit:
        customer.creditLimit !== null && customer.creditLimit !== undefined
          ? String(customer.creditLimit)
          : "",
      paymentTermsDays: String(customer.paymentTermsDays ?? 30),
      isActive: customer.isActive ?? true,
      notes: customer.notes || "",
    });
    setIsEditCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCustomerSubmitting(true);
    try {
      const payload: any = {
        name: customerForm.name.trim(),
        customerType: customerForm.customerType,
        legalBusinessName: customerForm.legalBusinessName?.trim() || null,
        primaryMobile: customerForm.primaryMobile.trim(),
        alternateMobile: customerForm.alternateMobile?.trim() || null,
        whatsappNumber: customerForm.whatsappNumber?.trim() || null,
        email: customerForm.email?.trim() || null,
        gstStatus: customerForm.gstStatus,
        gstin: customerForm.gstin?.trim() ? customerForm.gstin.trim().toUpperCase() : null,
        pan: customerForm.pan?.trim() ? customerForm.pan.trim().toUpperCase() : null,
        billingAddress: customerForm.billingAddress.trim(),
        state: customerForm.state.trim(),
        stateCode: customerForm.stateCode.trim(),
        pinCode: customerForm.pinCode?.trim() || null,
        businessType: customerForm.businessType?.trim() || null,
        creditLimit: customerForm.creditLimit !== "" ? Number(customerForm.creditLimit) : null,
        paymentTermsDays: Number(customerForm.paymentTermsDays) || 30,
        isActive: Boolean(customerForm.isActive),
        notes: customerForm.notes?.trim() || null,
      };

      const res = await fetch(`/api/v1/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!customerValidation.handleApiResponse(res, data, customerModalRef.current)) {
        toast.error(formatValidationToast(parseApiValidationErrors(data)));
        return;
      }

      toast.success(
        `Customer profile '${data.data?.name || customerForm.name}' updated successfully.`
      );
      setIsEditCustomerModalOpen(false);
      customerValidation.clearErrors();
      invalidateClientCache("/api/v1/customers");
      invalidateClientCache(`/api/v1/customers/${id}`);
      await fetchCustomer(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update customer");
    } finally {
      setIsCustomerSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageSkeleton
        title="Customer Profile"
        subtitle="Loading customer details, sites, and custody records..."
        cardCount={3}
      />
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
              {!customer.isActive && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  Inactive
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {customer.customerType} • {customer.billingAddress}, {customer.state} ({customer.stateCode})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenEditCustomer}
            className="text-xs border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5 text-[#F26522]" /> Edit Customer
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAddSite}
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Construction Site
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenAddContact}
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
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Contact & Communication
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenEditCustomer}
                  className="h-6 px-2 text-[11px] text-slate-500 hover:text-[#0B1E36] hover:bg-slate-100"
                >
                  <Pencil className="h-3 w-3 mr-1 text-[#F26522]" /> Edit
                </Button>
              </div>
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
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Statutory & Tax Compliance
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenEditCustomer}
                  className="h-6 px-2 text-[11px] text-slate-500 hover:text-[#0B1E36] hover:bg-slate-100"
                >
                  <Pencil className="h-3 w-3 mr-1 text-[#F26522]" /> Edit
                </Button>
              </div>
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
                {customer.businessType ? (
                  <div>
                    <div className="text-slate-400 text-[11px]">Business Classification</div>
                    <div className="font-medium text-slate-800 mt-0.5">
                      {customer.businessType}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="border-slate-200 shadow-sm p-5 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Commercial Terms & Balances
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenEditCustomer}
                  className="h-6 px-2 text-[11px] text-slate-500 hover:text-[#0B1E36] hover:bg-slate-100"
                >
                  <Pencil className="h-3 w-3 mr-1 text-[#F26522]" /> Edit
                </Button>
              </div>
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
                <Button size="sm" onClick={handleOpenAddSite} className="bg-[#0B1E36] text-white text-xs">
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
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditSite(site)}
                        className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        title="Edit Construction Site"
                      >
                        <Pencil className="h-3 w-3 mr-1 text-slate-400" />
                        Edit
                      </Button>
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
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        {site.fullAddress}, {site.city} - {site.pinCode}
                      </div>
                    </div>

                    {site.gpsLatitude && site.gpsLongitude ? (
                      <div className="flex items-center justify-between font-mono text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                        <div className="flex items-center gap-2">
                          <Compass className="h-3.5 w-3.5 text-[#F26522]" />
                          <span>
                            GPS: {Number(site.gpsLatitude).toFixed(6)}, {Number(site.gpsLongitude).toFixed(6)}
                          </span>
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${Number(site.gpsLatitude)},${Number(site.gpsLongitude)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-sans text-[11px] text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Open Maps</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
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
        <DialogContent ref={siteModalRef} className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSiteId ? "Edit Customer Construction Site" : "Add Customer Construction Site"}
            </DialogTitle>
            <DialogDescription>
              {editingSiteId
                ? `Update project location details, Google Maps GPS coordinates and delivery directions for ${customer.name}.`
                : `Register an independent project location for ${customer.name}.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSite} className="space-y-4 pt-2" noValidate>
            <FormErrorSummary
              errors={siteValidation.fieldErrors}
              generalError={siteValidation.generalError}
              onFieldClick={(field) => siteValidation.scrollToField(field, siteModalRef.current)}
              containerRef={siteModalRef}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="siteCode">Site ID</Label>
                <Input
                  id="siteCode"
                  name="siteCode"
                  placeholder="Auto-generated if blank"
                  value={siteForm.siteCode}
                  error={!!siteValidation.fieldErrors.siteCode}
                  aria-invalid={!!siteValidation.fieldErrors.siteCode}
                  aria-describedby={siteValidation.fieldErrors.siteCode ? "siteCode-error" : undefined}
                  onChange={(e) => {
                    setSiteForm({ ...siteForm, siteCode: e.target.value.toUpperCase() });
                    siteValidation.clearFieldError("siteCode");
                  }}
                />
                <FormFieldError id="siteCode-error" error={siteValidation.fieldErrors.siteCode} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="siteName" required>Construction Site Name</Label>
                <Input
                  id="siteName"
                  name="siteName"
                  maxLength={100}
                  placeholder="e.g. Prestige Tech Park Tower 3"
                  value={siteForm.siteName}
                  error={!!siteValidation.fieldErrors.siteName}
                  aria-invalid={!!siteValidation.fieldErrors.siteName}
                  aria-describedby={siteValidation.fieldErrors.siteName ? "siteName-error" : undefined}
                  onChange={(e) => {
                    setSiteForm({ ...siteForm, siteName: e.target.value });
                    siteValidation.clearFieldError("siteName");
                  }}
                  required
                />
                <FormFieldError id="siteName-error" error={siteValidation.fieldErrors.siteName} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="siteAddress" required>Full Site Address</Label>
              <Input
                id="siteAddress"
                name="fullAddress"
                maxLength={300}
                placeholder="Plot #, Street, Landmark"
                value={siteForm.fullAddress}
                error={!!siteValidation.fieldErrors.fullAddress}
                aria-invalid={!!siteValidation.fieldErrors.fullAddress}
                aria-describedby={siteValidation.fieldErrors.fullAddress ? "siteAddress-error" : undefined}
                onChange={(e) => {
                  setSiteForm({ ...siteForm, fullAddress: e.target.value });
                  siteValidation.clearFieldError("fullAddress");
                }}
                required
              />
              <FormFieldError id="siteAddress-error" error={siteValidation.fieldErrors.fullAddress} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="siteCity" required>City</Label>
                <Input
                  id="siteCity"
                  name="city"
                  maxLength={50}
                  placeholder="e.g. Bengaluru"
                  value={siteForm.city}
                  error={!!siteValidation.fieldErrors.city}
                  aria-invalid={!!siteValidation.fieldErrors.city}
                  aria-describedby={siteValidation.fieldErrors.city ? "siteCity-error" : undefined}
                  onChange={(e) => {
                    setSiteForm({ ...siteForm, city: e.target.value });
                    siteValidation.clearFieldError("city");
                  }}
                  required
                />
                <FormFieldError id="siteCity-error" error={siteValidation.fieldErrors.city} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="siteDistrict" required>District</Label>
                <Input
                  id="siteDistrict"
                  name="district"
                  maxLength={50}
                  placeholder="e.g. Bengaluru Urban"
                  value={siteForm.district}
                  error={!!siteValidation.fieldErrors.district}
                  aria-invalid={!!siteValidation.fieldErrors.district}
                  aria-describedby={siteValidation.fieldErrors.district ? "siteDistrict-error" : undefined}
                  onChange={(e) => {
                    setSiteForm({ ...siteForm, district: e.target.value });
                    siteValidation.clearFieldError("district");
                  }}
                  required
                />
                <FormFieldError id="siteDistrict-error" error={siteValidation.fieldErrors.district} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sitePin" required>PIN Code</Label>
                <Input
                  id="sitePin"
                  name="pinCode"
                  maxLength={6}
                  placeholder="6 digits"
                  value={siteForm.pinCode}
                  error={!!siteValidation.fieldErrors.pinCode}
                  aria-invalid={!!siteValidation.fieldErrors.pinCode}
                  aria-describedby={siteValidation.fieldErrors.pinCode ? "sitePin-error" : undefined}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setSiteForm({ ...siteForm, pinCode: clean });
                    siteValidation.clearFieldError("pinCode");
                  }}
                  required
                />
                <FormFieldError id="sitePin-error" error={siteValidation.fieldErrors.pinCode} />
              </div>
            </div>

            {/* GOOGLE MAPS LOCATION & GPS EXTRACTOR */}
            <GoogleMapsLocationInput
              id="siteMapsUrl"
              value={siteForm.mapsUrl}
              latitude={siteForm.gpsLatitude}
              longitude={siteForm.gpsLongitude}
              error={
                siteValidation.fieldErrors.mapsUrl ||
                siteValidation.fieldErrors.gpsLatitude ||
                siteValidation.fieldErrors.gpsLongitude
              }
              onErrorClear={() => {
                siteValidation.clearFieldError("mapsUrl");
                siteValidation.clearFieldError("gpsLatitude");
                siteValidation.clearFieldError("gpsLongitude");
              }}
              onChange={({ latitude, longitude, mapsUrl }) => {
                setSiteForm((prev) => ({
                  ...prev,
                  gpsLatitude: latitude !== null ? String(latitude) : "",
                  gpsLongitude: longitude !== null ? String(longitude) : "",
                  mapsUrl,
                }));
                siteValidation.clearFieldError("mapsUrl");
                siteValidation.clearFieldError("gpsLatitude");
                siteValidation.clearFieldError("gpsLongitude");
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="siteInCharge">Site In-Charge / Supervisor</Label>
                <Input
                  id="siteInCharge"
                  name="siteInCharge"
                  maxLength={100}
                  placeholder="e.g. Suresh Kumar"
                  value={siteForm.siteInCharge}
                  error={!!siteValidation.fieldErrors.siteInCharge}
                  aria-invalid={!!siteValidation.fieldErrors.siteInCharge}
                  aria-describedby={siteValidation.fieldErrors.siteInCharge ? "siteInCharge-error" : undefined}
                  onChange={(e) => {
                    setSiteForm({ ...siteForm, siteInCharge: e.target.value });
                    siteValidation.clearFieldError("siteInCharge");
                  }}
                />
                <FormFieldError id="siteInCharge-error" error={siteValidation.fieldErrors.siteInCharge} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="siteContact">Supervisor Phone</Label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {siteForm.siteContactDetails.length}/10
                  </span>
                </div>
                <Input
                  id="siteContact"
                  name="siteContactDetails"
                  maxLength={10}
                  placeholder="e.g. 9845012345"
                  value={siteForm.siteContactDetails}
                  error={!!siteValidation.fieldErrors.siteContactDetails}
                  aria-invalid={!!siteValidation.fieldErrors.siteContactDetails}
                  aria-describedby={siteValidation.fieldErrors.siteContactDetails ? "siteContact-error" : undefined}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setSiteForm({ ...siteForm, siteContactDetails: clean });
                    siteValidation.clearFieldError("siteContactDetails");
                  }}
                  className="font-mono"
                />
                <FormFieldError id="siteContact-error" error={siteValidation.fieldErrors.siteContactDetails} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="siteInstructions">Delivery & Yard Access Instructions</Label>
              <Input
                id="siteInstructions"
                name="deliveryInstructions"
                maxLength={300}
                placeholder="Gate #, vehicle height limits, unloading timings"
                value={siteForm.deliveryInstructions}
                error={!!siteValidation.fieldErrors.deliveryInstructions}
                aria-invalid={!!siteValidation.fieldErrors.deliveryInstructions}
                aria-describedby={siteValidation.fieldErrors.deliveryInstructions ? "siteInstructions-error" : undefined}
                onChange={(e) => {
                  setSiteForm({ ...siteForm, deliveryInstructions: e.target.value });
                  siteValidation.clearFieldError("deliveryInstructions");
                }}
              />
              <FormFieldError id="siteInstructions-error" error={siteValidation.fieldErrors.deliveryInstructions} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsSiteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isSiteSubmitting}
                loadingText={editingSiteId ? "Updating Site..." : "Saving Site..."}
                className="bg-[#0B1E36] hover:bg-[#071424] text-white"
              >
                {editingSiteId ? "Update Construction Site" : "Save Construction Site"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ADD CONTACT MODAL */}
      <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
        <DialogContent ref={contactModalRef} className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Authorized Contact Person</DialogTitle>
            <DialogDescription>
              Specify individual operational authorizations for delivery sign-off, invoices & WhatsApp alerts.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddContact} className="space-y-4 pt-2" noValidate>
            <FormErrorSummary
              errors={contactValidation.fieldErrors}
              generalError={contactValidation.generalError}
              onFieldClick={(field) => contactValidation.scrollToField(field, contactModalRef.current)}
              containerRef={contactModalRef}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cntName" required>Full Name</Label>
                <Input
                  id="cntName"
                  name="name"
                  maxLength={100}
                  placeholder="e.g. Ramesh Babu"
                  value={contactForm.name}
                  error={!!contactValidation.fieldErrors.name}
                  aria-invalid={!!contactValidation.fieldErrors.name}
                  aria-describedby={contactValidation.fieldErrors.name ? "cntName-error" : undefined}
                  onChange={(e) => {
                    setContactForm({ ...contactForm, name: e.target.value });
                    contactValidation.clearFieldError("name");
                  }}
                  required
                />
                <FormFieldError id="cntName-error" error={contactValidation.fieldErrors.name} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cntDesig" required>Designation</Label>
                <Input
                  id="cntDesig"
                  name="designation"
                  maxLength={100}
                  placeholder="e.g. Project Manager / Site Engineer"
                  value={contactForm.designation}
                  error={!!contactValidation.fieldErrors.designation}
                  aria-invalid={!!contactValidation.fieldErrors.designation}
                  aria-describedby={contactValidation.fieldErrors.designation ? "cntDesig-error" : undefined}
                  onChange={(e) => {
                    setContactForm({ ...contactForm, designation: e.target.value });
                    contactValidation.clearFieldError("designation");
                  }}
                  required
                />
                <FormFieldError id="cntDesig-error" error={contactValidation.fieldErrors.designation} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="cntMobile" required>Mobile Number</Label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {contactForm.mobile.length}/10
                  </span>
                </div>
                <Input
                  id="cntMobile"
                  name="mobile"
                  maxLength={10}
                  placeholder="10 digits"
                  value={contactForm.mobile}
                  error={!!contactValidation.fieldErrors.mobile}
                  aria-invalid={!!contactValidation.fieldErrors.mobile}
                  aria-describedby={contactValidation.fieldErrors.mobile ? "cntMobile-error" : undefined}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setContactForm({ ...contactForm, mobile: clean });
                    contactValidation.clearFieldError("mobile");
                  }}
                  className="font-mono"
                  required
                />
                <FormFieldError id="cntMobile-error" error={contactValidation.fieldErrors.mobile} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cntEmail">Email</Label>
                <Input
                  id="cntEmail"
                  name="email"
                  type="email"
                  maxLength={100}
                  placeholder="ramesh@company.com"
                  value={contactForm.email}
                  error={!!contactValidation.fieldErrors.email}
                  aria-invalid={!!contactValidation.fieldErrors.email}
                  aria-describedby={contactValidation.fieldErrors.email ? "cntEmail-error" : undefined}
                  onChange={(e) => {
                    setContactForm({ ...contactForm, email: e.target.value });
                    contactValidation.clearFieldError("email");
                  }}
                />
                <FormFieldError id="cntEmail-error" error={contactValidation.fieldErrors.email} />
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
              <Button
                type="submit"
                isLoading={isContactSubmitting}
                loadingText="Saving Contact..."
                className="bg-[#0B1E36] hover:bg-[#071424] text-white"
              >
                Save Contact
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT CUSTOMER MODAL */}
      <Dialog open={isEditCustomerModalOpen} onOpenChange={setIsEditCustomerModalOpen}>
        <DialogContent ref={customerModalRef} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#F26522] shrink-0">
                <Pencil className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Edit Customer Profile
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Update customer account details, GST compliance, communication numbers, and credit terms.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveCustomer} className="space-y-4 pt-2" noValidate>
            <FormErrorSummary
              errors={customerValidation.fieldErrors}
              generalError={customerValidation.generalError}
              onFieldClick={(field) => customerValidation.scrollToField(field, customerModalRef.current)}
              containerRef={customerModalRef}
            />

            {/* Readonly Account Badge & Customer Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Customer Code (Fixed Identifier)</Label>
                <div className="font-mono text-xs font-bold text-slate-800 bg-white px-3 py-2 rounded-lg border border-slate-200">
                  {customer.customerCode}
                </div>
              </div>
              <div className="space-y-1">
                <Label required className="text-xs">Customer Classification</Label>
                <SearchableCombobox
                  options={[
                    { value: "COMPANY", label: "Company / Corporate Entity" },
                    { value: "CONTRACTOR", label: "Civil Contractor / Subcontractor" },
                    { value: "INDIVIDUAL", label: "Individual / Property Owner" },
                  ]}
                  value={customerForm.customerType}
                  error={!!customerValidation.fieldErrors.customerType}
                  onChange={(val) => {
                    setCustomerForm({ ...customerForm, customerType: val || "COMPANY" });
                    customerValidation.clearFieldError("customerType");
                  }}
                  allowClear={false}
                />
                <FormFieldError id="custType-error" error={customerValidation.fieldErrors.customerType} />
              </div>
            </div>

            {/* Trade & Legal Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custEditName" required>Trade / Display Name</Label>
                <Input
                  id="custEditName"
                  name="name"
                  placeholder="e.g. Casaagrand / Prestige Infra"
                  value={customerForm.name}
                  error={!!customerValidation.fieldErrors.name}
                  aria-invalid={!!customerValidation.fieldErrors.name}
                  aria-describedby={customerValidation.fieldErrors.name ? "custEditName-error" : undefined}
                  onChange={(e) => {
                    setCustomerForm({ ...customerForm, name: e.target.value });
                    customerValidation.clearFieldError("name");
                  }}
                  required
                />
                <FormFieldError id="custEditName-error" error={customerValidation.fieldErrors.name} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custEditLegalName">Legal Registered Name (Optional)</Label>
                <Input
                  id="custEditLegalName"
                  name="legalBusinessName"
                  placeholder="e.g. Casaagrand Builder Private Limited"
                  value={customerForm.legalBusinessName}
                  error={!!customerValidation.fieldErrors.legalBusinessName}
                  aria-invalid={!!customerValidation.fieldErrors.legalBusinessName}
                  aria-describedby={customerValidation.fieldErrors.legalBusinessName ? "custEditLegalName-error" : undefined}
                  onChange={(e) => {
                    setCustomerForm({ ...customerForm, legalBusinessName: e.target.value });
                    customerValidation.clearFieldError("legalBusinessName");
                  }}
                />
                <FormFieldError id="custEditLegalName-error" error={customerValidation.fieldErrors.legalBusinessName} />
              </div>
            </div>

            {/* Contact & Phone Numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="custEditMobile" required>Primary Mobile</Label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {customerForm.primaryMobile.length}/10
                  </span>
                </div>
                <Input
                  id="custEditMobile"
                  name="primaryMobile"
                  type="tel"
                  maxLength={10}
                  placeholder="10 digits"
                  value={customerForm.primaryMobile}
                  error={!!customerValidation.fieldErrors.primaryMobile}
                  aria-invalid={!!customerValidation.fieldErrors.primaryMobile}
                  aria-describedby={customerValidation.fieldErrors.primaryMobile ? "custEditMobile-error" : undefined}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setCustomerForm({ ...customerForm, primaryMobile: clean });
                    customerValidation.clearFieldError("primaryMobile");
                  }}
                  className="font-mono"
                  required
                />
                <FormFieldError id="custEditMobile-error" error={customerValidation.fieldErrors.primaryMobile} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="custEditAltMobile">Alternate Mobile</Label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {customerForm.alternateMobile.length}/10
                  </span>
                </div>
                <Input
                  id="custEditAltMobile"
                  name="alternateMobile"
                  type="tel"
                  maxLength={10}
                  placeholder="Optional 10 digits"
                  value={customerForm.alternateMobile}
                  error={!!customerValidation.fieldErrors.alternateMobile}
                  aria-invalid={!!customerValidation.fieldErrors.alternateMobile}
                  aria-describedby={customerValidation.fieldErrors.alternateMobile ? "custEditAltMobile-error" : undefined}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setCustomerForm({ ...customerForm, alternateMobile: clean });
                    customerValidation.clearFieldError("alternateMobile");
                  }}
                  className="font-mono"
                />
                <FormFieldError id="custEditAltMobile-error" error={customerValidation.fieldErrors.alternateMobile} />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="custEditWhatsapp">WhatsApp Number</Label>
                  {customerForm.primaryMobile && customerForm.whatsappNumber !== customerForm.primaryMobile && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerForm({ ...customerForm, whatsappNumber: customerForm.primaryMobile });
                        customerValidation.clearFieldError("whatsappNumber");
                      }}
                      className="text-[10px] text-[#F26522] hover:underline font-medium"
                    >
                      Same as mobile
                    </button>
                  )}
                </div>
                <Input
                  id="custEditWhatsapp"
                  name="whatsappNumber"
                  type="tel"
                  maxLength={10}
                  placeholder="WhatsApp 10 digits"
                  value={customerForm.whatsappNumber}
                  error={!!customerValidation.fieldErrors.whatsappNumber}
                  aria-invalid={!!customerValidation.fieldErrors.whatsappNumber}
                  aria-describedby={customerValidation.fieldErrors.whatsappNumber ? "custEditWhatsapp-error" : undefined}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setCustomerForm({ ...customerForm, whatsappNumber: clean });
                    customerValidation.clearFieldError("whatsappNumber");
                  }}
                  className="font-mono"
                />
                <FormFieldError id="custEditWhatsapp-error" error={customerValidation.fieldErrors.whatsappNumber} />
              </div>
            </div>

            {/* Email & Business Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custEditEmail">Billing / Accounts Email</Label>
                <Input
                  id="custEditEmail"
                  name="email"
                  type="email"
                  maxLength={100}
                  placeholder="billing@customer.com"
                  value={customerForm.email}
                  error={!!customerValidation.fieldErrors.email}
                  aria-invalid={!!customerValidation.fieldErrors.email}
                  aria-describedby={customerValidation.fieldErrors.email ? "custEditEmail-error" : undefined}
                  onChange={(e) => {
                    setCustomerForm({ ...customerForm, email: e.target.value });
                    customerValidation.clearFieldError("email");
                  }}
                />
                <FormFieldError id="custEditEmail-error" error={customerValidation.fieldErrors.email} />
              </div>

              <div className="space-y-1.5">
                <Label>Business Project Type</Label>
                <SearchableCombobox
                  options={[
                    { value: "RESIDENTIAL", label: "Residential Construction" },
                    { value: "COMMERCIAL", label: "Commercial / IT Parks" },
                    { value: "INFRASTRUCTURE", label: "Infrastructure / Public Works" },
                    { value: "INDUSTRIAL", label: "Industrial & Manufacturing" },
                  ]}
                  value={customerForm.businessType}
                  placeholder="Select project classification..."
                  onChange={(val) => {
                    setCustomerForm({ ...customerForm, businessType: val || "" });
                  }}
                />
              </div>
            </div>

            {/* Statutory & GST */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label required>GST Registration</Label>
                <SearchableCombobox
                  options={[
                    { value: "REGISTERED", label: "Registered (Regular GST)" },
                    { value: "UNREGISTERED", label: "Unregistered (Non-GST)" },
                    { value: "COMPOSITION", label: "Composition Dealer" },
                  ]}
                  value={customerForm.gstStatus}
                  error={!!customerValidation.fieldErrors.gstStatus}
                  onChange={(val) => {
                    setCustomerForm({ ...customerForm, gstStatus: val || "UNREGISTERED" });
                    customerValidation.clearFieldError("gstStatus");
                  }}
                  allowClear={false}
                />
                <FormFieldError id="custEditGstStatus-error" error={customerValidation.fieldErrors.gstStatus} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custEditGstin">GSTIN</Label>
                <Input
                  id="custEditGstin"
                  name="gstin"
                  maxLength={15}
                  placeholder="15-character GSTIN"
                  value={customerForm.gstin}
                  error={!!customerValidation.fieldErrors.gstin}
                  aria-invalid={!!customerValidation.fieldErrors.gstin}
                  aria-describedby={customerValidation.fieldErrors.gstin ? "custEditGstin-error" : undefined}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    const updates: any = { gstin: val };
                    // Auto-extract PAN from GSTIN if 15 chars and PAN is blank or was previous subpart
                    if (val.length >= 12 && (!customerForm.pan || customerForm.pan === customerForm.gstin.slice(2, 12))) {
                      updates.pan = val.slice(2, 12);
                    }
                    if (val.length >= 2 && !customerForm.stateCode) {
                      updates.stateCode = val.slice(0, 2);
                    }
                    if (val.length > 0 && customerForm.gstStatus === "UNREGISTERED") {
                      updates.gstStatus = "REGISTERED";
                    }
                    setCustomerForm({ ...customerForm, ...updates });
                    customerValidation.clearFieldError("gstin");
                    if (updates.pan) customerValidation.clearFieldError("pan");
                  }}
                  className="font-mono uppercase"
                />
                <FormFieldError id="custEditGstin-error" error={customerValidation.fieldErrors.gstin} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custEditPan">Permanent Account Number (PAN)</Label>
                <Input
                  id="custEditPan"
                  name="pan"
                  maxLength={10}
                  placeholder="10-digit PAN"
                  value={customerForm.pan}
                  error={!!customerValidation.fieldErrors.pan}
                  aria-invalid={!!customerValidation.fieldErrors.pan}
                  aria-describedby={customerValidation.fieldErrors.pan ? "custEditPan-error" : undefined}
                  onChange={(e) => {
                    setCustomerForm({ ...customerForm, pan: e.target.value.toUpperCase() });
                    customerValidation.clearFieldError("pan");
                  }}
                  className="font-mono uppercase"
                />
                <FormFieldError id="custEditPan-error" error={customerValidation.fieldErrors.pan} />
              </div>
            </div>

            {/* Billing Address */}
            <div className="space-y-1.5">
              <Label htmlFor="custEditBilling" required>Full Registered Billing Address</Label>
              <Textarea
                id="custEditBilling"
                name="billingAddress"
                rows={2}
                placeholder="Door/Plot No., Street, Area, City, etc."
                value={customerForm.billingAddress}
                error={!!customerValidation.fieldErrors.billingAddress}
                aria-invalid={!!customerValidation.fieldErrors.billingAddress}
                aria-describedby={customerValidation.fieldErrors.billingAddress ? "custEditBilling-error" : undefined}
                onChange={(e) => {
                  setCustomerForm({ ...customerForm, billingAddress: e.target.value });
                  customerValidation.clearFieldError("billingAddress");
                }}
                required
              />
              <FormFieldError id="custEditBilling-error" error={customerValidation.fieldErrors.billingAddress} />
            </div>

            {/* State, State Code, PIN Code */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custEditState" required>State</Label>
                <Input
                  id="custEditState"
                  name="state"
                  placeholder="e.g. Tamil Nadu"
                  value={customerForm.state}
                  error={!!customerValidation.fieldErrors.state}
                  aria-invalid={!!customerValidation.fieldErrors.state}
                  aria-describedby={customerValidation.fieldErrors.state ? "custEditState-error" : undefined}
                  onChange={(e) => {
                    setCustomerForm({ ...customerForm, state: e.target.value });
                    customerValidation.clearFieldError("state");
                  }}
                  required
                />
                <FormFieldError id="custEditState-error" error={customerValidation.fieldErrors.state} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custEditStateCode" required>State Code (2 Digits)</Label>
                <Input
                  id="custEditStateCode"
                  name="stateCode"
                  maxLength={2}
                  placeholder="e.g. 33"
                  value={customerForm.stateCode}
                  error={!!customerValidation.fieldErrors.stateCode}
                  aria-invalid={!!customerValidation.fieldErrors.stateCode}
                  aria-describedby={customerValidation.fieldErrors.stateCode ? "custEditStateCode-error" : undefined}
                  onChange={(e) => {
                    setCustomerForm({ ...customerForm, stateCode: e.target.value });
                    customerValidation.clearFieldError("stateCode");
                  }}
                  className="font-mono"
                  required
                />
                <FormFieldError id="custEditStateCode-error" error={customerValidation.fieldErrors.stateCode} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custEditPin">PIN Code</Label>
                <Input
                  id="custEditPin"
                  name="pinCode"
                  maxLength={6}
                  placeholder="6 digits"
                  value={customerForm.pinCode}
                  error={!!customerValidation.fieldErrors.pinCode}
                  aria-invalid={!!customerValidation.fieldErrors.pinCode}
                  aria-describedby={customerValidation.fieldErrors.pinCode ? "custEditPin-error" : undefined}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCustomerForm({ ...customerForm, pinCode: clean });
                    customerValidation.clearFieldError("pinCode");
                  }}
                  className="font-mono"
                />
                <FormFieldError id="custEditPin-error" error={customerValidation.fieldErrors.pinCode} />
              </div>
            </div>

            {/* Commercial Terms & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custEditLimit">Credit Limit (₹)</Label>
                <Input
                  id="custEditLimit"
                  name="creditLimit"
                  type="number"
                  placeholder="Empty for unrestricted"
                  value={customerForm.creditLimit}
                  error={!!customerValidation.fieldErrors.creditLimit}
                  aria-invalid={!!customerValidation.fieldErrors.creditLimit}
                  aria-describedby={customerValidation.fieldErrors.creditLimit ? "custEditLimit-error" : undefined}
                  onChange={(e) => {
                    setCustomerForm({ ...customerForm, creditLimit: e.target.value });
                    customerValidation.clearFieldError("creditLimit");
                  }}
                />
                <FormFieldError id="custEditLimit-error" error={customerValidation.fieldErrors.creditLimit} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custEditTerms">Payment Terms (Days)</Label>
                <Input
                  id="custEditTerms"
                  name="paymentTermsDays"
                  type="number"
                  placeholder="30"
                  value={customerForm.paymentTermsDays}
                  error={!!customerValidation.fieldErrors.paymentTermsDays}
                  aria-invalid={!!customerValidation.fieldErrors.paymentTermsDays}
                  aria-describedby={customerValidation.fieldErrors.paymentTermsDays ? "custEditTerms-error" : undefined}
                  onChange={(e) => {
                    setCustomerForm({ ...customerForm, paymentTermsDays: e.target.value });
                    customerValidation.clearFieldError("paymentTermsDays");
                  }}
                />
                <FormFieldError id="custEditTerms-error" error={customerValidation.fieldErrors.paymentTermsDays} />
              </div>

              <div className="space-y-1.5">
                <Label>Account Status</Label>
                <SearchableCombobox
                  options={[
                    { value: "true", label: "Active Account" },
                    { value: "false", label: "Inactive / Suspended" },
                  ]}
                  value={customerForm.isActive ? "true" : "false"}
                  onChange={(val) => {
                    setCustomerForm({ ...customerForm, isActive: val === "true" });
                  }}
                  allowClear={false}
                />
              </div>
            </div>

            {/* Notes / Internal Remarks */}
            <div className="space-y-1.5">
              <Label htmlFor="custEditNotes">Internal Operational Notes / Remarks</Label>
              <Textarea
                id="custEditNotes"
                name="notes"
                rows={2}
                placeholder="Special billing instructions, payment follow-up preferences, customer relationship notes..."
                value={customerForm.notes}
                error={!!customerValidation.fieldErrors.notes}
                aria-invalid={!!customerValidation.fieldErrors.notes}
                aria-describedby={customerValidation.fieldErrors.notes ? "custEditNotes-error" : undefined}
                onChange={(e) => {
                  setCustomerForm({ ...customerForm, notes: e.target.value });
                  customerValidation.clearFieldError("notes");
                }}
              />
              <FormFieldError id="custEditNotes-error" error={customerValidation.fieldErrors.notes} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditCustomerModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isCustomerSubmitting}
                loadingText="Saving Changes..."
                className="bg-[#0B1E36] hover:bg-[#071424] text-white"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

