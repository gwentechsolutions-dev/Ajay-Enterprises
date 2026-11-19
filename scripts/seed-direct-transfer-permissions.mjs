import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES = [
  "OWNER",
  "ADMINISTRATOR",
  "ADMIN",
  "ACCOUNTANT",
  "WAREHOUSE_MANAGER",
  "WAREHOUSE_STAFF",
  "DELIVERY_MANAGER",
  "DELIVERY_PERSONNEL",
  "LABOUR_SUPERVISOR",
  "AUDITOR",
  "READ_ONLY",
];

const ACTIONS = ["view", "create", "edit", "approve", "post", "cancel", "export", "delete"];

const ROLE_PERMS = {
  OWNER: ["view", "create", "edit", "approve", "post", "cancel", "export", "delete"],
  ADMINISTRATOR: ["view", "create", "edit", "approve", "post", "cancel", "export"],
  ADMIN: ["view", "create", "edit", "approve", "post", "cancel", "export"],
  ACCOUNTANT: ["view", "export"],
  WAREHOUSE_MANAGER: ["view", "create", "edit", "approve", "post", "cancel", "export"],
  WAREHOUSE_STAFF: ["view", "edit"],
  DELIVERY_MANAGER: ["view", "create", "edit", "approve", "export"],
  DELIVERY_PERSONNEL: ["view", "edit", "post"],
  LABOUR_SUPERVISOR: [],
  AUDITOR: ["view", "export"],
  READ_ONLY: ["view"],
};

async function main() {
  console.log("Seeding direct_transfers permissions into RolePermission table...");
  let count = 0;

  for (const role of ROLES) {
    const allowed = ROLE_PERMS[role] || [];
    for (const action of ACTIONS) {
      const isAllowed = allowed.includes(action);
      await prisma.rolePermission.upsert({
        where: {
          role_module_action: {
            role,
            module: "direct_transfers",
            action,
          },
        },
        update: {
          isAllowed,
        },
        create: {
          role,
          module: "direct_transfers",
          action,
          isAllowed,
        },
      });
      count++;
    }
  }

  console.log(`Successfully upserted ${count} direct_transfers role permissions!`);
}

main()
  .catch((e) => {
    console.error("Error seeding permissions:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
