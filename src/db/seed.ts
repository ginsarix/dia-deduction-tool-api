import "dotenv/config";
import { auth } from "../lib/auth.js";

try {
  const { DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PWD } =
    process.env;

  if (!DEFAULT_ADMIN_PWD)
    throw new Error("DEFAULT_ADMIN_PWD must not be empty");

  const res = await auth.api.signUpEmail({
    body: {
      name: DEFAULT_ADMIN_NAME ?? "Admin",
      email: DEFAULT_ADMIN_EMAIL || "admin@placeholder.com",
      password: DEFAULT_ADMIN_PWD,
    },
  });
  console.log("Sign up successful:", res);
} catch (error) {
  console.log("Sign up failed:", error);
}
