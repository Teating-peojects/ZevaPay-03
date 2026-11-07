/**
 * Types mirroring the ZevaPay API contract.
 *
 * Every field here is returned by the real backend — there is no mock layer.
 */

/** Payment providers supported by ZevaPay. */
export type PaymentProvider = "BKASH" | "NAGAD" | "ROCKET" | "UPAY";

/** Lifecycle of a payment account. */
export type AccountStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

/** Lifecycle of a merchant organisation. */
export type MerchantStatus = "PENDING_REVIEW" | "ACTIVE" | "SUSPENDED";

/** Connection state of an Android SMS Bridge device. */
export type DeviceStatus = "PENDING" | "ONLINE" | "OFFLINE";

/**
 * Processing state of a recorded payment notification. The API returns the
 * same eight values for transactions and payments.
 */
export type TransactionStatus = import("@/lib/payment-status").PaymentStatus;

/** Type of a connected mobile financial services account. */
export type AccountType = "PERSONAL" | "MERCHANT" | "AGENT" | "BUSINESS";

/** Role of a signed-in user. */
export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "SUPPORT"
  | "MERCHANT_OWNER"
  | "MERCHANT_ADMIN"
  | "MERCHANT_MANAGER"
  | "MERCHANT_SUPPORT"
  | "MERCHANT_VIEWER";

export interface ApiUser {
  id: string;
  merchantId: string | null;
  merchantName: string | null;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ApiMerchant {
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

export interface ApiPaymentAccount {
  id: string;
  merchantId: string;
  provider: PaymentProvider;
  /** Already masked by the API — the full number is never returned. */
  accountNumber: string;
  accountType: AccountType;
  label: string;
  status: AccountStatus;
  createdAt: string;
}

export interface ApiDevice {
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
  /** No token yet: paired before tokens existed, so it must pair again. */
  needsPairing?: boolean;
  /** Only returned by the admin device list. */
  merchantName?: string | null;
}

export interface ApiTransaction {
  id: string;
  reference: string;
  merchantId: string;
  merchantName?: string | null;
  provider: PaymentProvider;
  amount: number;
  customerName: string | null;
  customerPhone: string | null;
  status: TransactionStatus;
  accountLabel: string | null;
  accountId: string | null;
  deviceId: string | null;
  deviceName: string | null;
  rawNotification: string;
  /** Parser confidence, 0..1. */
  confidence: number;
  providerRef: string | null;
  occurredAt: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
}

export interface ApiApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiAuditLog {
  id: string;
  action: string;
  actorName: string | null;
  merchantName?: string | null;
  /** Extra detail the API attached to the entry, when there was any. */
  metadata?: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface ApiPairingCode {
  id: string;
  code: string;
  expiresAt: string;
  connectedAccountId: string | null;
}

export interface ApiSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ActivityPoint {
  label: string;
  success: number;
  pending: number;
  failed: number;
}

export interface MerchantOverview {
  merchant: {
    id: string;
    businessName: string;
    status: MerchantStatus;
    plan: string;
    country: string;
  };
  stats: {
    totalTransactions: number;
    successfulTransactions: number;
    pendingTransactions: number;
    totalAmount: number;
    successRate: number;
    pendingReviews: number;
  };
  statusCounts: {
    success: number;
    pending: number;
    review: number;
    failed: number;
  };
  deviceCounts: { online: number; offline: number; pending: number };
  activity: ActivityPoint[];
  accounts: ApiPaymentAccount[];
  devices: ApiDevice[];
  recentTransactions: ApiTransaction[];
}

export interface AdminOverview {
  stats: {
    totalMerchants: number;
    activeMerchants: number;
    totalTransactions: number;
    pendingReviews: number;
    totalAmount: number;
  };
  merchantCounts: {
    active: number;
    pendingReview: number;
    suspended: number;
  };
  transactionCounts: {
    success: number;
    pending: number;
    review: number;
    failed: number;
  };
  deviceCounts: { online: number; offline: number; pending: number };
  activity: ActivityPoint[];
  recentMerchants: ApiMerchant[];
  recentTransactions: ApiTransaction[];
}

export interface AdminSystemInfo {
  merchants: number;
  users: number;
  devices: number;
  transactions: number;
  environment: string;
}

/**
 * A sensitive action recorded on the platform.
 *
 * The backend stores an append-only trail with a fixed set of action names.
 * There is no severity on the record, so the console derives the emphasis of
 * an entry from the action itself rather than pretending the API said so.
 */
export interface SessionResponse {
  user: ApiUser;
  merchant: ApiMerchant | null;
  expiresIn?: number;
}

/** A payment a merchant has raised. Amounts are in minor units (paisa). */
export interface ApiPayment {
  id: string;
  reference: string;
  amountMinor: number;
  currency: string;
  status: import("@/lib/payment-status").PaymentStatus;
  description: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerId: string | null;
}

/** One attempt to collect a payment through a provider. */
export interface ApiPaymentAttempt {
  id: string;
  provider: PaymentProvider;
  status: import("@/lib/payment-status").PaymentStatus;
  amountMinor: number;
  currency: string;
  providerReference: string | null;
  createdAt: string;
}

/** `GET /merchant/payments/:id`: the payment plus its customer and attempts. */
export interface ApiPaymentDetail extends ApiPayment {
  customer: Pick<ApiCustomer, "id" | "name" | "email" | "phone"> | null;
  attempts: ApiPaymentAttempt[];
}

export interface ApiCustomer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  payments?: ApiPayment[];
}

/** What the customer's checkout page may know about a payment. */
export interface CheckoutView {
  merchantName: string;
  reference: string;
  amountMinor: number;
  currency: string;
  description: string | null;
  status: import("@/lib/payment-status").PaymentStatus;
  /** True once the time has passed without the payment being settled. */
  expired: boolean;
  expiresAt: string | null;
  /** Where "Back to the shop" goes. Null when the merchant gave none. */
  returnUrl: string | null;
  /** One receiving account per provider the merchant can accept. */
  providers: { provider: "BKASH" | "NAGAD"; accountNumber: string; label: string }[];
  /** A TrxID is in and the payment is waiting for its SMS. */
  awaitingSms: boolean;
  attemptsLeft: number;
  /** Whether the customer can still type a TrxID. */
  canSubmit: boolean;
}

export interface ApiWebhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface ApiWebhookDelivery {
  id: string;
  event: string;
  status: "PENDING" | "DELIVERED" | "FAILED";
  attempts: number;
  responseCode: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
  nextAttemptAt: string | null;
}
