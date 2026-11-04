import { z } from "zod";

/**
 * Validation schemas shared by the forms.
 *
 * The rules mirror the API's own validation so the user sees the same
 * message whether the form or the server rejects the input.
 */

/** Bangladeshi mobile number, e.g. 01712345678. */
export const bdPhoneSchema = z
  .string()
  .trim()
  .regex(/^01[3-9]\d{8}$/, "Enter a valid 11-digit mobile number.");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(128, "Password is too long.")
  .regex(/[a-z]/, "Include at least one lowercase letter.")
  .regex(/[A-Z]/, "Include at least one uppercase letter.")
  .regex(/\d/, "Include at least one number.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  business: z.string().trim().min(2, "Enter your business name."),
  email: emailSchema,
  phone: bdPhoneSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Re-enter your password."),
  terms: z.literal(true, {
    error: "You must accept the terms to continue.",
  }),
});

export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/**
 * The reset-password form.
 *
 * This screen is UI-only in Phase 2 — the backend has no reset-token
 * endpoint yet — but it validates the same password rules the rest of the
 * app uses, so the behaviour is already correct when the endpoint lands.
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Re-enter your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/**
 * The two-factor code.
 *
 * Six digits, as a one-time code usually is. The field is a code, not a
 * PIN — ZevaPay never asks for a provider PIN or an OTP.
 */
export const twoFactorSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the six-digit code."),
});

export type TwoFactorValues = z.infer<typeof twoFactorSchema>;

/**
 * The email-verification form.
 *
 * The backend has no verification endpoint yet, so this screen only checks
 * that the address is well formed.
 */
export const verifyEmailSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the six-digit code."),
});

export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>;

/**
 * The contact form.
 *
 * There is no ticketing system behind the contact page, so this only checks
 * that the message is complete enough to be useful.
 */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: emailSchema,
  topic: z.enum(
    ["general", "device", "payment", "account", "api", "billing"],
    { error: "Choose a topic." },
  ),
  message: z
    .string()
    .trim()
    .min(20, "Describe the problem in a little more detail (at least 20 characters).")
    .max(2_000, "Keep the message under 2,000 characters."),
});

export type ContactValues = z.infer<typeof contactSchema>;

export const accountSchema = z.object({
  provider: z.enum(["BKASH", "NAGAD", "ROCKET", "UPAY"], {
    error: "Choose a payment provider.",
  }),
  accountNumber: bdPhoneSchema,
  accountType: z.enum(["PERSONAL", "MERCHANT", "AGENT", "BUSINESS"], {
    error: "Choose an account type.",
  }),
  label: z.string().trim().min(1, "Give this account a label."),
});

export type AccountValues = z.infer<typeof accountSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  email: emailSchema,
  phone: bdPhoneSchema,
  businessName: z.string().trim().min(2, "Enter your business name."),
});

export type ProfileValues = z.infer<typeof profileSchema>;

/**
 * The merchant settings form. The phone number is optional, so it is
 * validated only when it is filled in.
 */
export const merchantProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^01[3-9]\d{8}$/.test(value),
      "Enter a valid 11-digit mobile number.",
    ),
  businessName: z.string().trim().min(2, "Enter your business name."),
});

export type MerchantProfileValues = z.infer<typeof merchantProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Re-enter your password."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const adminProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^01[3-9]\d{8}$/.test(value),
      "Enter a valid 11-digit mobile number.",
    ),
});

export type AdminProfileValues = z.infer<typeof adminProfileSchema>;

/**
 * The admin console's "register a merchant" form.
 *
 * The rules match the API's own validation, so the same message appears
 * whether the form or the server rejects the input.
 */
export const createMerchantSchema = z.object({
  businessName: z.string().trim().min(2, "Enter the business name."),
  ownerName: z.string().trim().min(2, "Enter the owner's name."),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^01[3-9]\d{8}$/.test(value),
      "Enter a valid 11-digit Bangladeshi mobile number.",
    ),
  status: z.enum(["PENDING_REVIEW", "ACTIVE", "SUSPENDED"], {
    error: "Choose an account status.",
  }),
});

export type CreateMerchantValues = z.infer<typeof createMerchantSchema>;

/**
 * A platform announcement, sent from the admin console to merchants.
 */
export const platformNotificationSchema = z.object({
  title: z.string().trim().min(3, "Give the announcement a title."),
  detail: z
    .string()
    .trim()
    .min(10, "Write the message in at least 10 characters.")
    .max(500, "Keep the message under 500 characters."),
  channel: z.enum(
    ["email", "dashboard", "sms", "telegram", "discord", "slack", "webhook"],
    { error: "Choose a channel." },
  ),
  audience: z.string().trim().min(2, "Say who the message is for."),
});

export type PlatformNotificationValues = z.infer<
  typeof platformNotificationSchema
>;

/**
 * The admin console's "invite a staff member" form.
 */
export const adminStaffSchema = z.object({
  name: z.string().trim().min(2, "Enter their name."),
  email: emailSchema,
  role: z.enum(["SUPER_ADMIN", "ADMIN", "SUPPORT", "VIEWER"], {
    error: "Choose a role.",
  }),
});

export type AdminStaffValues = z.infer<typeof adminStaffSchema>;

export const apiKeySchema = z.object({
  name: z.string().trim().min(2, "Give the key a name."),
});

export type ApiKeyValues = z.infer<typeof apiKeySchema>;
