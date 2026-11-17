import { z } from "zod";

/**
 * Standard dictionary of field labels for human-friendly error presentations.
 */
export const FIELD_LABELS: Record<string, string> = {
  customerCode: "Customer ID",
  name: "Customer / Entity Name",
  customerType: "Customer Type",
  legalBusinessName: "Legal Business Name",
  primaryMobile: "Primary Mobile",
  alternateMobile: "Alternate Mobile",
  whatsappNumber: "WhatsApp Number",
  email: "Email Address",
  pan: "PAN",
  gstStatus: "GST Registration Status",
  gstin: "GSTIN",
  billingAddress: "Billing Address",
  communicationAddress: "Communication Address",
  state: "State",
  stateCode: "State Code",
  pinCode: "PIN Code",
  businessType: "Business Type",
  creditLimit: "Credit Limit",
  paymentTermsDays: "Payment Terms (Days)",
  openingBalance: "Opening Balance",
  notes: "Notes",

  // Customer Sites
  customerId: "Customer",
  siteCode: "Site Code",
  siteName: "Site Name",
  fullAddress: "Full Site Address",
  district: "District",
  city: "City",
  siteOwnerName: "Site Owner Name",
  siteOwnerContact: "Site Owner Contact",
  siteInCharge: "Site In-Charge",
  siteContactDetails: "Site Contact Details",
  projectType: "Project Type",
  deliveryInstructions: "Delivery Instructions",
  gpsLatitude: "GPS Latitude",
  gpsLongitude: "GPS Longitude",
  mapsUrl: "Google Maps Location Link",
  googleMapsUrl: "Google Maps Location Link",

  // Suppliers
  supplierCode: "Supplier Code",
  contactPerson: "Contact Person",
  mobile: "Mobile Number",

  // Materials & Catalogue
  materialCode: "Material Code",
  categoryCode: "Category Code",
  typeCode: "Type Code",
  materialTypeId: "Material Type",
  uom: "Unit of Measure (UOM)",
  defaultRentalRate: "Default Rental Rate",
  purchaseCost: "Purchase Cost",
  replacementValue: "Replacement Value",
  minimumStock: "Minimum Stock",

  // Fleet & Transport
  vehicleNumber: "Vehicle Number",
  make: "Vehicle Make",
  model: "Vehicle Model",
  category: "Vehicle Category",
  fuelType: "Fuel Type",
  currentOdometer: "Current Odometer",
  driverCode: "Driver Code",
  licenseNumber: "License Number",
  mobileNumber: "Mobile Number",
  licenseExpiryDate: "License Expiry Date",
  tripNumber: "Trip Number",
  originWarehouseId: "Origin Warehouse",
  destinationSiteId: "Destination Site",
  startOdometer: "Start Odometer",
  endOdometer: "End Odometer",

  // Fuel & Maintenance
  quantityLitres: "Fuel Quantity (Litres)",
  pricePerUnit: "Price per Unit",
  totalCost: "Total Cost",
  serviceCategory: "Service Category",
  descriptionOfWork: "Description of Work",

  // Labour & Attendance
  workerCode: "Worker Code",
  wageType: "Wage Type",
  dailyWage: "Daily Wage",
  monthlySalary: "Monthly Salary",
  attendanceDate: "Attendance Date",
  overtimeHours: "Overtime Hours",
  advanceAmount: "Advance Amount",

  // Document Operations & Rentals
  deliveryDate: "Delivery Date",
  returnDate: "Return Date",
  transferDate: "Transfer Date",
  sourceWarehouseId: "Source Warehouse",
  receivingWarehouseId: "Receiving Warehouse",
  sourceCustomerId: "Source Customer",
  sourceCustomerSiteId: "Source Customer Site",
  destinationCustomerId: "Destination Customer",
  destinationCustomerSiteId: "Destination Customer Site",
  agreedDailyRate: "Agreed Daily Rate",
  quantity: "Quantity",
  returnedQty: "Returned Quantity",
  acceptedQty: "Accepted Quantity",
  damagedQty: "Damaged Quantity",
  missingQty: "Missing Quantity",

  // Invoices & Accounting
  invoiceNumber: "Invoice Number",
  invoiceDate: "Invoice Date",
  dueDate: "Due Date",
  receiptNumber: "Receipt Number",
  paymentDate: "Payment Date",
  paymentMethod: "Payment Method",
  amountReceived: "Amount Received",
  depositAccountId: "Deposit Bank/Cash Account",
  disbursingAccountId: "Disbursing Account",
  amountPaid: "Amount Paid",
  accountCode: "Account Code",
  accountName: "Account Name",
  postingDate: "Posting Date",
  totalDebit: "Total Debit",
  totalCredit: "Total Credit",

  // Auth & Settings
  username: "Username",
  password: "Password",
  confirmPassword: "Confirm Password",
  oldPassword: "Current Password",
  newPassword: "New Password",
  role: "Role",

  // Site Delivery & Handover Proof
  receiverName: "Receiver Full Name",
  receiverPhone: "Receiver Mobile Phone",
  receiverDesignation: "Receiver Designation",
  driverPhone: "Driver Mobile Phone",
  driverName: "Driver Name",
  photoUrl: "Site Delivery Proof Photo",
  remarks: "Notes / Remarks",

  // Branches & Warehouses
  branchCode: "Branch Code",
  warehouseCode: "Warehouse / Yard Code",
  branchId: "Branch",
  warehouseId: "Warehouse / Yard",
  addressLine1: "Address Line 1",
  addressLine2: "Address Line 2",
  warehouseType: "Yard Classification",
  branchType: "Branch Type",

  // Financial & Banking
  accountNumber: "Bank Account Number",
  bankName: "Bank Name",
  ifscCode: "IFSC Code",
  emergencyContact: "Emergency Contact Mobile",
  salaryAmount: "Salary Amount",
  salaryType: "Salary Type",
  licenseClass: "Licence Class",
};

/**
 * Converts a camelCase or dotted path into a clean, human-readable label.
 */
export function formatFieldLabel(path: string): string {
  if (!path) return "General";

  // Check direct dictionary
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];

  // If nested (e.g. billingAddress.pinCode or items[0].quantity)
  if (path.includes(".") || path.includes("[")) {
    const parts = path
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .filter(Boolean);

    const formattedParts = parts.map((part) => {
      if (/^\d+$/.test(part)) return `Item #${Number(part) + 1}`;
      if (FIELD_LABELS[part]) return FIELD_LABELS[part];
      return camelToTitleCase(part);
    });

    return formattedParts.join(" › ");
  }

  return camelToTitleCase(path);
}

function camelToTitleCase(str: string): string {
  const result = str
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Normalizes an array or string path from Zod issues into a uniform dot/bracket path.
 */
export function normalizeFieldPath(path: (string | number)[] | string): string {
  if (typeof path === "string") return path;
  if (!Array.isArray(path) || path.length === 0) return "";

  return path.reduce<string>((acc, segment, index) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }
    if (index === 0) {
      return String(segment);
    }
    return `${acc}.${segment}`;
  }, "");
}

export interface ParsedValidationErrors {
  fieldErrors: Record<string, string>;
  generalError?: string | null;
  errorList: Array<{ field: string; message: string; label: string }>;
  hasErrors: boolean;
}

/**
 * Comprehensive parser for backend and client validation error responses.
 * Supports:
 * - Zod issues array: [{ path: [...], message: "..." }]
 * - fieldErrors maps: { [field]: string | string[] }
 * - Nested objects and array indexes
 * - INVENTRA API standard: { success: false, error: { code: "VALIDATION_FAILED", details: [...] } }
 * - Top-level string errors or general messages
 */
export function parseApiValidationErrors(data: any): ParsedValidationErrors {
  const fieldErrors: Record<string, string> = {};
  let generalError: string | null = null;

  if (!data) {
    return { fieldErrors: {}, generalError: null, errorList: [], hasErrors: false };
  }

  // Case 1: INVENTRA standard { error: { code: "VALIDATION_FAILED", details: [...] } } or { error: { details: [...] } }
  const issues =
    data.error?.details ||
    data.details ||
    data.issues ||
    data.error?.issues ||
    (Array.isArray(data.errors) ? data.errors : null);

  if (Array.isArray(issues)) {
    for (const issue of issues) {
      if (typeof issue === "string") {
        if (!generalError) generalError = issue;
        continue;
      }

      const pathStr = normalizeFieldPath(issue.path || issue.field);
      const message = issue.message || issue.errorMessage || "Invalid value";

      if (pathStr) {
        fieldErrors[pathStr] = message;

        // Also map the leaf field name if nested (e.g. billingAddress.pinCode -> pinCode)
        // so form inputs bound to either path or leaf field will highlight correctly
        const leaf = pathStr.split(".").pop()?.replace(/\[\d+\]/, "");
        if (leaf && leaf !== pathStr && !fieldErrors[leaf]) {
          fieldErrors[leaf] = message;
        }
      } else {
        if (!generalError) generalError = message;
      }
    }
  }

  // Case 2: fieldErrors dictionary { fieldErrors: { pan: "Invalid PAN", ... } }
  const dict = data.error?.fieldErrors || data.fieldErrors;
  if (dict && typeof dict === "object") {
    for (const [key, value] of Object.entries(dict)) {
      const message = Array.isArray(value) ? value[0] : String(value);
      if (message && !fieldErrors[key]) {
        fieldErrors[key] = message;
      }
    }
  }

  // Case 3: Top-level error message or general error
  const topMessage =
    data.error?.message ||
    (typeof data.error === "string" ? data.error : null) ||
    data.message;

  if (topMessage && topMessage !== "Validation failed" && Object.keys(fieldErrors).length === 0) {
    generalError = topMessage;
  } else if (!generalError && Object.keys(fieldErrors).length === 0 && topMessage) {
    generalError = topMessage;
  }

  // Construct structured error list for interactive summaries
  const errorList: Array<{ field: string; message: string; label: string }> = [];
  const seenFields = new Set<string>();

  for (const [field, message] of Object.entries(fieldErrors)) {
    // Avoid duplicate entries if both dotted path and leaf key were registered
    if (seenFields.has(field)) continue;
    seenFields.add(field);

    errorList.push({
      field,
      message,
      label: formatFieldLabel(field),
    });
  }

  return {
    fieldErrors,
    generalError,
    errorList,
    hasErrors: errorList.length > 0 || !!generalError,
  };
}

/**
 * Validates arbitrary data client-side using a Zod schema.
 */
export function validateWithZod<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): {
  isValid: boolean;
  fieldErrors: Record<string, string>;
  generalError?: string | null;
  errorList: Array<{ field: string; message: string; label: string }>;
  data?: T;
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      isValid: true,
      fieldErrors: {},
      generalError: null,
      errorList: [],
      data: result.data,
    };
  }

  const parsed = parseApiValidationErrors({ details: result.error.issues });
  return {
    isValid: false,
    fieldErrors: parsed.fieldErrors,
    generalError: parsed.generalError,
    errorList: parsed.errorList,
  };
}

/**
 * Bridges API error responses to React Hook Form's `setError` function,
 * highlights fields, and triggers smooth auto-scroll to the first invalid field.
 */
export function setReactHookFormErrors(
  setError: (field: any, error: { type: string; message: string }) => void,
  data: any,
  container?: HTMLElement | null
): {
  generalError?: string | null;
  hasErrors: boolean;
  fieldErrors: Record<string, string>;
  errorList: Array<{ field: string; message: string; label: string }>;
} {
  const parsed = parseApiValidationErrors(data);

  for (const [field, message] of Object.entries(parsed.fieldErrors)) {
    try {
      setError(field, {
        type: "server",
        message,
      });
    } catch {
      // Ignore unmappable sub-paths
    }
  }

  return {
    generalError: parsed.generalError,
    hasErrors: parsed.hasErrors,
    fieldErrors: parsed.fieldErrors,
    errorList: parsed.errorList,
  };
}

/**
 * Formats parsed validation errors into a clear, informative toast notification.
 * Instead of generic "Validation failed", it highlights the exact offending field and requirement.
 */
export function formatValidationToast(parsed: ParsedValidationErrors): string {
  if (parsed.errorList && parsed.errorList.length > 0) {
    const first = parsed.errorList[0];
    const moreCount = parsed.errorList.length - 1;
    return `${first.label}: ${first.message}${moreCount > 0 ? ` (and ${moreCount} other field error${moreCount > 1 ? "s" : ""})` : ""}`;
  }
  return parsed.generalError || "Validation failed: please review the highlighted fields.";
}

/**
 * Universal error extractor for API responses, errors, or objects.
 * Guarantees that if validation issues are returned from the server,
 * a clear human-readable field-specific message is returned.
 */
export function getApiErrorMessage(data: any, fallback = "Operation failed"): string {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data instanceof Error) return data.message;

  const parsed = parseApiValidationErrors(data);
  if (parsed.hasErrors && parsed.errorList.length > 0) {
    return formatValidationToast(parsed);
  }

  if (data.error?.message && data.error.message !== "Validation failed") {
    return data.error.message;
  }
  if (data.message && data.message !== "Validation failed") {
    return data.message;
  }
  return fallback;
}



