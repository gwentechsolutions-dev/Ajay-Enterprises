import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isRouteAllowedForRole } from "@/lib/portal-routing";

const SYSTEM_PAGES = [
  { title: "Dashboard", subtitle: "Executive overview & KPIs", href: "/dashboard", category: "Navigation", badge: "Overview" },
  { title: "Delivery Notes (DN)", subtitle: "Outward centering material custody", href: "/delivery-notes", category: "Navigation", badge: "Operations" },
  { title: "Material Returns (MRN)", subtitle: "Centering return notes & inspection", href: "/return-notes", category: "Navigation", badge: "Operations" },
  { title: "Direct Transfers (DSTN)", subtitle: "Site-to-site equipment transfers", href: "/operations/direct-transfers", category: "Navigation", badge: "Operations" },
  { title: "Stock Transfers (STN)", subtitle: "Inter-yard material movement", href: "/stock-transfers", category: "Navigation", badge: "Operations" },
  { title: "Rental Operations", subtitle: "Rental agreements & contracts", href: "/rentals", category: "Navigation", badge: "Rental" },
  { title: "Rental Agreements", subtitle: "Customer site master contracts", href: "/rentals/agreements", category: "Navigation", badge: "Rental" },
  { title: "Monthly Statements", subtitle: "Daily rental usage billing", href: "/rentals/statements", category: "Navigation", badge: "Rental" },
  { title: "Tax Invoices", subtitle: "GST-compliant invoices & receipts", href: "/invoices", category: "Navigation", badge: "Invoicing" },
  { title: "Purchase Bills", subtitle: "Supplier bills & ITC tracking", href: "/purchases/bills", category: "Navigation", badge: "Purchasing" },
  { title: "Customers & Sites", subtitle: "Multi-site client master records", href: "/customers", category: "Navigation", badge: "Masters" },
  { title: "Material Catalogue", subtitle: "Props, spans, sheets & variants", href: "/materials", category: "Navigation", badge: "Masters" },
  { title: "Inventory Hub", subtitle: "Real-time stock valuation & pools", href: "/inventory", category: "Navigation", badge: "Inventory" },
  { title: "Reports Hub", subtitle: "Financial & operational analytics", href: "/reports", category: "Navigation", badge: "Reports" },
  { title: "GST & Statutory Center", subtitle: "GSTR-1, GSTR-3B & tax offsets", href: "/accounting/gst", category: "Navigation", badge: "Accounting" },
  { title: "Company Fleet", subtitle: "Vehicles, trips & fuel logs", href: "/fleet", category: "Navigation", badge: "Fleet" },
  { title: "Company Profile", subtitle: "Ajay Enterprises business settings", href: "/company", category: "Navigation", badge: "Settings" },
];

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    const allowedPages = SYSTEM_PAGES.filter((p) => isRouteAllowedForRole(session.role, p.href));

    if (!q || q.length < 2) {
      return NextResponse.json({
        success: true,
        data: {
          results: [],
          suggestions: allowedPages.slice(0, 6),
        },
      });
    }

    const term = q;
    const canViewDN = isRouteAllowedForRole(session.role, "/delivery-notes");
    const canViewMRN = isRouteAllowedForRole(session.role, "/return-notes");
    const canViewInvoices = isRouteAllowedForRole(session.role, "/invoices");
    const canViewAgreements = isRouteAllowedForRole(session.role, "/rentals/agreements");
    const canViewCustomers = isRouteAllowedForRole(session.role, "/customers");
    const canViewMaterials = isRouteAllowedForRole(session.role, "/materials");

    // Search in parallel across permitted business entities
    const [
      deliveryNotes,
      returnNotes,
      invoices,
      agreements,
      customers,
      sites,
      materials,
    ] = await Promise.all([
      canViewDN
        ? db.deliveryNote.findMany({
            where: {
              OR: [
                { dnNumber: { contains: term, mode: "insensitive" } },
                { eWayBillNumber: { contains: term, mode: "insensitive" } },
                { customer: { name: { contains: term, mode: "insensitive" } } },
                { customerSite: { siteName: { contains: term, mode: "insensitive" } } },
                { vehicleNumber: { contains: term, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              dnNumber: true,
              eWayBillNumber: true,
              status: true,
              deliveryDate: true,
              customer: { select: { name: true } },
              customerSite: { select: { siteName: true } },
            },
            take: 4,
            orderBy: { deliveryDate: "desc" },
          })
        : Promise.resolve([]),

      canViewMRN
        ? db.materialReturnNote.findMany({
            where: {
              OR: [
                { mrnNumber: { contains: term, mode: "insensitive" } },
                { customer: { name: { contains: term, mode: "insensitive" } } },
                { customerSite: { siteName: { contains: term, mode: "insensitive" } } },
              ],
            },
            select: {
              id: true,
              mrnNumber: true,
              status: true,
              returnDate: true,
              customer: { select: { name: true } },
              customerSite: { select: { siteName: true } },
            },
            take: 4,
            orderBy: { returnDate: "desc" },
          })
        : Promise.resolve([]),

      canViewInvoices
        ? db.invoice.findMany({
            where: {
              OR: [
                { invoiceNumber: { contains: term, mode: "insensitive" } },
                { customer: { name: { contains: term, mode: "insensitive" } } },
                { customerGstin: { contains: term, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              grandTotal: true,
              invoiceDate: true,
              customer: { select: { name: true } },
            },
            take: 4,
            orderBy: { invoiceDate: "desc" },
          })
        : Promise.resolve([]),

      canViewAgreements
        ? db.rentalAgreement.findMany({
            where: {
              OR: [
                { agreementNumber: { contains: term, mode: "insensitive" } },
                { customer: { name: { contains: term, mode: "insensitive" } } },
                { customerSite: { siteName: { contains: term, mode: "insensitive" } } },
              ],
            },
            select: {
              id: true,
              agreementNumber: true,
              status: true,
              customer: { select: { name: true } },
              customerSite: { select: { siteName: true } },
            },
            take: 4,
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),

      canViewCustomers
        ? db.customer.findMany({
            where: {
              OR: [
                { name: { contains: term, mode: "insensitive" } },
                { customerCode: { contains: term, mode: "insensitive" } },
                { primaryMobile: { contains: term, mode: "insensitive" } },
                { gstin: { contains: term, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              name: true,
              customerCode: true,
              primaryMobile: true,
              state: true,
              sites: { select: { id: true } },
            },
            take: 4,
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),

      canViewCustomers
        ? db.customerSite.findMany({
            where: {
              OR: [
                { siteName: { contains: term, mode: "insensitive" } },
                { siteCode: { contains: term, mode: "insensitive" } },
                { city: { contains: term, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              siteName: true,
              siteCode: true,
              city: true,
              customerId: true,
              customer: { select: { name: true } },
            },
            take: 4,
          })
        : Promise.resolve([]),

      canViewMaterials
        ? db.materialVariant.findMany({
            where: {
              OR: [
                { name: { contains: term, mode: "insensitive" } },
                { materialCode: { contains: term, mode: "insensitive" } },
                { size: { contains: term, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              name: true,
              materialCode: true,
              size: true,
              uom: true,
              defaultRentalRate: true,
            },
            take: 4,
          })
        : Promise.resolve([]),
    ]);

    // Matching navigation pages
    const matchingPages = allowedPages.filter(
      (p) =>
        p.title.toLowerCase().includes(term.toLowerCase()) ||
        p.subtitle.toLowerCase().includes(term.toLowerCase())
    );

    // Combine formatted results
    const results: Array<{
      id: string;
      title: string;
      subtitle: string;
      category: string;
      href: string;
      badge?: string;
    }> = [];

    // Navigation
    matchingPages.forEach((p) => {
      results.push({
        id: `nav-${p.href}`,
        title: p.title,
        subtitle: p.subtitle,
        category: "Navigation",
        href: p.href,
        badge: p.badge,
      });
    });

    // Customers
    customers.forEach((c) => {
      results.push({
        id: `cust-${c.id}`,
        title: c.name,
        subtitle: `${c.customerCode} • ${c.primaryMobile || "No mobile"} • ${c.sites?.length || 0} Site(s)`,
        category: "Customers",
        href: `/customers/${c.id}`,
        badge: "Customer",
      });
    });

    // Sites
    sites.forEach((s) => {
      results.push({
        id: `site-${s.id}`,
        title: s.siteName,
        subtitle: `${s.customer?.name || "Client"} • ${s.city || "Site"} (${s.siteCode || "Active"})`,
        category: "Construction Sites",
        href: `/customers/${s.customerId}`,
        badge: "Site",
      });
    });

    // Delivery Notes
    deliveryNotes.forEach((dn) => {
      const ewbText = dn.eWayBillNumber ? ` • EWB: ${dn.eWayBillNumber}` : "";
      results.push({
        id: `dn-${dn.id}`,
        title: dn.dnNumber,
        subtitle: `${dn.customer?.name || "Customer"} ➔ ${dn.customerSite?.siteName || "Site"}${ewbText}`,
        category: "Delivery Notes",
        href: `/delivery-notes`,
        badge: dn.status,
      });
    });

    // Material Returns
    returnNotes.forEach((mrn) => {
      results.push({
        id: `mrn-${mrn.id}`,
        title: mrn.mrnNumber,
        subtitle: `${mrn.customer?.name || "Customer"} • Return Note`,
        category: "Material Returns",
        href: `/return-notes`,
        badge: mrn.status,
      });
    });

    // Invoices
    invoices.forEach((inv) => {
      results.push({
        id: `inv-${inv.id}`,
        title: inv.invoiceNumber,
        subtitle: `${inv.customer?.name || "Customer"} • ₹${Number(inv.grandTotal).toLocaleString("en-IN")}`,
        category: "Invoices",
        href: `/invoices`,
        badge: inv.status,
      });
    });

    // Agreements
    agreements.forEach((agr) => {
      results.push({
        id: `agr-${agr.id}`,
        title: agr.agreementNumber,
        subtitle: `${agr.customer?.name || "Customer"} ➔ ${agr.customerSite?.siteName || "Site"}`,
        category: "Rental Agreements",
        href: `/rentals/agreements`,
        badge: agr.status,
      });
    });

    // Materials
    materials.forEach((m) => {
      results.push({
        id: `mat-${m.id}`,
        title: m.name,
        subtitle: `${m.materialCode} • ${m.size || "-"} • Rate: ₹${Number(m.defaultRentalRate || 0)}/day`,
        category: "Materials",
        href: `/materials`,
        badge: m.uom,
      });
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          results,
          count: results.length,
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=20, stale-while-revalidate=40",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
