import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { adjustSiteBalance, adjustWarehouseBalance } from "@/lib/inventory/ledger";
import {
  CreateDirectTransferInput,
  DispatchDirectTransferInput,
  ReceiveDirectTransferInput,
  PickupDirectTransferInput,
  GodownReturnTransferInput,
} from "@/lib/schemas/direct-transfer";

export class DirectTransferError extends Error {
  code?: string;
  statusCode?: number;

  constructor(message: string, code?: string, statusCode: number = 400) {
    super(message);
    this.name = "DirectTransferError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Retrieves available active rental batches at a customer site
 */
export async function getAvailableSourceBatches(customerSiteId: string) {
  const batches = await db.rentalBatch.findMany({
    where: {
      customerSiteId,
      currentHeldQty: { gt: 0 },
      status: "ACTIVE",
    },
    include: {
      materialVariant: true,
    },
    orderBy: {
      deliveryDate: "asc",
    },
  });

  // Group summary by materialVariantId and ownershipType
  const summaryMap = new Map<
    string,
    {
      materialVariantId: string;
      materialName: string;
      materialCode: string;
      uom: string;
      ownershipType: string;
      totalAvailableQty: Prisma.Decimal;
      batches: typeof batches;
    }
  >();

  for (const batch of batches) {
    const key = `${batch.materialVariantId}_${batch.ownershipType}`;
    const existing = summaryMap.get(key);
    if (existing) {
      existing.totalAvailableQty = existing.totalAvailableQty.plus(batch.currentHeldQty);
      existing.batches.push(batch);
    } else {
      summaryMap.set(key, {
        materialVariantId: batch.materialVariantId,
        materialName: batch.materialVariant.name,
        materialCode: batch.materialVariant.materialCode,
        uom: batch.materialVariant.uom,
        ownershipType: batch.ownershipType,
        totalAvailableQty: new Prisma.Decimal(batch.currentHeldQty),
        batches: [batch],
      });
    }
  }

  return {
    batches,
    summaries: Array.from(summaryMap.values()),
  };
}

/**
 * Lists direct site transfer notes with optional filters
 */
export async function getDirectTransferList(filters?: {
  sourceCustomerId?: string;
  destinationCustomerId?: string;
  sourceCustomerSiteId?: string;
  destinationCustomerSiteId?: string;
  status?: string;
}) {
  const where: Prisma.DirectSiteTransferNoteWhereInput = {};

  if (filters?.sourceCustomerId) where.sourceCustomerId = filters.sourceCustomerId;
  if (filters?.destinationCustomerId) where.destinationCustomerId = filters.destinationCustomerId;
  if (filters?.sourceCustomerSiteId) where.sourceCustomerSiteId = filters.sourceCustomerSiteId;
  if (filters?.destinationCustomerSiteId) where.destinationCustomerSiteId = filters.destinationCustomerSiteId;
  if (filters?.status) where.status = filters.status;

  return await db.directSiteTransferNote.findMany({
    where,
    include: {
      sourceCustomer: true,
      sourceCustomerSite: true,
      destinationCustomer: true,
      destinationCustomerSite: true,
      vehicle: true,
      driver: true,
      vehicleTrip: true,
      sourceMrn: true,
      destinationDn: true,
      godownMrn: true,
      items: {
        include: {
          materialVariant: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Gets details of a specific direct site transfer note with complete linked documents,
 * reconciliation state, evidence timeline, and candidate representatives.
 */
export async function getDirectTransferById(id: string) {
  const transfer = await db.directSiteTransferNote.findUnique({
    where: { id },
    include: {
      sourceCustomer: {
        include: {
          contacts: {
            where: { isActive: true },
            orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          },
        },
      },
      sourceCustomerSite: {
        include: {
          contacts: {
            where: { isActive: true },
            orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          },
        },
      },
      destinationCustomer: {
        include: {
          contacts: {
            where: { isActive: true },
            orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          },
        },
      },
      destinationCustomerSite: {
        include: {
          contacts: {
            where: { isActive: true },
            orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          },
        },
      },
      sourceRentalAgreement: {
        include: { items: true },
      },
      destinationRentalAgreement: {
        include: { items: true },
      },
      vehicle: true,
      driver: true,
      vehicleTrip: {
        include: {
          vehicle: true,
          driver: true,
        },
      },
      sourceMrn: {
        include: {
          items: {
            include: {
              materialVariant: true,
            },
          },
          evidences: true,
        },
      },
      destinationDn: {
        include: {
          items: {
            include: {
              materialVariant: true,
            },
          },
          evidences: true,
        },
      },
      godownMrn: {
        include: {
          items: {
            include: {
              materialVariant: true,
            },
          },
          evidences: true,
        },
      },
      items: {
        include: {
          materialVariant: true,
          sourceRentalBatch: true,
          destinationBatches: true,
          returnAllocations: true,
        },
      },
      rentalBatches: true,
      returnAllocations: true,
      damageAssessments: {
        include: {
          materialVariant: true,
        },
      },
      materialRepairJobs: {
        include: {
          materialVariant: true,
          warehouse: true,
        },
      },
    },
  });

  if (!transfer) {
    throw new DirectTransferError(`Direct Site Transfer '${id}' not found.`, "NOT_FOUND", 404);
  }

  // Fetch candidate site representatives from recent dispatches / returns
  const [pastSiteReturns, pastSiteDeliveries] = await Promise.all([
    db.materialReturnNote.findMany({
      where: {
        customerSiteId: transfer.sourceCustomerSiteId,
        customerRepresentativeName: { not: null },
      },
      select: {
        customerRepresentativeName: true,
        customerRepresentativePhone: true,
        customerRepresentativeDesignation: true,
      },
      distinct: ["customerRepresentativeName"],
      take: 5,
    }),
    db.deliveryNote.findMany({
      where: {
        customerSiteId: transfer.sourceCustomerSiteId,
        receiverName: { not: null },
      },
      select: {
        receiverName: true,
        receiverPhone: true,
        receiverDesignation: true,
      },
      distinct: ["receiverName"],
      take: 5,
    }),
  ]);

  const candidateMap = new Map<
    string,
    {
      name: string;
      phone: string;
      designation: string;
      badge: string;
    }
  >();

  // 1. Site Contacts
  for (const c of transfer.sourceCustomerSite?.contacts || []) {
    if (c.name) {
      candidateMap.set(c.name.toLowerCase().trim(), {
        name: c.name.trim(),
        phone: c.mobile || "",
        designation: c.designation || "Site In-Charge",
        badge: c.isPrimary ? "PRIMARY IN-CHARGE" : "SITE CONTACT",
      });
    }
  }

  // 2. Site in-charge field
  if (transfer.sourceCustomerSite?.siteInCharge) {
    const name = transfer.sourceCustomerSite.siteInCharge.trim();
    if (!candidateMap.has(name.toLowerCase())) {
      candidateMap.set(name.toLowerCase(), {
        name,
        phone: transfer.sourceCustomerSite.siteContactDetails || "",
        designation: "Site In-Charge",
        badge: "SITE IN-CHARGE",
      });
    }
  }

  // 3. Site owner field
  if (transfer.sourceCustomerSite?.siteOwnerName) {
    const name = transfer.sourceCustomerSite.siteOwnerName.trim();
    if (!candidateMap.has(name.toLowerCase())) {
      candidateMap.set(name.toLowerCase(), {
        name,
        phone: transfer.sourceCustomerSite.siteOwnerContact || "",
        designation: "Site Owner",
        badge: "SITE OWNER",
      });
    }
  }

  // 4. Customer Contacts
  for (const c of transfer.sourceCustomer?.contacts || []) {
    if (c.name && !candidateMap.has(c.name.toLowerCase().trim())) {
      candidateMap.set(c.name.toLowerCase().trim(), {
        name: c.name.trim(),
        phone: c.mobile || "",
        designation: c.designation || "Customer Contact",
        badge: "CUSTOMER CONTACT",
      });
    }
  }

  // 5. Past returns & delivery receivers
  for (const r of pastSiteReturns) {
    if (r.customerRepresentativeName && !candidateMap.has(r.customerRepresentativeName.toLowerCase().trim())) {
      candidateMap.set(r.customerRepresentativeName.toLowerCase().trim(), {
        name: r.customerRepresentativeName.trim(),
        phone: r.customerRepresentativePhone || "",
        designation: r.customerRepresentativeDesignation || "Site Representative",
        badge: "PAST RETURN REP",
      });
    }
  }

  for (const d of pastSiteDeliveries) {
    if (d.receiverName && !candidateMap.has(d.receiverName.toLowerCase().trim())) {
      candidateMap.set(d.receiverName.toLowerCase().trim(), {
        name: d.receiverName.trim(),
        phone: d.receiverPhone || "",
        designation: d.receiverDesignation || "Site Engineer",
        badge: "PAST RECEIVER",
      });
    }
  }

  const sourceRepCandidates = Array.from(candidateMap.values());

  // Destination Candidates
  const destCandidateMap = new Map<
    string,
    {
      name: string;
      phone: string;
      designation: string;
      badge: string;
    }
  >();

  for (const c of transfer.destinationCustomerSite?.contacts || []) {
    if (c.name) {
      destCandidateMap.set(c.name.toLowerCase().trim(), {
        name: c.name.trim(),
        phone: c.mobile || "",
        designation: c.designation || "Site In-Charge",
        badge: c.isPrimary ? "PRIMARY IN-CHARGE" : "SITE CONTACT",
      });
    }
  }

  if (transfer.destinationCustomerSite?.siteInCharge) {
    const name = transfer.destinationCustomerSite.siteInCharge.trim();
    if (!destCandidateMap.has(name.toLowerCase())) {
      destCandidateMap.set(name.toLowerCase(), {
        name,
        phone: transfer.destinationCustomerSite.siteContactDetails || "",
        designation: "Site In-Charge",
        badge: "SITE IN-CHARGE",
      });
    }
  }

  for (const c of transfer.destinationCustomer?.contacts || []) {
    if (c.name && !destCandidateMap.has(c.name.toLowerCase().trim())) {
      destCandidateMap.set(c.name.toLowerCase().trim(), {
        name: c.name.trim(),
        phone: c.mobile || "",
        designation: c.designation || "Customer Contact",
        badge: "CUSTOMER CONTACT",
      });
    }
  }

  const destRepCandidates = Array.from(destCandidateMap.values());

  return {
    ...transfer,
    sourceRepCandidates,
    destRepCandidates,
  };
}

/**
 * Creates a new Direct Site Transfer Note.
 * Automatically creates and links:
 * 1. Source Material Return Note (MRN) in DRAFT state
 * 2. VehicleTrip (SITE_TRANSFER) if vehicle/driver assigned
 * 3. Destination Delivery Note (DN) in DRAFT state
 * 4. Connects all documents atomically without premature completion
 */
export async function createDirectTransfer(
  input: CreateDirectTransferInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  if (input.sourceCustomerSiteId === input.destinationCustomerSiteId) {
    throw new DirectTransferError(
      "Source site and destination site must be different for a site-to-site transfer.",
      "INVALID_SITES",
      400
    );
  }

  // 1. Validate source customer, site, destination customer, and destination site
  const [sourceCustomer, sourceSite, destCustomer, destSite] = await Promise.all([
    db.customer.findUnique({ where: { id: input.sourceCustomerId } }),
    db.customerSite.findUnique({ where: { id: input.sourceCustomerSiteId } }),
    db.customer.findUnique({ where: { id: input.destinationCustomerId } }),
    db.customerSite.findUnique({ where: { id: input.destinationCustomerSiteId } }),
  ]);

  if (!sourceCustomer || !sourceSite) {
    throw new DirectTransferError("Source customer or site not found.", "SOURCE_NOT_FOUND", 404);
  }
  if (!destCustomer || !destSite) {
    throw new DirectTransferError("Destination customer or site not found.", "DEST_NOT_FOUND", 404);
  }

  // 2. Require active rental agreement at destination site
  const destAgreement = await db.rentalAgreement.findFirst({
    where: {
      customerId: input.destinationCustomerId,
      customerSiteId: input.destinationCustomerSiteId,
      status: "ACTIVE",
    },
    include: { items: true },
  });

  if (!destAgreement && !input.destinationRentalAgreementId) {
    throw new DirectTransferError(
      `An active rental agreement is required at destination site '${destSite.siteName}' before accepting materials there.`,
      "DESTINATION_AGREEMENT_REQUIRED",
      422
    );
  }

  const agreementId = destAgreement?.id || input.destinationRentalAgreementId || null;

  // 3. Validate that source site currently holds enough material in active batches
  for (const item of input.items) {
    const qtyDispatched = new Prisma.Decimal(item.quantityDispatched);
    if (qtyDispatched.lte(0)) {
      throw new DirectTransferError("Dispatched quantity must be greater than zero.", "INVALID_QTY", 400);
    }

    if (item.sourceRentalBatchId) {
      const batch = await db.rentalBatch.findUnique({
        where: { id: item.sourceRentalBatchId },
      });
      if (!batch || batch.customerSiteId !== input.sourceCustomerSiteId) {
        throw new DirectTransferError(
          `Specified rental batch '${item.sourceRentalBatchId}' does not belong to the source site.`,
          "INVALID_BATCH",
          400
        );
      }
      if (new Prisma.Decimal(batch.currentHeldQty).lt(qtyDispatched)) {
        throw new DirectTransferError(
          `Insufficient quantity in source batch ${batch.batchNumber}. Held: ${batch.currentHeldQty}, Requested: ${qtyDispatched}`,
          "INSUFFICIENT_STOCK",
          400
        );
      }
    } else {
      const activeBatches = await db.rentalBatch.findMany({
        where: {
          customerSiteId: input.sourceCustomerSiteId,
          materialVariantId: item.materialVariantId,
          ownershipType: item.ownershipType,
          currentHeldQty: { gt: 0 },
          status: "ACTIVE",
        },
      });

      const totalHeld = activeBatches.reduce(
        (acc, b) => acc.plus(new Prisma.Decimal(b.currentHeldQty)),
        new Prisma.Decimal(0)
      );

      if (totalHeld.lt(qtyDispatched)) {
        const variant = await db.materialVariant.findUnique({ where: { id: item.materialVariantId } });
        throw new DirectTransferError(
          `Insufficient held stock at source site for variant ${variant?.name || item.materialVariantId}. Available held: ${totalHeld.toString()}, Requested: ${qtyDispatched.toString()}`,
          "INSUFFICIENT_STOCK",
          400
        );
      }
    }
  }

  // 4. Find default primary yard
  const defaultWarehouse =
    (await db.warehouse.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    })) || (await db.warehouse.findFirst());

  if (!defaultWarehouse) {
    throw new DirectTransferError("No active warehouse found in the system.", "WAREHOUSE_NOT_FOUND", 400);
  }

  // 5. Atomic multi-document creation
  const transfer = await db.$transaction(
    async (tx) => {
      // Generate document numbers
      const transferNumber =
        input.transferNumber || (await generateNextDocumentNumber("DSTN", undefined, tx));
      const mrnNumber = await generateNextDocumentNumber("MRN", undefined, tx);
      const dnNumber = await generateNextDocumentNumber("DN", undefined, tx);

      // Fetch driver and vehicle details if assigned
      const driver = input.driverId
        ? await tx.driver.findUnique({ where: { id: input.driverId } })
        : null;
      const vehicle = input.vehicleId
        ? await tx.vehicle.findUnique({ where: { id: input.vehicleId } })
        : null;

      // Create linked VehicleTrip if vehicle is assigned
      let vehicleTripId = input.vehicleTripId || null;
      if (!vehicleTripId && input.vehicleId) {
        const tripNumber = await generateNextDocumentNumber("TRIP", undefined, tx);
        const trip = await tx.vehicleTrip.create({
          data: {
            tripNumber,
            vehicleId: input.vehicleId,
            driverId: input.driverId || null,
            originWarehouseId: defaultWarehouse.id,
            originAddress: `${sourceSite.siteName}, ${sourceSite.fullAddress || ""}`.trim(),
            destinationSiteId: destSite.id,
            destinationAddress: `${destSite.siteName}, ${destSite.fullAddress || ""}`.trim(),
            tripDate: input.transferDate ? new Date(input.transferDate) : new Date(),
            startOdometer: vehicle?.currentOdometer
              ? new Prisma.Decimal(vehicle.currentOdometer)
              : new Prisma.Decimal(0),
            tripPurpose: "SITE_TRANSFER",
            status: "PLANNED",
            remarks: `Direct Transfer Trip: Yard -> ${sourceSite.siteName} (Pickup) -> ${destSite.siteName} (Delivery) -> Yard (if remaining)`,
            createdById: actor.id,
          },
        });
        vehicleTripId = trip.id;
      }

      // Automatically create Source MRN (Material Return Note / Pickup Record) in DRAFT state
      const sourceMrn = await tx.materialReturnNote.create({
        data: {
          mrnNumber,
          customerId: input.sourceCustomerId,
          customerSiteId: input.sourceCustomerSiteId,
          receivingWarehouseId: defaultWarehouse.id,
          returnDate: input.transferDate ? new Date(input.transferDate) : new Date(),
          includeReturnDate: input.includeCutoffDate ?? false,
          status: "DRAFT",
          driverName: driver?.name || null,
          driverPhone: driver?.mobileNumber || null,
          vehicleNumber: vehicle?.vehicleNumber || null,
          preferredPickupTime: input.preferredPickupTime || null,
          pickupInstructions: input.notes || "Direct Site Transfer Source Pickup",
          isDirectTransfer: true,
          vehicleTripId,
          remarks: `Direct Transfer Source Pickup for DSTN ${transferNumber}`,
          items: {
            create: input.items.map((item) => ({
              materialVariantId: item.materialVariantId,
              ownershipType: item.ownershipType,
              returnedQty: new Prisma.Decimal(item.quantityDispatched),
              acceptedQty: new Prisma.Decimal(0),
              condition: "GOOD",
              remarks: "Pending source customer physical handover",
            })),
          },
        },
      });

      // Automatically create Destination DN (Delivery Note) in DRAFT state
      const destDn = await tx.deliveryNote.create({
        data: {
          dnNumber,
          customerId: input.destinationCustomerId,
          customerSiteId: input.destinationCustomerSiteId,
          sourceWarehouseId: defaultWarehouse.id,
          rentalAgreementId: agreementId,
          deliveryDate: input.transferDate ? new Date(input.transferDate) : new Date(),
          includeDeliveryDate: !(input.includeCutoffDate ?? false),
          status: "DRAFT",
          driverName: driver?.name || null,
          driverPhone: driver?.mobileNumber || null,
          vehicleNumber: vehicle?.vehicleNumber || null,
          transportMode: "COMPANY_VEHICLE",
          isDirectTransfer: true,
          notes: `Direct Transfer Destination Delivery for DSTN ${transferNumber} from ${sourceSite.siteName}`,
          items: {
            create: input.items.map((item) => {
              let agreedRate =
                item.agreedDailyRate !== undefined && item.agreedDailyRate !== null
                  ? new Prisma.Decimal(item.agreedDailyRate)
                  : null;
              if (!agreedRate && destAgreement) {
                const matched = destAgreement.items.find(
                  (ai) => ai.materialVariantId === item.materialVariantId
                );
                if (matched) agreedRate = new Prisma.Decimal(matched.agreedDailyRate);
              }
              return {
                materialVariantId: item.materialVariantId,
                quantity: new Prisma.Decimal(item.quantityDispatched),
                ownershipType: item.ownershipType,
                dailyRate: agreedRate,
                condition: "GOOD",
                remarks: "Pending destination unloading and acceptance",
              };
            }),
          },
        },
      });

      // Link Trip to Destination DN if trip exists
      if (vehicleTripId) {
        await tx.vehicleTripDeliveryNote.create({
          data: {
            tripId: vehicleTripId,
            deliveryNoteId: destDn.id,
          },
        });
      }

      // Create the DirectSiteTransferNote linking all created documents
      const created = await tx.directSiteTransferNote.create({
        data: {
          transferNumber,
          transferDate: input.transferDate ? new Date(input.transferDate) : new Date(),
          sourceCustomerId: input.sourceCustomerId,
          sourceCustomerSiteId: input.sourceCustomerSiteId,
          destinationCustomerId: input.destinationCustomerId,
          destinationCustomerSiteId: input.destinationCustomerSiteId,
          sourceRentalAgreementId: input.sourceRentalAgreementId || null,
          destinationRentalAgreementId: agreementId,
          vehicleId: input.vehicleId || null,
          driverId: input.driverId || null,
          vehicleTripId,
          sourceMrnId: sourceMrn.id,
          destinationDnId: destDn.id,
          preferredPickupTime: input.preferredPickupTime || null,
          expectedArrivalTime: input.expectedArrivalTime || null,
          transportPayer: input.transportPayer || "DESTINATION_CUSTOMER",
          status: vehicleTripId ? "SOURCE_PICKUP_PENDING" : "DRAFT",
          includeCutoffDate: input.includeCutoffDate ?? false,
          transportCharges: new Prisma.Decimal(input.transportCharges || 0),
          notes: input.notes || null,
          createdById: actor.id,
          items: {
            create: input.items.map((item) => ({
              materialVariantId: item.materialVariantId,
              ownershipType: item.ownershipType,
              sourceRentalBatchId: item.sourceRentalBatchId || null,
              quantityDispatched: new Prisma.Decimal(item.quantityDispatched),
              quantityCollected: new Prisma.Decimal(0),
              quantityAccepted: new Prisma.Decimal(0),
              quantityDamaged: new Prisma.Decimal(0),
              quantityMissing: new Prisma.Decimal(0),
              quantityRejected: new Prisma.Decimal(0),
              quantityGodownReturned: new Prisma.Decimal(0),
              agreedDailyRate:
                item.agreedDailyRate !== undefined && item.agreedDailyRate !== null
                  ? new Prisma.Decimal(item.agreedDailyRate)
                  : null,
              remarks: item.remarks || null,
            })),
          },
        },
        include: {
          items: true,
          sourceMrn: true,
          destinationDn: true,
          vehicleTrip: true,
        },
      });

      // Update source MRN and dest DN with direct transfer id
      await tx.materialReturnNote.update({
        where: { id: sourceMrn.id },
        data: { directSiteTransferId: created.id },
      });

      await tx.deliveryNote.update({
        where: { id: destDn.id },
        data: { directSiteTransferId: created.id },
      });

      return created;
    },
    { maxWait: 15000, timeout: 30000 }
  );

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "CREATE",
    module: "DIRECT_TRANSFERS",
    entityType: "DirectSiteTransferNote",
    entityId: transfer.id,
    afterState: {
      transferNumber: transfer.transferNumber,
      sourceCustomerId: input.sourceCustomerId,
      destinationCustomerId: input.destinationCustomerId,
      sourceMrnId: transfer.sourceMrnId,
      destinationDnId: transfer.destinationDnId,
      vehicleTripId: transfer.vehicleTripId,
      itemCount: input.items.length,
    },
    notes: `Created Direct Site Transfer ${transfer.transferNumber} with linked Source MRN & Destination DN`,
  });

  return transfer;
}

/**
 * Confirms physical material pickup at source site (MRN workflow).
 * - Records source representative name, phone, designation, signature
 * - Records GPS coordinates and photo evidence
 * - Records actual quantities collected on vehicle
 * - Updates linked Source MRN to PICKUP_COMPLETED (custody handover, zero warehouse stock impact)
 * - Sets transfer status to SOURCE_PICKUP_COMPLETED (IN_TRANSIT)
 */
export async function confirmSourcePickup(
  id: string,
  input: PickupDirectTransferInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  return await db.$transaction(
    async (tx) => {
      const transfer = await tx.directSiteTransferNote.findUnique({
        where: { id },
        include: {
          items: true,
          sourceMrn: true,
          vehicleTrip: true,
        },
      });

      if (!transfer) {
        throw new DirectTransferError(`Direct Site Transfer '${id}' not found.`, "NOT_FOUND", 404);
      }

      if (transfer.status === "COMPLETED" || transfer.status === "CANCELLED") {
        throw new DirectTransferError(
          `Cannot perform source pickup on transfer in '${transfer.status}' status.`,
          "INVALID_STATUS",
          400
        );
      }

      // Map item collection quantities
      const itemMap = new Map((input.items || []).map((i) => [i.itemId, i]));

      for (const item of transfer.items) {
        const itemInput = itemMap.get(item.id);
        const collected = itemInput
          ? new Prisma.Decimal(itemInput.quantityCollected)
          : new Prisma.Decimal(item.quantityDispatched);

        await tx.directSiteTransferItem.update({
          where: { id: item.id },
          data: {
            quantityCollected: collected,
            remarks: itemInput?.remarks || item.remarks,
          },
        });
      }

      // Update linked Source MRN
      if (transfer.sourceMrnId) {
        await tx.materialReturnNote.update({
          where: { id: transfer.sourceMrnId },
          data: {
            customerRepresentativeName: input.sourceRepName,
            customerRepresentativePhone: input.sourceRepPhone || null,
            customerRepresentativeDesignation: input.sourceRepDesignation || null,
            siteArrivedAt: new Date(),
            siteArrivalGpsLat:
              input.sourceGpsLat !== undefined && input.sourceGpsLat !== null
                ? new Prisma.Decimal(input.sourceGpsLat)
                : null,
            siteArrivalGpsLng:
              input.sourceGpsLng !== undefined && input.sourceGpsLng !== null
                ? new Prisma.Decimal(input.sourceGpsLng)
                : null,
            pickupCompletedAt: new Date(),
            pickupOdometer:
              input.odometerReading !== undefined && input.odometerReading !== null
                ? new Prisma.Decimal(input.odometerReading)
                : null,
            photoUrl: input.sourcePhotoUrl || null,
            status: "PICKUP_COMPLETED",
          },
        });

        // Update items in MRN to match collected quantities
        for (const item of transfer.items) {
          const itemInput = itemMap.get(item.id);
          const collected = itemInput
            ? new Prisma.Decimal(itemInput.quantityCollected)
            : new Prisma.Decimal(item.quantityDispatched);

          await tx.materialReturnNoteItem.updateMany({
            where: {
              mrnId: transfer.sourceMrnId,
              materialVariantId: item.materialVariantId,
            },
            data: {
              acceptedQty: collected,
              driverCollectedQty: collected,
            },
          });
        }
      }

      // Update linked VehicleTrip to IN_TRANSIT
      if (transfer.vehicleTripId) {
        await tx.vehicleTrip.update({
          where: { id: transfer.vehicleTripId },
          data: {
            status: "IN_TRANSIT",
            departureTime: new Date(),
          },
        });
      }

      // Update Direct Transfer status and evidence
      const updated = await tx.directSiteTransferNote.update({
        where: { id },
        data: {
          sourceRepName: input.sourceRepName,
          sourceRepPhone: input.sourceRepPhone || null,
          sourceRepDesignation: input.sourceRepDesignation || null,
          sourceRepSignatureUrl: input.sourceRepSignatureUrl || null,
          sourceGpsLat:
            input.sourceGpsLat !== undefined && input.sourceGpsLat !== null
              ? new Prisma.Decimal(input.sourceGpsLat)
              : null,
          sourceGpsLng:
            input.sourceGpsLng !== undefined && input.sourceGpsLng !== null
              ? new Prisma.Decimal(input.sourceGpsLng)
              : null,
          sourcePhotoUrl: input.sourcePhotoUrl || null,
          dispatchedAt: new Date(),
          dispatchedById: actor.id,
          status: "SOURCE_PICKUP_COMPLETED",
          notes: input.notes || transfer.notes,
        },
        include: {
          items: {
            include: {
              materialVariant: true,
            },
          },
          sourceMrn: true,
          destinationDn: true,
          vehicleTrip: true,
        },
      });

      await logAuditEvent(
        {
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          ipAddress: actor.ipAddress,
          action: "DISPATCH",
          module: "DIRECT_TRANSFERS",
          entityType: "DirectSiteTransferNote",
          entityId: updated.id,
          notes: `Completed source pickup for Direct Site Transfer ${updated.transferNumber}. Rep: ${input.sourceRepName}`,
        },
        tx
      );

      return updated;
    },
    { maxWait: 15000, timeout: 30000 }
  );
}

/**
 * Backward-compatible alias for dispatching / confirming source pickup
 */
export async function dispatchDirectTransfer(
  id: string,
  input: DispatchDirectTransferInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  return await confirmSourcePickup(id, input, actor);
}

/**
 * Receives and reconciles a Direct Site Transfer Note at destination site.
 * Enforces quantity reconciliation:
 * Dispatched/Collected = Accepted + GodownReturned + Damaged + Missing + Rejected.
 *
 * If GodownReturned > 0:
 * - Automatically creates and links a Godown Return MRN record.
 * - Sets status to GODOWN_RETURN_PENDING.
 *
 * If GodownReturned == 0:
 * - Marks destination DN as DELIVERED.
 * - Completes the transfer and marks linked trip COMPLETED.
 */
export async function receiveDirectTransfer(
  id: string,
  input: ReceiveDirectTransferInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  return await db.$transaction(
    async (tx) => {
      // 1. Concurrency-safe retrieval
      const transfer = await tx.directSiteTransferNote.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              materialVariant: true,
            },
          },
          sourceCustomerSite: true,
          destinationCustomerSite: true,
          destinationDn: true,
          vehicleTrip: true,
        },
      });

      if (!transfer) {
        throw new DirectTransferError(`Direct Site Transfer '${id}' not found.`, "NOT_FOUND", 404);
      }

      if (transfer.status === "COMPLETED") {
        throw new DirectTransferError("Transfer has already been completed.", "ALREADY_COMPLETED", 400);
      }

      if (transfer.status === "CANCELLED") {
        throw new DirectTransferError("Cannot receive a cancelled transfer.", "INVALID_STATUS", 400);
      }

      // 2. Validate destination agreement coverage
      const destAgreement = await tx.rentalAgreement.findFirst({
        where: {
          customerId: transfer.destinationCustomerId,
          customerSiteId: transfer.destinationCustomerSiteId,
          status: "ACTIVE",
        },
        include: {
          items: true,
        },
      });

      // 3. Map reconciliation inputs
      const recMap = new Map(input.items.map((i) => [i.itemId, i]));

      let hasDiscrepancy = false;
      let hasGodownReturn = false;

      for (const item of transfer.items) {
        const rec = recMap.get(item.id);
        if (!rec) {
          throw new DirectTransferError(
            `Missing reconciliation details for transfer item ${item.id}`,
            "MISSING_RECONCILIATION",
            400
          );
        }

        // Base quantity is collected quantity if recorded, otherwise dispatched quantity
        const qBase = new Prisma.Decimal(item.quantityCollected).gt(0)
          ? new Prisma.Decimal(item.quantityCollected)
          : new Prisma.Decimal(item.quantityDispatched);

        const qAccepted = new Prisma.Decimal(rec.quantityAccepted || 0);
        const qGodownReturned = new Prisma.Decimal(rec.quantityGodownReturned || 0);
        const qDamaged = new Prisma.Decimal(rec.quantityDamaged || 0);
        const qMissing = new Prisma.Decimal(rec.quantityMissing || 0);
        const qRejected = new Prisma.Decimal(rec.quantityRejected || 0);

        // Invariant: Base Qty = Accepted + GodownReturned + Damaged + Missing + Rejected
        const sum = qAccepted
          .plus(qGodownReturned)
          .plus(qDamaged)
          .plus(qMissing)
          .plus(qRejected);

        if (!sum.equals(qBase)) {
          throw new DirectTransferError(
            `Item reconciliation mismatch for ${item.materialVariant.name}: Collected/Dispatched (${qBase.toString()}) must equal Accepted (${qAccepted.toString()}) + Godown Return (${qGodownReturned.toString()}) + Damaged (${qDamaged.toString()}) + Missing (${qMissing.toString()}) + Rejected (${qRejected.toString()}). Got sum: ${sum.toString()}`,
            "RECONCILIATION_MISMATCH",
            400
          );
        }

        if (qGodownReturned.gt(0)) {
          hasGodownReturn = true;
        }

        if (qDamaged.gt(0) || qMissing.gt(0) || qRejected.gt(0)) {
          hasDiscrepancy = true;
        }

        // Check destination agreement for accepted units
        let destDailyRate: Prisma.Decimal | null = item.agreedDailyRate
          ? new Prisma.Decimal(item.agreedDailyRate)
          : null;

        if (qAccepted.gt(0)) {
          if (!destDailyRate && destAgreement) {
            const agrItem = destAgreement.items.find(
              (ai) => ai.materialVariantId === item.materialVariantId
            );
            if (agrItem) {
              destDailyRate = new Prisma.Decimal(agrItem.agreedDailyRate);
            }
          }

          if (!destDailyRate) {
            throw new DirectTransferError(
              `Destination customer does not have an active rental agreement covering material variant '${item.materialVariant.name}'. An active agreement or explicit rate is required.`,
              "DESTINATION_AGREEMENT_REQUIRED",
              422
            );
          }
        }

        // 4. Source RentalBatch deduction & Return Allocation (FIFO)
        let unallocatedToDeduct = qBase;
        let unallocatedAccepted = qAccepted;
        let unallocatedDamaged = qDamaged;
        let unallocatedMissing = qMissing;

        const openBatches = await tx.rentalBatch.findMany({
          where: {
            customerSiteId: transfer.sourceCustomerSiteId,
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
            currentHeldQty: { gt: 0 },
          },
          orderBy: {
            deliveryDate: "asc",
          },
        });

        if (item.sourceRentalBatchId) {
          openBatches.sort((a, b) =>
            a.id === item.sourceRentalBatchId ? -1 : b.id === item.sourceRentalBatchId ? 1 : 0
          );
        }

        for (const batch of openBatches) {
          if (unallocatedToDeduct.lte(0)) break;

          const held = new Prisma.Decimal(batch.currentHeldQty);
          if (held.lte(0)) continue;

          const allocReturn = unallocatedToDeduct.gt(held) ? held : unallocatedToDeduct;
          const allocAccepted = unallocatedAccepted.gt(allocReturn) ? allocReturn : unallocatedAccepted;
          const allocDamaged = unallocatedDamaged.gt(allocReturn.minus(allocAccepted))
            ? allocReturn.minus(allocAccepted)
            : unallocatedDamaged;
          const allocMissing = allocReturn.minus(allocAccepted).minus(allocDamaged);

          // Record return allocation on source batch
          await tx.rentalReturnAllocation.create({
            data: {
              rentalBatchId: batch.id,
              directSiteTransferId: transfer.id,
              directSiteTransferItemId: item.id,
              returnDate: transfer.transferDate,
              includeReturnDate: transfer.includeCutoffDate,
              allocatedReturnedQty: allocReturn,
              allocatedAcceptedQty: allocAccepted,
              allocatedDamagedQty: allocDamaged,
              allocatedMissingQty: allocMissing,
            },
          });

          // Update source batch balances
          const newReturned = new Prisma.Decimal(batch.returnedQty).plus(allocReturn);
          const newDamaged = new Prisma.Decimal(batch.damagedQty).plus(allocDamaged);
          const newMissing = new Prisma.Decimal(batch.missingQty).plus(allocMissing);
          const newHeld = held.minus(allocReturn);

          await tx.rentalBatch.update({
            where: { id: batch.id },
            data: {
              returnedQty: newReturned,
              damagedQty: newDamaged,
              missingQty: newMissing,
              currentHeldQty: newHeld.lt(0) ? new Prisma.Decimal(0) : newHeld,
              status: newHeld.lte(0) ? "CLOSED" : "ACTIVE",
            },
          });

          unallocatedToDeduct = unallocatedToDeduct.minus(allocReturn);
          unallocatedAccepted = unallocatedAccepted.minus(allocAccepted);
          unallocatedDamaged = unallocatedDamaged.minus(allocDamaged);
          unallocatedMissing = unallocatedMissing.minus(allocMissing);
        }

        // 5. Destination RentalBatch Creation (strictly for accepted quantity)
        if (qAccepted.gt(0)) {
          const destBatchNumber = await generateNextDocumentNumber("RB", undefined, tx);
          const includeDeliveryDate = !transfer.includeCutoffDate;

          await tx.rentalBatch.create({
            data: {
              batchNumber: destBatchNumber,
              customerId: transfer.destinationCustomerId,
              customerSiteId: transfer.destinationCustomerSiteId,
              materialVariantId: item.materialVariantId,
              ownershipType: item.ownershipType,
              directSiteTransferId: transfer.id,
              directSiteTransferItemId: item.id,
              deliveryDate: transfer.transferDate,
              includeDeliveryDate,
              deliveredQty: qAccepted,
              returnedQty: new Prisma.Decimal(0),
              damagedQty: new Prisma.Decimal(0),
              missingQty: new Prisma.Decimal(0),
              currentHeldQty: qAccepted,
              applicableDailyRate: destDailyRate!,
              status: "ACTIVE",
            },
          });
        }

        // 6. Direct Site-to-Site Inventory StockBalance adjustments
        // Deduct from source site
        await adjustSiteBalance(tx, {
          siteId: transfer.sourceCustomerSiteId,
          materialVariantId: item.materialVariantId,
          ownershipType: item.ownershipType,
          availableDelta: qBase.negated(),
        });

        // Add accepted quantity to destination site
        if (qAccepted.gt(0)) {
          await adjustSiteBalance(tx, {
            siteId: transfer.destinationCustomerSiteId,
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
            availableDelta: qAccepted,
          });
        }

        // 7. Create immutable Inventory Movement record for accepted units (SITE_TO_SITE_TRANSFER)
        if (qAccepted.gt(0)) {
          const movementNumber = await generateNextDocumentNumber("MV", undefined, tx);
          await tx.inventoryMovement.create({
            data: {
              movementNumber,
              materialVariantId: item.materialVariantId,
              quantity: qAccepted,
              uom: item.materialVariant.uom,
              ownershipType: item.ownershipType,
              movementType: "SITE_TO_SITE_TRANSFER",
              movementDate: transfer.transferDate,
              sourceLocationType: "CUSTOMER_SITE",
              sourceSiteId: transfer.sourceCustomerSiteId,
              destinationLocationType: "CUSTOMER_SITE",
              destinationSiteId: transfer.destinationCustomerSiteId,
              customerId: transfer.destinationCustomerId,
              referenceDocumentType: "DIRECT_SITE_TRANSFER",
              referenceDocumentId: transfer.id,
              responsibleUserId: actor.id,
              status: "POSTED",
              postedAt: new Date(),
              notes: `Direct Site Transfer ${transfer.transferNumber} from ${transfer.sourceCustomerSite.siteName} to ${transfer.destinationCustomerSite.siteName}`,
            },
          });
        }

        // 8. Traceable workflows for Damaged, Missing, and Rejected quantities
        const defaultWarehouse =
          (await tx.warehouse.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
          })) || (await tx.warehouse.findFirst());

        if (qDamaged.gt(0)) {
          const dlaNumber = await generateNextDocumentNumber("DLA", undefined, tx);
          await tx.damageLossAssessment.create({
            data: {
              assessmentNumber: dlaNumber,
              customerId: transfer.sourceCustomerId,
              customerSiteId: transfer.destinationCustomerSiteId,
              materialVariantId: item.materialVariantId,
              directSiteTransferId: transfer.id,
              assessmentType: "DAMAGED_REPAIRABLE",
              quantity: qDamaged,
              condition: "DAMAGED",
              status: "PENDING_APPROVAL",
              assessedById: actor.id,
              remarks:
                rec.remarks ||
                `Damaged upon receipt of Direct Transfer ${transfer.transferNumber}. Responsible: ${input.discrepancyResponsibleParty || "UNDER_INVESTIGATION"}`,
            },
          });

          if (defaultWarehouse) {
            const repCode = await generateNextDocumentNumber("MAT_REP", undefined, tx);
            await tx.materialRepairJob.create({
              data: {
                jobCode: repCode,
                warehouseId: defaultWarehouse.id,
                materialVariantId: item.materialVariantId,
                ownershipType: item.ownershipType,
                directSiteTransferId: transfer.id,
                totalQuantity: qDamaged,
                remainingQuantity: qDamaged,
                damageDescription: `Damaged during direct transfer ${transfer.transferNumber} from ${transfer.sourceCustomerSite.siteName}. Awaiting repair.`,
                status: "REPORTED",
                priority: "MEDIUM",
                remarks: `Direct Transfer discrepancy: ${qDamaged.toString()} units damaged`,
              },
            });
          }

          const damMvNumber = await generateNextDocumentNumber("MV", undefined, tx);
          await tx.inventoryMovement.create({
            data: {
              movementNumber: damMvNumber,
              materialVariantId: item.materialVariantId,
              quantity: qDamaged,
              uom: item.materialVariant.uom,
              ownershipType: item.ownershipType,
              movementType: "DAMAGE",
              movementDate: transfer.transferDate,
              sourceLocationType: "CUSTOMER_SITE",
              sourceSiteId: transfer.sourceCustomerSiteId,
              destinationLocationType: defaultWarehouse ? "WAREHOUSE" : "CUSTOMER_SITE",
              destinationWarehouseId: defaultWarehouse?.id || null,
              destinationSiteId: defaultWarehouse ? null : transfer.destinationCustomerSiteId,
              customerId: transfer.sourceCustomerId,
              referenceDocumentType: "DIRECT_SITE_TRANSFER",
              referenceDocumentId: transfer.id,
              condition: "DAMAGED",
              responsibleUserId: actor.id,
              status: "POSTED",
              postedAt: new Date(),
              notes: `Damaged in Direct Transfer ${transfer.transferNumber}. Routed to repair workflow.`,
            },
          });
        }

        if (qMissing.gt(0)) {
          const dlaMissingNumber = await generateNextDocumentNumber("DLA", undefined, tx);
          await tx.damageLossAssessment.create({
            data: {
              assessmentNumber: dlaMissingNumber,
              customerId: transfer.sourceCustomerId,
              customerSiteId: transfer.destinationCustomerSiteId,
              materialVariantId: item.materialVariantId,
              directSiteTransferId: transfer.id,
              assessmentType: "MISSING",
              quantity: qMissing,
              condition: "MISSING",
              status: "PENDING_APPROVAL",
              assessedById: actor.id,
              remarks:
                rec.remarks ||
                `Missing equipment during Direct Transfer ${transfer.transferNumber}. Responsible: ${input.discrepancyResponsibleParty || "UNDER_INVESTIGATION"}`,
            },
          });

          const misMvNumber = await generateNextDocumentNumber("MV", undefined, tx);
          await tx.inventoryMovement.create({
            data: {
              movementNumber: misMvNumber,
              materialVariantId: item.materialVariantId,
              quantity: qMissing,
              uom: item.materialVariant.uom,
              ownershipType: item.ownershipType,
              movementType: "DAMAGE",
              movementDate: transfer.transferDate,
              sourceLocationType: "CUSTOMER_SITE",
              sourceSiteId: transfer.sourceCustomerSiteId,
              destinationLocationType: "CUSTOMER_SITE",
              destinationSiteId: null,
              customerId: transfer.sourceCustomerId,
              referenceDocumentType: "DIRECT_SITE_TRANSFER",
              referenceDocumentId: transfer.id,
              condition: "DAMAGED",
              responsibleUserId: actor.id,
              status: "POSTED",
              postedAt: new Date(),
              notes: `Missing units in Direct Transfer ${transfer.transferNumber}. Under loss investigation.`,
            },
          });
        }

        if (qRejected.gt(0)) {
          const rejMvNumber = await generateNextDocumentNumber("MV", undefined, tx);
          await tx.inventoryMovement.create({
            data: {
              movementNumber: rejMvNumber,
              materialVariantId: item.materialVariantId,
              quantity: qRejected,
              uom: item.materialVariant.uom,
              ownershipType: item.ownershipType,
              movementType: "INTERNAL_TRANSFER",
              movementDate: transfer.transferDate,
              sourceLocationType: "CUSTOMER_SITE",
              sourceSiteId: transfer.sourceCustomerSiteId,
              destinationLocationType: defaultWarehouse ? "WAREHOUSE" : "CUSTOMER_SITE",
              destinationWarehouseId: defaultWarehouse?.id || null,
              destinationSiteId: null,
              customerId: transfer.sourceCustomerId,
              referenceDocumentType: "DIRECT_SITE_TRANSFER",
              referenceDocumentId: transfer.id,
              condition: "REJECTED",
              responsibleUserId: actor.id,
              status: "POSTED",
              postedAt: new Date(),
              notes: `Rejected in Direct Transfer ${transfer.transferNumber}. Disposition: ${input.rejectedDisposition || "RETURN_TO_WAREHOUSE"}`,
            },
          });
        }

        // 9. Update transfer line item with reconciled quantities
        await tx.directSiteTransferItem.update({
          where: { id: item.id },
          data: {
            quantityAccepted: qAccepted,
            quantityGodownReturned: qGodownReturned,
            quantityDamaged: qDamaged,
            quantityMissing: qMissing,
            quantityRejected: qRejected,
            agreedDailyRate: destDailyRate,
            remarks: rec.remarks || item.remarks,
          },
        });
      }

      // 10. Update linked Destination DN
      if (transfer.destinationDnId) {
        await tx.deliveryNote.update({
          where: { id: transfer.destinationDnId },
          data: {
            receiverName: input.destRepName,
            receiverPhone: input.destRepPhone || null,
            receiverDesignation: input.destRepDesignation || null,
            receiverSignatureUrl: input.destRepSignatureUrl || null,
            gpsLatitude:
              input.destGpsLat !== undefined && input.destGpsLat !== null
                ? new Prisma.Decimal(input.destGpsLat)
                : null,
            gpsLongitude:
              input.destGpsLng !== undefined && input.destGpsLng !== null
                ? new Prisma.Decimal(input.destGpsLng)
                : null,
            photoUrl: input.destPhotoUrl || null,
            status: "DELIVERED",
          },
        });

        // Update items in Destination DN to match accepted quantities
        for (const item of transfer.items) {
          const rec = recMap.get(item.id);
          const qAccepted = new Prisma.Decimal(rec?.quantityAccepted || 0);
          await tx.deliveryNoteItem.updateMany({
            where: {
              deliveryNoteId: transfer.destinationDnId,
              materialVariantId: item.materialVariantId,
            },
            data: {
              quantity: qAccepted,
            },
          });
        }
      }

      // 11. Handle Godown Return Leg if remaining materials exist
      let godownMrnId = transfer.godownMrnId;
      if (hasGodownReturn && !godownMrnId) {
        const defaultWarehouse =
          (await tx.warehouse.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
          })) || (await tx.warehouse.findFirst());

        if (defaultWarehouse) {
          const gMrnNumber = await generateNextDocumentNumber("MRN", undefined, tx);
          const returnItems = transfer.items
            .map((item) => {
              const rec = recMap.get(item.id);
              const qGodownReturned = new Prisma.Decimal(rec?.quantityGodownReturned || 0);
              return { item, qGodownReturned };
            })
            .filter((x) => x.qGodownReturned.gt(0));

          const godownMrn = await tx.materialReturnNote.create({
            data: {
              mrnNumber: gMrnNumber,
              customerId: transfer.sourceCustomerId,
              customerSiteId: transfer.destinationCustomerSiteId,
              receivingWarehouseId: defaultWarehouse.id,
              returnDate: transfer.transferDate,
              status: "DRAFT",
              isDirectTransfer: true,
              directSiteTransferId: transfer.id,
              vehicleTripId: transfer.vehicleTripId,
              remarks: `Godown Return leg for remaining materials from Direct Transfer ${transfer.transferNumber}`,
              items: {
                create: returnItems.map(({ item, qGodownReturned }) => ({
                  materialVariantId: item.materialVariantId,
                  ownershipType: item.ownershipType,
                  returnedQty: qGodownReturned,
                  acceptedQty: new Prisma.Decimal(0),
                  condition: "GOOD",
                  remarks: "Remaining material returning to godown",
                })),
              },
            },
          });
          godownMrnId = godownMrn.id;
        }
      }

      // 12. Determine Final Status
      let finalStatus = "COMPLETED";
      if (hasGodownReturn) {
        finalStatus = "GODOWN_RETURN_PENDING";
      } else if (hasDiscrepancy) {
        finalStatus = "PARTIALLY_RECEIVED";
      }

      // If no godown return is needed, complete the vehicle trip
      if (!hasGodownReturn && transfer.vehicleTripId) {
        await tx.vehicleTrip.update({
          where: { id: transfer.vehicleTripId },
          data: {
            status: "COMPLETED",
            arrivalTime: new Date(),
          },
        });
      }

      const completedTransfer = await tx.directSiteTransferNote.update({
        where: { id },
        data: {
          destRepName: input.destRepName,
          destRepPhone: input.destRepPhone || null,
          destRepDesignation: input.destRepDesignation || null,
          destRepSignatureUrl: input.destRepSignatureUrl || null,
          destGpsLat:
            input.destGpsLat !== undefined && input.destGpsLat !== null
              ? new Prisma.Decimal(input.destGpsLat)
              : null,
          destGpsLng:
            input.destGpsLng !== undefined && input.destGpsLng !== null
              ? new Prisma.Decimal(input.destGpsLng)
              : null,
          destPhotoUrl: input.destPhotoUrl || null,
          discrepancyNotes: input.discrepancyNotes || null,
          discrepancyResponsibleParty:
            input.discrepancyResponsibleParty || (hasDiscrepancy ? "UNDER_INVESTIGATION" : null),
          rejectedDisposition:
            input.rejectedDisposition || (hasDiscrepancy ? "RETURN_TO_WAREHOUSE" : null),
          godownMrnId,
          receivedAt: new Date(),
          receivedById: actor.id,
          status: finalStatus,
        },
        include: {
          items: {
            include: {
              materialVariant: true,
            },
          },
          sourceCustomer: true,
          sourceCustomerSite: true,
          destinationCustomer: true,
          destinationCustomerSite: true,
          sourceMrn: true,
          destinationDn: true,
          godownMrn: true,
          vehicleTrip: true,
        },
      });

      await logAuditEvent(
        {
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          ipAddress: actor.ipAddress,
          action: "RECEIVE",
          module: "DIRECT_TRANSFERS",
          entityType: "DirectSiteTransferNote",
          entityId: completedTransfer.id,
          afterState: {
            transferNumber: completedTransfer.transferNumber,
            status: finalStatus,
            hasDiscrepancy,
            hasGodownReturn,
          },
          notes: `Delivered & reconciled Direct Site Transfer ${completedTransfer.transferNumber} with status ${finalStatus}`,
        },
        tx
      );

      return completedTransfer;
    },
    { maxWait: 15000, timeout: 30000 }
  );
}

/**
 * Confirms physical receiving and inspection of remaining materials at godown.
 * - Increments warehouse stock balance
 * - Completes Godown MRN and marks transfer COMPLETED
 * - Completes linked VehicleTrip
 */
export async function confirmGodownReceiving(
  id: string,
  input: GodownReturnTransferInput,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  return await db.$transaction(
    async (tx) => {
      const transfer = await tx.directSiteTransferNote.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              materialVariant: true,
            },
          },
          godownMrn: {
            include: {
              items: true,
            },
          },
          vehicleTrip: true,
        },
      });

      if (!transfer) {
        throw new DirectTransferError(`Direct Site Transfer '${id}' not found.`, "NOT_FOUND", 404);
      }

      if (!transfer.godownMrnId || !transfer.godownMrn) {
        throw new DirectTransferError(
          "No godown return note linked to this direct transfer.",
          "NO_GODOWN_RETURN",
          400
        );
      }

      const receivingWarehouseId = input.warehouseId;
      const itemMap = new Map((input.items || []).map((i) => [i.itemId, i]));

      for (const item of transfer.items) {
        const itemInput = itemMap.get(item.id);
        const qtyReceived = itemInput
          ? new Prisma.Decimal(itemInput.quantityReceived)
          : new Prisma.Decimal(item.quantityGodownReturned);
        const qtyDamaged = itemInput
          ? new Prisma.Decimal(itemInput.quantityDamaged)
          : new Prisma.Decimal(0);
        const qtyGood = qtyReceived.minus(qtyDamaged);

        if (qtyReceived.gt(0)) {
          // Re-credit accepted stock to warehouse balance
          await adjustWarehouseBalance(tx, {
            warehouseId: receivingWarehouseId,
            materialVariantId: item.materialVariantId,
            ownershipType: item.ownershipType,
            availableDelta: qtyGood.gt(0) ? qtyGood : new Prisma.Decimal(0),
            damagedDelta: qtyDamaged.gt(0) ? qtyDamaged : new Prisma.Decimal(0),
          });

          // Post inventory movement record into warehouse
          const mvNumber = await generateNextDocumentNumber("MV", undefined, tx);
          await tx.inventoryMovement.create({
            data: {
              movementNumber: mvNumber,
              materialVariantId: item.materialVariantId,
              quantity: qtyReceived,
              uom: item.materialVariant.uom,
              ownershipType: item.ownershipType,
              movementType: "STOCK_RECEIPT",
              movementDate: new Date(),
              sourceLocationType: "CUSTOMER_SITE",
              sourceSiteId: transfer.destinationCustomerSiteId,
              destinationLocationType: "WAREHOUSE",
              destinationWarehouseId: receivingWarehouseId,
              referenceDocumentType: "MATERIAL_RETURN_NOTE",
              referenceDocumentId: transfer.godownMrnId,
              responsibleUserId: actor.id,
              status: "POSTED",
              postedAt: new Date(),
              notes: `Godown return receiving for Direct Transfer ${transfer.transferNumber}`,
            },
          });
        }
      }

      // Update Godown MRN
      await tx.materialReturnNote.update({
        where: { id: transfer.godownMrnId },
        data: {
          yardArrivedAt: new Date(),
          yardArrivalGpsLat:
            input.yardArrivalGpsLat !== undefined && input.yardArrivalGpsLat !== null
              ? new Prisma.Decimal(input.yardArrivalGpsLat)
              : null,
          yardArrivalGpsLng:
            input.yardArrivalGpsLng !== undefined && input.yardArrivalGpsLng !== null
              ? new Prisma.Decimal(input.yardArrivalGpsLng)
              : null,
          yardOdometer:
            input.yardOdometer !== undefined && input.yardOdometer !== null
              ? new Prisma.Decimal(input.yardOdometer)
              : null,
          photoUrl: input.photoUrl || null,
          postedById: actor.id,
          postedAt: new Date(),
          status: "POSTED",
          remarks: input.remarks || `Received remaining materials at godown for DSTN ${transfer.transferNumber}`,
        },
      });

      // Complete linked vehicle trip
      if (transfer.vehicleTripId) {
        await tx.vehicleTrip.update({
          where: { id: transfer.vehicleTripId },
          data: {
            status: "COMPLETED",
            arrivalTime: new Date(),
            endOdometer:
              input.yardOdometer !== undefined && input.yardOdometer !== null
                ? new Prisma.Decimal(input.yardOdometer)
                : undefined,
          },
        });
      }

      // Mark Direct Transfer COMPLETED
      const completed = await tx.directSiteTransferNote.update({
        where: { id },
        data: {
          status: "COMPLETED",
        },
        include: {
          items: {
            include: {
              materialVariant: true,
            },
          },
          sourceMrn: true,
          destinationDn: true,
          godownMrn: true,
          vehicleTrip: true,
        },
      });

      await logAuditEvent(
        {
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          ipAddress: actor.ipAddress,
          action: "RECEIVE",
          module: "DIRECT_TRANSFERS",
          entityType: "DirectSiteTransferNote",
          entityId: completed.id,
          notes: `Completed godown receiving for Direct Site Transfer ${completed.transferNumber}`,
        },
        tx
      );

      return completed;
    },
    { maxWait: 15000, timeout: 30000 }
  );
}

/**
 * Cancels a Direct Site Transfer Note if in draft or pending status.
 * Automatically cleans up linked draft MRN and DN.
 */
export async function cancelDirectTransfer(
  id: string,
  reason: string,
  actor: { id: string; name: string; role: string; ipAddress?: string }
) {
  const transfer = await db.directSiteTransferNote.findUnique({
    where: { id },
  });

  if (!transfer) {
    throw new DirectTransferError(`Direct Site Transfer '${id}' not found.`, "NOT_FOUND", 404);
  }

  if (["COMPLETED", "PARTIALLY_RECEIVED"].includes(transfer.status)) {
    throw new DirectTransferError(
      `Cannot cancel transfer in '${transfer.status}' status.`,
      "INVALID_STATUS",
      400
    );
  }

  const updated = await db.$transaction(async (tx) => {
    // Cancel source MRN if draft
    if (transfer.sourceMrnId) {
      await tx.materialReturnNote.updateMany({
        where: { id: transfer.sourceMrnId, status: "DRAFT" },
        data: { status: "CANCELLED" },
      });
    }

    // Cancel destination DN if draft
    if (transfer.destinationDnId) {
      await tx.deliveryNote.updateMany({
        where: { id: transfer.destinationDnId, status: "DRAFT" },
        data: { status: "CANCELLED" },
      });
    }

    // Cancel vehicle trip if planned
    if (transfer.vehicleTripId) {
      await tx.vehicleTrip.updateMany({
        where: { id: transfer.vehicleTripId, status: "PLANNED" },
        data: { status: "CANCELLED" },
      });
    }

    return await tx.directSiteTransferNote.update({
      where: { id },
      data: {
        status: "CANCELLED",
        notes: transfer.notes ? `${transfer.notes} | Cancelled: ${reason}` : `Cancelled: ${reason}`,
      },
    });
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    userRole: actor.role,
    ipAddress: actor.ipAddress,
    action: "CANCEL",
    module: "DIRECT_TRANSFERS",
    entityType: "DirectSiteTransferNote",
    entityId: updated.id,
    notes: `Cancelled Direct Site Transfer ${updated.transferNumber}. Reason: ${reason}`,
  });

  return updated;
}
