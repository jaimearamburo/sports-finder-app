import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";

// A real bcrypt hash of a throwaway string, at the same cost factor (10)
// as every stored password (see app/signup/actions.ts), so comparing
// against it takes the same time as a genuine check. Matches nothing
// anyone could log in with; it exists only for the timing equaliser in
// authorize() below.
const DUMMY_PASSWORD_HASH = "$2b$10$3Rb76sUdawRn1K5iws32YuGeud/q.ixcZEcA6Q.Dlt01aSkQH/.rW";

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
    //
    // allowDangerousEmailAccountLinking lets a Google sign-in attach to an
    // existing password account with the same email instead of failing
    // with OAuthAccountNotLinked. Normally risky, but safe in this
    // direction: Google only issues verified emails, so whoever completes
    // this sign-in really owns the address. It's how the real owner
    // reclaims an account someone else registered under their email first
    // (signup has no email verification) - see events.linkAccount below,
    // which removes that squatter's password on link.
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
        // Auth.js's own sign-in endpoint (/api/auth/callback/credentials)
        // reaches this directly, not only via the login Server Action, so
        // the input is re-parsed here with the same schema rather than
        // trusted. Normalises email the same way signup stored it.
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        // No account, or the account was created via Google (no password
        // ever set) — reject rather than throwing, so the UI just shows a
        // generic "invalid credentials" message either way. Still runs a
        // full bcrypt comparison against a dummy hash first: skipping it
        // made "no such account" answer measurably faster than "wrong
        // password," which let anyone tell registered emails apart by
        // timing alone, defeating the generic message.
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

  events: {
    // Fires when a Google account is attached to an existing user (see
    // allowDangerousEmailAccountLinking above). The Google side has just
    // proved ownership of this email; the password side never did, since
    // signup doesn't verify emails. Clearing passwordHash means anyone who
    // registered this email before its real owner loses access the moment
    // the owner signs in with Google. Trade-off: a legitimate user who
    // signed up with a password and later links Google can no longer log
    // in with that password, only with Google, until a real
    // password-reset flow exists.
    async linkAccount({ user, account }) {
      if (account.provider !== "google" || !user.id) return;
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: null } });
    },
  },

  pages: {
    signIn: "/login",
  },
});
