import { z } from "zod";
import {
  bdPhoneSchema,
  emailSchema,
  passwordSchema,
} from "./common.js";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
  rememberMe: z.boolean().optional().default(false),
});

export const registerSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Business name is required")
    .max(120, "Business name is too long"),
  ownerName: z
    .string()
    .trim()
    .min(2, "Your name is required")
    .max(120, "Your name is too long"),
  email: emailSchema,
  phone: bdPhoneSchema,
  password: passwordSchema,
  country: z.string().trim().max(60).default("Bangladesh"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, "A reset token is required"),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Your current password is required"),
  newPassword: passwordSchema,
});

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Your name is required")
    .max(120, "Your name is too long"),
  email: emailSchema,
  phone: bdPhoneSchema.optional().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
