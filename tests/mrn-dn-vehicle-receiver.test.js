import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

describe("MRN & DN Vehicle & Yard Receiver Selection with Manual Override Suite", () => {
  const dummyUuid = "00000000-0000-0000-0000-000000000001";

  // Schema matching INVENTRA MRN input
  const materialReturnNoteItemSchema = z.object({
    materialVariantId: z.string().uuid(),
    ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
    returnedQty: z.coerce.number().positive(),
    acceptedQty: z.coerce.number().min(0),
    damagedQty: z.coerce.number().min(0).default(0),
    missingQty: z.coerce.number().min(0).default(0),
    condition: z.enum(["GOOD", "FAIR", "DAMAGED", "REPAIRABLE", "SCRAP"]).default("GOOD"),
    remarks: z.string().optional().nullable(),
  });

  const materialReturnNoteSchema = z.object({
    customerId: z.string().uuid(),
    customerSiteId: z.string().uuid(),
    receivingWarehouseId: z.string().uuid(),
    referenceDeliveryNoteId: z.string().uuid().optional().nullable(),
    returnDate: z.coerce.date().default(() => new Date()),
    includeReturnDate: z.boolean().default(false),
    driverName: z.string().optional().nullable(),
    driverPhone: z.string().optional().nullable(),
    vehicleNumber: z.string().optional().nullable(),
    receiverName: z.string().optional().nullable(),
    receiverPhone: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
    items: z.array(materialReturnNoteItemSchema).min(1),
  });

  const deliveryNoteSchema = z.object({
    customerId: z.string().uuid(),
    customerSiteId: z.string().uuid(),
    sourceWarehouseId: z.string().uuid(),
    deliveryDate: z.coerce.date(),
    includeDeliveryDate: z.boolean().default(false),
    vehicleNumber: z.string().min(1),
    driverName: z.string().optional().nullable(),
    driverPhone: z.string().optional().nullable(),
    items: z.array(
      z.object({
        materialVariantId: z.string().uuid(),
        ownershipType: z.enum(["OWNED", "HIRED_IN"]).default("OWNED"),
        dispatchedQty: z.coerce.number().positive(),
      })
    ).min(1),
  });

  test("should accept MRN with registered fleet vehicle and yard in-charge receiver", () => {
    const payload = {
      customerId: dummyUuid,
      customerSiteId: dummyUuid,
      receivingWarehouseId: dummyUuid,
      returnDate: new Date(),
      includeReturnDate: false,
      vehicleNumber: "KA-01-AB-1234",
      driverName: "Ramesh Kumar",
      driverPhone: "9876543210",
      receiverName: "Senthil Nathan",
      receiverPhone: "9876543211",
      items: [
        {
          materialVariantId: dummyUuid,
          ownershipType: "OWNED",
          returnedQty: 10,
          acceptedQty: 10,
          damagedQty: 0,
          missingQty: 0,
          condition: "GOOD",
        },
      ],
    };

    const parsed = materialReturnNoteSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.vehicleNumber, "KA-01-AB-1234");
      assert.equal(parsed.data.receiverName, "Senthil Nathan");
    }
  });

  test("should accept MRN with manually typed custom vehicle and manual receiver name", () => {
    const payload = {
      customerId: dummyUuid,
      customerSiteId: dummyUuid,
      receivingWarehouseId: dummyUuid,
      returnDate: new Date(),
      includeReturnDate: true,
      vehicleNumber: "TN-09-CUSTOM-9999",
      driverName: "Third Party Driver",
      driverPhone: "9123456789",
      receiverName: "Site Security - Murugan",
      receiverPhone: "9988776655",
      items: [
        {
          materialVariantId: dummyUuid,
          ownershipType: "OWNED",
          returnedQty: 5,
          acceptedQty: 4,
          damagedQty: 1,
          missingQty: 0,
          condition: "DAMAGED",
        },
      ],
    };

    const parsed = materialReturnNoteSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.vehicleNumber, "TN-09-CUSTOM-9999");
      assert.equal(parsed.data.receiverName, "Site Security - Murugan");
    }
  });

  test("should deduplicate receiver candidates across logged in user, yard contacts, and past receivers", () => {
    const currentUser = { name: "Ramesh Kumar", mobile: "9876543210", role: "WAREHOUSE_MANAGER" };
    const warehouses = [
      {
        id: "wh-1",
        name: "Main Yard",
        contactPerson: "Ramesh Kumar", // Same name as current user (case-insensitive deduplication)
        mobile: "9876543210",
      },
      {
        id: "wh-2",
        name: "Secondary Yard",
        contactPerson: "Praveen",
        mobile: "9876543222",
        users: [
          { name: "Praveen", role: "STAFF" }, // Duplicate of contactPerson
          { name: "Kiran", role: "STAFF", mobile: "9876543233" },
        ],
      },
    ];
    const pastReturnNotes = [
      { receiverName: "Praveen", receiverPhone: "9876543222" },
      { receiverName: "Karthik", receiverPhone: "9876543244" },
    ];

    const seen = new Set();
    const candidateList = [];

    // 1. Current user
    if (currentUser?.name && !seen.has(currentUser.name.toLowerCase())) {
      seen.add(currentUser.name.toLowerCase());
      candidateList.push(currentUser.name);
    }

    // 2. Warehouses
    warehouses.forEach((w) => {
      if (w.contactPerson && !seen.has(w.contactPerson.toLowerCase())) {
        seen.add(w.contactPerson.toLowerCase());
        candidateList.push(w.contactPerson);
      }
      if (Array.isArray(w.users)) {
        w.users.forEach((u) => {
          if (u.name && !seen.has(u.name.toLowerCase())) {
            seen.add(u.name.toLowerCase());
            candidateList.push(u.name);
          }
        });
      }
    });

    // 3. Past return notes
    pastReturnNotes.forEach((rn) => {
      if (rn.receiverName && !seen.has(rn.receiverName.toLowerCase())) {
        seen.add(rn.receiverName.toLowerCase());
        candidateList.push(rn.receiverName);
      }
    });

    assert.deepEqual(candidateList, ["Ramesh Kumar", "Praveen", "Kiran", "Karthik"]);
    assert.equal(candidateList.length, 4);
  });

  test("should accept Delivery Note with fleet vehicle and custom manual vehicle override", () => {
    const fleetPayload = {
      customerId: dummyUuid,
      customerSiteId: dummyUuid,
      sourceWarehouseId: dummyUuid,
      deliveryDate: new Date(),
      includeDeliveryDate: true,
      vehicleNumber: "KA-01-EA-4412",
      driverName: "Muthu Vel",
      driverPhone: "9876543210",
      items: [
        {
          materialVariantId: dummyUuid,
          ownershipType: "OWNED",
          dispatchedQty: 20,
        },
      ],
    };

    const parsedFleet = deliveryNoteSchema.safeParse(fleetPayload);
    assert.equal(parsedFleet.success, true);

    const manualPayload = {
      ...fleetPayload,
      vehicleNumber: "TN-22-EXTRA-1001",
    };
    const parsedManual = deliveryNoteSchema.safeParse(manualPayload);
    assert.equal(parsedManual.success, true);
    if (parsedManual.success) {
      assert.equal(parsedManual.data.vehicleNumber, "TN-22-EXTRA-1001");
    }
  });
});
