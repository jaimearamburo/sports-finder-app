import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter persists OAuth accounts/sessions to our User/Account/Session
  // tables. It is NOT used to persist Credentials-provider sessions (see
  // `session.strategy` below) — Auth.js only ever calls it to look up/create
  // the User row itself and to link Google accounts to that row.
  adapter: PrismaAdapter(prisma),

  // The Credentials provider's user isn't authenticated through the
  // adapter, so it requires JWT sessions rather than database sessions
  // (Auth.js can't persist a "session" row for a login method it didn't
  // authenticate via OAuth/adapter). Since Credentials is one of our
  // providers, the whole app uses JWT sessions — including for Google
  // sign-ins — for one consistent session mechanism.
  session: { strategy: "jwt" },

  providers: [
    // `prompt: "select_account"` forces Google's account chooser to show
    // every time, even when the browser already has an active Google
    // session or has consented to this app before. Without it, Google
    // silently skips straight to sign-in once both of those are already
    // true — fine for a real returning user, but confusing during testing
    // when you don't realize which Google account you're about to sign in as.
    Google({
      authorization: { params: { prompt: "select_account" } },
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        // No account, or the account was created via Google (no password
        // ever set) — reject rather than throwing, so the UI just shows a
        // generic "invalid credentials" message either way.
        if (!user || !user.passwordHash) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],

  callbacks: {
    // Runs whenever a JWT is created/updated. `user` is only defined right
    // after sign-in (from `authorize`, or from the adapter for Google) — we
    // copy the fields we need onto the token here so later requests, which
    // only have the token (no `user`), can still read them.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    // Runs whenever a session is read. Exposes the fields we stashed on the
    // token to `useSession()` / `auth()` callers as `session.user.id/.role`.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as typeof session.user.role;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
