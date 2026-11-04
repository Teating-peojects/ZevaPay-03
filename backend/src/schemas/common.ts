import { z } from "zod";

/** Bangladeshi mobile number in `01XXXXXXXXX` form. */
export const bdPhoneSchema = z
  .string()
  .trim()
  .regex(
    /^01[3-9]\d{8}$/,
    "Enter a valid 11-digit Bangladeshi mobile number",
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(160, "Email is too long");

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Password is too long")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number");

/** Providers ZevaPay can read notifications from. */
export const providerSchema = z.enum(["BKASH", "NAGAD", "ROCKET", "UPAY"]);

export const accountTypeSchema = z.enum([
  "PERSONAL",
  "MERCHANT",
  "AGENT",
  "BUSINESS",
]);

export const accountStatusSchema = z.enum(["PENDING", "ACTIVE", "SUSPENDED"]);

export const deviceStatusSchema = z.enum(["PENDING", "ONLINE", "OFFLINE"]);

export const transactionStatusSchema = z.enum([
  "CREATED",
  "PENDING",
  "REVIEW",
  "CONFIRMED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
]);

export const paymentStatusSchema = transactionStatusSchema;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().trim().min(1, "A record id is required"),
});

export type Pagination = z.infer<typeof paginationSchema>;
