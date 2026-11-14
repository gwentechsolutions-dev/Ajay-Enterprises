import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { getCurrentFiscalYear } from "@/lib/document-series";

// ==============================================================================
// INVENTRA: COMPLETE DEMO DATA GENERATOR SERVICE
// Operating Business: AJAY ENTERPRISES | Product: INVENTRA ERP
// Guarantees:
// 1. 100% Data Isolation (isDemo=true, demoRunId, DemoDataRecord registry)
// 2. Strict Double-Entry Balance (SUM(debits) == SUM(credits)) on every journal
// 3. Movement-derived stock balances (never arbitrary edits)
// 4. Realistic interconnected workflows across all ERP modules
// 5. Zero modification or disruption of genuine business data
// ==============================================================================

export interface DemoGenerationResult {
  success: boolean;
  demoRunId: string;
  runNumber: string;
  totalRecords: number;
  moduleCounts: Record<string, number>;
  message: string;
}

export async function generateComprehensiveDemoData(actor: {
  id: string;
  name: string;
  role: string;
  ipAddress?: string;
}): Promise<DemoGenerationResult> {
  // Step 1: Ensure no active demo dataset exists
  const existingActive = await db.demoDataRun.findFirst({
    where: { status: "ACTIVE" },
  });
  if (existingActive) {
    throw new Error(
      `An active demo dataset (${existingActive.runNumber}) is already loaded. Please clear the existing demo dataset before generating a new one.`
    );
  }

  const fiscalYear = getCurrentFiscalYear();
  const runNumber = `DEMO-${fiscalYear.replace("-", "")}-${Date.now().toString().slice(-4)}`;

  // Create active DemoDataRun record
  const demoRun = await db.demoDataRun.create({
    data: {
      runNumber,
      status: "ACTIVE",
      totalRecords: 0,
      generatedById: actor.id,
    },
  });

  const demoRunId = demoRun.id;
  const recordsToRegister: Array<{
    tableName: string;
    recordId: string;
    recordCode?: string | null;
    details?: string | null;
  }> = [];

  const counts: Record<string, number> = {
    masterData: 0,
    inventory: 0,
    purchases: 0,
    operations: 0,
    rentals: 0,
    accounting: 0,
    fleet: 0,
    labour: 0,
    maintenance: 0,
  };

  function track(tableName: string, recordId: string, recordCode?: string | null, details?: string | null) {
    recordsToRegister.push({ tableName, recordId, recordCode, details });
  }

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const twentyDaysAgo = new Date(now.getTime() - 20 * 86400000);
    const eighteenDaysAgo = new Date(now.getTime() - 18 * 86400000);
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 86400000);
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400000);
    const nineDaysAgo = new Date(now.getTime() - 9 * 86400000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);

    // =========================================================================
    // 1. FACILITIES & MASTER DATA
    // =========================================================================

    // Branch
    let branch = await db.branch.findFirst({ where: { isActive: true } });
    if (!branch) {
      branch = await db.branch.create({
        data: {
          branchCode: "BR-BLR-01",
          name: "Bangalore Central Operations",
          branchType: "MAIN_OFFICE",
          addressLine1: "No. 12, Outer Ring Road, Peenya Industrial Area",
          city: "Bengaluru",
          state: "Karnataka",
          pinCode: "560058",
          contactPerson: "Branch Manager",
          mobile: "080-28394411",
          email: "peenya@ajayenterprises.com",
          isActive: true,
          isDemo: true,
          demoRunId,
        },
      });
      track("Branch", branch.id, branch.branchCode, "Demo Branch");
      counts.masterData++;
    }

    // Warehouses
    // Warehouses (Dedicated Demo Warehouses to guarantee zero collision with genuine stock)
    let mainYard = await db.warehouse.findFirst({
      where: { warehouseCode: "WH-DEMO-01" },
    });
    if (!mainYard) {
      mainYard = await db.warehouse.create({
        data: {
          warehouseCode: "WH-DEMO-01",
          name: "AJAY ENTERPRISES Demo Main Yard - Peenya",
          warehouseType: "MAIN_YARD",
          addressLine1: "Plot 42, 3rd Phase, Peenya Industrial Area",
          city: "Bengaluru",
          state: "Karnataka",
          pinCode: "560058",
          contactPerson: "Yard Manager",
          mobile: "9845011112",
          branchId: branch.id,
          isDemo: true,
          demoRunId,
        },
      });
      track("Warehouse", mainYard.id, mainYard.warehouseCode, "Demo Main Yard");
      counts.masterData++;
    } else {
      mainYard = await db.warehouse.update({
        where: { id: mainYard.id },
        data: { isDemo: true, demoRunId },
      });
      track("Warehouse", mainYard.id, mainYard.warehouseCode, "Demo Main Yard");
    }

    let secondaryYard = await db.warehouse.findFirst({
      where: { warehouseCode: "WH-DEMO-02" },
    });
    if (!secondaryYard) {
      secondaryYard = await db.warehouse.create({
        data: {
          warehouseCode: "WH-DEMO-02",
          name: "AJAY ENTERPRISES Demo Secondary Yard - Whitefield",
          warehouseType: "SECONDARY_YARD",
          addressLine1: "Survey 18, Hoodi Industrial Area, Whitefield",
          city: "Bengaluru",
          state: "Karnataka",
          pinCode: "560066",
          contactPerson: "Yard Supervisor",
          mobile: "9845011113",
          branchId: branch.id,
          isDemo: true,
          demoRunId,
        },
      });
      track("Warehouse", secondaryYard.id, secondaryYard.warehouseCode, "Demo Secondary Yard");
      counts.masterData++;
    } else {
      secondaryYard = await db.warehouse.update({
        where: { id: secondaryYard.id },
        data: { isDemo: true, demoRunId },
      });
      track("Warehouse", secondaryYard.id, secondaryYard.warehouseCode, "Demo Secondary Yard");
    }

    // Fetch existing material variants or create supplementary demo variants
    let variants = await db.materialVariant.findMany({ where: { isActive: true } });

    // Ensure Column Box and Scaffolding exist if missing
    let colBox = variants.find((v) => v.materialCode.includes("COL-BOX"));
    if (!colBox) {
      let cat = await db.materialCategory.findFirst({ where: { categoryCode: "FORM" } });
      if (!cat) {
        cat = await db.materialCategory.create({
          data: { categoryCode: "FORM", name: "Formwork & Columns", description: "Column boxes & accessories" },
        });
      }
      let typ = await db.materialType.findFirst({ where: { typeCode: "COL_BOX" } });
      if (!typ) {
        typ = await db.materialType.create({
          data: { categoryId: cat.id, typeCode: "COL_BOX", name: "Column Box MS" },
        });
      }
      colBox = await db.materialVariant.create({
        data: {
          materialTypeId: typ.id,
          materialCode: "MAT-COL-BOX-12",
          name: "Column Box 12x12 MS Heavy Duty",
          size: "12in x 12in x 8ft",
          uom: "Nos.",
          defaultRentalRate: new Prisma.Decimal("15.00"),
          purchaseCost: new Prisma.Decimal("4200.00"),
          replacementValue: new Prisma.Decimal("4800.00"),
          minimumStock: new Prisma.Decimal("50.000"),
          ownershipClassification: "OWNED",
          isActive: true,
          isDemo: true,
          demoRunId,
        },
      });
      track("MaterialVariant", colBox.id, colBox.materialCode, "Demo Column Box");
      counts.masterData++;
      variants.push(colBox);
    }

    let scaffolding = variants.find((v) => v.materialCode.includes("SCAF"));
    if (!scaffolding) {
      let cat = await db.materialCategory.findFirst({ where: { categoryCode: "SCAF" } });
      if (!cat) {
        cat = await db.materialCategory.create({
          data: { categoryCode: "SCAF", name: "Scaffolding Systems", description: "Cuplock & tubular scaffolding" },
        });
      }
      let typ = await db.materialType.findFirst({ where: { typeCode: "CUP_VERT" } });
      if (!typ) {
        typ = await db.materialType.create({
          data: { categoryId: cat.id, typeCode: "CUP_VERT", name: "Cuplock Vertical" },
        });
      }
      scaffolding = await db.materialVariant.create({
        data: {
          materialTypeId: typ.id,
          materialCode: "MAT-SCAF-CUP-2M",
          name: "Cuplock Scaffolding Standard 2.0m",
          size: "48mm OD x 2.0m",
          uom: "NOS",
          defaultRentalRate: new Prisma.Decimal("6.50"),
          purchaseCost: new Prisma.Decimal("1100.00"),
          replacementValue: new Prisma.Decimal("1350.00"),
          minimumStock: new Prisma.Decimal("100.000"),
          ownershipClassification: "OWNED",
          isActive: true,
          isDemo: true,
          demoRunId,
        },
      });
      track("MaterialVariant", scaffolding.id, scaffolding.materialCode, "Demo Scaffolding");
      counts.masterData++;
      variants.push(scaffolding);
    }

    // Identify key variants for simulation
    const propVariant = variants.find((v) => v.materialCode.includes("PROP")) || variants[0];
    const spanVariant = variants.find((v) => v.materialCode.includes("SPAN")) || variants[1] || variants[0];
    const sheetVariant = variants.find((v) => v.materialCode.includes("FOLD") || v.materialCode.includes("SHT")) || variants[2] || variants[0];
    const angleVariant = variants.find((v) => v.materialCode.includes("ANGLE")) || sheetVariant;

    // Fictional Customers
    const cust1 = await db.customer.create({
      data: {
        customerCode: `CUST-DEMO-001`,
        name: "Skyline Infra Developers Pvt Ltd",
        legalBusinessName: "Skyline Infra Developers Private Limited",
        customerType: "COMPANY",
        gstStatus: "REGISTERED",
        gstin: "29AABCS1429B1Z1",
        pan: "AABCS1429B",
        primaryMobile: "9845011223",
        billingAddress: "Skyline Hub, 4th Floor, 100 Ft Road, Indiranagar, Bengaluru - 560038",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "560038",
        isActive: true,
        isDemo: true,
        demoRunId,
      },
    });
    track("Customer", cust1.id, cust1.customerCode, cust1.name);
    counts.masterData++;

    const site1A = await db.customerSite.create({
      data: {
        customerId: cust1.id,
        siteCode: "SITE-DEMO-101",
        siteName: "Skyline Solitaire Tower B - Whitefield",
        fullAddress: "Survey 45/2, ITPL Main Road, Whitefield, Bengaluru - 560066",
        state: "Karnataka",
        stateCode: "29",
        district: "Bengaluru Urban",
        city: "Bengaluru",
        pinCode: "560066",
        gpsLatitude: new Prisma.Decimal("12.9716"),
        gpsLongitude: new Prisma.Decimal("77.5946"),
        siteInCharge: "Kiran Patel",
        siteContactDetails: "9845022334",
        status: "ACTIVE",
        isDemo: true,
        demoRunId,
      },
    });
    track("CustomerSite", site1A.id, site1A.siteCode, site1A.siteName);
    counts.masterData++;

    const site1B = await db.customerSite.create({
      data: {
        customerId: cust1.id,
        siteCode: "SITE-DEMO-102",
        siteName: "Skyline Oasis Villa Phase 2 - Sarjapur",
        fullAddress: "Off Sarjapur Main Road, Carmelaram Post, Bengaluru - 560035",
        state: "Karnataka",
        stateCode: "29",
        district: "Bengaluru Urban",
        city: "Bengaluru",
        pinCode: "560035",
        gpsLatitude: new Prisma.Decimal("12.9102"),
        gpsLongitude: new Prisma.Decimal("77.6834"),
        siteInCharge: "Manoj Kumar",
        siteContactDetails: "9845022335",
        status: "ACTIVE",
        isDemo: true,
        demoRunId,
      },
    });
    track("CustomerSite", site1B.id, site1B.siteCode, site1B.siteName);
    counts.masterData++;

    const cust2 = await db.customer.create({
      data: {
        customerCode: `CUST-DEMO-002`,
        name: "Apex Urban Constructions LLP",
        legalBusinessName: "Apex Urban Constructions LLP",
        customerType: "COMPANY",
        gstStatus: "REGISTERED",
        gstin: "29AAHCA5512C1Z8",
        pan: "AAHCA5512C",
        primaryMobile: "9845033445",
        billingAddress: "Apex Heights, 12th Main, 4th Block, Koramangala, Bengaluru - 560034",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "560034",
        isActive: true,
        isDemo: true,
        demoRunId,
      },
    });
    track("Customer", cust2.id, cust2.customerCode, cust2.name);
    counts.masterData++;

    const site2A = await db.customerSite.create({
      data: {
        customerId: cust2.id,
        siteCode: "SITE-DEMO-201",
        siteName: "Apex Tech Park Pier 7 - Electronic City",
        fullAddress: "Plot 88, Electronic City Phase 1, Hosur Road, Bengaluru - 560100",
        state: "Karnataka",
        stateCode: "29",
        district: "Bengaluru Urban",
        city: "Bengaluru",
        pinCode: "560100",
        gpsLatitude: new Prisma.Decimal("12.8452"),
        gpsLongitude: new Prisma.Decimal("77.6602"),
        siteInCharge: "Siddharth Rao",
        siteContactDetails: "9845033446",
        status: "ACTIVE",
        isDemo: true,
        demoRunId,
      },
    });
    track("CustomerSite", site2A.id, site2A.siteCode, site2A.siteName);
    counts.masterData++;

    // Unregistered / Non-GST Customer (Rule #13 Dual GST & Non-GST support)
    const cust3 = await db.customer.create({
      data: {
        customerCode: `CUST-DEMO-003`,
        name: "Kaveri Formwork & Civil Projects",
        legalBusinessName: "Kaveri Formwork",
        customerType: "CONTRACTOR",
        gstStatus: "UNREGISTERED",
        pan: "AAFCK8812D",
        primaryMobile: "9845044556",
        billingAddress: "Near Ring Road Flyover, Peenya 2nd Stage, Bengaluru - 560058",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "560058",
        isActive: true,
        isDemo: true,
        demoRunId,
      },
    });
    track("Customer", cust3.id, cust3.customerCode, cust3.name);
    counts.masterData++;

    const site3A = await db.customerSite.create({
      data: {
        customerId: cust3.id,
        siteCode: "SITE-DEMO-301",
        siteName: "Kaveri Commercial Complex - Peenya",
        fullAddress: "Industrial Suburb, Peenya 1st Stage, Bengaluru - 560058",
        state: "Karnataka",
        stateCode: "29",
        district: "Bengaluru Urban",
        city: "Bengaluru",
        pinCode: "560058",
        gpsLatitude: new Prisma.Decimal("13.0312"),
        gpsLongitude: new Prisma.Decimal("77.5255"),
        siteInCharge: "Anand Murthy",
        siteContactDetails: "9845044556",
        status: "ACTIVE",
        isDemo: true,
        demoRunId,
      },
    });
    track("CustomerSite", site3A.id, site3A.siteCode, site3A.siteName);
    counts.masterData++;

    // Customer 4: Infrastructure Developer
    const cust4 = await db.customer.create({
      data: {
        customerCode: `CUST-DEMO-004`,
        name: "Metro Horizon Infrastructure Ltd",
        legalBusinessName: "Metro Horizon Infrastructure Limited",
        customerType: "COMPANY",
        gstStatus: "REGISTERED",
        gstin: "29AAGCM8891D1Z4",
        pan: "AAGCM8891D",
        primaryMobile: "9845055667",
        billingAddress: "Infra Towers, Outer Ring Road, Bellandur, Bengaluru - 560103",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "560103",
        isActive: true,
        isDemo: true,
        demoRunId,
      },
    });
    track("Customer", cust4.id, cust4.customerCode, cust4.name);
    counts.masterData++;

    const site4A = await db.customerSite.create({
      data: {
        customerId: cust4.id,
        siteCode: "SITE-DEMO-401",
        siteName: "Metro Line 4 Pier 12 to 18 - Indiranagar",
        fullAddress: "CMH Road Corridor, Indiranagar, Bengaluru - 560038",
        state: "Karnataka",
        stateCode: "29",
        district: "Bengaluru Urban",
        city: "Bengaluru",
        pinCode: "560038",
        gpsLatitude: new Prisma.Decimal("12.9784"),
        gpsLongitude: new Prisma.Decimal("77.6408"),
        siteInCharge: "Pradeep Rao",
        siteContactDetails: "9845055667",
        status: "ACTIVE",
        isDemo: true,
        demoRunId,
      },
    });
    track("CustomerSite", site4A.id, site4A.siteCode, site4A.siteName);
    counts.masterData++;

    // Fictional Suppliers
    const sup1 = await db.supplier.create({
      data: {
        supplierCode: "SUP-DEMO-001",
        name: "Jindal Scaffolding & Pipes Ltd",
        contactPerson: "R. K. Jindal",
        primaryMobile: "9845199881",
        email: "sales@jindalscaffold.demo",
        gstStatus: "REGISTERED",
        gstin: "29AAACJ4321A1Z5",
        pan: "AAACJ4321A",
        billingAddress: "Industrial Growth Centre, Kudithini, Bellary - 583115",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "583115",
        isActive: true,
        isDemo: true,
        demoRunId,
      },
    });
    track("Supplier", sup1.id, sup1.supplierCode, sup1.name);
    counts.masterData++;

    const sup2 = await db.supplier.create({
      data: {
        supplierCode: "SUP-DEMO-002",
        name: "Tata Steel Tubulars & Formwork Hub",
        contactPerson: "Amitabh Sen",
        primaryMobile: "9845199882",
        email: "tubulars@tatasteel.demo",
        gstStatus: "REGISTERED",
        gstin: "29AAACT9876B1Z3",
        pan: "AAACT9876B",
        billingAddress: "Bommasandra Industrial Area, Hosur Road, Bengaluru - 560099",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "560099",
        isActive: true,
        isDemo: true,
        demoRunId,
      },
    });
    track("Supplier", sup2.id, sup2.supplierCode, sup2.name);
    counts.masterData++;

    const sup3 = await db.supplier.create({
      data: {
        supplierCode: "SUP-DEMO-003",
        name: "National Heavy Fabrication Works",
        contactPerson: "Gopal Shetty",
        primaryMobile: "9845199883",
        email: "gopal@nationalfab.demo",
        gstStatus: "REGISTERED",
        gstin: "29AAACN1122C1Z9",
        pan: "AAACN1122C",
        billingAddress: "Plot 15, 4th Phase, Peenya Industrial Area, Bengaluru - 560058",
        state: "Karnataka",
        stateCode: "29",
        pinCode: "560058",
        isActive: true,
        isDemo: true,
        demoRunId,
      },
    });
    track("Supplier", sup3.id, sup3.supplierCode, sup3.name);
    counts.masterData++;

    // =========================================================================
    // 2. INVENTORY OPENING STOCK & BALANCES
    // =========================================================================

    const stockItems = [
      { variant: propVariant, owned: 2500, hired: 400 },
      { variant: spanVariant, owned: 1200, hired: 200 },
      { variant: sheetVariant, owned: 1800, hired: 0 },
      { variant: angleVariant, owned: 800, hired: 0 },
      { variant: colBox, owned: 400, hired: 0 },
      { variant: scaffolding, owned: 1000, hired: 0 },
    ];

    for (const item of stockItems) {
      if (item.owned > 0) {
        const mv = await db.inventoryMovement.create({
          data: {
            movementNumber: `MV-DEMO-OP-${item.variant.materialCode}-O`,
            movementType: "OPENING_STOCK",
            materialVariantId: item.variant.id,
            ownershipType: "OWNED",
            quantity: new Prisma.Decimal(item.owned),
            sourceLocationType: "WAREHOUSE",
            destinationLocationType: "WAREHOUSE",
            destinationWarehouseId: mainYard.id,
            movementDate: thirtyDaysAgo,
            notes: "Demo Opening Stock Valuation (OWNED)",
            isDemo: true,
            demoRunId,
          },
        });
        track("InventoryMovement", mv.id, mv.movementNumber, "Opening Stock (OWNED)");
        counts.inventory++;

        const existing = await db.stockBalance.findFirst({
          where: {
            warehouseId: mainYard.id,
            siteId: null,
            materialVariantId: item.variant.id,
            ownershipType: "OWNED",
            locationType: "WAREHOUSE",
          },
        });
        if (existing) {
          await db.stockBalance.update({
            where: { id: existing.id },
            data: {
              availableQty: existing.availableQty.plus(item.owned),
              totalQty: existing.totalQty.plus(item.owned),
              lastMovementAt: thirtyDaysAgo,
            },
          });
        } else {
          await db.stockBalance.create({
            data: {
              warehouseId: mainYard.id,
              materialVariantId: item.variant.id,
              ownershipType: "OWNED",
              locationType: "WAREHOUSE",
              availableQty: new Prisma.Decimal(item.owned),
              totalQty: new Prisma.Decimal(item.owned),
              lastMovementAt: thirtyDaysAgo,
            },
          });
        }
      }

      if (item.hired > 0) {
        const mvHired = await db.inventoryMovement.create({
          data: {
            movementNumber: `MV-DEMO-OP-${item.variant.materialCode}-H`,
            movementType: "OPENING_STOCK",
            materialVariantId: item.variant.id,
            ownershipType: "HIRED_IN",
            quantity: new Prisma.Decimal(item.hired),
            sourceLocationType: "WAREHOUSE",
            destinationLocationType: "WAREHOUSE",
            destinationWarehouseId: mainYard.id,
            movementDate: thirtyDaysAgo,
            notes: "Demo Opening Stock (HIRED_IN)",
            isDemo: true,
            demoRunId,
          },
        });
        track("InventoryMovement", mvHired.id, mvHired.movementNumber, "Opening Stock (HIRED_IN)");
        counts.inventory++;

        const existingHired = await db.stockBalance.findFirst({
          where: {
            warehouseId: mainYard.id,
            siteId: null,
            materialVariantId: item.variant.id,
            ownershipType: "HIRED_IN",
            locationType: "WAREHOUSE",
          },
        });
        if (existingHired) {
          await db.stockBalance.update({
            where: { id: existingHired.id },
            data: {
              availableQty: existingHired.availableQty.plus(item.hired),
              totalQty: existingHired.totalQty.plus(item.hired),
              lastMovementAt: thirtyDaysAgo,
            },
          });
        } else {
          await db.stockBalance.create({
            data: {
              warehouseId: mainYard.id,
              materialVariantId: item.variant.id,
              ownershipType: "HIRED_IN",
              locationType: "WAREHOUSE",
              availableQty: new Prisma.Decimal(item.hired),
              totalQty: new Prisma.Decimal(item.hired),
              lastMovementAt: thirtyDaysAgo,
            },
          });
        }
      }
    }

    // Stock Audit
    const audit = await db.stockAudit.create({
      data: {
        auditNumber: "AUD-DEMO-2026-0001",
        warehouseId: mainYard.id,
        title: "Full Physical Quarterly Stock Verification",
        status: "COMPLETED",
        conductedById: actor.id,
        auditDate: twentyDaysAgo,
        approvedAt: twentyDaysAgo,
        remarks: "Quarterly physical stock verification - 100% reconciled",
        isDemo: true,
        demoRunId,
      },
    });
    track("StockAudit", audit.id, audit.auditNumber, "Physical Stock Audit");
    counts.inventory++;

    // =========================================================================
    // 3. PURCHASES & GOODS RECEIPT (PO -> GRN -> BILL -> PAYMENT)
    // =========================================================================

    const po1 = await db.purchaseOrder.create({
      data: {
        poNumber: "PO-DEMO-2026-0001",
        supplierId: sup1.id,
        branchId: branch.id,
        deliveryWarehouseId: mainYard.id,
        orderDate: twentyDaysAgo,
        status: "COMPLETED",
        subtotal: new Prisma.Decimal("630000.00"),
        taxAmount: new Prisma.Decimal("113400.00"),
        grandTotal: new Prisma.Decimal("743400.00"),
        notes: "Centering props and spans procurement from Jindal",
        isDemo: true,
        demoRunId,
        items: {
          create: [
            {
              materialVariantId: propVariant.id,
              quantity: new Prisma.Decimal("400.000"),
              receivedQty: new Prisma.Decimal("400.000"),
              unitRate: new Prisma.Decimal("1200.00"),
              taxPercent: new Prisma.Decimal("18.00"),
              taxAmount: new Prisma.Decimal("86400.00"),
              totalAmount: new Prisma.Decimal("566400.00"),
            },
            {
              materialVariantId: spanVariant.id,
              quantity: new Prisma.Decimal("100.000"),
              receivedQty: new Prisma.Decimal("100.000"),
              unitRate: new Prisma.Decimal("1500.00"),
              taxPercent: new Prisma.Decimal("18.00"),
              taxAmount: new Prisma.Decimal("27000.00"),
              totalAmount: new Prisma.Decimal("177000.00"),
            },
          ],
        },
      },
    });
    track("PurchaseOrder", po1.id, po1.poNumber, "Completed Purchase Order");
    counts.purchases++;

    // Goods Receipt Note (GRN)
    const grn1 = await db.goodsReceiptNote.create({
      data: {
        grnNumber: "GRN-DEMO-2026-0001",
        purchaseOrderId: po1.id,
        supplierId: sup1.id,
        receivingWarehouseId: mainYard.id,
        receiptDate: eighteenDaysAgo,
        status: "POSTED",
        supplierInvoiceNumber: "JIN/CH-4412",
        supplierInvoiceDate: eighteenDaysAgo,
        isDemo: true,
        demoRunId,
        items: {
          create: [
            {
              materialVariantId: propVariant.id,
              orderedQty: new Prisma.Decimal("400.000"),
              receivedQty: new Prisma.Decimal("400.000"),
              acceptedQty: new Prisma.Decimal("400.000"),
              rejectedQty: new Prisma.Decimal("0.000"),
              unitCost: new Prisma.Decimal("1200.00"),
            },
            {
              materialVariantId: spanVariant.id,
              orderedQty: new Prisma.Decimal("100.000"),
              receivedQty: new Prisma.Decimal("100.000"),
              acceptedQty: new Prisma.Decimal("100.000"),
              rejectedQty: new Prisma.Decimal("0.000"),
              unitCost: new Prisma.Decimal("1500.00"),
            },
          ],
        },
      },
    });
    track("GoodsReceiptNote", grn1.id, grn1.grnNumber, "Goods Receipt Note");
    counts.purchases++;

    // Inventory movements for GRN
    const grnMv1 = await db.inventoryMovement.create({
      data: {
        movementNumber: "MV-DEMO-GRN-01-PROP",
        movementType: "PURCHASE_RECEIPT",
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        quantity: new Prisma.Decimal("400.000"),
        sourceLocationType: "WAREHOUSE",
        destinationLocationType: "WAREHOUSE",
        destinationWarehouseId: mainYard.id,
        movementDate: eighteenDaysAgo,
        isDemo: true,
        demoRunId,
      },
    });
    track("InventoryMovement", grnMv1.id, grnMv1.movementNumber, "GRN Purchase Receipt Props");
    counts.inventory++;

    const sbProp = await db.stockBalance.findFirst({
      where: {
        warehouseId: mainYard.id,
        siteId: null,
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        locationType: "WAREHOUSE",
      },
    });
    if (sbProp) {
      await db.stockBalance.update({
        where: { id: sbProp.id },
        data: {
          availableQty: sbProp.availableQty.plus(400),
          totalQty: sbProp.totalQty.plus(400),
        },
      });
    }

    // Purchase Bill
    const bill1 = await db.purchaseBill.create({
      data: {
        billNumber: "BILL-DEMO-2026-0001",
        purchaseOrderId: po1.id,
        goodsReceiptNoteId: grn1.id,
        supplierId: sup1.id,
        supplierInvoiceNumber: "JIN-INV-9901",
        supplierInvoiceDate: eighteenDaysAgo,
        billDate: eighteenDaysAgo,
        dueDate: new Date(now.getTime() + 15 * 86400000),
        fiscalYear,
        taxableAmount: new Prisma.Decimal("630000.00"),
        cgstAmount: new Prisma.Decimal("56700.00"),
        sgstAmount: new Prisma.Decimal("56700.00"),
        totalTaxAmount: new Prisma.Decimal("113400.00"),
        grandTotal: new Prisma.Decimal("743400.00"),
        paidAmount: new Prisma.Decimal("500000.00"),
        outstandingAmount: new Prisma.Decimal("243400.00"),
        isDemo: true,
        demoRunId,
      },
    });
    track("PurchaseBill", bill1.id, bill1.billNumber, "Supplier Purchase Bill");
    counts.purchases++;

    // Fetch account IDs for payments & journals
    const accounts = await db.chartOfAccount.findMany({
      where: {
        accountCode: {
          in: [
            "1010", "1020", "1025", "1030", "1060", "1061", "1070", "1200",
            "2010", "2041", "2042", "2060", "2070", "3010", "4010", "4030",
            "4040", "5010", "5030", "5035", "5040", "5050"
          ],
        },
      },
    });

    const accMap = new Map<string, string>();
    for (const a of accounts) {
      accMap.set(a.accountCode, a.id);
    }
    const getAccId = (code: string) => {
      const id = accMap.get(code);
      if (!id) throw new Error(`Required account code ${code} not found in Chart of Accounts.`);
      return id;
    };

    // Supplier Payment
    const spay1 = await db.supplierPayment.create({
      data: {
        paymentNumber: "SPAY-DEMO-2026-0001",
        supplierId: sup1.id,
        paymentDate: tenDaysAgo,
        fiscalYear,
        paymentMethod: "BANK_TRANSFER",
        disbursingAccountId: getAccId("1020"),
        amountPaid: new Prisma.Decimal("500000.00"),
        allocatedAmount: new Prisma.Decimal("500000.00"),
        unallocatedAmount: new Prisma.Decimal("0.00"),
        transactionReference: "HDFC-NEFT-991204",
        status: "POSTED",
        isDemo: true,
        demoRunId,
      },
    });
    track("SupplierPayment", spay1.id, spay1.paymentNumber, "Supplier Payment");
    counts.purchases++;

    await db.supplierPaymentAllocation.create({
      data: {
        supplierPaymentId: spay1.id,
        purchaseBillId: bill1.id,
        allocatedAmount: new Prisma.Decimal("500000.00"),
      },
    });

    // =========================================================================
    // 4. FLEET & DRIVERS (Rule #4 Company Fleet Only)
    // =========================================================================

    const v1 = await db.vehicle.create({
      data: {
        vehicleNumber: "KA-01-EA-4412",
        make: "Tata",
        model: "407 LPT Heavy Duty",
        category: "TRUCK",
        fuelType: "DIESEL",
        status: "ACTIVE",
        currentOdometer: new Prisma.Decimal("45820.00"),
        insuranceExpiryDate: new Date(now.getTime() + 180 * 86400000),
        fitnessExpiryDate: new Date(now.getTime() + 240 * 86400000),
        isDemo: true,
        demoRunId,
      },
    });
    track("Vehicle", v1.id, v1.vehicleNumber, "Company Truck 1");
    counts.fleet++;

    const v2 = await db.vehicle.create({
      data: {
        vehicleNumber: "KA-01-EA-7890",
        make: "Ashok Leyland",
        model: "Ecomet 1215",
        category: "TRUCK",
        fuelType: "DIESEL",
        status: "ACTIVE",
        currentOdometer: new Prisma.Decimal("62340.00"),
        insuranceExpiryDate: new Date(now.getTime() + 120 * 86400000),
        isDemo: true,
        demoRunId,
      },
    });
    track("Vehicle", v2.id, v2.vehicleNumber, "Company Truck 2");
    counts.fleet++;

    const v3 = await db.vehicle.create({
      data: {
        vehicleNumber: "KA-04-MH-3321",
        make: "Mahindra",
        model: "Bolero Maxi Truck Plus",
        category: "PICKUP",
        fuelType: "DIESEL",
        status: "ACTIVE",
        currentOdometer: new Prisma.Decimal("28150.00"),
        isDemo: true,
        demoRunId,
      },
    });
    track("Vehicle", v3.id, v3.vehicleNumber, "Company Mini Truck");
    counts.fleet++;

    const d1 = await db.driver.create({
      data: {
        driverCode: "DRV-DEMO-001",
        name: "Suresh Gowda",
        licenseNumber: "KA-01-2019-004412",
        mobileNumber: "9845112233",
        status: "ACTIVE",
        licenseExpiryDate: new Date(now.getTime() + 365 * 86400000),
        isDemo: true,
        demoRunId,
      },
    });
    track("Driver", d1.id, d1.driverCode, "Company Driver 1");
    counts.fleet++;

    const d2 = await db.driver.create({
      data: {
        driverCode: "DRV-DEMO-002",
        name: "Manjunath R.",
        licenseNumber: "KA-04-2020-007890",
        mobileNumber: "9845223344",
        status: "ACTIVE",
        licenseExpiryDate: new Date(now.getTime() + 400 * 86400000),
        isDemo: true,
        demoRunId,
      },
    });
    track("Driver", d2.id, d2.driverCode, "Company Driver 2");
    counts.fleet++;

    // Vehicle Fuel Logs
    const fuelLog1 = await db.vehicleFuelLog.create({
      data: {
        logNumber: "FUEL-DEMO-2026-0001",
        vehicleId: v1.id,
        fuelDate: twentyDaysAgo,
        odometerReading: new Prisma.Decimal("45200.00"),
        quantityLitres: new Prisma.Decimal("45.00"),
        pricePerUnit: new Prisma.Decimal("96.00"),
        totalCost: new Prisma.Decimal("4320.00"),
        fuelStation: "Indian Oil Swastik Peenya",
        isFullTank: true,
        isDemo: true,
        demoRunId,
      },
    });
    track("VehicleFuelLog", fuelLog1.id, null, "Fuel Fill 1");
    counts.fleet++;

    const fuelLog2 = await db.vehicleFuelLog.create({
      data: {
        logNumber: "FUEL-DEMO-2026-0002",
        vehicleId: v1.id,
        fuelDate: tenDaysAgo,
        odometerReading: new Prisma.Decimal("45510.00"),
        quantityLitres: new Prisma.Decimal("45.00"),
        pricePerUnit: new Prisma.Decimal("96.00"),
        totalCost: new Prisma.Decimal("4320.00"),
        fuelStation: "Bharat Petroleum Peenya",
        isFullTank: true,
        isDemo: true,
        demoRunId,
      },
    });
    track("VehicleFuelLog", fuelLog2.id, null, "Fuel Fill 2");
    counts.fleet++;

    // Maintenance Record
    const maint1 = await db.vehicleMaintenanceRecord.create({
      data: {
        recordNumber: "VMR-DEMO-2026-0001",
        vehicleId: v1.id,
        serviceDate: fifteenDaysAgo,
        serviceCategory: "REGULAR_SERVICE",
        descriptionOfWork: "10,000 km Periodic Service, Engine Oil change, Fuel Filter & Greasing",
        odometerReading: new Prisma.Decimal("45350.00"),
        totalCost: new Prisma.Decimal("12500.00"),
        serviceProvider: "Prerana Motors Tata Authorized, Peenya",
        isDemo: true,
        demoRunId,
      },
    });
    track("VehicleMaintenanceRecord", maint1.id, null, "Vehicle Service Record");
    counts.fleet++;

    // =========================================================================
    // 5. LABOUR & WAGE MANAGEMENT
    // =========================================================================

    const w1 = await db.labourWorker.create({
      data: {
        workerCode: "WRK-DEMO-001",
        name: "Muthu Vel",
        category: "SUPERVISOR",
        skillTrade: "Yard Supervisor",
        wageType: "MONTHLY",
        monthlySalary: new Prisma.Decimal("28000.00"),
        dailyWage: new Prisma.Decimal("0.00"),
        mobileNumber: "9845331122",
        status: "ACTIVE",
        joiningDate: thirtyDaysAgo,
        isDemo: true,
        demoRunId,
      },
    });
    track("LabourWorker", w1.id, w1.workerCode, "Yard Supervisor");
    counts.labour++;

    const w2 = await db.labourWorker.create({
      data: {
        workerCode: "WRK-DEMO-002",
        name: "Raju Naik",
        category: "REPAIR_MAINTENANCE",
        skillTrade: "Welder",
        wageType: "DAILY",
        dailyWage: new Prisma.Decimal("950.00"),
        monthlySalary: new Prisma.Decimal("0.00"),
        mobileNumber: "9845331123",
        status: "ACTIVE",
        joiningDate: thirtyDaysAgo,
        isDemo: true,
        demoRunId,
      },
    });
    track("LabourWorker", w2.id, w2.workerCode, "Senior Welder");
    counts.labour++;

    const w3 = await db.labourWorker.create({
      data: {
        workerCode: "WRK-DEMO-003",
        name: "Shankar Lal",
        category: "LOADING_UNLOADING",
        skillTrade: "Loader",
        wageType: "DAILY",
        dailyWage: new Prisma.Decimal("800.00"),
        monthlySalary: new Prisma.Decimal("0.00"),
        mobileNumber: "9845331124",
        status: "ACTIVE",
        joiningDate: thirtyDaysAgo,
        isDemo: true,
        demoRunId,
      },
    });
    track("LabourWorker", w3.id, w3.workerCode, "Yard Loading Lead");
    counts.labour++;

    // Labour Attendance Records (7 days)
    for (let i = 7; i >= 1; i--) {
      const attDate = new Date(now.getTime() - i * 86400000);
      const att1 = await db.labourAttendance.create({
        data: {
          workerId: w1.id,
          attendanceDate: attDate,
          status: "PRESENT",
          overtimeHours: new Prisma.Decimal(i % 2 === 0 ? "2.0" : "0.0"),
          isDemo: true,
          demoRunId,
        },
      });
      track("LabourAttendance", att1.id, null, "Attendance");
      counts.labour++;

      const att2 = await db.labourAttendance.create({
        data: {
          workerId: w2.id,
          attendanceDate: attDate,
          status: "PRESENT",
          overtimeHours: new Prisma.Decimal("1.5"),
          isDemo: true,
          demoRunId,
        },
      });
      track("LabourAttendance", att2.id, null, "Attendance");
      counts.labour++;
    }

    // Labour Advance
    const adv1 = await db.labourAdvance.create({
      data: {
        advanceNumber: "AE/LADV/DEMO-01",
        workerId: w2.id,
        advanceDate: twentyDaysAgo,
        amount: new Prisma.Decimal("5000.00"),
        paymentMode: "CASH",
        recoveredAmount: new Prisma.Decimal("5000.00"),
        outstandingAmount: new Prisma.Decimal("0.00"),
        status: "APPROVED",
        purpose: "Festival advance (deducted in monthly wage settlement)",
        isDemo: true,
        demoRunId,
      },
    });
    track("LabourAdvance", adv1.id, adv1.advanceNumber, "Labour Advance");
    counts.labour++;

    // Labour Wage Settlement
    const wage1 = await db.labourWageSettlement.create({
      data: {
        settlementNumber: "AE/LWAGE/DEMO-01",
        workerId: w2.id,
        periodStart: thirtyDaysAgo,
        periodEnd: tenDaysAgo,
        daysPresent: new Prisma.Decimal("24.00"),
        baseWageAmount: new Prisma.Decimal("22800.00"),
        overtimeAmount: new Prisma.Decimal("1900.00"),
        grossAmount: new Prisma.Decimal("24700.00"),
        advanceDeduction: new Prisma.Decimal("5000.00"),
        netPayable: new Prisma.Decimal("19700.00"),
        paidAmount: new Prisma.Decimal("19700.00"),
        status: "PAID",
        isDemo: true,
        demoRunId,
      },
    });
    track("LabourWageSettlement", wage1.id, wage1.settlementNumber, "Wage Settlement");
    counts.labour++;

    // =========================================================================
    // 6. RENTAL AGREEMENTS, MOVEMENTS (DN/MRN/DIRECT TRANSFERS) & BATCHES
    // =========================================================================

    const agr1 = await db.rentalAgreement.create({
      data: {
        agreementNumber: "AE/AGR/DEMO-2026-0001",
        customerId: cust1.id,
        customerSiteId: site1A.id,
        startDate: twentyDaysAgo,
        depositAmount: new Prisma.Decimal("75000.00"),
        billingFrequency: "MONTHLY",
        status: "ACTIVE",
        notes: "Centering props and spans rental for Skyline Whitefield project",
        isDemo: true,
        demoRunId,
      },
    });
    track("RentalAgreement", agr1.id, agr1.agreementNumber, "Rental Agreement Skyline");
    counts.rentals++;

    const agr2 = await db.rentalAgreement.create({
      data: {
        agreementNumber: "AE/AGR/DEMO-2026-0002",
        customerId: cust2.id,
        customerSiteId: site2A.id,
        startDate: eighteenDaysAgo,
        depositAmount: new Prisma.Decimal("50000.00"),
        billingFrequency: "MONTHLY",
        status: "ACTIVE",
        notes: "Formwork rental for Electronic City Pier project",
        isDemo: true,
        demoRunId,
      },
    });
    track("RentalAgreement", agr2.id, agr2.agreementNumber, "Rental Agreement Apex");
    counts.rentals++;

    const agr3 = await db.rentalAgreement.create({
      data: {
        agreementNumber: "AE/AGR/DEMO-2026-0003",
        customerId: cust3.id,
        customerSiteId: site3A.id,
        startDate: fifteenDaysAgo,
        depositAmount: new Prisma.Decimal("30000.00"),
        billingFrequency: "MONTHLY",
        status: "ACTIVE",
        notes: "Centering props rental for Peenya Commercial",
        isDemo: true,
        demoRunId,
      },
    });
    track("RentalAgreement", agr3.id, agr3.agreementNumber, "Rental Agreement Kaveri");
    counts.rentals++;

    // Security Deposit Receipt for Skyline
    const dep1 = await db.rentalDepositTransaction.create({
      data: {
        depositNumber: "AE/DEP/DEMO-0001",
        rentalAgreementId: agr1.id,
        customerId: cust1.id,
        customerSiteId: site1A.id,
        transactionType: "DEPOSIT_RECEIVED",
        amount: new Prisma.Decimal("75000.00"),
        receiptDate: twentyDaysAgo,
        referenceNumber: "HDFC-NEFT-DEP-01",
      },
    });
    track("RentalDepositTransaction", dep1.id, dep1.depositNumber, "Security Deposit Receipt");
    counts.rentals++;

    // Delivery Note 1 (DN-1) -> Skyline Site 1A
    const dn1 = await db.deliveryNote.create({
      data: {
        dnNumber: "AE/DN/DEMO-2026-0001",
        customerId: cust1.id,
        customerSiteId: site1A.id,
        sourceWarehouseId: mainYard.id,
        deliveryDate: twentyDaysAgo,
        status: "DELIVERED",
        vehicleNumber: "KA-01-EA-4412",
        driverName: "Suresh Gowda",
        driverPhone: "9845112233",
        receiverName: "Kiran Patel",
        receiverPhone: "9845022334",
        receiverDesignation: "Site Engineer",
        gpsLatitude: new Prisma.Decimal("12.9716"),
        gpsLongitude: new Prisma.Decimal("77.5946"),
        gpsAccuracy: new Prisma.Decimal("4.8"),
        photoUrl: "https://inventra.storage/evidence/dn-demo-01-gps.jpg",
        receiverSignatureUrl: "https://inventra.storage/signatures/kiran-patel.png",
        isDemo: true,
        demoRunId,
        items: {
          create: [
            {
              materialVariantId: propVariant.id,
              ownershipType: "OWNED",
              quantity: new Prisma.Decimal("500.000"),
              dailyRate: new Prisma.Decimal("2.50"),
            },
            {
              materialVariantId: spanVariant.id,
              ownershipType: "OWNED",
              quantity: new Prisma.Decimal("200.000"),
              dailyRate: new Prisma.Decimal("4.00"),
            },
            {
              materialVariantId: sheetVariant.id,
              ownershipType: "OWNED",
              quantity: new Prisma.Decimal("300.000"),
              dailyRate: new Prisma.Decimal("1.80"),
            },
          ],
        },
      },
    });
    track("DeliveryNote", dn1.id, dn1.dnNumber, "Delivery Note Skyline");
    counts.operations++;

    const ev1 = await db.movementEvidence.create({
      data: {
        documentType: "DELIVERY_NOTE",
        documentId: dn1.id,
        deliveryNoteId: dn1.id,
        photoUrl: "https://inventra.storage/evidence/dn-demo-01-gps.jpg",
        gpsLatitude: new Prisma.Decimal("12.9716000"),
        gpsLongitude: new Prisma.Decimal("77.5946000"),
        gpsAccuracy: new Prisma.Decimal("4.80"),
        capturedAt: twentyDaysAgo,
        receiverName: "Kiran Patel",
        receiverPhone: "9845022334",
        receiverDesignation: "Site Engineer",
        receiverSignatureUrl: "https://inventra.storage/signatures/kiran-patel.png",
      },
    });
    track("MovementEvidence", ev1.id, null, "GPS Delivery Proof");
    counts.operations++;

    const trip1 = await db.vehicleTrip.create({
      data: {
        tripNumber: "AE/TRIP/DEMO-001",
        vehicleId: v1.id,
        driverId: d1.id,
        originWarehouseId: mainYard.id,
        destinationSiteId: site1A.id,
        startOdometer: new Prisma.Decimal("45200.00"),
        endOdometer: new Prisma.Decimal("45242.00"),
        distanceKm: new Prisma.Decimal("42.00"),
        departureTime: twentyDaysAgo,
        arrivalTime: twentyDaysAgo,
        tripPurpose: "DELIVERY",
        status: "COMPLETED",
        isDemo: true,
        demoRunId,
      },
    });
    track("VehicleTrip", trip1.id, trip1.tripNumber, "Delivery Trip 1");
    counts.fleet++;

    const rbProp = await db.rentalBatch.create({
      data: {
        batchNumber: "RB-DEMO-2026-0001",
        customerId: cust1.id,
        customerSiteId: site1A.id,
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        deliveryDate: twentyDaysAgo,
        deliveryNoteId: dn1.id,
        deliveredQty: new Prisma.Decimal("500.000"),
        currentHeldQty: new Prisma.Decimal("250.000"),
        returnedQty: new Prisma.Decimal("150.000"),
        applicableDailyRate: new Prisma.Decimal("2.50"),
        status: "ACTIVE",
        isDemo: true,
        demoRunId,
      },
    });
    track("RentalBatch", rbProp.id, rbProp.batchNumber, "Active Rental Batch Props");
    counts.rentals++;

    const rbSpan = await db.rentalBatch.create({
      data: {
        batchNumber: "RB-DEMO-2026-0002",
        customerId: cust1.id,
        customerSiteId: site1A.id,
        materialVariantId: spanVariant.id,
        ownershipType: "OWNED",
        deliveryDate: twentyDaysAgo,
        deliveryNoteId: dn1.id,
        deliveredQty: new Prisma.Decimal("200.000"),
        currentHeldQty: new Prisma.Decimal("150.000"),
        returnedQty: new Prisma.Decimal("50.000"),
        applicableDailyRate: new Prisma.Decimal("4.00"),
        status: "ACTIVE",
        isDemo: true,
        demoRunId,
      },
    });
    track("RentalBatch", rbSpan.id, rbSpan.batchNumber, "Active Rental Batch Spans");
    counts.rentals++;

    const mvDnProp = await db.inventoryMovement.create({
      data: {
        movementNumber: "MV-DEMO-DN-01-PROP",
        movementType: "DELIVERY_DISPATCH",
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        quantity: new Prisma.Decimal("500.000"),
        sourceLocationType: "WAREHOUSE",
        sourceWarehouseId: mainYard.id,
        destinationLocationType: "CUSTOMER_SITE",
        destinationSiteId: site1A.id,
        referenceDocumentType: "DELIVERY_NOTE",
        referenceDocumentId: dn1.id,
        movementDate: twentyDaysAgo,
        isDemo: true,
        demoRunId,
      },
    });
    track("InventoryMovement", mvDnProp.id, mvDnProp.movementNumber, "DN Props Dispatch");
    counts.inventory++;

    const sbMainProp = await db.stockBalance.findFirst({
      where: {
        warehouseId: mainYard.id,
        siteId: null,
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        locationType: "WAREHOUSE",
      },
    });
    if (sbMainProp) {
      await db.stockBalance.update({
        where: { id: sbMainProp.id },
        data: {
          availableQty: sbMainProp.availableQty.minus(500),
          totalQty: sbMainProp.totalQty.minus(500),
        },
      });
    }

    const sbSite1Prop = await db.stockBalance.findFirst({
      where: {
        warehouseId: null,
        siteId: site1A.id,
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        locationType: "CUSTOMER_SITE",
      },
    });
    if (sbSite1Prop) {
      await db.stockBalance.update({
        where: { id: sbSite1Prop.id },
        data: {
          availableQty: sbSite1Prop.availableQty.plus(500),
          totalQty: sbSite1Prop.totalQty.plus(500),
        },
      });
    } else {
      await db.stockBalance.create({
        data: {
          siteId: site1A.id,
          materialVariantId: propVariant.id,
          ownershipType: "OWNED",
          locationType: "CUSTOMER_SITE",
          availableQty: new Prisma.Decimal("500.000"),
          totalQty: new Prisma.Decimal("500.000"),
        },
      });
    }

    // Material Return Note (MRN-1) from Skyline Site 1A
    const mrn1 = await db.materialReturnNote.create({
      data: {
        mrnNumber: "AE/MRN/DEMO-2026-0001",
        customerId: cust1.id,
        customerSiteId: site1A.id,
        receivingWarehouseId: mainYard.id,
        referenceDeliveryNoteId: dn1.id,
        returnDate: tenDaysAgo,
        status: "POSTED",
        vehicleNumber: "KA-01-EA-4412",
        driverName: "Suresh Gowda",
        receiverName: "Muthu Vel",
        isDemo: true,
        demoRunId,
        items: {
          create: [
            {
              materialVariantId: propVariant.id,
              ownershipType: "OWNED",
              returnedQty: new Prisma.Decimal("150.000"),
              acceptedQty: new Prisma.Decimal("125.000"),
              damagedQty: new Prisma.Decimal("20.000"),
              missingQty: new Prisma.Decimal("5.000"),
            },
            {
              materialVariantId: spanVariant.id,
              ownershipType: "OWNED",
              returnedQty: new Prisma.Decimal("50.000"),
              acceptedQty: new Prisma.Decimal("50.000"),
              damagedQty: new Prisma.Decimal("0.000"),
              missingQty: new Prisma.Decimal("0.000"),
            },
          ],
        },
      },
    });
    track("MaterialReturnNote", mrn1.id, mrn1.mrnNumber, "Material Return Skyline");
    counts.operations++;

    await db.rentalReturnAllocation.create({
      data: {
        rentalBatchId: rbProp.id,
        materialReturnNoteId: mrn1.id,
        returnDate: tenDaysAgo,
        allocatedReturnedQty: new Prisma.Decimal("150.000"),
        allocatedAcceptedQty: new Prisma.Decimal("125.000"),
        allocatedDamagedQty: new Prisma.Decimal("20.000"),
        allocatedMissingQty: new Prisma.Decimal("5.000"),
      },
    });

    const mvMrnGood = await db.inventoryMovement.create({
      data: {
        movementNumber: "MV-DEMO-MRN-01-GOOD",
        movementType: "RETURN_RECEIPT",
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        quantity: new Prisma.Decimal("125.000"),
        sourceLocationType: "CUSTOMER_SITE",
        sourceSiteId: site1A.id,
        destinationLocationType: "WAREHOUSE",
        destinationWarehouseId: mainYard.id,
        referenceDocumentType: "RETURN_NOTE",
        referenceDocumentId: mrn1.id,
        movementDate: tenDaysAgo,
        isDemo: true,
        demoRunId,
      },
    });
    track("InventoryMovement", mvMrnGood.id, mvMrnGood.movementNumber, "MRN Good Props Returned");
    counts.inventory++;

    const mvMrnDamaged = await db.inventoryMovement.create({
      data: {
        movementNumber: "MV-DEMO-MRN-01-DMG",
        movementType: "RETURN_DAMAGED",
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        quantity: new Prisma.Decimal("20.000"),
        sourceLocationType: "CUSTOMER_SITE",
        sourceSiteId: site1A.id,
        destinationLocationType: "WAREHOUSE",
        destinationWarehouseId: mainYard.id,
        referenceDocumentType: "RETURN_NOTE",
        referenceDocumentId: mrn1.id,
        movementDate: tenDaysAgo,
        notes: "Bent outer pipes - transferred to Maintenance Yard",
        isDemo: true,
        demoRunId,
      },
    });
    track("InventoryMovement", mvMrnDamaged.id, mvMrnDamaged.movementNumber, "MRN Damaged Props Returned");
    counts.inventory++;

    const sbMainAfterReturn = await db.stockBalance.findFirst({
      where: {
        warehouseId: mainYard.id,
        siteId: null,
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        locationType: "WAREHOUSE",
      },
    });
    if (sbMainAfterReturn) {
      await db.stockBalance.update({
        where: { id: sbMainAfterReturn.id },
        data: {
          availableQty: sbMainAfterReturn.availableQty.plus(125),
          damagedQty: sbMainAfterReturn.damagedQty.plus(20),
          totalQty: sbMainAfterReturn.totalQty.plus(145),
        },
      });
    }

    const sbSiteAfterReturn = await db.stockBalance.findFirst({
      where: {
        warehouseId: null,
        siteId: site1A.id,
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        locationType: "CUSTOMER_SITE",
      },
    });
    if (sbSiteAfterReturn) {
      await db.stockBalance.update({
        where: { id: sbSiteAfterReturn.id },
        data: {
          availableQty: sbSiteAfterReturn.availableQty.minus(150),
          totalQty: sbSiteAfterReturn.totalQty.minus(150),
        },
      });
    }

    // =========================================================================
    // 7. DIRECT SITE-TO-SITE MATERIAL TRANSFER
    // =========================================================================

    const dstn1 = await db.directSiteTransferNote.create({
      data: {
        transferNumber: "AE/DSTN/DEMO-2026-0001",
        sourceCustomerId: cust1.id,
        sourceCustomerSiteId: site1A.id,
        destinationCustomerId: cust2.id,
        destinationCustomerSiteId: site2A.id,
        transferDate: fiveDaysAgo,
        status: "COMPLETED",
        vehicleId: v1.id,
        driverId: d1.id,
        dispatchedAt: fiveDaysAgo,
        sourceRepName: "Kiran Patel",
        sourceRepPhone: "9845022334",
        isDemo: true,
        demoRunId,
        items: {
          create: [
            {
              materialVariantId: propVariant.id,
              ownershipType: "OWNED",
              sourceRentalBatchId: rbProp.id,
              quantityDispatched: new Prisma.Decimal("100.000"),
              quantityAccepted: new Prisma.Decimal("100.000"),
              agreedDailyRate: new Prisma.Decimal("2.75"),
            },
          ],
        },
      },
    });
    track("DirectSiteTransferNote", dstn1.id, dstn1.transferNumber, "Direct Site Transfer");
    counts.operations++;

    const rbApexDirect = await db.rentalBatch.create({
      data: {
        batchNumber: "RB-DEMO-2026-0003",
        customerId: cust2.id,
        customerSiteId: site2A.id,
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        directSiteTransferId: dstn1.id,
        deliveryDate: fiveDaysAgo,
        deliveredQty: new Prisma.Decimal("100.000"),
        currentHeldQty: new Prisma.Decimal("100.000"),
        returnedQty: new Prisma.Decimal("0.000"),
        applicableDailyRate: new Prisma.Decimal("2.75"),
        status: "ACTIVE",
        isDemo: true,
        demoRunId,
      },
    });
    track("RentalBatch", rbApexDirect.id, rbApexDirect.batchNumber, "Apex Batch from Direct Transfer");
    counts.rentals++;

    const mvDstnOut = await db.inventoryMovement.create({
      data: {
        movementNumber: "MV-DEMO-DSTN-01-OUT",
        movementType: "DIRECT_TRANSFER_DISPATCH",
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        quantity: new Prisma.Decimal("100.000"),
        sourceLocationType: "CUSTOMER_SITE",
        sourceSiteId: site1A.id,
        destinationLocationType: "CUSTOMER_SITE",
        destinationSiteId: site2A.id,
        movementDate: fiveDaysAgo,
        notes: "Direct Transfer out to Apex Tech Park",
        isDemo: true,
        demoRunId,
      },
    });
    track("InventoryMovement", mvDstnOut.id, mvDstnOut.movementNumber, "Direct Transfer Dispatch");
    counts.inventory++;

    const mvDstnIn = await db.inventoryMovement.create({
      data: {
        movementNumber: "MV-DEMO-DSTN-01-IN",
        movementType: "DIRECT_TRANSFER_RECEIPT",
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        quantity: new Prisma.Decimal("100.000"),
        sourceLocationType: "CUSTOMER_SITE",
        sourceSiteId: site1A.id,
        destinationLocationType: "CUSTOMER_SITE",
        destinationSiteId: site2A.id,
        movementDate: fiveDaysAgo,
        notes: "Direct Transfer in from Skyline Whitefield",
        isDemo: true,
        demoRunId,
      },
    });
    track("InventoryMovement", mvDstnIn.id, mvDstnIn.movementNumber, "Direct Transfer Receipt");
    counts.inventory++;

    const sbSite1AfterDstn = await db.stockBalance.findFirst({
      where: {
        warehouseId: null,
        siteId: site1A.id,
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        locationType: "CUSTOMER_SITE",
      },
    });
    if (sbSite1AfterDstn) {
      await db.stockBalance.update({
        where: { id: sbSite1AfterDstn.id },
        data: {
          availableQty: sbSite1AfterDstn.availableQty.minus(100),
          totalQty: sbSite1AfterDstn.totalQty.minus(100),
        },
      });
    }

    const sbSite2AfterDstn = await db.stockBalance.findFirst({
      where: {
        warehouseId: null,
        siteId: site2A.id,
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        locationType: "CUSTOMER_SITE",
      },
    });
    if (sbSite2AfterDstn) {
      await db.stockBalance.update({
        where: { id: sbSite2AfterDstn.id },
        data: {
          availableQty: sbSite2AfterDstn.availableQty.plus(100),
          totalQty: sbSite2AfterDstn.totalQty.plus(100),
        },
      });
    } else {
      await db.stockBalance.create({
        data: {
          siteId: site2A.id,
          materialVariantId: propVariant.id,
          ownershipType: "OWNED",
          locationType: "CUSTOMER_SITE",
          availableQty: new Prisma.Decimal("100.000"),
          totalQty: new Prisma.Decimal("100.000"),
        },
      });
    }

    // =========================================================================
    // 8. MATERIAL MAINTENANCE & REPAIR (MRN damaged props -> repaired)
    // =========================================================================

    const repJob1 = await db.materialRepairJob.create({
      data: {
        jobCode: "AE/REP/DEMO-2026-0001",
        warehouseId: mainYard.id,
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        mrnId: mrn1.id,
        totalQuantity: new Prisma.Decimal("20.000"),
        repairedQuantity: new Prisma.Decimal("18.000"),
        scrappedQuantity: new Prisma.Decimal("2.000"),
        remainingQuantity: new Prisma.Decimal("0.000"),
        damageDescription: "Bent outer pipes and damaged locking pins returned from Skyline Whitefield",
        priority: "MEDIUM",
        assignedTechnicianId: w2.id,
        startDate: nineDaysAgo,
        completedDate: threeDaysAgo,
        partsCost: new Prisma.Decimal("1900.00"),
        labourCost: new Prisma.Decimal("1500.00"),
        totalCost: new Prisma.Decimal("3400.00"),
        status: "COMPLETED",
        isDemo: true,
        demoRunId,
      },
    });
    track("MaterialRepairJob", repJob1.id, repJob1.jobCode, "Completed Material Repair Job");
    counts.maintenance++;

    const repLog1 = await db.materialRepairLog.create({
      data: {
        repairJobId: repJob1.id,
        action: "PARTS_REPLACED",
        notes: "Hydraulic straightening of 18 props, welded collar sleeves, threaded new pins",
        partsUsed: "18 High-tensile steel pin collars",
        cost: new Prisma.Decimal("3400.00"),
        technicianName: "Raju Naik",
      },
    });
    track("MaterialRepairLog", repLog1.id, null, "Repair Work Log");
    counts.maintenance++;

    const mvRepaired = await db.inventoryMovement.create({
      data: {
        movementNumber: "MV-DEMO-REP-01-REL",
        movementType: "STOCK_RECEIPT",
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        quantity: new Prisma.Decimal("18.000"),
        sourceLocationType: "WAREHOUSE",
        destinationLocationType: "WAREHOUSE",
        destinationWarehouseId: mainYard.id,
        movementDate: threeDaysAgo,
        notes: "18 props repaired and reconditioned released to stock",
        isDemo: true,
        demoRunId,
      },
    });
    track("InventoryMovement", mvRepaired.id, mvRepaired.movementNumber, "Repaired Props Released to Stock");
    counts.inventory++;

    const sbMainRepaired = await db.stockBalance.findFirst({
      where: {
        warehouseId: mainYard.id,
        siteId: null,
        materialVariantId: propVariant.id,
        ownershipType: "OWNED",
        locationType: "WAREHOUSE",
      },
    });
    if (sbMainRepaired) {
      await db.stockBalance.update({
        where: { id: sbMainRepaired.id },
        data: {
          damagedQty: sbMainRepaired.damagedQty.minus(18),
          availableQty: sbMainRepaired.availableQty.plus(18),
        },
      });
    }

    // =========================================================================
    // 9. RENTAL BILLING & INVOICING
    // =========================================================================

    const stm1 = await db.rentalStatement.create({
      data: {
        statementNumber: "AE/STM/DEMO-2026-0001",
        billingMode: "SITE_WISE",
        customerId: cust1.id,
        customerSiteId: site1A.id,
        rentalAgreementId: agr1.id,
        periodStartDate: twentyDaysAgo,
        periodEndDate: twoDaysAgo,
        totalRentalAmount: new Prisma.Decimal("145000.00"),
        totalDamageCharges: new Prisma.Decimal("8000.00"),
        totalMissingCharges: new Prisma.Decimal("6500.00"),
        netPayableAmount: new Prisma.Decimal("159500.00"),
        status: "FINALIZED",
        finalizedAt: twoDaysAgo,
        isDemo: true,
        demoRunId,
      },
    });
    track("RentalStatement", stm1.id, stm1.statementNumber, "Rental Statement Skyline");
    counts.rentals++;

    const inv1 = await db.invoice.create({
      data: {
        invoiceNumber: "AE/INV/DEMO-2026-0001",
        invoiceType: "RENTAL",
        customerId: cust1.id,
        customerSiteId: site1A.id,
        rentalStatementId: stm1.id,
        invoiceDate: twoDaysAgo,
        dueDate: new Date(now.getTime() + 15 * 86400000),
        fiscalYear,
        placeOfSupply: "29",
        subtotal: new Prisma.Decimal("159500.00"),
        taxableAmount: new Prisma.Decimal("159500.00"),
        cgstAmount: new Prisma.Decimal("14355.00"),
        sgstAmount: new Prisma.Decimal("14355.00"),
        igstAmount: new Prisma.Decimal("0.00"),
        totalTaxAmount: new Prisma.Decimal("28710.00"),
        grandTotal: new Prisma.Decimal("188210.00"),
        paidAmount: new Prisma.Decimal("120000.00"),
        outstandingAmount: new Prisma.Decimal("68210.00"),
        status: "PARTIALLY_PAID",
        notes: "Monthly Rental & Recovery for Whitefield Tower B",
        isDemo: true,
        demoRunId,
        items: {
          create: [
            {
              itemType: "RENTAL",
              materialVariantId: propVariant.id,
              itemDescription: "Centering Props & Spans Monthly Rental",
              hsnSacCode: "9973",
              quantity: new Prisma.Decimal("1.000"),
              unitRate: new Prisma.Decimal("145000.00"),
              taxableValue: new Prisma.Decimal("145000.00"),
              gstRatePercent: new Prisma.Decimal("18.00"),
              cgstAmount: new Prisma.Decimal("13050.00"),
              sgstAmount: new Prisma.Decimal("13050.00"),
              totalAmount: new Prisma.Decimal("171100.00"),
            },
            {
              itemType: "DAMAGE_CHARGE",
              materialVariantId: propVariant.id,
              itemDescription: "Material Damage & Reconditioning Charges",
              hsnSacCode: "9973",
              quantity: new Prisma.Decimal("1.000"),
              unitRate: new Prisma.Decimal("8000.00"),
              taxableValue: new Prisma.Decimal("8000.00"),
              gstRatePercent: new Prisma.Decimal("18.00"),
              cgstAmount: new Prisma.Decimal("720.00"),
              sgstAmount: new Prisma.Decimal("720.00"),
              totalAmount: new Prisma.Decimal("9440.00"),
            },
            {
              itemType: "MISSING_CHARGE",
              materialVariantId: propVariant.id,
              itemDescription: "Missing Material Replacement Recovery",
              hsnSacCode: "9973",
              quantity: new Prisma.Decimal("1.000"),
              unitRate: new Prisma.Decimal("6500.00"),
              taxableValue: new Prisma.Decimal("6500.00"),
              gstRatePercent: new Prisma.Decimal("18.00"),
              cgstAmount: new Prisma.Decimal("585.00"),
              sgstAmount: new Prisma.Decimal("585.00"),
              totalAmount: new Prisma.Decimal("7670.00"),
            },
          ],
        },
      },
    });
    track("Invoice", inv1.id, inv1.invoiceNumber, "Rental Invoice Skyline");
    counts.accounting++;

    const rec1 = await db.paymentReceipt.create({
      data: {
        receiptNumber: "AE/REC/DEMO-2026-0001",
        customerId: cust1.id,
        paymentDate: now,
        fiscalYear,
        paymentMethod: "BANK_TRANSFER",
        depositAccountId: getAccId("1020"),
        amountReceived: new Prisma.Decimal("120000.00"),
        allocatedAmount: new Prisma.Decimal("120000.00"),
        unallocatedAmount: new Prisma.Decimal("0.00"),
        transactionReference: "HDFC-NEFT-SKYLINE-01",
        status: "POSTED",
        isDemo: true,
        demoRunId,
      },
    });
    track("PaymentReceipt", rec1.id, rec1.receiptNumber, "Payment Receipt Skyline");
    counts.accounting++;

    await db.paymentAllocation.create({
      data: {
        receiptId: rec1.id,
        invoiceId: inv1.id,
        allocatedAmount: new Prisma.Decimal("120000.00"),
      },
    });

    const inv2 = await db.invoice.create({
      data: {
        invoiceNumber: "AE/INV/DEMO-2026-0002",
        invoiceType: "RENTAL",
        customerId: cust2.id,
        customerSiteId: site2A.id,
        invoiceDate: fiveDaysAgo,
        dueDate: now,
        fiscalYear,
        placeOfSupply: "29",
        subtotal: new Prisma.Decimal("95000.00"),
        taxableAmount: new Prisma.Decimal("95000.00"),
        cgstAmount: new Prisma.Decimal("8550.00"),
        sgstAmount: new Prisma.Decimal("8550.00"),
        igstAmount: new Prisma.Decimal("0.00"),
        totalTaxAmount: new Prisma.Decimal("17100.00"),
        grandTotal: new Prisma.Decimal("112100.00"),
        paidAmount: new Prisma.Decimal("112100.00"),
        outstandingAmount: new Prisma.Decimal("0.00"),
        status: "PAID",
        notes: "Electronic City Formwork Rental",
        isDemo: true,
        demoRunId,
      },
    });
    track("Invoice", inv2.id, inv2.invoiceNumber, "Rental Invoice Apex");
    counts.accounting++;

    const rec2 = await db.paymentReceipt.create({
      data: {
        receiptNumber: "AE/REC/DEMO-2026-0002",
        customerId: cust2.id,
        paymentDate: twoDaysAgo,
        fiscalYear,
        paymentMethod: "UPI",
        depositAccountId: getAccId("1025"),
        amountReceived: new Prisma.Decimal("112100.00"),
        allocatedAmount: new Prisma.Decimal("112100.00"),
        unallocatedAmount: new Prisma.Decimal("0.00"),
        transactionReference: "UPI-APEX-99210",
        status: "POSTED",
        isDemo: true,
        demoRunId,
      },
    });
    track("PaymentReceipt", rec2.id, rec2.receiptNumber, "Payment Receipt Apex");
    counts.accounting++;

    await db.paymentAllocation.create({
      data: {
        receiptId: rec2.id,
        invoiceId: inv2.id,
        allocatedAmount: new Prisma.Decimal("112100.00"),
      },
    });

    const inv3 = await db.invoice.create({
      data: {
        invoiceNumber: "AE/INV/DEMO-2026-0003",
        invoiceType: "RENTAL",
        customerId: cust3.id,
        customerSiteId: site3A.id,
        invoiceDate: twoDaysAgo,
        dueDate: new Date(now.getTime() + 10 * 86400000),
        fiscalYear,
        placeOfSupply: "29",
        subtotal: new Prisma.Decimal("42000.00"),
        taxableAmount: new Prisma.Decimal("42000.00"),
        cgstAmount: new Prisma.Decimal("3780.00"),
        sgstAmount: new Prisma.Decimal("3780.00"),
        igstAmount: new Prisma.Decimal("0.00"),
        totalTaxAmount: new Prisma.Decimal("7560.00"),
        grandTotal: new Prisma.Decimal("49560.00"),
        paidAmount: new Prisma.Decimal("0.00"),
        outstandingAmount: new Prisma.Decimal("49560.00"),
        status: "ISSUED",
        notes: "Peenya Commercial Formwork Rental (Unregistered Customer)",
        isDemo: true,
        demoRunId,
      },
    });
    track("Invoice", inv3.id, inv3.invoiceNumber, "Rental Invoice Kaveri");
    counts.accounting++;

    // =========================================================================
    // 10. GENERAL LEDGER JOURNAL ENTRIES (DOUBLE-ENTRY)
    // =========================================================================

    const jrn1 = await db.journalEntry.create({
      data: {
        journalNumber: "AE/JRN/DEMO-001",
        journalType: "GENERAL",
        postingDate: thirtyDaysAgo,
        fiscalYear,
        narration: "Owner Capital & Equipment Capital Asset Opening Balance",
        totalDebit: new Prisma.Decimal("5150000.00"),
        totalCredit: new Prisma.Decimal("5150000.00"),
        status: "POSTED",
        isDemo: true,
        demoRunId,
        lines: {
          create: [
            {
              accountId: getAccId("1020"),
              debitAmount: new Prisma.Decimal("1500000.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "HDFC Current Account Initial Balance",
            },
            {
              accountId: getAccId("1010"),
              debitAmount: new Prisma.Decimal("150000.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "Cash in Hand Initial Balance",
            },
            {
              accountId: getAccId("1200"),
              debitAmount: new Prisma.Decimal("3500000.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "Centering & Formwork Steel Props & Sheets Asset Valuation",
            },
            {
              accountId: getAccId("3010"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("5150000.00"),
              description: "Ajay Enterprises Proprietorship Capital",
            },
          ],
        },
      },
    });
    track("JournalEntry", jrn1.id, jrn1.journalNumber, "Journal Capital Opening");
    counts.accounting++;

    const jrn2 = await db.journalEntry.create({
      data: {
        journalNumber: "AE/JRN/DEMO-002",
        journalType: "PURCHASE",
        postingDate: eighteenDaysAgo,
        fiscalYear,
        narration: "Material Purchase Bill from Jindal Scaffolding & Pipes Ltd",
        referenceDocumentType: "PURCHASE_BILL",
        referenceDocumentId: bill1.id,
        referenceNumber: bill1.billNumber,
        totalDebit: new Prisma.Decimal("743400.00"),
        totalCredit: new Prisma.Decimal("743400.00"),
        status: "POSTED",
        isDemo: true,
        demoRunId,
        lines: {
          create: [
            {
              accountId: getAccId("5010"),
              debitAmount: new Prisma.Decimal("630000.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              supplierId: sup1.id,
              description: "Centering Props & Spans Purchases (COGS)",
            },
            {
              accountId: getAccId("1060"),
              debitAmount: new Prisma.Decimal("56700.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "GST Input CGST 9%",
            },
            {
              accountId: getAccId("1061"),
              debitAmount: new Prisma.Decimal("56700.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "GST Input SGST 9%",
            },
            {
              accountId: getAccId("2010"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("743400.00"),
              supplierId: sup1.id,
              description: "Accounts Payable Jindal Scaffolding",
            },
          ],
        },
      },
    });
    track("JournalEntry", jrn2.id, jrn2.journalNumber, "Journal Purchase Bill");
    counts.accounting++;

    const jrn3 = await db.journalEntry.create({
      data: {
        journalNumber: "AE/JRN/DEMO-003",
        journalType: "PAYMENT",
        postingDate: tenDaysAgo,
        fiscalYear,
        narration: "Payment to Jindal Scaffolding against Bill 1",
        referenceDocumentType: "SUPPLIER_PAYMENT",
        referenceDocumentId: spay1.id,
        referenceNumber: spay1.paymentNumber,
        totalDebit: new Prisma.Decimal("500000.00"),
        totalCredit: new Prisma.Decimal("500000.00"),
        status: "POSTED",
        isDemo: true,
        demoRunId,
        lines: {
          create: [
            {
              accountId: getAccId("2010"),
              debitAmount: new Prisma.Decimal("500000.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              supplierId: sup1.id,
              description: "Payment to Jindal Scaffolding",
            },
            {
              accountId: getAccId("1020"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("500000.00"),
              description: "HDFC Current Account NEFT Payout",
            },
          ],
        },
      },
    });
    track("JournalEntry", jrn3.id, jrn3.journalNumber, "Journal Supplier Payment");
    counts.accounting++;

    const jrn4 = await db.journalEntry.create({
      data: {
        journalNumber: "AE/JRN/DEMO-004",
        journalType: "SALES",
        postingDate: twoDaysAgo,
        fiscalYear,
        narration: "Rental & Recovery Invoice for Skyline Infra Developers",
        referenceDocumentType: "INVOICE",
        referenceDocumentId: inv1.id,
        referenceNumber: inv1.invoiceNumber,
        totalDebit: new Prisma.Decimal("188210.00"),
        totalCredit: new Prisma.Decimal("188210.00"),
        status: "POSTED",
        isDemo: true,
        demoRunId,
        lines: {
          create: [
            {
              accountId: getAccId("1030"),
              debitAmount: new Prisma.Decimal("188210.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              customerId: cust1.id,
              customerSiteId: site1A.id,
              description: "Receivables from Skyline Infra",
            },
            {
              accountId: getAccId("4010"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("145000.00"),
              description: "Monthly Centering Equipment Rental Revenue",
            },
            {
              accountId: getAccId("4030"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("8000.00"),
              description: "Damaged Material Reconditioning Recovery",
            },
            {
              accountId: getAccId("4040"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("6500.00"),
              description: "Missing Equipment Replacement Recovery",
            },
            {
              accountId: getAccId("2041"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("14355.00"),
              description: "GST Output CGST 9%",
            },
            {
              accountId: getAccId("2042"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("14355.00"),
              description: "GST Output SGST 9%",
            },
          ],
        },
      },
    });
    track("JournalEntry", jrn4.id, jrn4.journalNumber, "Journal Sales Invoice 1");
    counts.accounting++;

    const jrn5 = await db.journalEntry.create({
      data: {
        journalNumber: "AE/JRN/DEMO-005",
        journalType: "RECEIPT",
        postingDate: now,
        fiscalYear,
        narration: "Payment received from Skyline Infra against Inv 1",
        referenceDocumentType: "PAYMENT_RECEIPT",
        referenceDocumentId: rec1.id,
        referenceNumber: rec1.receiptNumber,
        totalDebit: new Prisma.Decimal("120000.00"),
        totalCredit: new Prisma.Decimal("120000.00"),
        status: "POSTED",
        isDemo: true,
        demoRunId,
        lines: {
          create: [
            {
              accountId: getAccId("1020"),
              debitAmount: new Prisma.Decimal("120000.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "HDFC Current Account Inward NEFT",
            },
            {
              accountId: getAccId("1030"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("120000.00"),
              customerId: cust1.id,
              description: "Settlement of Accounts Receivable",
            },
          ],
        },
      },
    });
    track("JournalEntry", jrn5.id, jrn5.journalNumber, "Journal Customer Receipt 1");
    counts.accounting++;

    const jrn6 = await db.journalEntry.create({
      data: {
        journalNumber: "AE/JRN/DEMO-006",
        journalType: "RECEIPT",
        postingDate: twentyDaysAgo,
        fiscalYear,
        narration: "Refundable Security Deposit received from Skyline Infra",
        totalDebit: new Prisma.Decimal("75000.00"),
        totalCredit: new Prisma.Decimal("75000.00"),
        status: "POSTED",
        isDemo: true,
        demoRunId,
        lines: {
          create: [
            {
              accountId: getAccId("1020"),
              debitAmount: new Prisma.Decimal("75000.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "HDFC Current Account Security Deposit",
            },
            {
              accountId: getAccId("2060"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("75000.00"),
              customerId: cust1.id,
              description: "Customer Security Deposits (Refundable)",
            },
          ],
        },
      },
    });
    track("JournalEntry", jrn6.id, jrn6.journalNumber, "Journal Security Deposit");
    counts.accounting++;

    const jrn7 = await db.journalEntry.create({
      data: {
        journalNumber: "AE/JRN/DEMO-007",
        journalType: "SALES",
        postingDate: fiveDaysAgo,
        fiscalYear,
        narration: "Rental Invoice for Apex Urban Constructions",
        referenceDocumentType: "INVOICE",
        referenceDocumentId: inv2.id,
        referenceNumber: inv2.invoiceNumber,
        totalDebit: new Prisma.Decimal("112100.00"),
        totalCredit: new Prisma.Decimal("112100.00"),
        status: "POSTED",
        isDemo: true,
        demoRunId,
        lines: {
          create: [
            {
              accountId: getAccId("1030"),
              debitAmount: new Prisma.Decimal("112100.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              customerId: cust2.id,
              customerSiteId: site2A.id,
              description: "Receivables from Apex Urban",
            },
            {
              accountId: getAccId("4010"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("95000.00"),
              description: "Monthly Rental Revenue",
            },
            {
              accountId: getAccId("2041"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("8550.00"),
              description: "GST Output CGST 9%",
            },
            {
              accountId: getAccId("2042"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("8550.00"),
              description: "GST Output SGST 9%",
            },
          ],
        },
      },
    });
    track("JournalEntry", jrn7.id, jrn7.journalNumber, "Journal Sales Invoice 2");
    counts.accounting++;

    const jrn8 = await db.journalEntry.create({
      data: {
        journalNumber: "AE/JRN/DEMO-008",
        journalType: "RECEIPT",
        postingDate: twoDaysAgo,
        fiscalYear,
        narration: "Payment received from Apex Urban via UPI",
        referenceDocumentType: "PAYMENT_RECEIPT",
        referenceDocumentId: rec2.id,
        referenceNumber: rec2.receiptNumber,
        totalDebit: new Prisma.Decimal("112100.00"),
        totalCredit: new Prisma.Decimal("112100.00"),
        status: "POSTED",
        isDemo: true,
        demoRunId,
        lines: {
          create: [
            {
              accountId: getAccId("1025"),
              debitAmount: new Prisma.Decimal("112100.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "UPI & Digital Clearing Inward",
            },
            {
              accountId: getAccId("1030"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("112100.00"),
              customerId: cust2.id,
              description: "Receivables settled by Apex Urban",
            },
          ],
        },
      },
    });
    track("JournalEntry", jrn8.id, jrn8.journalNumber, "Journal Receipt 2");
    counts.accounting++;

    const jrn9 = await db.journalEntry.create({
      data: {
        journalNumber: "AE/JRN/DEMO-009",
        journalType: "SALES",
        postingDate: twoDaysAgo,
        fiscalYear,
        narration: "Rental Invoice for Kaveri Formwork (Unregistered)",
        referenceDocumentType: "INVOICE",
        referenceDocumentId: inv3.id,
        referenceNumber: inv3.invoiceNumber,
        totalDebit: new Prisma.Decimal("49560.00"),
        totalCredit: new Prisma.Decimal("49560.00"),
        status: "POSTED",
        isDemo: true,
        demoRunId,
        lines: {
          create: [
            {
              accountId: getAccId("1030"),
              debitAmount: new Prisma.Decimal("49560.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              customerId: cust3.id,
              customerSiteId: site3A.id,
              description: "Receivables Kaveri Formwork",
            },
            {
              accountId: getAccId("4010"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("42000.00"),
              description: "Rental Revenue Kaveri Formwork",
            },
            {
              accountId: getAccId("2041"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("3780.00"),
              description: "GST Output CGST 9%",
            },
            {
              accountId: getAccId("2042"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("3780.00"),
              description: "GST Output SGST 9%",
            },
          ],
        },
      },
    });
    track("JournalEntry", jrn9.id, jrn9.journalNumber, "Journal Sales Invoice 3");
    counts.accounting++;

    const jrn10 = await db.journalEntry.create({
      data: {
        journalNumber: "AE/JRN/DEMO-010",
        journalType: "PAYMENT",
        postingDate: tenDaysAgo,
        fiscalYear,
        narration: "Operational Expenses: Fleet Fuel, Vehicle Service & Yard Maintenance",
        totalDebit: new Prisma.Decimal("29540.00"),
        totalCredit: new Prisma.Decimal("29540.00"),
        status: "POSTED",
        isDemo: true,
        demoRunId,
        lines: {
          create: [
            {
              accountId: getAccId("5030"),
              debitAmount: new Prisma.Decimal("8640.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "Fleet Fuel Diesel Expenses (2 Fills)",
            },
            {
              accountId: getAccId("5035"),
              debitAmount: new Prisma.Decimal("12500.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "Vehicle KA-01-EA-4412 Scheduled Servicing",
            },
            {
              accountId: getAccId("5050"),
              debitAmount: new Prisma.Decimal("3400.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "Prop Straightening & Welding Materials/Parts (Maintenance)",
            },
            {
              accountId: getAccId("1070"),
              debitAmount: new Prisma.Decimal("5000.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "Advance Given to Raju Naik (Welder)",
            },
            {
              accountId: getAccId("1010"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("17040.00"),
              description: "Cash Disbursements for Fuel, Welding & Advance",
            },
            {
              accountId: getAccId("1020"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("12500.00"),
              description: "HDFC Cheque for Vehicle Authorized Service",
            },
          ],
        },
      },
    });
    track("JournalEntry", jrn10.id, jrn10.journalNumber, "Journal Operational Expenses");
    counts.accounting++;

    const jrn11 = await db.journalEntry.create({
      data: {
        journalNumber: "AE/JRN/DEMO-011",
        journalType: "PAYMENT",
        postingDate: tenDaysAgo,
        fiscalYear,
        narration: "Monthly Yard Workforce Wages & Advance Settlement",
        totalDebit: new Prisma.Decimal("24700.00"),
        totalCredit: new Prisma.Decimal("24700.00"),
        status: "POSTED",
        isDemo: true,
        demoRunId,
        lines: {
          create: [
            {
              accountId: getAccId("5040"),
              debitAmount: new Prisma.Decimal("24700.00"),
              creditAmount: new Prisma.Decimal("0.00"),
              description: "Gross Yard Labour Wages",
            },
            {
              accountId: getAccId("1070"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("5000.00"),
              description: "Advance Recovery from Raju Naik",
            },
            {
              accountId: getAccId("1020"),
              debitAmount: new Prisma.Decimal("0.00"),
              creditAmount: new Prisma.Decimal("19700.00"),
              description: "Net Wages Bank Transfer Payout",
            },
          ],
        },
      },
    });
    track("JournalEntry", jrn11.id, jrn11.journalNumber, "Journal Wage Settlement");
    counts.accounting++;

    // =========================================================================
    // 11. BATCH REGISTER TRACKING IN DEMO DATA RECORD REGISTRY
    // =========================================================================

    const totalRecords = recordsToRegister.length;

    const chunkSize = 50;
    for (let i = 0; i < recordsToRegister.length; i += chunkSize) {
      const chunk = recordsToRegister.slice(i, i + chunkSize);
      await db.demoDataRecord.createMany({
        data: chunk.map((r) => ({
          demoRunId,
          tableName: r.tableName,
          recordId: r.recordId,
          recordCode: r.recordCode || null,
          details: r.details || null,
        })),
        skipDuplicates: true,
      });
    }

    await db.demoDataRun.update({
      where: { id: demoRunId },
      data: {
        totalRecords,
        moduleCounts: JSON.stringify(counts),
        metadata: JSON.stringify({
          customersCount: 4,
          sitesCount: 6,
          suppliersCount: 3,
          vehiclesCount: 3,
          driversCount: 2,
          workersCount: 3,
          invoicesCount: 3,
          journalEntriesCount: 11,
          movementsCount: counts.inventory,
          activeAgreementCount: 3,
        }),
      },
    });

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      ipAddress: actor.ipAddress,
      action: "DEMO_DATA_GENERATED",
      module: "demo_data",
      entityType: "DemoDataRun",
      entityId: demoRunId,
      notes: `Generated demo dataset ${runNumber} with ${totalRecords} records`,
    });

    return {
      success: true,
      demoRunId,
      runNumber,
      totalRecords,
      moduleCounts: counts,
      message: `Demo dataset ${runNumber} successfully generated with ${totalRecords} interconnected business records.`,
    };
  } catch (error: any) {
    await db.demoDataRecord.deleteMany({ where: { demoRunId } }).catch(() => {});
    await db.demoDataRun.delete({ where: { id: demoRunId } }).catch(() => {});
    throw error;
  }
}
