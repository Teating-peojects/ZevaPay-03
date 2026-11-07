import type {
  AccountStatus,
  DeviceStatus,
  MerchantStatus,
  PaymentAccount,
  PaymentProvider,
  Transaction,
  TransactionStatus,
} from "../generated/prisma/client.js";

/** Masks a payment account number, e.g. `01712345678` -> `0171****678`. */
export function maskAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 7) return digits ? `****${digits.slice(-3)}` : "****";
  return `${digits.slice(0, 4)}****${digits.slice(-3)}`;
}

export interface MerchantDto {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  country: string;
  plan: string;
  status: MerchantStatus;
  registrationDate: string;
  lastActiveAt: string;
}

export function serializeMerchant(merchant: {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  country: string;
  plan: string;
  status: MerchantStatus;
  registrationDate: Date;
  lastActiveAt: Date;
}): MerchantDto {
  return {
    id: merchant.id,
    businessName: merchant.businessName,
    ownerName: merchant.ownerName,
    email: merchant.email,
    phone: merchant.phone,
    country: merchant.country,
    plan: merchant.plan,
    status: merchant.status,
    registrationDate: merchant.registrationDate.toISOString(),
    lastActiveAt: merchant.lastActiveAt.toISOString(),
  };
}

export interface AccountDto {
  id: string;
  merchantId: string;
  provider: PaymentProvider;
  /** Masked — the full number is never returned by the API. */
  accountNumber: string;
  accountType: string;
  label: string;
  status: AccountStatus;
  createdAt: string;
}

export function serializeAccount(account: PaymentAccount): AccountDto {
  return {
    id: account.id,
    merchantId: account.merchantId,
    provider: account.provider,
    accountNumber: maskAccountNumber(account.accountNumber),
    accountType: account.accountType,
    label: account.label,
    status: account.status,
    createdAt: account.createdAt.toISOString(),
  };
}

export interface DeviceDto {
  id: string;
  merchantId: string;
  name: string;
  deviceId: string;
  status: DeviceStatus;
  lastActiveAt: string;
  connectedAt: string;
  connectedAccountId: string | null;
  connectedAccountLabel: string | null;
  androidVersion: string | null;
  /** True when the device has no token, so it cannot send until it pairs again. */
  needsPairing: boolean;
}

export function serializeDevice(device: {
  id: string;
  merchantId: string;
  name: string;
  deviceId: string;
  status: DeviceStatus;
  lastActiveAt: Date;
  connectedAt: Date;
  connectedAccountId: string | null;
  androidVersion: string | null;
  tokenHash?: string | null;
  connectedAccount?: { label: string } | null;
}): DeviceDto {
  return {
    id: device.id,
    merchantId: device.merchantId,
    name: device.name,
    deviceId: device.deviceId,
    status: device.status,
    lastActiveAt: device.lastActiveAt.toISOString(),
    connectedAt: device.connectedAt.toISOString(),
    connectedAccountId: device.connectedAccountId,
    connectedAccountLabel: device.connectedAccount?.label ?? null,
    androidVersion: device.androidVersion,
    // Never the hash itself, only whether there is one.
    needsPairing: device.tokenHash === null,
  };
}

export interface TransactionDto {
  id: string;
  reference: string;
  merchantId: string;
  merchantName?: string;
  provider: PaymentProvider;
  amount: number;
  amountMinor: number;
  currency: string;
  customerName: string | null;
  customerPhone: string | null;
  status: TransactionStatus;
  accountLabel: string | null;
  accountId: string | null;
  deviceId: string | null;
  deviceName: string | null;
  rawNotification: string;
  confidence: number;
  providerRef: string | null;
  occurredAt: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
}

export function serializeTransaction(
  transaction: Transaction & {
    account?: { label: string } | null;
    device?: { name: string } | null;
    merchant?: { businessName: string } | null;
    reviewedBy?: { fullName: string } | null;
  },
): TransactionDto {
  return {
    id: transaction.id,
    reference: transaction.reference,
    merchantId: transaction.merchantId,
    ...(transaction.merchant
      ? { merchantName: transaction.merchant.businessName }
      : {}),
    provider: transaction.provider,
    amount: transaction.amountMinor / 100,
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    customerName: transaction.customerName,
    customerPhone: transaction.customerPhone,
    status: transaction.status,
    accountLabel: transaction.account?.label ?? null,
    accountId: transaction.accountId,
    deviceId: transaction.deviceId,
    deviceName: transaction.device?.name ?? null,
    rawNotification: transaction.rawNotification,
    confidence: transaction.confidence,
    providerRef: transaction.providerRef,
    occurredAt: transaction.occurredAt.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
    reviewedAt: transaction.reviewedAt?.toISOString() ?? null,
    reviewedByName: transaction.reviewedBy?.fullName ?? null,
  };
}

export interface UserDto {
  id: string;
  merchantId: string | null;
  merchantName: string | null;
  email: string;
  fullName: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function serializeUser(user: {
  id: string;
  merchantId: string | null;
  email: string;
  fullName: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  merchant?: { businessName: string } | null;
}): UserDto {
  return {
    id: user.id,
    merchantId: user.merchantId,
    merchantName: user.merchant?.businessName ?? null,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
