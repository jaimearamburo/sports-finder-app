import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { demoAccountEmail, demoAccountSchema } from "@/lib/demo-login";

// A bcrypt hash at the same cost as stored passwords, compared against when no
// user exists so login timing doesn't reveal registered emails. Matches no
// usable password.
const DUMMY_PASSWORD_HASH = "$2b$10$3Rb76sUdawRn1K5iws32YuGeud/q.ixcZEcA6Q.Dlt01aSkQH/.rW";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Stores users and linked Google accounts. Sessions are JWTs, not adapter
  // rows.
  adapter: PrismaAdapter(prisma),

  // Credentials sign-in requires JWT sessions, so the whole app uses them,
  // Google included.
  session: { strategy: "jwt" },

  providers: [
    // select_account always shows Google's account chooser, so it's clear which
    // account is signing in.
    //
    // allowDangerousEmailAccountLinking attaches a Google sign-in to an
    // existing password account with the same email. Safe in this direction:
    // Google emails are verified, so this lets the real owner reclaim an
    // address someone registered first (signup doesn't verify emails).
    // events.linkAccount then removes that account's password.
    Google({
      authorization: { params: { prompt: "select_account" } },
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Auth.js's endpoint (/api/auth/callback/credentials) reaches this
        // directly, so input is parsed here too, normalising the email as
        // signup does.
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        // No account, or a Google-only account: return null so the UI shows one
        // generic message. The dummy bcrypt comparison keeps timing the same as
        // a wrong password.
        if (!user || !user.passwordHash) {
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    // Demo logins (lib/demo-login.ts): the only input is "owner" or "user"; the
    // account comes from server env vars. Auth.js's endpoint reaches this
    // directly, so input is parsed here, and everything is refused unless
    // DEMO_LOGIN_ENABLED is on.
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: { account: { label: "Account", type: "text" } },
      async authorize(credentials) {
        const parsed = demoAccountSchema.safeParse(credentials?.account);
        if (!parsed.success) return null;
        const email = demoAccountEmail(parsed.data);
        if (!email) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Never an admin, whatever the env says.
        if (!user || user.role === "admin") return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],

  callbacks: {
    // `user` is only set at sign-in; copy id and role onto the token for later
    // requests.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    // Exposes the token's id and role as session.user.id/.role.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as typeof session.user.role;
      }
      return session;
    },
  },

  events: {
    // A Google account was linked to an existing user (see
    // allowDangerousEmailAccountLinking). Google proved ownership of the email;
    // the password never did, so it's cleared and anyone who pre-registered the
    // address loses access. A user who links Google keeps only Google sign-in
    // until a password reset flow exists.
    async linkAccount({ user, account }) {
      if (account.provider !== "google" || !user.id) return;
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: null } });
    },
  },

  pages: {
    signIn: "/login",
  },
});
