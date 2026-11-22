import { pool, db } from "./connection.js";
import {
  organizations,
  users,
  agents,
  agentCredentials,
  policies,
  policyVersions,
} from "./schema.js";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function seed() {
  console.log("Seeding database...");

  const orgRows = await db
    .insert(organizations)
    .values({
      name: "Acme Corp",
      slug: "acme",
      status: "active",
    })
    .returning();
  const org = orgRows[0]!;

  console.log(`  org: ${org.id} (${org.slug})`);

  const adminRows = await db
    .insert(users)
    .values({
      organizationId: org.id,
      email: "admin@acme.dev",
      name: "Acme Admin",
      passwordHash: sha256("frame-demo-password"),
      role: "admin",
    })
    .returning();
  const admin = adminRows[0]!;

  console.log(`  user: ${admin.id} (${admin.email})`);

  const devopsAgentRows = await db
    .insert(agents)
    .values({
      organizationId: org.id,
      name: "devops-agent",
      description: "Automates cloud infrastructure provisioning and billing",
      owner: "platform-team",
      environment: "sandbox",
      purpose: "Cloud infrastructure management",
      status: "active",
    })
    .returning();
  const devopsAgent = devopsAgentRows[0]!;

  const procurementAgentRows = await db
    .insert(agents)
    .values({
      organizationId: org.id,
      name: "procurement-agent",
      description: "Manages vendor payments and office supply purchases",
      owner: "operations-team",
      environment: "sandbox",
      purpose: "Procurement and vendor payments",
      status: "active",
    })
    .returning();
  const procurementAgent = procurementAgentRows[0]!;

  console.log(`  agents: ${devopsAgent.id}, ${procurementAgent.id}`);

  const devopsKeyPrefix = "fr_devops_abc123";
  const devopsKeyFull = `${devopsKeyPrefix}_secretvalue`;
  const devopsKeyHash = sha256(devopsKeyFull);

  const procKeyPrefix = "fr_proc_xyz789";
  const procKeyFull = `${procKeyPrefix}_secretvalue`;
  const procKeyHash = sha256(procKeyFull);

  await db.insert(agentCredentials).values([
    {
      organizationId: org.id,
      agentId: devopsAgent.id,
      keyPrefix: devopsKeyPrefix,
      keyHash: devopsKeyHash,
      status: "active",
    },
    {
      organizationId: org.id,
      agentId: procurementAgent.id,
      keyPrefix: procKeyPrefix,
      keyHash: procKeyHash,
      status: "active",
    },
  ]);

  console.log("  credentials created");

  const devopsConfig = {
    monthlyLimitPaise: 5000000,
    dailyLimitPaise: 500000,
    transactionLimitPaise: 1000000,
    approvalThresholdPaise: 300000,
    allowedMerchants: ["AWS", "GCP", "Cloudflare"],
    blockedMerchants: [],
    allowedCategories: ["infrastructure"],
    restrictedCategories: [],
    maxPaymentsPerHour: 10,
    maxPaymentsPerDay: 50,
    expiresAt: null,
  };

  const procurementConfig = {
    monthlyLimitPaise: 3000000,
    dailyLimitPaise: 300000,
    transactionLimitPaise: 500000,
    approvalThresholdPaise: 200000,
    allowedMerchants: ["Vendor XYZ", "Office Supplies Co"],
    blockedMerchants: [],
    allowedCategories: ["procurement", "office-supplies"],
    restrictedCategories: [],
    maxPaymentsPerHour: 5,
    maxPaymentsPerDay: 20,
    expiresAt: null,
  };

  const devopsPolicyRows = await db
    .insert(policies)
    .values({
      organizationId: org.id,
      agentId: devopsAgent.id,
      name: "Cloud Infrastructure v1",
      description: "Payment policy for cloud infrastructure spending",
      status: "active",
      activeVersion: 1,
    })
    .returning();
  const devopsPolicy = devopsPolicyRows[0]!;

  const procurementPolicyRows = await db
    .insert(policies)
    .values({
      organizationId: org.id,
      agentId: procurementAgent.id,
      name: "Procurement Policy v1",
      description: "Payment policy for procurement and vendor payments",
      status: "active",
      activeVersion: 1,
    })
    .returning();
  const procurementPolicy = procurementPolicyRows[0]!;

  console.log(`  policies: ${devopsPolicy.id}, ${procurementPolicy.id}`);

  const devopsPVRows = await db
    .insert(policyVersions)
    .values({
      organizationId: org.id,
      policyId: devopsPolicy.id,
      version: 1,
      config: devopsConfig,
      createdBy: admin.id,
    })
    .returning();
  const devopsPV = devopsPVRows[0]!;

  const procPVRows = await db
    .insert(policyVersions)
    .values({
      organizationId: org.id,
      policyId: procurementPolicy.id,
      version: 1,
      config: procurementConfig,
      createdBy: admin.id,
    })
    .returning();
  const procPV = procPVRows[0]!;

  await db
    .update(policies)
    .set({ currentVersionId: devopsPV.id })
    .where(eq(policies.id, devopsPolicy.id));

  await db
    .update(policies)
    .set({ currentVersionId: procPV.id })
    .where(eq(policies.id, procurementPolicy.id));

  console.log(`  policy versions: ${devopsPV.id}, ${procPV.id}`);
  console.log("Seed completed.");
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error("Seed failed:", err);
    pool.end();
    process.exit(1);
  });
