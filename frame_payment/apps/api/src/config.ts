import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(3000),
  FRAMER_API_KEY: z.string().min(16).default("dev-framer-key-please-change"),
  DATA_FILE: z.string().default("./data/framer.json"),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment: ${result.error.issues.map((issue) => issue.message).join(", ")}`);
  }
  return result.data;
}
