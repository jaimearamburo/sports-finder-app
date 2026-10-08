// Exposes Auth.js's own endpoints (OAuth callbacks, CSRF token, session
// check, sign-in/sign-out POSTs) under /api/auth/*. The route itself has no
// logic of its own — all behavior is configured in auth.ts at the project
// root.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
