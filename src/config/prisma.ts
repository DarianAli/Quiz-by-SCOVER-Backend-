import { PrismaClient } from "@prisma/client";

// ─── Models subject to soft-delete ───────────────────────────────────────────
const SOFT_DELETE_MODELS = ["user", "subject", "quiz", "questions"] as const;
type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

function isSoft(model: string): model is SoftDeleteModel {
    return (SOFT_DELETE_MODELS as readonly string[]).includes(model);
}

// ─── Raw (unextended) client ──────────────────────────────────────────────────
// Kept as a reference so delete→update and findUnique→findFirst redirects
// call through the raw client and don't trigger the extension recursively.
const rawClient = new PrismaClient({ errorFormat: "pretty" });

// ─── Extended client with soft-delete query interception ─────────────────────
const prisma = rawClient.$extends({
    query: {
        $allModels: {
            // ── READ: exclude soft-deleted rows ──────────────────────────
            // We cast through `any` at the assignment site to satisfy
            // Prisma 6's union where-type + exactOptionalPropertyTypes.
            async findFirst({ model, args, query }) {
                if (isSoft(model)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (args as any).where = { ...(args.where ?? {}), deleted_at: null };
                }
                return query(args);
            },

            async findMany({ model, args, query }) {
                if (isSoft(model)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (args as any).where = { ...(args.where ?? {}), deleted_at: null };
                }
                return query(args);
            },

            async count({ model, args, query }) {
                if (isSoft(model)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (args as any).where = { ...(args.where ?? {}), deleted_at: null };
                }
                return query(args);
            },

            // findUnique only accepts unique-column filters in its where clause,
            // so we redirect to findFirst on the rawClient and apply the filter
            // manually (bypassing the extension to avoid recursion).
            async findUnique({ model, args, query }) {
                if (isSoft(model)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (rawClient as any)[model].findFirst({
                        ...args,
                        where: { ...(args.where ?? {}), deleted_at: null },
                    });
                }
                return query(args);
            },

            // ── WRITE: soft-delete instead of hard-delete ─────────────────
            async delete({ model, args, query }) {
                if (isSoft(model)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (rawClient as any)[model].update({
                        where: args.where,
                        data: { deleted_at: new Date() },
                    });
                }
                return query(args);
            },

            async deleteMany({ model, args, query }) {
                if (isSoft(model)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (rawClient as any)[model].updateMany({
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        where: (args as any).where,
                        data: { deleted_at: new Date() },
                    });
                }
                return query(args);
            },
        },
    },
});

export default prisma;
