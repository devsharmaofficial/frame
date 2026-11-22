export const config = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://frame:frame_dev_password@localhost:5432/frame",
  JWT_SECRET: process.env.JWT_SECRET ?? "change_me_in_production_at_least_32_chars",
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ?? "frame_dev_webhook_secret",
  PORT: Number(process.env.PORT ?? 4100),
};
