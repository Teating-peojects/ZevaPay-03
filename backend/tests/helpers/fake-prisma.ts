/**
 * A small in-memory stand-in for the database, shared by the tests that
 * exercise the matching and checkout code.
 *
 * It supports exactly the queries that code uses: equality, `in`, `notIn`,
 * `not`, `gt`/`gte`/`lt`/`lte`, relation filters, `include`/`select` of
 * relations and `_count`, and a `$transaction` that rolls everything back when
 * its callback throws, as the real one does.
 *
 * It checks the logic written on top of the database. It is not a substitute
 * for running against Postgres.
 */
type Row = Record<string, any>;

export const store = {
  transactions: [] as Row[],
  payments: [] as Row[],
  attempts: [] as Row[],
  apiKeys: [] as Row[],
  merchants: [] as Row[],
  accounts: [] as Row[],
  audits: [] as Row[],
};

type Relation = { table: keyof typeof store; fk: string; many: boolean; local?: string };

/** Relations by table. `fk` is the column that holds the link. */
const relations: Record<string, Record<string, Relation>> = {
  payments: {
    merchant: { table: "merchants", fk: "merchantId", many: false },
    attempts: { table: "attempts", fk: "paymentId", many: true, local: "id" },
  },
  attempts: { payment: { table: "payments", fk: "paymentId", many: false } },
  apiKeys: { merchant: { table: "merchants", fk: "merchantId", many: false } },
  merchants: { paymentAccounts: { table: "accounts", fk: "merchantId", many: true, local: "id" } },
};

let counter = 0;

function same(have: unknown, want: unknown): boolean {
  if (have instanceof Date && want instanceof Date) return have.getTime() === want.getTime();
  return have === want;
}

function matches(table: string, row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, want]) => {
    const relation = relations[table]?.[key];
    if (relation && !relation.many) {
      const related = store[relation.table].find((r) => r.id === row[relation.fk]);
      return !!related && matches(relation.table, related, want as Row);
    }
    const have = row[key];
    if (want !== null && typeof want === "object" && !(want instanceof Date)) {
      if ("in" in want) return want.in.includes(have);
      if ("notIn" in want) return !want.notIn.includes(have);
      if ("not" in want) return !same(have, want.not);
      if ("gt" in want) return have > want.gt;
      if ("gte" in want) return have >= want.gte;
      if ("lt" in want) return have < want.lt;
      if ("lte" in want) return have <= want.lte;
    }
    return same(have, want);
  });
}

/** Attaches the relations a query asked for through `include` or `select`. */
function shape(table: string, row: Row, query: Row): Row {
  const spec: Row = { ...(query.include ?? {}), ...(query.select ?? {}) };
  const out: Row = { ...row };
  for (const [key, value] of Object.entries(spec)) {
    if (key === "_count") {
      const counts: Row = {};
      for (const name of Object.keys((value as Row).select ?? {})) {
        const relation = relations[table]?.[name];
        counts[name] = relation
          ? store[relation.table].filter((r) => r[relation.fk] === row[relation.local ?? "id"]).length
          : 0;
      }
      out._count = counts;
      continue;
    }
    const relation = relations[table]?.[key];
    if (!relation) continue;
    const nested = typeof value === "object" ? (value as Row) : {};
    if (relation.many) {
      out[key] = store[relation.table]
        .filter((r) => r[relation.fk] === row[relation.local ?? "id"])
        .filter((r) => matches(relation.table as string, r, nested.where))
        .map((r) => shape(relation.table as string, r, nested));
    } else {
      const related = store[relation.table].find((r) => r.id === row[relation.fk]);
      out[key] = related ? shape(relation.table as string, related, nested) : null;
    }
  }
  return out;
}

function table(name: keyof typeof store, defaults: () => Row = () => ({})) {
  const rows = () => store[name];
  return {
    findUnique: async (query: Row) => {
      const row = rows().find((r) => matches(name, r, query.where));
      return row ? shape(name, row, query) : null;
    },
    findUniqueOrThrow: async (query: Row) => {
      const row = rows().find((r) => matches(name, r, query.where));
      if (!row) throw new Error(`${name}: not found`);
      return shape(name, row, query);
    },
    findFirst: async (query: Row) => {
      const row = rows().find((r) => matches(name, r, query.where));
      return row ? shape(name, row, query) : null;
    },
    findMany: async (query: Row) => {
      let found = rows().filter((r) => matches(name, r, query.where));
      if (query.orderBy?.createdAt) {
        const direction = query.orderBy.createdAt === "desc" ? -1 : 1;
        found = [...found].sort((a, b) => (a.createdAt - b.createdAt) * direction);
      }
      return found.slice(0, query.take ?? found.length).map((r) => shape(name, r, query));
    },
    count: async (query: Row = {}) => rows().filter((r) => matches(name, r, query.where)).length,
    create: async ({ data }: Row) => {
      const row = { id: `${name}_${++counter}`, createdAt: new Date(), ...defaults(), ...data };
      rows().push(row);
      return { ...row };
    },
    update: async ({ where, data }: Row) => {
      const row = rows().find((r) => matches(name, r, where));
      if (!row) throw new Error(`${name}: not found`);
      Object.assign(row, data);
      return { ...row };
    },
    updateMany: async ({ where, data }: Row) => {
      const found = rows().filter((r) => matches(name, r, where));
      found.forEach((r) => Object.assign(r, data));
      return { count: found.length };
    },
  };
}

export const prisma: Row = {
  transaction: table("transactions"),
  payment: table("payments", () => ({
    status: "CREATED",
    deletedAt: null,
    confirmedAt: null,
    expiresAt: null,
    metadata: null,
    description: null,
  })),
  paymentAttempt: table("attempts", () => ({ status: "PENDING" })),
  paymentAccount: table("accounts"),
  apiKey: table("apiKeys"),
  merchant: table("merchants"),
  auditLog: table("audits"),
  $transaction: async (callback: (tx: Row) => Promise<unknown>) => {
    const snapshot = structuredClone(store);
    try {
      return await callback(prisma);
    } catch (error) {
      for (const key of Object.keys(store) as (keyof typeof store)[]) {
        store[key] = snapshot[key];
      }
      throw error;
    }
  },
};

export function resetStore(): void {
  for (const key of Object.keys(store) as (keyof typeof store)[]) store[key] = [];
}
