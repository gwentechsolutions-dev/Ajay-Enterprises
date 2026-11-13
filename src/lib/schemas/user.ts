import { z } from "zod";
import { IndianMobileSchema } from "./common";

export const createUserSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters").optional().or(z.literal("")),
  mobile: IndianMobileSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one digit"),
  role: z.enum([
    "OWNER",
    "ADMIN",
    "ACCOUNTANT",
    "WAREHOUSE_MANAGER",
    "WAREHOUSE_STAFF",
    "DELIVERY_MANAGER",
    "DELIVERY_PERSONNEL",
    "LABOUR_SUPERVISOR",
    "READ_ONLY",
  ]),
  scope: z.enum(["ALL_BUSINESS", "ASSIGNED_WAREHOUSE", "ASSIGNED_SITE", "ASSIGNED_DELIVERY"]).default("ALL_BUSINESS"),
  branchId: z.string().uuid("Invalid branch ID").optional().nullable(),
  warehouseId: z.string().uuid("Invalid warehouse ID").optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters").optional().or(z.literal("")),
  mobile: IndianMobileSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one digit")
    .optional()
    .or(z.literal("")),
  role: z.enum([
    "OWNER",
    "ADMIN",
    "ACCOUNTANT",
    "WAREHOUSE_MANAGER",
    "WAREHOUSE_STAFF",
    "DELIVERY_MANAGER",
    "DELIVERY_PERSONNEL",
    "LABOUR_SUPERVISOR",
    "READ_ONLY",
  ]),
  scope: z.enum(["ALL_BUSINESS", "ASSIGNED_WAREHOUSE", "ASSIGNED_SITE", "ASSIGNED_DELIVERY"]),
  branchId: z.string().uuid("Invalid branch ID").optional().nullable(),
  warehouseId: z.string().uuid("Invalid warehouse ID").optional().nullable(),
  isActive: z.boolean(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

