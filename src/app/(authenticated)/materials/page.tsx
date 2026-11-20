"use client";

import * as React from "react";
import {
  Layers,
  Plus,
  Search,
  IndianRupee,
  History,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Edit2,
  Power,
  RefreshCw,
  FolderPlus,
  FilePlus,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/loading-states";
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
import { BulkMaterialImportModal } from "@/components/materials/bulk-material-import-modal";
import { toast } from "sonner";

export default function MaterialsPage() {
  const [variants, setVariants] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [types, setTypes] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [seeding, setSeeding] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filters
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [selectedType, setSelectedType] = React.useState<string | null>(null);
  const [selectedSize, setSelectedSize] = React.useState<string | null>(null);
  const [ownershipFilter, setOwnershipFilter] = React.useState<string>("ALL");

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = React.useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = React.useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = React.useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = React.useState(false);
  const [activeVariantForRate, setActiveVariantForRate] = React.useState<any | null>(null);
  const [rateHistoryList, setRateHistoryList] = React.useState<any[]>([]);
  const [loadingRateHistory, setLoadingRateHistory] = React.useState(false);

  // Forms
  const [categoryForm, setCategoryForm] = React.useState({ categoryCode: "", name: "", description: "" });
  const [typeForm, setTypeForm] = React.useState({ categoryId: "", typeCode: "", name: "", description: "" });
  const [variantForm, setVariantForm] = React.useState({
    materialTypeId: "",
    materialCode: "",
    name: "",
    size: "",
    uom: "Nos.",
    defaultRentalRate: "",
    purchaseCost: "",
    replacementValue: "",
    minimumStock: "0",
    ownershipClassification: "OWNED",
  });
  const [rateForm, setRateForm] = React.useState({ rentalRate: "", reason: "" });

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [vRes, cRes, tRes] = await Promise.all([
        fetch("/api/v1/materials/variants"),
        fetch("/api/v1/materials/categories"),
        fetch("/api/v1/materials/types"),
      ]);
      const [vData, cData, tData] = await Promise.all([vRes.json(), cRes.json(), tRes.json()]);

      if (vData.success) setVariants(vData.data);
      if (cData.success) setCategories(cData.data);
      if (tData.success) setTypes(tData.data);
    } catch {
      toast.error("Failed to load material catalogue.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Seed Initial Catalogue handler
  const handleSeedInitial = async () => {
    try {
      setSeeding(true);
      const res = await fetch("/api/v1/materials/seed-initial", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to seed catalogue");
      toast.success(data.message);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSeeding(false);
    }
  };

  // Submit Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/v1/materials/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create category");
      toast.success(`Category '${data.data.name}' created.`);
      setIsCategoryModalOpen(false);
      setCategoryForm({ categoryCode: "", name: "", description: "" });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Type
  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/v1/materials/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(typeForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create material type");
      toast.success(`Material type '${data.data.name}' created.`);
      setIsTypeModalOpen(false);
      setTypeForm({ categoryId: "", typeCode: "", name: "", description: "" });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Variant
  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/v1/materials/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...variantForm,
          materialCode: variantForm.materialCode.trim() || "AUTO",
          defaultRentalRate: Number(variantForm.defaultRentalRate) || 0,
          purchaseCost: variantForm.purchaseCost ? Number(variantForm.purchaseCost) : null,
          replacementValue: variantForm.replacementValue ? Number(variantForm.replacementValue) : null,
          minimumStock: Number(variantForm.minimumStock) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create variant");
      toast.success(`Material variant '${data.data.name}' (${data.data.materialCode}) created.`);
      setIsVariantModalOpen(false);
      setVariantForm({
        materialTypeId: "",
        materialCode: "",
        name: "",
        size: "",
        uom: "Nos.",
        defaultRentalRate: "",
        purchaseCost: "",
        replacementValue: "",
        minimumStock: "0",
        ownershipClassification: "OWNED",
      });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Rate History Modal
  const handleOpenRateModal = async (variant: any) => {
    setActiveVariantForRate(variant);
    setIsRateModalOpen(true);
    setRateForm({ rentalRate: Number(variant.defaultRentalRate).toString(), reason: "" });
    try {
      setLoadingRateHistory(true);
      const res = await fetch(`/api/v1/materials/variants/${variant.id}`);
      const data = await res.json();
      if (data.success && data.data?.rateHistory) {
        setRateHistoryList(data.data.rateHistory);
      }
    } catch {
      toast.error("Failed to load rate history.");
    } finally {
      setLoadingRateHistory(false);
    }
  };

  // Submit Rate Update
  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVariantForRate) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/v1/materials/variants/${activeVariantForRate.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rateForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to update rate");
      toast.success(data.message);
      setIsRateModalOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (variant: any) => {
    try {
      const res = await fetch(`/api/v1/materials/variants/${variant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !variant.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to update status");
      toast.success(`Variant ${variant.materialCode} marked as ${!variant.isActive ? "Active" : "Inactive"}.`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Available distinct sizes for filter
  const availableSizes = React.useMemo(() => {
    const set = new Set<string>();
    variants.forEach((v) => {
      if (v.size && v.size.trim()) set.add(v.size.trim());
    });
    return Array.from(set).sort();
  }, [variants]);

  // Filtered variants
  const filteredVariants = React.useMemo(() => {
    return variants.filter((v) => {
      const matchesSearch =
        search === "" ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.materialCode.toLowerCase().includes(search.toLowerCase()) ||
        v.size.toLowerCase().includes(search.toLowerCase());

      const matchesCat =
        !selectedCategory || v.materialType?.categoryId === selectedCategory;

      const matchesType =
        !selectedType || v.materialTypeId === selectedType;

      const matchesSize =
        !selectedSize || v.size === selectedSize;

      const matchesOwnership =
        ownershipFilter === "ALL" || v.ownershipClassification === ownershipFilter;

      return matchesSearch && matchesCat && matchesType && matchesSize && matchesOwnership;
    });
  }, [variants, search, selectedCategory, selectedType, selectedSize, ownershipFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 break-words">
              Material Catalogue
            </h1>
            <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700 whitespace-nowrap">
              {variants.length} Variants
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Hierarchical centering & formwork master: Categories, Types, Dimensions, Rental Rates & Versioning
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedInitial}
            isLoading={seeding}
            loadingText="Seeding..."
            className="border-amber-300 bg-amber-50/50 hover:bg-amber-100/60 text-amber-900 text-xs font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
            Seed Initial Catalogue
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCategoryModalOpen(true)}
            className="text-xs border-slate-300"
          >
            <FolderPlus className="h-3.5 w-3.5 mr-1.5" /> Category
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTypeModalOpen(true)}
            className="text-xs border-slate-300"
          >
            <FilePlus className="h-3.5 w-3.5 mr-1.5" /> Type
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="border-blue-300 bg-blue-50/50 hover:bg-blue-100/60 text-blue-900 text-xs font-semibold"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
            Import Materials
          </Button>

          <Button
            size="sm"
            onClick={() => setIsVariantModalOpen(true)}
            className="bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Material Variant
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200 shadow-none bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search code, name, size..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Category Combobox */}
            <SearchableCombobox
              options={[
                { value: "", label: "All Categories" },
                ...categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                  sublabel: c.categoryCode,
                })),
              ]}
              value={selectedCategory || ""}
              onChange={(val) => {
                setSelectedCategory(val || null);
                setSelectedType(null);
              }}
              placeholder="Filter Category..."
              className="h-9 text-xs"
            />

            {/* Type Combobox */}
            <SearchableCombobox
              options={[
                { value: "", label: "All Material Types" },
                ...types
                  .filter((t) => !selectedCategory || t.categoryId === selectedCategory)
                  .map((t) => ({
                    value: t.id,
                    label: t.name,
                    sublabel: t.typeCode,
                  })),
              ]}
              value={selectedType || ""}
              onChange={(val) => setSelectedType(val || null)}
              placeholder="Filter Material Type..."
              className="h-9 text-xs"
            />

            {/* Size Combobox */}
            <SearchableCombobox
              options={[
                { value: "", label: "All Sizes" },
                ...availableSizes.map((s) => ({
                  value: s,
                  label: s,
                })),
              ]}
              value={selectedSize || ""}
              onChange={(val) => setSelectedSize(val || null)}
              placeholder="Filter Size..."
              className="h-9 text-xs"
            />

            {/* Ownership */}
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={ownershipFilter === "ALL" ? "default" : "outline"}
                onClick={() => setOwnershipFilter("ALL")}
                className={`h-9 flex-1 text-xs ${ownershipFilter === "ALL" ? "bg-[#0B1E36]" : ""}`}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={ownershipFilter === "OWNED" ? "default" : "outline"}
                onClick={() => setOwnershipFilter("OWNED")}
                className={`h-9 flex-1 text-xs ${ownershipFilter === "OWNED" ? "bg-[#0B1E36]" : ""}`}
              >
                Owned
              </Button>
              <Button
                size="sm"
                variant={ownershipFilter === "HIRED_IN" ? "default" : "outline"}
                onClick={() => setOwnershipFilter("HIRED_IN")}
                className={`h-9 flex-1 text-xs ${ownershipFilter === "HIRED_IN" ? "bg-[#0B1E36]" : ""}`}
              >
                Hired-In
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Materials Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Code</th>
                <th className="py-3 px-4 whitespace-nowrap">Material Variant</th>
                <th className="py-3 px-4 whitespace-nowrap">Size</th>
                <th className="py-3 px-4 whitespace-nowrap">Category / Type</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Daily Rental Rate</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Ownership</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <TableSkeleton columns={8} rows={8} />
              ) : filteredVariants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Layers className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No material variants found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click &quot;Seed Initial Catalogue&quot; or &quot;Material Variant&quot; to begin.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredVariants.map((v) => {
                  const rate = Number(v.defaultRentalRate);
                  const isUnconfirmed = rate === 0;

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {v.materialCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{v.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          UOM: {v.uom}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80">
                          {v.size || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">
                          {v.materialType?.name || "—"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {v.materialType?.category?.name || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isUnconfirmed ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-bold text-amber-700 font-mono">₹0.00 / day</span>
                            <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5">
                              Rate Unconfirmed
                            </span>
                          </div>
                        ) : (
                          <div className="font-bold text-slate-900 font-mono text-sm">
                            ₹{rate.toFixed(2)}
                            <span className="text-slate-400 text-xs font-normal"> / day</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={
                            v.ownershipClassification === "OWNED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold"
                              : "bg-blue-50 text-blue-800 border-blue-200 font-semibold"
                          }
                        >
                          {v.ownershipClassification}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={
                            v.isActive
                              ? "bg-slate-100 text-slate-700 border-slate-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }
                        >
                          {v.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenRateModal(v)}
                            className="h-7 text-xs border-slate-300 hover:bg-slate-100"
                            title="Rate Versioning History"
                          >
                            <History className="h-3 w-3 mr-1 text-[#F26522]" /> Rate History
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActive(v)}
                            className={`h-7 w-7 p-0 ${v.isActive ? "text-slate-400 hover:text-red-600" : "text-emerald-600"}`}
                            title={v.isActive ? "Deactivate Variant" : "Activate Variant"}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CREATE CATEGORY MODAL */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Material Category</DialogTitle>
            <DialogDescription>
              Create a top-level grouping (e.g. Centering Materials, Scaffolding, Formwork Accessories).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="catCode" required>Category Code</Label>
              <Input
                id="catCode"
                placeholder="e.g. CAT-CENTERING"
                value={categoryForm.categoryCode}
                onChange={(e) => setCategoryForm({ ...categoryForm, categoryCode: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="catName" required>Category Name</Label>
              <Input
                id="catName"
                placeholder="e.g. Centering Materials"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="catDesc">Description</Label>
              <Input
                id="catDesc"
                placeholder="Optional notes or details"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCategoryModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting} loadingText="Saving..." className="bg-[#0B1E36] hover:bg-[#071424] text-white">
                Save Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE TYPE MODAL */}
      <Dialog open={isTypeModalOpen} onOpenChange={setIsTypeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Material Type</DialogTitle>
            <DialogDescription>
              Group variants by equipment type (e.g. Props, Folding Sheets, Column Boxes).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateType} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label required>Parent Category</Label>
              <SearchableCombobox
                options={categories.map((c) => ({ value: c.id, label: c.name, sublabel: c.categoryCode }))}
                value={typeForm.categoryId}
                onChange={(val) => setTypeForm({ ...typeForm, categoryId: val })}
                placeholder="Select category..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="typeCode" required>Type Code</Label>
              <Input
                id="typeCode"
                placeholder="e.g. TYP-PROPS"
                value={typeForm.typeCode}
                onChange={(e) => setTypeForm({ ...typeForm, typeCode: e.target.value.toUpperCase() })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="typeName" required>Type Name</Label>
              <Input
                id="typeName"
                placeholder="e.g. Props / Column Boxes"
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsTypeModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting} loadingText="Saving..." className="bg-[#0B1E36] hover:bg-[#071424] text-white">
                Save Type
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE VARIANT MODAL */}
      <Dialog open={isVariantModalOpen} onOpenChange={setIsVariantModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Material Variant</DialogTitle>
            <DialogDescription>
              Define specific dimensions, unit of measurement, default rental rate, and ownership.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateVariant} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label required>Material Type</Label>
              <SearchableCombobox
                options={types.map((t) => ({
                  value: t.id,
                  label: `${t.name} (${t.category?.name || "Category"})`,
                  sublabel: t.typeCode,
                }))}
                value={variantForm.materialTypeId}
                onChange={(val) => setVariantForm({ ...variantForm, materialTypeId: val })}
                placeholder="Select material type..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="varCode">Material Code</Label>
                <Input
                  id="varCode"
                  placeholder="Leave blank to auto-generate"
                  value={variantForm.materialCode}
                  onChange={(e) => setVariantForm({ ...variantForm, materialCode: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="varName" required>Material Name</Label>
                <Input
                  id="varName"
                  placeholder="e.g. PROPS / FOLDING SHEET"
                  value={variantForm.name}
                  onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="varSize" required>Size / Variant Specification</Label>
                <Input
                  id="varSize"
                  placeholder="e.g. 7–12 ft / 3 × 2 ft"
                  value={variantForm.size}
                  onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="varUom" required>Unit of Measurement (UOM)</Label>
                <Input
                  id="varUom"
                  placeholder="Nos. / Set / Bundle"
                  value={variantForm.uom}
                  onChange={(e) => setVariantForm({ ...variantForm, uom: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="varRate" required>Default Daily Rental Rate (₹)</Label>
                <Input
                  id="varRate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 2.00"
                  value={variantForm.defaultRentalRate}
                  onChange={(e) => setVariantForm({ ...variantForm, defaultRentalRate: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label required>Ownership</Label>
                <SearchableCombobox
                  options={[
                    { value: "OWNED", label: "AJAY ENTERPRISES (Owned)" },
                    { value: "HIRED_IN", label: "Third-Party (Hired-In)" },
                  ]}
                  value={variantForm.ownershipClassification}
                  onChange={(val) => setVariantForm({ ...variantForm, ownershipClassification: val || "OWNED" })}
                  allowClear={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="purCost">Purchase Cost (₹)</Label>
                <Input
                  id="purCost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={variantForm.purchaseCost}
                  onChange={(e) => setVariantForm({ ...variantForm, purchaseCost: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="repVal">Replacement (₹)</Label>
                <Input
                  id="repVal"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={variantForm.replacementValue}
                  onChange={(e) => setVariantForm({ ...variantForm, replacementValue: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minStk">Min Stock Alert</Label>
                <Input
                  id="minStk"
                  type="number"
                  min="0"
                  value={variantForm.minimumStock}
                  onChange={(e) => setVariantForm({ ...variantForm, minimumStock: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsVariantModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting} loadingText="Creating Variant..." className="bg-[#0B1E36] hover:bg-[#071424] text-white">
                Create Variant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RATE HISTORY & VERSIONING MODAL */}
      <Dialog open={isRateModalOpen} onOpenChange={setIsRateModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-[#F26522]" />
              <span>Rental Rate History & Versioning</span>
            </DialogTitle>
            <DialogDescription>
              {activeVariantForRate?.name} ({activeVariantForRate?.materialCode}) • Current Rate:{" "}
              <strong className="text-slate-900 font-mono">
                ₹{Number(activeVariantForRate?.defaultRentalRate || 0).toFixed(2)}/day
              </strong>
            </DialogDescription>
          </DialogHeader>

          {/* New Rate Update Form */}
          <form onSubmit={handleUpdateRate} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Establish New Rental Rate Version
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="newRate" required>New Rental Rate (₹/day)</Label>
                <Input
                  id="newRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={rateForm.rentalRate}
                  onChange={(e) => setRateForm({ ...rateForm, rentalRate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rateReason" required>Reason for Change</Label>
                <Input
                  id="rateReason"
                  placeholder="e.g. Market revision / Confirmed rate"
                  value={rateForm.reason}
                  onChange={(e) => setRateForm({ ...rateForm, reason: e.target.value })}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              isLoading={isSubmitting}
              loadingText="Posting Revision..."
              className="w-full bg-[#0B1E36] hover:bg-[#071424] text-white text-xs font-semibold"
            >
              Post Rate Revision
            </Button>
          </form>

          {/* Version History Table */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Historical Rate Snapshots
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Effective From</th>
                    <th className="py-2 px-3">Rate</th>
                    <th className="py-2 px-3">Previous</th>
                    <th className="py-2 px-3">Reason</th>
                    <th className="py-2 px-3">Changed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingRateHistory ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                        Loading versions...
                      </td>
                    </tr>
                  ) : rateHistoryList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No previous rate versions recorded.
                      </td>
                    </tr>
                  ) : (
                    rateHistoryList.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-[11px] whitespace-nowrap">
                          {new Date(h.effectiveFrom).toLocaleDateString("en-IN")}
                        </td>
                        <td className="py-2 px-3 font-bold font-mono text-slate-900 whitespace-nowrap">
                          ₹{Number(h.rentalRate).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                          {h.previousRate ? `₹${Number(h.previousRate).toFixed(2)}` : "—"}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {h.reason || "—"}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {h.changedBy?.name || "System"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setIsRateModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Material Import Modal */}
      <BulkMaterialImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
}

