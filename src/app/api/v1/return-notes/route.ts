import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { generateNextDocumentNumber } from "@/lib/document-series";
import { logAuditEvent } from "@/lib/audit";
import { postInventoryMovement } from "@/lib/inventory/ledger";
import { createMaterialReturnNoteSchema } from "@/lib/schemas/material-return";
import { validateVehicleTripAssignment } from "@/lib/fleet/service";
import { validationErrorResponse } from "@/lib/api-validation";
import { sendWhatsAppNotification } from "@/lib/notifications/whatsapp";
import { allocateReturnToBatches } from "@/lib/rentals/tracking";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "material_returns", "view");

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || undefined;
    const siteId = searchParams.get("customerSiteId") || undefined;
    const warehouseId = searchParams.get("warehouseId") || undefined;
    const statusParam = searchParams.get("status") || undefined;

    let statusFilter = undefined;
    if (statusParam) {
      if (statusParam.includes(",")) {
        statusFilter = { in: statusParam.split(",") };
      } else {
        statusFilter = statusParam;
      }
    }

    const returnNotes = await db.materialReturnNote.findMany({
      where: {
        customerId,
        customerSiteId: siteId,
        receivingWarehouseId: warehouseId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true, primaryMobile: true, whatsappNumber: true } },
        customerSite: { select: { id: true, siteName: true, siteCode: true, siteContactDetails: true, siteOwnerContact: true, siteInCharge: true, fullAddress: true } },
        receivingWarehouse: { select: { id: true, name: true, warehouseCode: true } },
        referenceDeliveryNote: { select: { id: true, dnNumber: true } },
        vehicleTrip: {
          select: {
            id: true,
            tripNumber: true,
            status: true,
            startOdometer: true,
            endOdometer: true,
            distanceKm: true,
            driver: { select: { id: true, name: true, driverCode: true, mobileNumber: true } },
            vehicle: { select: { id: true, vehicleNumber: true, make: true, model: true } },
          },
        },
        items: {
          include: {
            materialVariant: { select: { id: true, name: true, size: true, materialCode: true, uom: true } },
          },
        },
        evidences: true,
        _count: { select: { evidences: true } },
      },
      orderBy: { returnDate: "desc" },
    });

    return NextResponse.json({ success: true, data: returnNotes });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    await requirePermission(session, "material_returns", "create");

    const body = await req.json();
    const parsed = createMaterialReturnNoteSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const input = parsed.data;
    const actor = {
      id: session!.id,
      name: session!.name,
      role: session!.role,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    };

    const isImmediatePost = input.status === "POSTED";

    const result = await db.$transaction(
      async (tx) => {
        const mrnNumber = input.mrnNumber || (await generateNextDocumentNumber("MRN", undefined, tx));

        let linkedTripId: string | null = null;
        let vehicleRegNumber: string | null = input.vehicleNumber || null;
        let driverFullName: string | null = input.driverName || null;
        let driverContactPhone: string | null = input.driverPhone || null;

        // Trip handling if vehicle/trip specified
        if (input.existingTripId) {
          const existingTrip = await tx.vehicleTrip.findUnique({
            where: { id: input.existingTripId },
            include: { vehicle: true, driver: true },
          });
          if (existingTrip) {
            linkedTripId = existingTrip.id;
            vehicleRegNumber = existingTrip.vehicle.vehicleNumber;
            if (existingTrip.driver) {
              driverFullName = existingTrip.driver.name;
              driverContactPhone = existingTrip.driver.mobileNumber;
            }
          }
        } else if (input.vehicleId) {
          await validateVehicleTripAssignment(input.vehicleId);
          const vehicle = await tx.vehicle.findUnique({
            where: { id: input.vehicleId },
          });
          if (vehicle) {
            vehicleRegNumber = vehicle.vehicleNumber;
            let driver = null;
            if (input.driverId) {
              driver = await tx.driver.findUnique({
                where: { id: input.driverId },
              });
              if (driver) {
                driverFullName = driver.name;
                driverContactPhone = driver.mobileNumber;
              }
            }

            const tripNumber = await generateNextDocumentNumber("TRIP", undefined, tx);
            const startOdo =
              input.startOdometer !== undefined && input.startOdometer !== null
                ? new Prisma.Decimal(input.startOdometer)
                : vehicle.currentOdometer;

            const site = await tx.customerSite.findUnique({
              where: { id: input.customerSiteId },
              select: { fullAddress: true },
            });

            const newTrip = await tx.vehicleTrip.create({
              data: {
                tripNumber,
                vehicleId: input.vehicleId,
                driverId: input.driverId || null,
                originWarehouseId: input.receivingWarehouseId,
                destinationSiteId: input.customerSiteId,
                destinationAddress: site?.fullAddress || undefined,
                tripDate: input.preferredPickupDate ? new Date(input.preferredPickupDate) : new Date(),
                departureTime: new Date(),
                startOdometer: startOdo,
                tripPurpose: "RETURN_PICKUP",
                status: "PLANNED",
                remarks: input.pickupInstructions || `Material Return Pickup for ${mrnNumber}`,
                createdById: actor.id,
              },
            });

            linkedTripId = newTrip.id;
          }
        }

        if (isImmediatePost) {
          // --- LEGACY / DIRECT YARD DROP-OFF IMMEDIATE POSTING ---
          const mrn = await tx.materialReturnNote.create({
            data: {
              mrnNumber,
              customerId: input.customerId,
              customerSiteId: input.customerSiteId,
              receivingWarehouseId: input.receivingWarehouseId,
              referenceDeliveryNoteId: input.referenceDeliveryNoteId || null,
              returnDate: input.returnDate ? new Date(input.returnDate) : new Date(),
              status: "POSTED",
              vehicleTripId: linkedTripId,
              vehicleNumber: vehicleRegNumber,
              driverName: driverFullName,
              driverPhone: driverContactPhone,
              includeReturnDate: input.includeReturnDate || false,

              // Customer / Site Representative - Material Handover
              customerRepresentativeName: input.customerRepresentativeName || null,
              customerRepresentativeDesignation: input.customerRepresentativeDesignation || null,
              customerRepresentativePhone: input.customerRepresentativePhone || null,
              customerSignatureUrl: input.customerSignatureUrl || null,
              handoverAt: input.handoverAt ? new Date(input.handoverAt) : new Date(input.returnDate || Date.now()),
              customerAgreedDamage: input.customerAgreedDamage || false,

              // AJAY ENTERPRISES - Material Receiving Acknowledgement
              receiverName: input.receiverName,
              receiverPhone: input.receiverPhone,
              receiverDesignation: input.receiverDesignation || null,
              receiverSignatureUrl: input.receiverSignatureUrl,
              receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(input.returnDate || Date.now()),
              companyStampUrl: input.companyStampUrl || null,

              // Material Inspection Lifecycle & Delayed Inspection
              inspectionStatus: input.inspectionStatus || "COMPLETED",
              inspectedById: input.inspectionStatus === "COMPLETED" ? actor.id : null,
              inspectorName: input.inspectorName || (input.inspectionStatus === "COMPLETED" ? input.receiverName : null),
              inspectorDesignation: input.inspectorDesignation || (input.inspectionStatus === "COMPLETED" ? input.receiverDesignation : null),
              inspectedAt: input.inspectedAt ? new Date(input.inspectedAt) : (input.inspectionStatus === "COMPLETED" ? new Date() : null),
              inspectionRemarks: input.inspectionRemarks || null,

              gpsLatitude: input.gpsLatitude ? new Prisma.Decimal(input.gpsLatitude) : null,
              gpsLongitude: input.gpsLongitude ? new Prisma.Decimal(input.gpsLongitude) : null,
              photoUrl: input.photoUrl,
              missingEvidenceReason: input.missingEvidenceReason,
              postedById: actor.id,
              postedAt: new Date(),
              remarks: input.remarks,
            },
          });

          // Process each returned material line
          for (const item of input.items) {
            const returnedQty = new Prisma.Decimal(item.returnedQty);
            const acceptedQty = new Prisma.Decimal(item.acceptedQty);
            const damagedQty = new Prisma.Decimal(item.damagedQty || 0);
            const missingQty = new Prisma.Decimal(item.missingQty || 0);
            const rejectedQty = new Prisma.Decimal(item.rejectedQty || 0);
            const receivedQty =
              item.receivedQty !== undefined && item.receivedQty !== null
                ? new Prisma.Decimal(item.receivedQty)
                : acceptedQty.plus(damagedQty).plus(rejectedQty);

            if (acceptedQty.plus(damagedQty).plus(missingQty).plus(rejectedQty).gt(returnedQty)) {
              throw new Error(
                `Sum of accepted (${acceptedQty}), damaged (${damagedQty}), missing (${missingQty}), and rejected (${rejectedQty}) cannot exceed returned quantity (${returnedQty}).`
              );
            }

            // Check customer site stock balance
            const siteBalance = await tx.stockBalance.findFirst({
              where: {
                warehouseId: null,
                siteId: input.customerSiteId,
                materialVariantId: item.materialVariantId,
                ownershipType: item.ownershipType,
                locationType: "CUSTOMER_SITE",
              },
            });

            const availableOnSite = siteBalance?.availableQty || new Prisma.Decimal(0);
            if (availableOnSite.lt(returnedQty)) {
              throw new Error(
                `Insufficient stock on customer site to process return. Available on site: ${availableOnSite.toString()}, Requested return: ${returnedQty.toString()}`
              );
            }

            // Create Item line
            await tx.materialReturnNoteItem.create({
              data: {
                mrnId: mrn.id,
                materialVariantId: item.materialVariantId,
                ownershipType: item.ownershipType,
                expectedQty: item.expectedQty ? new Prisma.Decimal(item.expectedQty) : returnedQty,
                returnedQty,
                receivedQty,
                acceptedQty,
                damagedQty,
                missingQty,
                rejectedQty,
                condition: item.condition,
                remarks: item.remarks,
                inspectionRemarks: item.inspectionRemarks || null,
              },
            });

            // Post Inventory Movement for Accepted Stock
            if (acceptedQty.gt(0)) {
              await postInventoryMovement(
                {
                  materialVariantId: item.materialVariantId,
                  quantity: acceptedQty.toNumber(),
                  uom: "Nos.",
                  ownershipType: item.ownershipType as "OWNED" | "HIRED_IN",
                  movementType: "CUSTOMER_RETURN",
                  sourceLocationType: "CUSTOMER_SITE",
                  sourceSiteId: input.customerSiteId,
                  destinationLocationType: "WAREHOUSE",
                  destinationWarehouseId: input.receivingWarehouseId,
                  customerId: input.customerId,
                  referenceDocumentType: "MATERIAL_RETURN_NOTE",
                  referenceDocumentId: mrn.id,
                  condition: "GOOD",
                  notes: `MRN ${mrnNumber}: Accepted ${acceptedQty.toString()} good units into warehouse.`,
                },
                actor,
                tx
              );
            }

            // Post Inventory Movement for Damaged Stock
            if (damagedQty.gt(0)) {
              await postInventoryMovement(
                {
                  materialVariantId: item.materialVariantId,
                  quantity: damagedQty.toNumber(),
                  uom: "Nos.",
                  ownershipType: item.ownershipType as "OWNED" | "HIRED_IN",
                  movementType: "CUSTOMER_RETURN",
                  sourceLocationType: "CUSTOMER_SITE",
                  sourceSiteId: input.customerSiteId,
                  destinationLocationType: "WAREHOUSE",
                  destinationWarehouseId: input.receivingWarehouseId,
                  customerId: input.customerId,
                  referenceDocumentType: "MATERIAL_RETURN_NOTE",
                  referenceDocumentId: mrn.id,
                  condition: "DAMAGED",
                  notes: `MRN ${mrnNumber}: Received ${damagedQty.toString()} damaged units from customer site.`,
                },
                actor,
                tx
              );
            }

            // Post Missing Stock Movement if applicable
            if (missingQty.gt(0)) {
              await postInventoryMovement(
                {
                  materialVariantId: item.materialVariantId,
                  quantity: missingQty.toNumber(),
                  uom: "Nos.",
                  ownershipType: item.ownershipType as "OWNED" | "HIRED_IN",
                  movementType: "MISSING",
                  sourceLocationType: "CUSTOMER_SITE",
                  sourceSiteId: input.customerSiteId,
                  destinationLocationType: "MISSING",
                  customerId: input.customerId,
                  referenceDocumentType: "MATERIAL_RETURN_NOTE",
                  referenceDocumentId: mrn.id,
                  condition: "SCRAP",
                  notes: `MRN ${mrnNumber}: Shortage/Missing ${missingQty.toString()} units on customer return.`,
                },
                actor,
                tx
              );
            }
          }

          if (input.photoUrl || input.receiverSignatureUrl || input.missingEvidenceReason) {
            await tx.movementEvidence.create({
              data: {
                documentType: "RETURN_NOTE",
                documentId: mrn.id,
                returnNoteId: mrn.id,
                photoUrl: input.photoUrl || "/placeholder-evidence.png",
                gpsLatitude: input.gpsLatitude ? new Prisma.Decimal(input.gpsLatitude) : null,
                gpsLongitude: input.gpsLongitude ? new Prisma.Decimal(input.gpsLongitude) : null,
                capturedById: actor.id,
                receiverName: input.receiverName,
                receiverPhone: input.receiverPhone,
                receiverSignatureUrl: input.receiverSignatureUrl,
                missingEvidenceReason: input.missingEvidenceReason,
              },
            });
          }

          await allocateReturnToBatches(mrn.id, tx);

          await logAuditEvent(
            {
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              ipAddress: actor.ipAddress,
              action: "POST",
              module: "material_returns",
              entityType: "MaterialReturnNote",
              entityId: mrn.id,
              notes: `Posted Material Return Note ${mrnNumber} from customer site.`,
            },
            tx
          );

          return mrn;
        } else {
          // --- STAGE 1 / STAGE 2: CREATE RETURN PICKUP REQUEST WORKFLOW ---
          // Physical pickup and warehouse receiving have NOT happened yet!
          // Stock movements are NOT posted until warehouse receiving & finalization.
          const initialStatus = linkedTripId ? "ASSIGNED" : (input.status || "PICKUP_REQUESTED");

          const mrn = await tx.materialReturnNote.create({
            data: {
              mrnNumber,
              customerId: input.customerId,
              customerSiteId: input.customerSiteId,
              receivingWarehouseId: input.receivingWarehouseId,
              referenceDeliveryNoteId: input.referenceDeliveryNoteId || null,
              returnDate: input.returnDate ? new Date(input.returnDate) : new Date(),
              status: initialStatus,
              preferredPickupDate: input.preferredPickupDate ? new Date(input.preferredPickupDate) : null,
              preferredPickupTime: input.preferredPickupTime || null,
              pickupInstructions: input.pickupInstructions || null,
              includeReturnDate: input.includeReturnDate || false,
              vehicleTripId: linkedTripId,
              vehicleNumber: vehicleRegNumber,
              driverName: driverFullName,
              driverPhone: driverContactPhone,
              inspectionStatus: "PENDING",
              remarks: input.remarks || null,
              postedById: actor.id,
              postedAt: null,
            },
          });

          // Create expected return item lines
          for (const item of input.items) {
            const expQty = new Prisma.Decimal(item.expectedQty !== undefined && item.expectedQty !== null ? item.expectedQty : item.returnedQty);

            await tx.materialReturnNoteItem.create({
              data: {
                mrnId: mrn.id,
                materialVariantId: item.materialVariantId,
                ownershipType: item.ownershipType || "OWNED",
                expectedQty: expQty,
                returnedQty: expQty, // Initial expected quantity
                receivedQty: new Prisma.Decimal(0),
                acceptedQty: new Prisma.Decimal(0),
                damagedQty: new Prisma.Decimal(0),
                missingQty: new Prisma.Decimal(0),
                rejectedQty: new Prisma.Decimal(0),
                condition: item.condition || "GOOD",
                remarks: item.remarks || null,
              },
            });
          }

          await logAuditEvent(
            {
              userId: actor.id,
              userName: actor.name,
              userRole: actor.role,
              ipAddress: actor.ipAddress,
              action: "CREATE",
              module: "material_returns",
              entityType: "MaterialReturnNote",
              entityId: mrn.id,
              notes: `Created Return Pickup Request ${mrnNumber} with status ${initialStatus}.`,
            },
            tx
          );

          return mrn;
        }
      },
      { maxWait: 15000, timeout: 30000 }
    );

    // If immediate post, notify customer via WhatsApp
    if (isImmediatePost) {
      const customer = await db.customer.findUnique({ where: { id: input.customerId } });
      if (customer?.primaryMobile) {
        sendWhatsAppNotification({
          recipientMobile: customer.primaryMobile,
          recipientName: customer.name,
          templateName: "MRN_CONFIRMATION",
          documentNumber: result.mrnNumber,
          documentType: "MaterialReturnNote",
          parameters: {
            mrnNumber: result.mrnNumber,
            date: result.returnDate.toLocaleDateString(),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: isImmediatePost
        ? `Material Return Note ${result.mrnNumber} posted successfully. Stock balances updated.`
        : `Material Return Pickup Request ${result.mrnNumber} created successfully (${result.status}).`,
    }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.startsWith("UNAUTHORIZED") ? 401 : error.message?.startsWith("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ success: false, error: { message: error.message } }, { status });
  }
}
