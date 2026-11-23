"use client";

import * as React from "react";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { getCitiesForState, DEFAULT_CITY } from "@/lib/constants/geo-locations";

export interface CityComboboxProps {
  id?: string;
  value?: string | null;
  state?: string | null;
  onChange: (city: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function CityCombobox({
  id = "city",
  value = DEFAULT_CITY,
  state = "Tamil Nadu",
  onChange,
  placeholder = "Select or type City...",
  disabled = false,
  error = false,
  className,
  triggerClassName,
}: CityComboboxProps) {
  const cityOptions = React.useMemo<ComboboxOption[]>(() => {
    const cities = getCitiesForState(state || undefined);
    return cities.map((c) => ({
      value: c,
      label: c,
    }));
  }, [state]);

  return (
    <SearchableCombobox
      options={cityOptions}
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Search or type city..."
      emptyText="No preset city found. Type custom city name above."
      disabled={disabled}
      error={error}
      allowClear={true}
      allowCustomValue={true}
      showSearch={true}
      className={className}
      triggerClassName={triggerClassName}
    />
  );
}
