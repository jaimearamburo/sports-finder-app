import { type DefaultSession } from "next-auth";
import { UserRole } from "../generated/prisma/enums";

// Auth.js's default User/Session types only know about id/name/email/image.
// This augments them with our own `role` field so it type-checks through
// `authorize()` in auth.ts and back out via `session.user.role` wherever a
// server component or action calls `auth()`.
declare module "next-auth" {
  interface User {
    role: UserRole;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
