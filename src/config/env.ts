import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV !== "production") {
  dotenvConfig();
}

const schema = z.object({
  APP_URL: z.url(),
  BETTER_AUTH_URL: z.url(),
  DATABASE_URL: z.url(),
  NODE_ENV: z.enum(["production", "development"]),
  DIA_PWD_SECRET_KEY: z
    .hex()
    .length(64)
    .transform((val) => Buffer.from(val, "hex")),
  BETTER_AUTH_SECRET: z.string().min(16),
});

export const env = schema.parse(process.env);
