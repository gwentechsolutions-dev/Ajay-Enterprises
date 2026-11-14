"use client";

import * as React from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  companyProfileSchema,
  CompanyProfileInput,
  companyAddressSchema,
  CompanyAddressInput,
  bankAccountSchema,
  BankAccountInput,
  signatorySchema,
  SignatoryInput,
} from "@/lib/schemas/company";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  Building2,
  MapPin,
  Landmark,
  FileCheck2,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Eye,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

const ENTITY_TYPES = [
  { value: "PROPRIETORSHIP", label: "Sole Proprietorship" },
  { value: "PARTNERSHIP", label: "Partnership Firm" },
  { value: "PVT_LTD", label: "Private Limited Company" },
  { value: "LLP", label: "Limited Liability Partnership (LLP)" },
  { value: "LTD", label: "Public Limited Company" },
  { value: "OTHER", label: "Other" },
];

const GST_TYPES = [
  { value: "REGULAR", label: "Regular GST Registered" },
  { value: "COMPOSITION", label: "Composition Scheme Dealer" },
  { value: "UNREGISTERED", label: "Unregistered / Non-GST" },
];

const ADDRESS_TYPES = [
  { value: "REGISTERED", label: "Registered Office" },
  { value: "HEAD_OFFICE", label: "Head Office" },
  { value: "YARD", label: "Primary Centering Yard" },
  { value: "BILLING", label: "Billing Address" },
  { value: "CORRESPONDENCE", label: "Correspondence Address" },
];

const ACCOUNT_TYPES = [
  { value: "CURRENT", label: "Current Account" },
  { value: "SAVINGS", label: "Savings Account" },
  { value: "OVERDRAFT", label: "Overdraft (OD / CC) Account" },
];

export default function CompanyProfilePage() {
  const [activeTab, setActiveTab] = React.useState("basic");
  const [loading, setLoading] = React.useState(true);
  const [company, setCompany] = React.useState<any>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Address Dialog state
  const [addressModalOpen, setAddressModalOpen] = React.useState(false);
  // Bank Account Dialog state
  const [bankModalOpen, setBankModalOpen] = React.useState(false);
  // Signatory Dialog state
  const [signatoryModalOpen, setSignatoryModalOpen] = React.useState(false);

  // Profile Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CompanyProfileInput>({
    resolver: zodResolver(companyProfileSchema),
  });

  const selectedEntityType = watch("entityType");
  const selectedGstType = watch("gstType");

  // Address Form
  const addressForm = useForm<CompanyAddressInput>({
    resolver: zodResolver(companyAddressSchema),
    defaultValues: {
      addressType: "REGISTERED",
      country: "India",
      stateCode: "29",
      state: "Karnataka",
      isDefaultBilling: true,
      isDefaultCorrespondence: true,
    },
  });

  // Bank Form
  const bankForm = useForm<BankAccountInput>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      accountType: "CURRENT",
      isPrimary: true,
      isActive: true,
    },
  });

  // Signatory Form
  const signatoryForm = useForm<SignatoryInput>({
    resolver: zodResolver(signatorySchema),
    defaultValues: {
      isDefault: true,
      isActive: true,
      validFrom: new Date().toISOString().split("T")[0],
    },
  });

  const fetchCompany = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/company");
      const json = await res.json();
      if (json.success && json.data) {
        setCompany(json.data);
        reset({
          legalName: json.data.legalName || "AJAY ENTERPRISES",
          tradeName: json.data.tradeName || "AJAY ENTERPRISES",
          entityType: json.data.entityType || "PROPRIETORSHIP",
          establishmentDate: json.data.establishmentDate
            ? new Date(json.data.establishmentDate).toISOString().split("T")[0]
            : "",
          businessCategory: json.data.businessCategory || "Construction Centering Material Rental & Formwork Equipment",
          description: json.data.description || "",
          website: json.data.website || "",
          primaryMobile: json.data.primaryMobile || "",
          alternateMobile: json.data.alternateMobile || "",
          whatsappNumber: json.data.whatsappNumber || "",
          officialEmail: json.data.officialEmail || "",
          alternateEmail: json.data.alternateEmail || "",
          contactPerson: json.data.contactPerson || "",
          telephone: json.data.telephone || "",
          pan: json.data.pan || "",
          gstin: json.data.gstin || "",
          gstLegalName: json.data.gstLegalName || "",
          gstTradeName: json.data.gstTradeName || "",
          gstType: json.data.gstType || "REGULAR",
          gstState: json.data.gstState || "Karnataka",
          gstStateCode: json.data.gstStateCode || "29",
          gstRegistrationDate: json.data.gstRegistrationDate
            ? new Date(json.data.gstRegistrationDate).toISOString().split("T")[0]
            : "",
          logoAssetUrl: json.data.logoAssetUrl || "",
        });
      }
    } catch {
      toast.error("Failed to load company profile");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  React.useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  // Handle Profile Save
  const onSaveProfile = async (values: CompanyProfileInput) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message || "Failed to update profile");
        return;
      }
      toast.success("AJAY ENTERPRISES profile updated successfully");
      fetchCompany();
    } catch {
      toast.error("Network error while saving profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Address
  const onAddAddress = async (values: CompanyAddressInput) => {
    try {
      const res = await fetch("/api/v1/company/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message || "Failed to add address");
        return;
      }
      toast.success("Address added successfully");
      setAddressModalOpen(false);
      addressForm.reset();
      fetchCompany();
    } catch {
      toast.error("Failed to add address");
    }
  };

  // Handle Delete Address
  const onDeleteAddress = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      const res = await fetch(`/api/v1/company/addresses?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Address deleted");
        fetchCompany();
      }
    } catch {
      toast.error("Failed to delete address");
    }
  };

  // Handle Add Bank Account
  const onAddBank = async (values: BankAccountInput) => {
    try {
      const res = await fetch("/api/v1/company/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message || "Failed to add bank account");
        return;
      }
      toast.success("Bank account added successfully");
      setBankModalOpen(false);
      bankForm.reset();
      fetchCompany();
    } catch {
      toast.error("Failed to add bank account");
    }
  };

  // Handle Delete Bank Account
  const onDeleteBank = async (id: string) => {
    if (!confirm("Are you sure you want to remove this bank account?")) return;
    try {
      const res = await fetch(`/api/v1/company/bank-accounts?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Bank account removed");
        fetchCompany();
      }
    } catch {
      toast.error("Failed to delete bank account");
    }
  };

  // Handle Add Signatory
  const onAddSignatory = async (values: SignatoryInput) => {
    try {
      const res = await fetch("/api/v1/company/signatories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message || "Failed to add signatory");
        return;
      }
      toast.success("Signatory saved successfully");
      setSignatoryModalOpen(false);
      signatoryForm.reset();
      fetchCompany();
    } catch {
      toast.error("Failed to add signatory");
    }
  };

  // Handle Delete Signatory
  const onDeleteSignatory = async (id: string) => {
    if (!confirm("Remove this signatory?")) return;
    try {
      const res = await fetch(`/api/v1/company/signatories?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Signatory removed");
        fetchCompany();
      }
    } catch {
      toast.error("Failed to delete signatory");
    }
  };

  // Handle File Upload Helper
  const handleFileUpload = async (file: File, folder: string, onUploaded: (url: string) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    try {
      const res = await fetch("/api/v1/storage/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.data?.fileUrl) {
        onUploaded(data.data.fileUrl);
        toast.success("File uploaded successfully");
      } else {
        toast.error(data.error?.message || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4" />
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Company Profile & Statutory Setup
            </h1>
            <Badge variant="outline" className="bg-primary-50 text-primary-900 border-primary-200">
              AJAY ENTERPRISES
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure legal trading identity, addresses, GST credentials, collection bank accounts, and document signatories.
          </p>
        </div>

        <Button
          onClick={handleSubmit(onSaveProfile)}
          isLoading={isSubmitting}
          className="bg-accent-500 hover:bg-accent-600 text-white font-semibold text-xs"
        >
          Save All Changes
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="basic" className="gap-2 text-xs">
            <Building2 className="h-3.5 w-3.5" /> Basic & Contact
          </TabsTrigger>
          <TabsTrigger value="addresses" className="gap-2 text-xs">
            <MapPin className="h-3.5 w-3.5" /> Address Book ({company?.addresses?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="tax" className="gap-2 text-xs">
            <FileCheck2 className="h-3.5 w-3.5" /> GST & Tax Profile
          </TabsTrigger>
          <TabsTrigger value="banking" className="gap-2 text-xs">
            <Landmark className="h-3.5 w-3.5" /> Bank Accounts ({company?.bankAccounts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="signatories" className="gap-2 text-xs">
            <ShieldAlert className="h-3.5 w-3.5" /> Signatures & Seal ({company?.signatories?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------------------------- */}
        {/* TAB 1: BASIC INFORMATION & CONTACT CHANNELS */}
        {/* -------------------------------------------------------------------- */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Legal & Business Identity</CardTitle>
              <CardDescription>
                Primary operating identity for AJAY ENTERPRISES used across invoices and legal rental agreements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="legalName" required>Legal Business Name</Label>
                  <Input id="legalName" {...register("legalName")} error={!!errors.legalName} />
                  {errors.legalName && <p className="text-xs text-red-600">{errors.legalName.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tradeName" required>Trade / Operating Name</Label>
                  <Input id="tradeName" {...register("tradeName")} error={!!errors.tradeName} />
                  {errors.tradeName && <p className="text-xs text-red-600">{errors.tradeName.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label required>Entity Constitution</Label>
                  <SearchableCombobox
                    options={ENTITY_TYPES}
                    value={selectedEntityType}
                    onChange={(val) => setValue("entityType", val as any)}
                    placeholder="Select entity type..."
                  />
                  {errors.entityType && <p className="text-xs text-red-600">{errors.entityType.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="establishmentDate">Establishment Date</Label>
                  <Input id="establishmentDate" type="date" {...register("establishmentDate")} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" placeholder="https://ajayenterprises.com" {...register("website")} error={!!errors.website} />
                  {errors.website && <p className="text-xs text-red-600">{errors.website.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="businessCategory">Business Category & Domain</Label>
                <Input id="businessCategory" {...register("businessCategory")} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Business Overview</Label>
                <Textarea id="description" placeholder="Brief description of operations..." {...register("description")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Official Contact Channels</CardTitle>
              <CardDescription>
                Customer-facing contact information for automated WhatsApp document delivery and communications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="primaryMobile" required>Primary Mobile (Calls)</Label>
                  <Input id="primaryMobile" placeholder="9876543210" {...register("primaryMobile")} error={!!errors.primaryMobile} />
                  {errors.primaryMobile && <p className="text-xs text-red-600">{errors.primaryMobile.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="whatsappNumber" required>WhatsApp Business Number</Label>
                  <Input id="whatsappNumber" placeholder="9876543210" {...register("whatsappNumber")} error={!!errors.whatsappNumber} />
                  {errors.whatsappNumber && <p className="text-xs text-red-600">{errors.whatsappNumber.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="alternateMobile">Alternate Mobile</Label>
                  <Input id="alternateMobile" placeholder="Optional" {...register("alternateMobile")} error={!!errors.alternateMobile} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="officialEmail" required>Official Billing Email</Label>
                  <Input id="officialEmail" type="email" placeholder="billing@ajayenterprises.com" {...register("officialEmail")} error={!!errors.officialEmail} />
                  {errors.officialEmail && <p className="text-xs text-red-600">{errors.officialEmail.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contactPerson" required>Primary Contact Person</Label>
                  <Input id="contactPerson" placeholder="e.g. Ajay Sharma" {...register("contactPerson")} error={!!errors.contactPerson} />
                  {errors.contactPerson && <p className="text-xs text-red-600">{errors.contactPerson.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="telephone">Telephone / Landline</Label>
                  <Input id="telephone" placeholder="Optional" {...register("telephone")} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------------------------- */}
        {/* TAB 2: ADDRESS BOOK */}
        {/* -------------------------------------------------------------------- */}
        <TabsContent value="addresses" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900">Registered & Operating Addresses</h3>
              <p className="text-xs text-slate-500">Configure headquarters, storage yards, and billing addresses.</p>
            </div>
            <Button
              size="sm"
              onClick={() => setAddressModalOpen(true)}
              className="bg-primary-900 hover:bg-primary-800 text-white gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Address
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {company?.addresses?.map((addr: any) => (
              <Card key={addr.id} className="relative p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-semibold text-xs text-primary-900 bg-primary-50">
                      {addr.addressType.replace("_", " ")}
                    </Badge>
                    {addr.isDefaultBilling && (
                      <Badge variant="success" className="text-[10px]">Default Billing</Badge>
                    )}
                    {addr.isDefaultCorrespondence && (
                      <Badge variant="secondary" className="text-[10px]">Default Correspondence</Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteAddress(addr.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 text-xs text-slate-700 space-y-1">
                  <p className="font-semibold text-slate-900">{addr.addressLine1}</p>
                  {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                  <p>{addr.city}, {addr.district}, {addr.state} - <span className="font-mono font-bold">{addr.pinCode}</span></p>
                  <p className="text-slate-400">State Code: {addr.stateCode} | {addr.country}</p>
                </div>
              </Card>
            ))}

            {(!company?.addresses || company.addresses.length === 0) && (
              <div className="col-span-2 py-8 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-white">
                No addresses added yet. Click &quot;Add Address&quot; to configure the registered office.
              </div>
            )}
          </div>
        </TabsContent>

        {/* -------------------------------------------------------------------- */}
        {/* TAB 3: GST & TAX PROFILE */}
        {/* -------------------------------------------------------------------- */}
        <TabsContent value="tax" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Goods & Services Tax (GST) & PAN Registration</CardTitle>
              <CardDescription>
                Statutory tax parameters required for Rule 46 GST invoices and FYN Gateway E-Way Bill generation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pan">Permanent Account Number (PAN)</Label>
                  <Input
                    id="pan"
                    placeholder="ABCDE1234F"
                    className="uppercase font-mono"
                    {...register("pan")}
                    error={!!errors.pan}
                  />
                  {errors.pan && <p className="text-xs text-red-600">{errors.pan.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>GST Registration Status</Label>
                  <SearchableCombobox
                    options={GST_TYPES}
                    value={selectedGstType}
                    onChange={(val) => setValue("gstType", val as any)}
                    placeholder="Select GST status..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gstin">GSTIN (15 Digits)</Label>
                  <Input
                    id="gstin"
                    placeholder="29ABCDE1234F1Z5"
                    className="uppercase font-mono font-semibold"
                    {...register("gstin")}
                    error={!!errors.gstin}
                  />
                  {errors.gstin && <p className="text-xs text-red-600">{errors.gstin.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gstRegistrationDate">GST Effective Registration Date</Label>
                  <Input id="gstRegistrationDate" type="date" {...register("gstRegistrationDate")} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gstLegalName">Legal Name on GST Certificate</Label>
                  <Input id="gstLegalName" placeholder="As per GST Portal" {...register("gstLegalName")} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gstTradeName">Trade Name on GST Certificate</Label>
                  <Input id="gstTradeName" placeholder="As per GST Portal" {...register("gstTradeName")} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gstState">Registered GST State</Label>
                  <Input id="gstState" placeholder="e.g. Karnataka" {...register("gstState")} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gstStateCode">State Code (2 Digits)</Label>
                  <Input id="gstStateCode" placeholder="29" maxLength={2} className="font-mono" {...register("gstStateCode")} error={!!errors.gstStateCode} />
                  {errors.gstStateCode && <p className="text-xs text-red-600">{errors.gstStateCode.message}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------------------------- */}
        {/* TAB 4: BANK ACCOUNTS */}
        {/* -------------------------------------------------------------------- */}
        <TabsContent value="banking" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900">Collection Bank Accounts</h3>
              <p className="text-xs text-slate-500">Bank accounts printed on customer invoices for NEFT/RTGS and UPI collections.</p>
            </div>
            <Button
              size="sm"
              onClick={() => setBankModalOpen(true)}
              className="bg-primary-900 hover:bg-primary-800 text-white gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Bank Account
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {company?.bankAccounts?.map((bank: any) => (
              <Card key={bank.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{bank.bankName}</span>
                    {bank.isPrimary && (
                      <Badge variant="success" className="text-[10px]">Primary Collection</Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteBank(bank.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Beneficiary:</span>
                    <span className="font-medium text-slate-900">{bank.accountHolderName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account No:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {bank.accountNumberMasked || bank.accountNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">IFSC Code:</span>
                    <span className="font-mono text-slate-900">{bank.ifscCode}</span>
                  </div>
                  {bank.upiId && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">UPI ID:</span>
                      <span className="font-mono text-primary-900">{bank.upiId}</span>
                    </div>
                  )}
                  {bank.branchName && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Branch:</span>
                      <span>{bank.branchName}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}

            {(!company?.bankAccounts || company.bankAccounts.length === 0) && (
              <div className="col-span-2 py-8 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-white">
                No bank accounts registered. Add a primary collection account for invoice footers.
              </div>
            )}
          </div>
        </TabsContent>

        {/* -------------------------------------------------------------------- */}
        {/* TAB 5: SIGNATURES & STAMP ASSETS */}
        {/* -------------------------------------------------------------------- */}
        <TabsContent value="signatories" className="space-y-4">
          <Alert variant="info" className="border-blue-200 bg-blue-50/70 text-xs text-blue-900">
            <Info className="h-4 w-4 text-blue-700" />
            <div className="ml-2">
              <p className="font-semibold text-blue-950">Statutory Notice on Digital Signatures</p>
              <AlertDescription className="text-blue-800 mt-0.5">
                Uploaded signature and stamp images are visual document elements only. They do not substitute for CCA-compliant Aadhaar eSign or Class-3 Digital Signature Certificates (DSC) under the Information Technology Act.
              </AlertDescription>
            </div>
          </Alert>

          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900">Authorized Signatories & Official Seals</h3>
              <p className="text-xs text-slate-500">Manage signatory images and company stamps overlayed on Delivery Notes and Invoices.</p>
            </div>
            <Button
              size="sm"
              onClick={() => setSignatoryModalOpen(true)}
              className="bg-primary-900 hover:bg-primary-800 text-white gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Signatory
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {company?.signatories?.map((sig: any) => (
              <Card key={sig.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{sig.name}</h4>
                    <p className="text-xs text-slate-500">{sig.designation}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {sig.isDefault && <Badge variant="success" className="text-[10px]">Default Signatory</Badge>}
                    <button
                      type="button"
                      onClick={() => onDeleteSignatory(sig.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Signature Preview</span>
                    <div className="mt-1 h-16 w-full rounded-lg border border-slate-200 bg-slate-50/50 p-1 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sig.signatureAssetUrl}
                        alt="Signature"
                        className="max-h-14 max-w-full object-contain"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Official Stamp</span>
                    <div className="mt-1 h-16 w-full rounded-lg border border-slate-200 bg-slate-50/50 p-1 flex items-center justify-center overflow-hidden">
                      {sig.stampAssetUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={sig.stampAssetUrl}
                          alt="Stamp"
                          className="max-h-14 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No stamp attached</span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-3">
                  Valid from: {formatDate(sig.validFrom)}
                </p>
              </Card>
            ))}

            {(!company?.signatories || company.signatories.length === 0) && (
              <div className="col-span-2 py-8 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-white">
                No signatories configured. Upload authorized signature PNG images for Delivery Notes and Invoices.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ---------------------------------------------------------------------- */}
      {/* ADD ADDRESS MODAL */}
      {/* ---------------------------------------------------------------------- */}
      <Dialog open={addressModalOpen} onOpenChange={setAddressModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Company Address</DialogTitle>
            <DialogDescription>
              Record an official address for AJAY ENTERPRISES
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addressForm.handleSubmit(onAddAddress)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label required>Address Type</Label>
              <SearchableCombobox
                options={ADDRESS_TYPES}
                value={addressForm.watch("addressType")}
                onChange={(val) => addressForm.setValue("addressType", val as any)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addressLine1" required>Address Line 1</Label>
              <Input id="addressLine1" placeholder="Building, Street, Plot No." {...addressForm.register("addressLine1")} error={!!addressForm.formState.errors.addressLine1} />
              {addressForm.formState.errors.addressLine1 && <p className="text-xs text-red-600">{addressForm.formState.errors.addressLine1.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input id="addressLine2" placeholder="Floor, Area, Landmark" {...addressForm.register("addressLine2")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city" required>City</Label>
                <Input id="city" placeholder="Bengaluru" {...addressForm.register("city")} error={!!addressForm.formState.errors.city} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="district" required>District</Label>
                <Input id="district" placeholder="Bengaluru Urban" {...addressForm.register("district")} error={!!addressForm.formState.errors.district} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="state" required>State</Label>
                <Input id="state" placeholder="Karnataka" {...addressForm.register("state")} error={!!addressForm.formState.errors.state} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stateCode" required>Code</Label>
                <Input id="stateCode" placeholder="29" maxLength={2} className="font-mono" {...addressForm.register("stateCode")} error={!!addressForm.formState.errors.stateCode} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pinCode" required>PIN Code</Label>
                <Input id="pinCode" placeholder="560001" maxLength={6} className="font-mono" {...addressForm.register("pinCode")} error={!!addressForm.formState.errors.pinCode} />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" {...addressForm.register("isDefaultBilling")} className="rounded text-primary-900" />
                <span>Default Billing Address</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" {...addressForm.register("isDefaultCorrespondence")} className="rounded text-primary-900" />
                <span>Default Correspondence</span>
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddressModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={addressForm.formState.isSubmitting} loadingText="Saving Address..." className="bg-primary-900 text-white">Save Address</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------------- */}
      {/* ADD BANK ACCOUNT MODAL */}
      {/* ---------------------------------------------------------------------- */}
      <Dialog open={bankModalOpen} onOpenChange={setBankModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Collection Bank Account</DialogTitle>
            <DialogDescription>
              Register a business bank account for customer payments
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={bankForm.handleSubmit(onAddBank)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bankName" required>Bank Name</Label>
                <Input id="bankName" placeholder="e.g. HDFC Bank" {...bankForm.register("bankName")} error={!!bankForm.formState.errors.bankName} />
                {bankForm.formState.errors.bankName && <p className="text-xs text-red-600">{bankForm.formState.errors.bankName.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="accountHolderName" required>Account Beneficiary</Label>
                <Input id="accountHolderName" placeholder="AJAY ENTERPRISES" {...bankForm.register("accountHolderName")} error={!!bankForm.formState.errors.accountHolderName} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="accountNumber" required>Account Number</Label>
                <Input id="accountNumber" type="password" placeholder="••••••••••••" {...bankForm.register("accountNumber")} error={!!bankForm.formState.errors.accountNumber} />
                {bankForm.formState.errors.accountNumber && <p className="text-xs text-red-600">{bankForm.formState.errors.accountNumber.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmAccountNumber" required>Confirm Account Number</Label>
                <Input id="confirmAccountNumber" placeholder="Re-enter Account No" {...bankForm.register("confirmAccountNumber")} error={!!bankForm.formState.errors.confirmAccountNumber} />
                {bankForm.formState.errors.confirmAccountNumber && <p className="text-xs text-red-600">{bankForm.formState.errors.confirmAccountNumber.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ifscCode" required>IFSC Code</Label>
                <Input id="ifscCode" placeholder="HDFC0001234" className="uppercase font-mono" {...bankForm.register("ifscCode")} error={!!bankForm.formState.errors.ifscCode} />
                {bankForm.formState.errors.ifscCode && <p className="text-xs text-red-600">{bankForm.formState.errors.ifscCode.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Account Type</Label>
                <SearchableCombobox
                  options={ACCOUNT_TYPES}
                  value={bankForm.watch("accountType")}
                  onChange={(val) => bankForm.setValue("accountType", val as any)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="branchName">Branch Name</Label>
                <Input id="branchName" placeholder="Main Branch" {...bankForm.register("branchName")} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="upiId">Collection UPI ID</Label>
                <Input id="upiId" placeholder="ajayenterprises@hdfcbank" {...bankForm.register("upiId")} error={!!bankForm.formState.errors.upiId} />
                {bankForm.formState.errors.upiId && <p className="text-xs text-red-600">{bankForm.formState.errors.upiId.message}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="isPrimary" {...bankForm.register("isPrimary")} className="rounded text-primary-900" />
              <Label htmlFor="isPrimary" className="text-xs font-normal cursor-pointer">
                Set as Primary Collection Account (Shown on Invoices)
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBankModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={bankForm.formState.isSubmitting} loadingText="Saving Bank Account..." className="bg-primary-900 text-white">Save Bank Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------------- */}
      {/* ADD SIGNATORY MODAL */}
      {/* ---------------------------------------------------------------------- */}
      <Dialog open={signatoryModalOpen} onOpenChange={setSignatoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Authorized Signatory</DialogTitle>
            <DialogDescription>
              Upload authorized signature image and official stamp
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={signatoryForm.handleSubmit(onAddSignatory)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sigName" required>Signatory Full Name</Label>
                <Input id="sigName" placeholder="e.g. Ajay Sharma" {...signatoryForm.register("name")} error={!!signatoryForm.formState.errors.name} />
                {signatoryForm.formState.errors.name && <p className="text-xs text-red-600">{signatoryForm.formState.errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sigDesignation" required>Designation</Label>
                <Input id="sigDesignation" placeholder="e.g. Proprietor" {...signatoryForm.register("designation")} error={!!signatoryForm.formState.errors.designation} />
              </div>
            </div>

            {/* Signature Upload */}
            <div className="space-y-1.5">
              <Label required>Signature Image (Transparent PNG / JPEG)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      handleFileUpload(f, "signatures", (url) => signatoryForm.setValue("signatureAssetUrl", url));
                    }
                  }}
                />
              </div>
              <input type="hidden" {...signatoryForm.register("signatureAssetUrl")} />
              {signatoryForm.watch("signatureAssetUrl") && (
                <div className="mt-2 p-2 border rounded-lg bg-slate-50 flex items-center justify-between">
                  <span className="text-xs text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Signature Uploaded
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signatoryForm.watch("signatureAssetUrl")} alt="Uploaded" className="h-8 max-w-[120px] object-contain" />
                </div>
              )}
              {signatoryForm.formState.errors.signatureAssetUrl && (
                <p className="text-xs text-red-600">{signatoryForm.formState.errors.signatureAssetUrl.message}</p>
              )}
            </div>

            {/* Stamp Upload */}
            <div className="space-y-1.5">
              <Label>Company Stamp / Seal Image (Optional)</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    handleFileUpload(f, "stamps", (url) => signatoryForm.setValue("stampAssetUrl", url));
                  }
                }}
              />
              <input type="hidden" {...signatoryForm.register("stampAssetUrl")} />
              {signatoryForm.watch("stampAssetUrl") && (
                <div className="mt-2 p-2 border rounded-lg bg-slate-50 flex items-center justify-between">
                  <span className="text-xs text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Stamp Uploaded
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signatoryForm.watch("stampAssetUrl") || ""} alt="Stamp" className="h-8 max-w-[120px] object-contain" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="validFrom" required>Valid From</Label>
                <Input id="validFrom" type="date" {...signatoryForm.register("validFrom")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="validUntil">Valid Until (Optional)</Label>
                <Input id="validUntil" type="date" {...signatoryForm.register("validUntil")} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="isDefaultSig" {...signatoryForm.register("isDefault")} className="rounded text-primary-900" />
              <Label htmlFor="isDefaultSig" className="text-xs font-normal cursor-pointer">
                Set as Default Signatory for Delivery Notes and Invoices
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSignatoryModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={signatoryForm.formState.isSubmitting} loadingText="Saving Signatory..." className="bg-primary-900 text-white">Save Signatory</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

