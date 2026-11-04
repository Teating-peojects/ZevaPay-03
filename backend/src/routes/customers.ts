import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { paginationSchema } from "../schemas/common.js";

const customerSchema = z.object({
  name: z.string().trim().min(2).max(120).optional().nullable(),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()).optional().nullable(),
  phone: z.string().trim().min(7).max(24).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function registerCustomerRoutes(app: FastifyInstance): Promise<void> {
  const read = { preHandler: [app.authenticate, app.requirePermission("customers:read")] };
  const write = { preHandler: [app.authenticate, app.requirePermission("customers:write")] };

  app.get("/api/v1/merchant/customers", read, async (request) => {
    const query = paginationSchema.extend({ q: z.string().trim().max(120).optional() }).parse(request.query);
    const merchantId = await app.resolveMerchantId(request);
    const where = {
      merchantId,
      ...(query.q ? { OR: [
        { name: { contains: query.q, mode: "insensitive" as const } },
        { email: { contains: query.q, mode: "insensitive" as const } },
        { phone: { contains: query.q } },
      ] } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.customer.count({ where }),
    ]);
    return { data, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  });

  app.post("/api/v1/merchant/customers", write, async (request, reply) => {
    const body = customerSchema.parse(request.body);
    const merchantId = await app.resolveMerchantId(request);
    try {
      const data = await prisma.customer.create({ data: { ...body, merchantId } });
      return reply.status(201).send({ data });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictError("A customer with that email or phone already exists.");
      throw error;
    }
  });

  app.get<{ Params: { id: string } }>("/api/v1/merchant/customers/:id", read, async (request) => {
    const merchantId = await app.resolveMerchantId(request);
    const data = await prisma.customer.findFirst({ where: { id: request.params.id, merchantId }, include: { payments: { orderBy: { createdAt: "desc" }, take: 20 } } });
    if (!data) throw new NotFoundError("That customer could not be found.");
    return { data };
  });

  app.patch<{ Params: { id: string } }>("/api/v1/merchant/customers/:id", write, async (request) => {
    const merchantId = await app.resolveMerchantId(request);
    const body = customerSchema.partial().parse(request.body);
    const changed = await prisma.customer.updateMany({ where: { id: request.params.id, merchantId }, data: body });
    if (changed.count !== 1) throw new NotFoundError("That customer could not be found.");
    const data = await prisma.customer.findFirst({ where: { id: request.params.id, merchantId } });
    return { data };
  });

  app.delete<{ Params: { id: string } }>("/api/v1/merchant/customers/:id", write, async (request, reply) => {
    const merchantId = await app.resolveMerchantId(request);
    const deleted = await prisma.customer.deleteMany({ where: { id: request.params.id, merchantId } });
    if (deleted.count !== 1) throw new NotFoundError("That customer could not be found.");
    return reply.status(204).send();
  });
}
