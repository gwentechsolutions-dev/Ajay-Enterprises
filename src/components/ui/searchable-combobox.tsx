"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  disabled?: boolean;
}

export interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  className?: string;
  triggerClassName?: string;
  allowClear?: boolean;
  isLoading?: boolean;
  allowCustomValue?: boolean;
  customBadge?: string;
}

export function SearchableCombobox({
  options = [],
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Type to search...",
  emptyText = "No matching items found.",
  disabled = false,
  error = false,
  className,
  triggerClassName,
  allowClear = true,
  isLoading = false,
  allowCustomValue = false,
  customBadge = "CUSTOM",
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Close when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-close if disabled or enclosing fieldset is disabled
  React.useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (isOpen) {
      if (disabled || Boolean(containerRef.current?.closest("fieldset:disabled"))) {
        setIsOpen(false);
        return;
      }
      if (searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    } else {
      setSearchQuery("");
    }
  }, [isOpen, disabled]);

  const selectedOption = options.find((opt) => opt.value === value);
  const isCustomValue = !selectedOption && !!value && allowCustomValue;

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(query)) ||
        (opt.badge && opt.badge.toLowerCase().includes(query))
    );
  }, [options, searchQuery]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          if (disabled || (e.currentTarget as HTMLButtonElement).disabled) return;
          setIsOpen(!isOpen);
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          error
            ? "border-red-500 focus:ring-red-500"
            : "border-slate-300 focus:border-primary-900 focus:ring-primary-900/20",
          isOpen && "ring-2 ring-primary-900/20 border-primary-900",
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1 text-left">
          {selectedOption ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-medium text-slate-900 truncate" title={selectedOption.label}>
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span className="hidden sm:inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shrink-0">
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : isCustomValue ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-medium text-slate-900 truncate" title={value}>
                {value}
              </span>
              <span className="rounded bg-orange-100 text-[#F26522] px-1.5 py-0.5 text-[10px] font-semibold shrink-0">
                {customBadge}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {allowClear && (selectedOption || isCustomValue) && !disabled && (
            <span
              onClick={handleClear}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-72 min-w-[280px] sm:min-w-[320px] w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95">
          {/* Search Box */}
          <div className="flex items-center border-b border-slate-100 px-3 py-2 bg-slate-50/50">
            <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1">
            {isLoading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-[#F26522]" />
                <span>Loading options...</span>
              </div>
            ) : (
              <>
                {allowCustomValue &&
                  searchQuery.trim() &&
                  !options.some(
                    (opt) =>
                      opt.label.toLowerCase() === searchQuery.trim().toLowerCase() ||
                      opt.value.toLowerCase() === searchQuery.trim().toLowerCase()
                  ) && (
                    <div
                      onClick={() => handleSelect(searchQuery.trim())}
                      className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-[#F26522] bg-orange-50/60 hover:bg-orange-100 cursor-pointer font-medium mb-1 border border-dashed border-orange-200 transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Use &ldquo;{searchQuery.trim()}&rdquo;</span>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/80 px-1.5 py-0.5 rounded border border-orange-200 shrink-0">
                        Custom
                      </span>
                    </div>
                  )}

                {filteredOptions.length === 0 &&
                !(
                  allowCustomValue &&
                  searchQuery.trim() &&
                  !options.some(
                    (opt) =>
                      opt.label.toLowerCase() === searchQuery.trim().toLowerCase() ||
                      opt.value.toLowerCase() === searchQuery.trim().toLowerCase()
                  )
                ) ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    {emptyText}
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => !opt.disabled && handleSelect(opt.value)}
                        className={cn(
                          "flex items-center justify-between rounded-md px-3 py-2 text-sm cursor-pointer select-none transition-colors",
                          opt.disabled
                            ? "cursor-not-allowed opacity-50 text-slate-400"
                            : isSelected
                            ? "bg-primary-50 text-primary-900 font-semibold"
                            : "text-slate-800 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        <div className="flex flex-col min-w-0 flex-1 pr-2">
                          <span className="font-medium truncate" title={opt.label}>{opt.label}</span>
                          {opt.sublabel && (
                            <span className="text-xs text-slate-500 font-normal truncate" title={opt.sublabel}>
                              {opt.sublabel}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {opt.badge && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary-900" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

