/**
 * INVENTRA Universal Reporting & Document Export Engine
 * Operating Business Identity: AJAY ENTERPRISES
 */

export interface ExportMetadata {
  reportTitle: string;
  businessName?: string;
  softwareName?: string;
  periodLabel?: string;
  filtersApplied?: Record<string, string>;
  generatedBy?: string;
  generationDate?: Date;
}

export interface ExportColumn {
  header: string;
  key: string;
  align?: "left" | "right" | "center";
}

/**
 * Generates an Excel-compatible CSV string with BOM for correct UTF-8 and currency character display
 */
export function generateCsvExport<T extends Record<string, any>>(
  columns: ExportColumn[],
  data: T[],
  metadata: ExportMetadata
): string {
  const business = metadata.businessName || "AJAY ENTERPRISES";
  const software = metadata.softwareName || "INVENTRA ERP";
  const generatedAt = (metadata.generationDate || new Date()).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const lines: string[] = [];

  // 1. Header Metadata Block
  lines.push(`"${business} - ${software}"`);
  lines.push(`"${metadata.reportTitle}"`);
  if (metadata.periodLabel) {
    lines.push(`"Report Period: ${metadata.periodLabel}"`);
  }
  lines.push(`"Generated On: ${generatedAt} | By: ${metadata.generatedBy || "Authorized User"}"`);

  if (metadata.filtersApplied && Object.keys(metadata.filtersApplied).length > 0) {
    const filterDesc = Object.entries(metadata.filtersApplied)
      .filter(([_, v]) => Boolean(v))
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    if (filterDesc) {
      lines.push(`"Filters: ${filterDesc}"`);
    }
  }

  lines.push(""); // Empty line separator

  // 2. Table Column Headers
  const headerRow = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`).join(",");
  lines.push(headerRow);

  // 3. Data Rows
  for (const row of data) {
    const rowValues = columns.map((col) => {
      const val = row[col.key];
      if (val === null || val === undefined) return '""';
      if (typeof val === "number" || typeof val === "bigint") return `"${val}"`;
      if (val instanceof Date) return `"${val.toLocaleDateString("en-IN")}"`;
      if (typeof val === "object" && "toFixed" in val) {
        // Decimal value
        return `"${val.toFixed(2)}"`;
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    lines.push(rowValues.join(","));
  }

  // Prepend UTF-8 BOM so Excel opens with proper encoding
  return "\uFEFF" + lines.join("\r\n");
}

/**
 * Generates a clean, printable HTML document for PDF rendering / browser printing
 */
export function generatePrintableHtml<T extends Record<string, any>>(
  columns: ExportColumn[],
  data: T[],
  metadata: ExportMetadata,
  totals?: Record<string, string | number>
): string {
  const business = metadata.businessName || "AJAY ENTERPRISES";
  const software = metadata.softwareName || "INVENTRA";
  const generatedAt = (metadata.generationDate || new Date()).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const filterRows = metadata.filtersApplied
    ? Object.entries(metadata.filtersApplied)
        .filter(([_, v]) => Boolean(v))
        .map(([k, v]) => `<span class="badge"><strong>${k}:</strong> ${v}</span>`)
        .join(" ")
    : "";

  const tableHeaders = columns
    .map(
      (c) =>
        `<th style="text-align: ${c.align || "left"}; padding: 8px; border: 1px solid #cbd5e1; background: #0B1E36; color: white; font-size: 11px;">${c.header}</th>`
    )
    .join("");

  const tableRows = data
    .map(
      (row, idx) =>
        `<tr style="background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">` +
        columns
          .map((col) => {
            const val = row[col.key];
            let displayVal = "";
            if (val !== null && val !== undefined) {
              if (val instanceof Date) displayVal = val.toLocaleDateString("en-IN");
              else if (typeof val === "object" && "toFixed" in val) displayVal = val.toFixed(2);
              else displayVal = String(val);
            }
            return `<td style="text-align: ${col.align || "left"}; padding: 7px 8px; border: 1px solid #e2e8f0; font-size: 11px;">${displayVal}</td>`;
          })
          .join("") +
        `</tr>`
    )
    .join("");

  const totalsRow = totals
    ? `<tr style="background: #e2e8f0; font-weight: bold;">` +
      columns
        .map((col, idx) => {
          const val = totals[col.key] || (idx === 0 ? "TOTAL" : "");
          return `<td style="text-align: ${col.align || "left"}; padding: 8px; border: 1px solid #cbd5e1; font-size: 11px;">${val}</td>`;
        })
        .join("") +
      `</tr>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${metadata.reportTitle} - ${business}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 24px; }
    .header { border-bottom: 2px solid #0B1E36; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .business-title { font-size: 20px; font-weight: bold; color: #0B1E36; margin: 0; }
    .software-tag { font-size: 11px; font-weight: 600; color: #ea580c; text-transform: uppercase; letter-spacing: 0.5px; }
    .report-title { font-size: 16px; font-weight: 600; color: #334155; margin-top: 4px; }
    .meta-box { font-size: 11px; color: #64748b; line-height: 1.4; text-align: right; }
    .filters-bar { margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
    .badge { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 10px; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="software-tag">${software} · Operational ERP</div>
      <h1 class="business-title">${business}</h1>
      <div class="report-title">${metadata.reportTitle}</div>
    </div>
    <div class="meta-box">
      <div><strong>Period:</strong> ${metadata.periodLabel || "All Records"}</div>
      <div><strong>Generated:</strong> ${generatedAt}</div>
      <div><strong>Generated By:</strong> ${metadata.generatedBy || "Authorized User"}</div>
    </div>
  </div>

  ${filterRows ? `<div class="filters-bar">${filterRows}</div>` : ""}

  <table>
    <thead>
      <tr>${tableHeaders}</tr>
    </thead>
    <tbody>
      ${tableRows}
      ${totalsRow}
    </tbody>
  </table>

  <div class="footer">
    <div>Strictly Confidential · For Internal Use of ${business} Only</div>
    <div>Page 1 of 1 · Generated by ${software}</div>
  </div>
</body>
</html>`;
}
