import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../backend/src/generated/prisma/client.js";
import argon2 from "argon2";

/**
 * Seeds the database with a realistic starting dataset:
 *
 *   - one platform administrator
 *   - four merchants (one active, one pending review, one suspended, one active)
 *   - a handful of staff users across those merchants
 *   - payment accounts for the active merchants
 *   - paired and unpaired devices
 *   - transactions in every state, including rows awaiting review
 *
 * Every credential below is a development default and is printed at the end
 * of the run. Change them before deploying anywhere real.
 */
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://zevapay:zevapay@localhost:5432/zevapay?schema=public";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PASSWORD = "ZevaPay#2026";
if (process.env.NODE_ENV === "production") {
  throw new Error("The development seed is disabled when NODE_ENV=production.");
}

const PERMISSIONS = ["payments:read", "payments:write", "transactions:read", "accounts:read", "accounts:write", "customers:read", "customers:write", "invoices:read", "invoices:write", "payment_links:read", "payment_links:write", "devices:read", "devices:write", "api_keys:read", "api_keys:write", "webhooks:read", "webhooks:write", "reports:read", "team:read", "team:write", "billing:read", "settings:read", "settings:write", "merchants:manage", "admin:manage"] as const;

const MERCHANTS = [
  {
    businessName: "Dhanmondi Electronics",
    ownerName: "Rakib Chowdhury",
    email: "owner@dhanmondi.test",
    phone: "01723445566",
    country: "Bangladesh",
    plan: "Growth",
    status: "ACTIVE" as const,
  },
  {
    businessName: "Gulshan Fresh Market",
    ownerName: "Shahriar Alam",
    email: "owner@gulshan.test",
    phone: "01815667788",
    country: "Bangladesh",
    plan: "Starter",
    status: "ACTIVE" as const,
  },
  {
    businessName: "Banani Textiles",
    ownerName: "Rezaul Karim",
    email: "owner@banani.test",
    phone: "01912334455",
    country: "Bangladesh",
    plan: "Starter",
    status: "PENDING_REVIEW" as const,
  },
  {
    businessName: "Mirpur Wholesale Hub",
    ownerName: "Mehedi Hasan",
    email: "owner@mirpur.test",
    phone: "01622556677",
    country: "Bangladesh",
    plan: "Enterprise",
    status: "SUSPENDED" as const,
  },
];

const STAFF = [
  {
    email: "operator@dhanmondi.test",
    fullName: "Ayesha Siddika",
    role: "MERCHANT_MANAGER" as const,
    merchantIndex: 0,
  },
  {
    email: "viewer@dhanmondi.test",
    fullName: "Kamrul Hasan",
    role: "MERCHANT_VIEWER" as const,
    merchantIndex: 0,
  },
  {
    email: "admin@gulshan.test",
    fullName: "Nafisa Rahman",
    role: "MERCHANT_ADMIN" as const,
    merchantIndex: 1,
  },
];

const ACCOUNTS = [
  {
    merchantIndex: 0,
    provider: "BKASH" as const,
    accountNumber: "01723445566",
    accountType: "MERCHANT" as const,
    label: "Main bKash Counter",
    status: "ACTIVE" as const,
  },
  {
    merchantIndex: 0,
    provider: "NAGAD" as const,
    accountNumber: "01815667788",
    accountType: "PERSONAL" as const,
    label: "Nagad Backup Wallet",
    status: "ACTIVE" as const,
  },
  {
    merchantIndex: 0,
    provider: "ROCKET" as const,
    accountNumber: "01912334455",
    accountType: "BUSINESS" as const,
    label: "Rocket Wallet",
    status: "PENDING" as const,
  },
  {
    merchantIndex: 0,
    provider: "UPAY" as const,
    accountNumber: "01622556677",
    accountType: "AGENT" as const,
    label: "Corporate Upay",
    status: "ACTIVE" as const,
  },
  {
    merchantIndex: 1,
    provider: "BKASH" as const,
    accountNumber: "01723445577",
    accountType: "MERCHANT" as const,
    label: "Storefront bKash",
    status: "ACTIVE" as const,
  },
  {
    merchantIndex: 1,
    provider: "NAGAD" as const,
    accountNumber: "01815667799",
    accountType: "MERCHANT" as const,
    label: "Metro Nagad",
    status: "ACTIVE" as const,
  },
];

const DEVICES = [
  {
    merchantIndex: 0,
    name: "Front Counter — Dhanmondi",
    deviceId: "ZP-SMS-8F2A41",
    status: "ONLINE" as const,
    androidVersion: "Android 13",
    accountIndex: 0,
    daysAgo: 200,
  },
  {
    merchantIndex: 0,
    name: "Front Counter — Gulshan",
    deviceId: "ZP-SMS-7C1B58",
    status: "ONLINE" as const,
    androidVersion: "Android 12",
    accountIndex: 1,
    daysAgo: 150,
  },
  {
    merchantIndex: 0,
    name: "Warehouse Scanner",
    deviceId: "ZP-SMS-4D9E23",
    status: "OFFLINE" as const,
    androidVersion: "Android 11",
    accountIndex: 0,
    daysAgo: 100,
  },
  {
    merchantIndex: 0,
    name: "Mobile Checkout — Mirpur",
    deviceId: "ZP-SMS-2A6F17",
    status: "PENDING" as const,
    androidVersion: "Android 14",
    accountIndex: null,
    daysAgo: 1,
  },
  {
    merchantIndex: 1,
    name: "Store Terminal 01",
    deviceId: "ZP-SMS-5B3C90",
    status: "ONLINE" as const,
    androidVersion: "Android 13",
    accountIndex: 4,
    daysAgo: 120,
  },
  {
    merchantIndex: 1,
    name: "Outlet Terminal — Banani",
    deviceId: "ZP-SMS-1F5A62",
    status: "OFFLINE" as const,
    androidVersion: "Android 11",
    accountIndex: 5,
    daysAgo: 60,
  },
];

interface SeedTransaction {
  merchantIndex: number;
  accountIndex: number;
  deviceIndex: number;
  provider: "BKASH" | "NAGAD" | "ROCKET" | "UPAY";
  amount: number;
  customerName: string | null;
  customerPhone: string | null;
  status: "PENDING" | "REVIEW" | "FAILED";
  confidence: number;
  providerRef: string | null;
  rawNotification: string;
  minutesAgo: number;
}

const TRANSACTIONS: SeedTransaction[] = [
  {
    merchantIndex: 0,
    accountIndex: 0,
    deviceIndex: 0,
    provider: "BKASH",
    amount: 2450,
    customerName: "Rakib Chowdhury",
    customerPhone: "01723445566",
    status: "PENDING",
    confidence: 1,
    providerRef: "8H2K4L9M",
    rawNotification:
      "bKash: You have received Tk 2,450.00 from Rakib Chowdhury. TrxID: 8H2K4L9M. Ref: BKSEND01.",
    minutesAgo: 20,
  },
  {
    merchantIndex: 0,
    accountIndex: 1,
    deviceIndex: 1,
    provider: "NAGAD",
    amount: 890,
    customerName: "Shahriar Alam",
    customerPhone: null,
    status: "PENDING",
    confidence: 1,
    providerRef: "NGD778812",
    rawNotification:
      "Nagad: Tk 890.00 received. Sender: Shahriar Alam. TxnID: NGD778812.",
    minutesAgo: 63,
  },
  {
    merchantIndex: 0,
    accountIndex: 0,
    deviceIndex: 0,
    provider: "BKASH",
    amount: 12750,
    customerName: "Rezaul Karim",
    customerPhone: null,
    status: "REVIEW",
    confidence: 0.65,
    providerRef: null,
    rawNotification: "You have received Tk 12,750.00 from Rezaul Karim.",
    minutesAgo: 99,
  },
  {
    merchantIndex: 0,
    accountIndex: 2,
    deviceIndex: 0,
    provider: "ROCKET",
    amount: 560,
    customerName: null,
    customerPhone: null,
    status: "FAILED",
    confidence: 1,
    providerRef: "RKT220145",
    rawNotification:
      "Tk 560.00 debited. Balance depleted. TxnID: RKT220145.",
    minutesAgo: 134,
  },
  {
    merchantIndex: 0,
    accountIndex: 3,
    deviceIndex: 1,
    provider: "UPAY",
    amount: 3400,
    customerName: "Sadia Islam",
    customerPhone: null,
    status: "PENDING",
    confidence: 1,
    providerRef: "UPY993012",
    rawNotification:
      "Upay: Payment received Tk 3,400.00 from Sadia Islam. Ref: UPY993012.",
    minutesAgo: 209,
  },
  {
    merchantIndex: 0,
    accountIndex: 0,
    deviceIndex: 0,
    provider: "BKASH",
    amount: 1750,
    customerName: "Jahangir Alam",
    customerPhone: "01866221334",
    status: "PENDING",
    confidence: 1,
    providerRef: "9X1C5V3B",
    rawNotification:
      "bKash: You have received Tk 1,750.00 from Jahangir Alam. TrxID: 9X1C5V3B. Mobile: 01866-221334.",
    minutesAgo: 292,
  },
  {
    merchantIndex: 0,
    accountIndex: 1,
    deviceIndex: 1,
    provider: "NAGAD",
    amount: 620,
    customerName: "Ayesha Siddika",
    customerPhone: "01999112233",
    status: "PENDING",
    confidence: 1,
    providerRef: "NGD550144",
    rawNotification:
      "Nagad: Tk 620.00 received. Sender: Ayesha Siddika. TxnID: NGD550144. Mobile: 01999-112233.",
    minutesAgo: 347,
  },
  {
    merchantIndex: 0,
    accountIndex: 0,
    deviceIndex: 2,
    provider: "BKASH",
    amount: 4820,
    customerName: "Kamrul Hasan",
    customerPhone: null,
    status: "PENDING",
    confidence: 1,
    providerRef: "2W8E6T4Y",
    rawNotification:
      "bKash: You have received Tk 4,820.00 from Kamrul Hasan. TrxID: 2W8E6T4Y.",
    minutesAgo: 425,
  },
  {
    merchantIndex: 0,
    accountIndex: 2,
    deviceIndex: 2,
    provider: "ROCKET",
    amount: 990,
    customerName: "Shirin Sultana",
    customerPhone: null,
    status: "PENDING",
    confidence: 1,
    providerRef: "RKT110233",
    rawNotification:
      "Tk 990.00 received. Sender: Shirin Sultana. TxnID: RKT110233.",
    minutesAgo: 1303,
  },
  {
    merchantIndex: 0,
    accountIndex: 3,
    deviceIndex: 1,
    provider: "UPAY",
    amount: 1290,
    customerName: "Rifat Ahmed",
    customerPhone: null,
    status: "REVIEW",
    confidence: 0.65,
    providerRef: null,
    rawNotification: "Payment received Tk 1,290.00.",
    minutesAgo: 1519,
  },
  {
    merchantIndex: 0,
    accountIndex: 1,
    deviceIndex: 1,
    provider: "NAGAD",
    amount: 245,
    customerName: null,
    customerPhone: null,
    status: "FAILED",
    confidence: 1,
    providerRef: "NGD330091",
    rawNotification:
      "Nagad: Transaction could not be completed. TxnID: NGD330091.",
    minutesAgo: 1654,
  },
  {
    merchantIndex: 1,
    accountIndex: 4,
    deviceIndex: 4,
    provider: "BKASH",
    amount: 1180,
    customerName: "Shahab Uddin",
    customerPhone: null,
    status: "PENDING",
    confidence: 1,
    providerRef: "3C7D2E9F",
    rawNotification:
      "bKash: You have received Tk 1,180.00 from Shahab Uddin. TrxID: 3C7D2E9F.",
    minutesAgo: 42,
  },
  {
    merchantIndex: 1,
    accountIndex: 4,
    deviceIndex: 4,
    provider: "BKASH",
    amount: 640,
    customerName: "Habibur Rahman",
    customerPhone: null,
    status: "PENDING",
    confidence: 1,
    providerRef: "6B1A8G4K",
    rawNotification:
      "bKash: You have received Tk 640.00 from Habibur Rahman. TrxID: 6B1A8G4K.",
    minutesAgo: 314,
  },
  {
    merchantIndex: 1,
    accountIndex: 5,
    deviceIndex: 5,
    provider: "NAGAD",
    amount: 5600,
    customerName: "Beximco Traders",
    customerPhone: null,
    status: "REVIEW",
    confidence: 0.65,
    providerRef: null,
    rawNotification: "Nagad: Tk 5,600.00 received.",
    minutesAgo: 107,
  },
  {
    merchantIndex: 1,
    accountIndex: 5,
    deviceIndex: 5,
    provider: "NAGAD",
    amount: 2100,
    customerName: "Rafiq Uddin",
    customerPhone: null,
    status: "PENDING",
    confidence: 1,
    providerRef: "NGD665301",
    rawNotification:
      "Nagad: Tk 2,100.00 received. Sender: Rafiq Uddin. TxnID: NGD665301.",
    minutesAgo: 382,
  },
  {
    merchantIndex: 1,
    accountIndex: 5,
    deviceIndex: 5,
    provider: "NAGAD",
    amount: 3300,
    customerName: "Shahin Alam",
    customerPhone: null,
    status: "FAILED",
    confidence: 1,
    providerRef: "NGD220145",
    rawNotification: "Nagad: Transaction declined. TxnID: NGD220145.",
    minutesAgo: 1758,
  },
  {
    merchantIndex: 1,
    accountIndex: 4,
    deviceIndex: 4,
    provider: "BKASH",
    amount: 7600,
    customerName: "Nazmul Hasan",
    customerPhone: null,
    status: "PENDING",
    confidence: 1,
    providerRef: "5D2F8G4H",
    rawNotification:
      "bKash: You have received Tk 7,600.00 from Nazmul Hasan. TrxID: 5D2F8G4H.",
    minutesAgo: 2510,
  },
  {
    merchantIndex: 1,
    accountIndex: 5,
    deviceIndex: 5,
    provider: "NAGAD",
    amount: 1875,
    customerName: "Anwar Hossain",
    customerPhone: null,
    status: "PENDING",
    confidence: 1,
    providerRef: "NGD778122",
    rawNotification:
      "Nagad: Tk 1,875.00 received. Sender: Anwar Hossain. TxnID: NGD778122.",
    minutesAgo: 2808,
  },
  {
    merchantIndex: 1,
    accountIndex: 5,
    deviceIndex: 5,
    provider: "NAGAD",
    amount: 7400,
    customerName: "Bashundhara Textiles",
    customerPhone: null,
    status: "PENDING",
    confidence: 1,
    providerRef: "NGD554411",
    rawNotification:
      "Nagad: Tk 7,400.00 received. Sender: Bashundhara Textiles. TxnID: NGD554411.",
    minutesAgo: 4521,
  },
];

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function main() {
  console.log("Seeding ZevaPay database...");

  // Reset in dependency order.
  await prisma.auditLog.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookEndpoint.deleteMany();
  await prisma.apiRequestLog.deleteMany();
  await prisma.paymentAttempt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.paymentLink.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.brandDomain.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.businessProfile.deleteMany();
  await prisma.memberRole.deleteMany();
  await prisma.merchantMember.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.session.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.pairingCode.deleteMany();
  await prisma.device.deleteMany();
  await prisma.paymentAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.merchant.deleteMany();

  const passwordHash = await argon2.hash(PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  // --- platform administrator -----------------------------------------
  const admin = await prisma.user.create({
    data: {
      email: "admin@zevapay.test",
      fullName: "Platform Administrator",
      role: "SUPER_ADMIN",
      passwordHash,
      phone: "01700000000",
    },
  });

  // --- merchants --------------------------------------------------------
  const merchants: Array<{ id: string }> = [];
  for (const merchant of MERCHANTS) {
    const created = await prisma.merchant.create({
      data: {
        businessName: merchant.businessName,
        ownerName: merchant.ownerName,
        email: merchant.email,
        phone: merchant.phone,
        country: merchant.country,
        plan: merchant.plan,
        status: merchant.status,
        registrationDate: daysAgo(120 + merchants.length * 20),
        lastActiveAt: daysAgo(merchants.length),
        users: {
          create: {
            email: merchant.email,
            fullName: merchant.ownerName,
            phone: merchant.phone,
            role: "MERCHANT_OWNER",
            passwordHash,
          },
        },
      },
    });
    merchants.push(created);
  }

  // --- staff users ------------------------------------------------------
  for (const staff of STAFF) {
    await prisma.user.create({
      data: {
        email: staff.email,
        fullName: staff.fullName,
        role: staff.role,
        merchantId: merchants[staff.merchantIndex].id,
        passwordHash,
      },
    });
  }

  const roleNames = ["SUPER_ADMIN", "ADMIN", "SUPPORT", "MERCHANT_OWNER", "MERCHANT_ADMIN", "MERCHANT_MANAGER", "MERCHANT_SUPPORT", "MERCHANT_VIEWER"];
  const roleRows = new Map<string, { id: string }>();
  for (const name of roleNames) roleRows.set(name, await prisma.role.create({ data: { name } }));
  const permissionRows = new Map<string, { id: string }>();
  for (const key of PERMISSIONS) permissionRows.set(key, await prisma.permission.create({ data: { key, description: `Permission to ${key.replaceAll(":", " ")}` } }));
  for (const name of roleNames) {
    const merchantPermissions = PERMISSIONS.filter((key) => !key.startsWith("admin:") && !key.startsWith("merchants:"));
    const allowed = name === "SUPER_ADMIN" || name === "ADMIN"
      ? PERMISSIONS
      : name === "SUPPORT"
        ? PERMISSIONS.filter((key) => key.endsWith(":read") || key === "merchants:manage")
        : name === "MERCHANT_OWNER" || name === "MERCHANT_ADMIN"
          ? merchantPermissions
          : name === "MERCHANT_MANAGER"
            ? merchantPermissions.filter((key) => key !== "team:write" && key !== "billing:read")
            : PERMISSIONS.filter((key) => key.endsWith(":read"));
    for (const key of allowed) await prisma.rolePermission.create({ data: { roleId: roleRows.get(name)!.id, permissionId: permissionRows.get(key)!.id } });
  }
  const merchantUsers = await prisma.user.findMany({ where: { merchantId: { not: null } }, select: { id: true, merchantId: true, role: true } });
  for (const user of merchantUsers) {
    const member = await prisma.merchantMember.create({ data: { userId: user.id, merchantId: user.merchantId! } });
    await prisma.memberRole.create({ data: { memberId: member.id, roleId: roleRows.get(user.role)!.id } });
  }

  for (const [code, name, monthlyPriceMinor] of [["FREE", "Free", 0], ["STARTER", "Starter", 0], ["GROWTH", "Growth", 99000], ["BUSINESS", "Business", 299000], ["ENTERPRISE", "Enterprise", 0]] as const) {
    await prisma.plan.upsert({ where: { code }, create: { code, name, monthlyPriceMinor }, update: { name, monthlyPriceMinor } });
  }

  // --- payment accounts --------------------------------------------------
  const accounts = [];
  for (const account of ACCOUNTS) {
    const created = await prisma.paymentAccount.create({
      data: {
        merchantId: merchants[account.merchantIndex].id,
        provider: account.provider,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        label: account.label,
        status: account.status,
      },
    });
    accounts.push(created);
  }

  // --- devices ------------------------------------------------------------
  const devices = [];
  for (const device of DEVICES) {
    const created = await prisma.device.create({
      data: {
        merchantId: merchants[device.merchantIndex].id,
        name: device.name,
        deviceId: device.deviceId,
        status: device.status,
        androidVersion: device.androidVersion,
        connectedAccountId:
          device.accountIndex === null
            ? null
            : accounts[device.accountIndex].id,
        connectedAt: daysAgo(device.daysAgo),
        lastActiveAt:
          device.status === "ONLINE"
            ? new Date(Date.now() - Math.floor(Math.random() * 40) * 60 * 1000)
            : daysAgo(2),
      },
    });
    devices.push(created);
  }

  // --- transactions -------------------------------------------------------
  let reference = 100245;
  for (const transaction of TRANSACTIONS) {
    await prisma.transaction.create({
      data: {
        reference: `TXN-${reference--}`,
        merchantId: merchants[transaction.merchantIndex].id,
        accountId: accounts[transaction.accountIndex].id,
        deviceId: devices[transaction.deviceIndex].id,
        provider: transaction.provider,
        amountMinor: Math.round(transaction.amount * 100),
        currency: "BDT",
        customerName: transaction.customerName,
        customerPhone: transaction.customerPhone,
        status: transaction.status,
        rawNotification: transaction.rawNotification,
        confidence: transaction.confidence,
        providerRef: transaction.providerRef,
        occurredAt: minutesAgo(transaction.minutesAgo),
        createdAt: minutesAgo(transaction.minutesAgo),
      },
    });
  }

  // --- a pending pairing code the device simulator can use ----------------
  await prisma.pairingCode.create({
    data: {
      merchantId: merchants[0].id,
      code: "ZP-DEMO1",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      connectedAccountId: accounts[0].id,
    },
  });

  // --- audit trail ---------------------------------------------------------
  await prisma.auditLog.create({
    data: {
      action: "REGISTER",
      actorId: admin.id,
      metadata: { source: "seed" },
    },
  });

  console.log("");
  console.log("Seed complete.");
  console.log("--------------------------------------------------------------");
  console.log("Platform admin : admin@zevapay.test");
  console.log(`Merchant owner : ${MERCHANTS[0].email}`);
  console.log(`Staff operator : ${STAFF[0].email}`);
  console.log(`Shared password: ${PASSWORD}`);
  console.log("Pairing code   : ZP-DEMO1");
  console.log("--------------------------------------------------------------");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
