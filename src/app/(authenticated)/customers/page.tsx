"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users2,
  Plus,
  Search,
  Phone,
  Building2,
  FileText,
  MapPin,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

export default function CustomersPage() {
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [gstFilter, setGstFilter] = React.useState("ALL");
  const [typeFilter, setTypeFilter] = React.useState("ALL");
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    customerCode: "",
    name: "",
    customerType: "COMPANY",
    legalBusinessName: "",
    primaryMobile: "",
    alternateMobile: "",
    whatsappNumber: "",
    email: "",
    pan: "",
    gstStatus: "UNREGISTERED",
    gstin: "",
    billingAddress: "",
    state: "Karnataka",
    stateCode: "29",
    pinCode: "",
    businessType: "COMMERCIAL",
    creditLimit: "",
    paymentTermsDays: "30",
    openingBalance: "0",
    notes: "",
  });

  const fetchCustomers = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/customers");
      const data = await res.json();
      if (data.success) setCustomers(data.data);
    } catch {
      toast.error("Failed to load customer directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customerCode: form.customerCode.trim() || "AUTO",
          creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
          paymentTermsDays: Number(form.paymentTermsDays) || 30,
          openingBalance: Number(form.openingBalance) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create customer");
      toast.success(`Customer '${data.data.name}' (${data.data.customerCode}) created.`);
      setIsModalOpen(false);
      setForm({
        customerCode: "",
        name: "",
        customerType: "COMPANY",
        legalBusinessName: "",
        primaryMobile: "",
        alternateMobile: "",
        whatsappNumber: "",
        email: "",
        pan: "",
        gstStatus: "UNREGISTERED",
        gstin: "",
        billingAddress: "",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "",
        businessType: "COMMERCIAL",
        creditLimit: "",
        paymentTermsDays: "30",
        openingBalance: "0",
        notes: "",
      });
      await fetchCustomers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredCustomers = React.useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        search === "" ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.customerCode.toLowerCase().includes(search.toLowerCase()) ||
        c.primaryMobile.includes(search) ||
        (c.gstin && c.gstin.toLowerCase().includes(search.toLowerCase())) ||
        (c.pan && c.pan.toLowerCase().includes(search.toLowerCase()));

      const matchesGst =
        gstFilter === "ALL" || c.gstStatus === gstFilter;

      const matchesType =
        typeFilter === "ALL" || c.customerType === typeFilter;

      return matchesSearch && matchesGst && matchesType;
    });
  }, [customers, search, gstFilter, typeFilter]);

  const registeredCount = customers.filter((c) => c.gstStatus === "REGISTERED").length;
  const totalSitesCount = customers.reduce((acc, c) => acc + (c._count?.sites || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Customer Master
            </h1>
            <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700">
              {customers.length} Accounts
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Centering material rental clients, multi-site construction projects & billing accounts
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> + New Customer Account
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm p-4 bg-white flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
            <Users2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{customers.length}</div>
            <div className="text-xs text-slate-500">Total Customer Profiles</div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4 bg-white flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{registeredCount}</div>
            <div className="text-xs text-slate-500">GST-Registered Entities</div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4 bg-white flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{totalSitesCount}</div>
            <div className="text-xs text-slate-500">Active Construction Sites</div>
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200 shadow-none bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search name, code, mobile, GSTIN, PAN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <SearchableCombobox
              options={[
                { value: "ALL", label: "All GST Categories" },
                { value: "REGISTERED", label: "GST Registered" },
                { value: "UNREGISTERED", label: "Unregistered (Non-GST)" },
                { value: "COMPOSITION", label: "Composition Scheme" },
              ]}
              value={gstFilter}
              onChange={(val) => setGstFilter(val || "ALL")}
              placeholder="Filter GST Status..."
              className="h-9 text-xs"
              allowClear={false}
            />

            <SearchableCombobox
              options={[
                { value: "ALL", label: "All Customer Types" },
                { value: "COMPANY", label: "Company / Corporate" },
                { value: "CONTRACTOR", label: "Civil Contractor" },
                { value: "INDIVIDUAL", label: "Individual / Builder" },
              ]}
              value={typeFilter}
              onChange={(val) => setTypeFilter(val || "ALL")}
              placeholder="Filter Customer Type..."
              className="h-9 text-xs"
              allowClear={false}
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Customer ID</th>
                <th className="py-3 px-4">Client Name & Business Type</th>
                <th className="py-3 px-4">Contact Details</th>
                <th className="py-3 px-4">GST & PAN Compliance</th>
                <th className="py-3 px-4 text-center">Sites</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Users2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No customers found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click &quot;+ New Customer Account&quot; to register your first client.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {c.customerCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {c.customerType} • {c.businessType || "Standard"}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-slate-800">{c.primaryMobile}</div>
                      {c.email ? (
                        <div className="text-[11px] text-slate-400">{c.email}</div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={
                            c.gstStatus === "REGISTERED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }
                        >
                          {c.gstStatus}
                        </Badge>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 mt-1">
                        {c.gstin ? `GST: ${c.gstin}` : c.pan ? `PAN: ${c.pan}` : "Non-GST"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono">
                        {c._count?.sites || 0} Sites
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={
                          c.isActive
                            ? "bg-slate-100 text-slate-700 border-slate-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link href={`/customers/${c.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-slate-300 hover:bg-slate-100"
                        >
                          View Profile <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CREATE CUSTOMER MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Customer Account</DialogTitle>
            <DialogDescription>
              Register a contractor or client profile with tax compliance and credit details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitCustomer} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custCode">Customer ID</Label>
                <Input
                  id="custCode"
                  placeholder="Auto-generated if left blank"
                  value={form.customerCode}
                  onChange={(e) => setForm({ ...form, customerCode: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="space-y-1.5">
                <Label required>Customer Type</Label>
                <SearchableCombobox
                  options={[
                    { value: "COMPANY", label: "Company / Corporate Entity" },
                    { value: "CONTRACTOR", label: "Civil Contractor / Subcontractor" },
                    { value: "INDIVIDUAL", label: "Individual / Property Owner" },
                  ]}
                  value={form.customerType}
                  onChange={(val) => setForm({ ...form, customerType: val || "COMPANY" })}
                  allowClear={false}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="custName" required>Customer / Company Trade Name</Label>
              <Input
                id="custName"
                placeholder="e.g. Prestige Constructions Ltd / Sri Sai Builders"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custMobile" required>Primary Mobile</Label>
                <Input
                  id="custMobile"
                  placeholder="10 digits (9876543210)"
                  value={form.primaryMobile}
                  onChange={(e) => setForm({ ...form, primaryMobile: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custAlt">Alternate Mobile</Label>
                <Input
                  id="custAlt"
                  placeholder="Optional"
                  value={form.alternateMobile}
                  onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custEmail">Email Address</Label>
                <Input
                  id="custEmail"
                  type="email"
                  placeholder="billing@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label required>GST Registration</Label>
                <SearchableCombobox
                  options={[
                    { value: "REGISTERED", label: "Registered (Regular)" },
                    { value: "UNREGISTERED", label: "Unregistered (Non-GST)" },
                    { value: "COMPOSITION", label: "Composition Dealer" },
                  ]}
                  value={form.gstStatus}
                  onChange={(val) => setForm({ ...form, gstStatus: val || "UNREGISTERED" })}
                  allowClear={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custGstin">GSTIN</Label>
                <Input
                  id="custGstin"
                  placeholder="15-digit GSTIN"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custPan">PAN</Label>
                <Input
                  id="custPan"
                  placeholder="10-digit PAN"
                  value={form.pan}
                  onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="custBilling" required>Billing Address</Label>
              <Input
                id="custBilling"
                placeholder="Full registered billing address"
                value={form.billingAddress}
                onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custState" required>State</Label>
                <Input
                  id="custState"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custStateCode" required>State Code</Label>
                <Input
                  id="custStateCode"
                  value={form.stateCode}
                  onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custPin">PIN Code</Label>
                <Input
                  id="custPin"
                  placeholder="6 digits"
                  value={form.pinCode}
                  onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custLimit">Credit Limit (₹)</Label>
                <Input
                  id="custLimit"
                  type="number"
                  placeholder="e.g. 500000"
                  value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custTerms">Payment Terms (Days)</Label>
                <Input
                  id="custTerms"
                  type="number"
                  value={form.paymentTermsDays}
                  onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0B1E36] hover:bg-[#071424] text-white">
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

