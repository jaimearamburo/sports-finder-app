import { type DefaultSession } from "next-auth";
import { UserRole } from "../generated/prisma/enums";

// Adds `role` to Auth.js's User and Session types.
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
