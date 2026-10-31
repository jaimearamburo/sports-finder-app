// Auth.js's endpoints under /api/auth/* (OAuth callbacks, CSRF, session,
// sign-in/out). Configured in auth.ts.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
