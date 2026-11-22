import type { FastifyInstance } from "fastify";
import { db } from "../../db.js";
import {
  paymentIntents,
  agents,
  approvalTasks,
  payments,
  auditEvents,
} from "@frame/db";
import { eq, and, sql, desc } from "drizzle-orm";

export async function overviewRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.userAuth);

  app.get("/overview", async (request) => {
    const orgId = request.organizationId!;

    const [totalSpend] = await db
      .select({ total: sql<number>`coalesce(sum(${paymentIntents.amountPaise}), 0)::bigint` })
      .from(paymentIntents)
      .where(
        and(
          eq(paymentIntents.organizationId, orgId),
          eq(paymentIntents.status, "SUCCEEDED"),
        ),
      );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todaySpend] = await db
      .select({ total: sql<number>`coalesce(sum(${paymentIntents.amountPaise}), 0)::bigint` })
      .from(paymentIntents)
      .where(
        and(
          eq(paymentIntents.organizationId, orgId),
          eq(paymentIntents.status, "SUCCEEDED"),
          sql`${paymentIntents.createdAt} >= ${todayStart}`,
        ),
      );

    const [activeAgents] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(agents)
      .where(and(eq(agents.organizationId, orgId), eq(agents.status, "active")));

    const [pendingApprovals] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(approvalTasks)
      .where(
        and(
          eq(approvalTasks.organizationId, orgId),
          eq(approvalTasks.decision, "pending"),
        ),
      );

    const [blockedAttempts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentIntents)
      .where(
        and(
          eq(paymentIntents.organizationId, orgId),
          eq(paymentIntents.status, "DENIED"),
        ),
      );

    const [totalIntents] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentIntents)
      .where(eq(paymentIntents.organizationId, orgId));

    const [succeededIntents] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentIntents)
      .where(
        and(
          eq(paymentIntents.organizationId, orgId),
          eq(paymentIntents.status, "SUCCEEDED"),
        ),
      );

    const total = totalIntents?.count ?? 0;
    const succeeded = succeededIntents?.count ?? 0;
    const successRate = total > 0 ? succeeded / total : 0;

    const recentPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.organizationId, orgId))
      .orderBy(desc(payments.createdAt))
      .limit(10);

    const recentAudit = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, orgId),
          sql`${auditEvents.action} LIKE '%failed%' OR ${auditEvents.action} LIKE '%denied%' OR ${auditEvents.action} LIKE '%rejected%'`,
        ),
      )
      .orderBy(desc(auditEvents.createdAt))
      .limit(5);

    return {
      totalSpendPaise: Number(totalSpend?.total ?? 0),
      todaySpendPaise: Number(todaySpend?.total ?? 0),
      activeAgents: activeAgents?.count ?? 0,
      pendingApprovals: pendingApprovals?.count ?? 0,
      blockedAttempts: blockedAttempts?.count ?? 0,
      successRate,
      recentPayments,
      alerts: recentAudit.map((a) => ({
        action: a.action,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        createdAt: a.createdAt,
      })),
    };
  });
}
