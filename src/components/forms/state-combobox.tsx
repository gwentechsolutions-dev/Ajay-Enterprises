"use client";

import * as React from "react";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { INDIAN_STATES, getStateCode } from "@/lib/constants/geo-locations";

export interface StateComboboxProps {
  id?: string;
  value?: string | null;
  onChange: (stateName: string, stateCode?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  triggerClassName?: string;
}

const STATE_OPTIONS: ComboboxOption[] = INDIAN_STATES.map((state) => ({
  value: state.name,
  label: state.name,
  badge: `GST: ${state.code}`,
  sublabel: state.isUnionTerritory ? "Union Territory" : undefined,
}));

export function StateCombobox({
  id = "state",
  value = "Tamil Nadu",
  onChange,
  placeholder = "Select State...",
  disabled = false,
  error = false,
  className,
  triggerClassName,
}: StateComboboxProps) {
  const handleChange = (selectedState: string) => {
    const code = getStateCode(selectedState);
    onChange(selectedState, code);
  };

  return (
    <SearchableCombobox
      options={STATE_OPTIONS}
      value={value || ""}
      onChange={handleChange}
      placeholder={placeholder}
      searchPlaceholder="Search Indian states / UTs..."
      emptyText="No state found."
      disabled={disabled}
      error={error}
      allowClear={false}
      showSearch={true}
      className={className}
      triggerClassName={triggerClassName}
    />
  );
}
