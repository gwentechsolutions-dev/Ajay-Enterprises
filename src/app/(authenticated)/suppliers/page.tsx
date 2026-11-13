"use client";

import * as React from "react";
import Link from "next/link";
import {
  Factory,
  Plus,
  Search,
  Phone,
  Building2,
  Mail,
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

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("ALL");
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    supplierCode: "",
    name: "",
    contactPerson: "",
    primaryMobile: "",
    alternateMobile: "",
    email: "",
    gstStatus: "UNREGISTERED",
    gstin: "",
    pan: "",
    billingAddress: "",
    state: "Karnataka",
    stateCode: "29",
    pinCode: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    supplierType: "MANUFACTURER",
    openingBalance: "0",
    creditTermsDays: "30",
    internalRemarks: "",
  });

  const fetchSuppliers = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/suppliers");
      const data = await res.json();
      if (data.success) setSuppliers(data.data);
    } catch {
      toast.error("Failed to load supplier directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          supplierCode: form.supplierCode.trim() || "AUTO",
          creditTermsDays: Number(form.creditTermsDays) || 30,
          openingBalance: Number(form.openingBalance) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create supplier");
      toast.success(`Supplier '${data.data.name}' (${data.data.supplierCode}) registered.`);
      setIsModalOpen(false);
      setForm({
        supplierCode: "",
        name: "",
        contactPerson: "",
        primaryMobile: "",
        alternateMobile: "",
        email: "",
        gstStatus: "UNREGISTERED",
        gstin: "",
        pan: "",
        billingAddress: "",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        supplierType: "MANUFACTURER",
        openingBalance: "0",
        creditTermsDays: "30",
        internalRemarks: "",
      });
      await fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filtered = React.useMemo(() => {
    return suppliers.filter((s) => {
      const matchesSearch =
        search === "" ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.supplierCode.toLowerCase().includes(search.toLowerCase()) ||
        s.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
        s.primaryMobile.includes(search) ||
        (s.gstin && s.gstin.toLowerCase().includes(search.toLowerCase()));

      const matchesType = typeFilter === "ALL" || s.supplierType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [suppliers, search, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Supplier Master
            </h1>
            <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700">
              {suppliers.length} Vendors
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Centering material manufacturers, equipment fabricators & hire-in vendors
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> + New Supplier
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200 shadow-none bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search vendor, code, contact person, mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <SearchableCombobox
              options={[
                { value: "ALL", label: "All Supplier Categories" },
                { value: "MANUFACTURER", label: "Formwork Manufacturer" },
                { value: "TRADER", label: "Material Trader / Stockist" },
                { value: "HIRE_VENDOR", label: "Third-Party Hire Vendor" },
                { value: "SERVICE_PROVIDER", label: "Fabrication & Repair Service" },
              ]}
              value={typeFilter}
              onChange={(val) => setTypeFilter(val || "ALL")}
              placeholder="Filter Supplier Type..."
              className="h-9 text-xs"
              allowClear={false}
            />
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Supplier Code</th>
                <th className="py-3 px-4">Vendor & Supplier Type</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">GST & State</th>
                <th className="py-3 px-4">Bank Details</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#0B1E36]" />
                    Loading suppliers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Factory className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No suppliers found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click &quot;+ New Supplier&quot; to register your centering material suppliers.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {s.supplierCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{s.supplierType}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{s.contactPerson}</div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">{s.primaryMobile}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-800">{s.gstin || "Unregistered"}</div>
                      <div className="text-[11px] text-slate-400">{s.state} ({s.stateCode})</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {s.bankName ? (
                        <div>
                          <div className="font-medium text-slate-800">{s.bankName}</div>
                          <div className="font-mono text-[11px] text-slate-500">A/C: ••••{s.accountNumber?.slice(-4)}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Not on file</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={
                          s.isActive
                            ? "bg-slate-100 text-slate-700 border-slate-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link href={`/suppliers/${s.id}`}>
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

      {/* CREATE SUPPLIER MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register New Supplier</DialogTitle>
            <DialogDescription>
              Add a centering material manufacturer or equipment vendor.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="supCode">Supplier Code</Label>
                <Input
                  id="supCode"
                  placeholder="Auto-generated if blank"
                  value={form.supplierCode}
                  onChange={(e) => setForm({ ...form, supplierCode: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label required>Supplier Type</Label>
                <SearchableCombobox
                  options={[
                    { value: "MANUFACTURER", label: "Formwork Manufacturer" },
                    { value: "TRADER", label: "Material Trader / Stockist" },
                    { value: "HIRE_VENDOR", label: "Third-Party Hire Vendor" },
                    { value: "SERVICE_PROVIDER", label: "Fabrication & Repair Service" },
                  ]}
                  value={form.supplierType}
                  onChange={(val) => setForm({ ...form, supplierType: val || "MANUFACTURER" })}
                  allowClear={false}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supName" required>Supplier / Company Name</Label>
              <Input
                id="supName"
                placeholder="e.g. Jindal Steel / National Scaffolding Works"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="supContact" required>Contact Person</Label>
                <Input
                  id="supContact"
                  placeholder="e.g. Rajesh Sharma"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supMobile" required>Primary Mobile</Label>
                <Input
                  id="supMobile"
                  placeholder="10 digits"
                  value={form.primaryMobile}
                  onChange={(e) => setForm({ ...form, primaryMobile: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="supGstin">GSTIN</Label>
                <Input
                  id="supGstin"
                  placeholder="15 digits"
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supPan">PAN</Label>
                <Input
                  id="supPan"
                  placeholder="10 digits"
                  value={form.pan}
                  onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supEmail">Email Address</Label>
                <Input
                  id="supEmail"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supAddress" required>Billing Address</Label>
              <Input
                id="supAddress"
                placeholder="Factory / Office Address"
                value={form.billingAddress}
                onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="supState" required>State</Label>
                <Input
                  id="supState"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supStateCode" required>State Code</Label>
                <Input
                  id="supStateCode"
                  value={form.stateCode}
                  onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supPin" required>PIN Code</Label>
                <Input
                  id="supPin"
                  placeholder="6 digits"
                  value={form.pinCode}
                  onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Bank details */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Bank & Payment Details (Optional)
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Bank Name"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  className="text-xs"
                />
                <Input
                  placeholder="Account Number"
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                  className="text-xs"
                />
                <Input
                  placeholder="IFSC Code"
                  value={form.ifscCode}
                  onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0B1E36] hover:bg-[#071424] text-white">
                Register Vendor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
