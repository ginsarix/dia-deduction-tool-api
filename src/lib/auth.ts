import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { localization } from "better-auth-localization";
import { env } from "../config/env.js";
import { db } from "../db/index.js";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  // this api is meant to be hosted in the same origin as the client so we only add this property on dev
  ...(env.NODE_ENV === "development" && {
    trustedOrigins: ["http://localhost:5173"],
  }),

  plugins: [
    localization({
      defaultLocale: "tr-TR", // Use built-in Turkish translations
      fallbackLocale: "default", // Fallback to English
    }),
  ],
});
