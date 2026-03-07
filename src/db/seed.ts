import "dotenv/config";
import { auth } from "../lib/auth.js";

try {
  const res = await auth.api.signUpEmail({
    body: {
      name: "Can Kömüşdoğan",
      email: "cankomusdogan@gmail.com",
      password: process.env.DEFAULT_ADMIN_PWD!,
    },
  });
  console.log("Sign up successful:", res);
} catch (error) {
  console.log("Sign up failed:", error);
}
