// Split out from actions.ts because a "use server" file requires every
// export to be an async Server Action. This is a plain synchronous
// helper, which Next.js's build rejects if it lives alongside them.

// Shown for a malformed submission (blank field, not an email) by both
// LoginForm's client-side check and the login action, so the two always
// say the same thing. Lives here rather than in actions.ts for the same
// "use server" export restriction noted above.
export const LOGIN_INVALID_INPUT_MESSAGE = "Enter a valid email and your password.";

// Only ever redirects to a path on this site. `callbackUrl` arrives as a
// hidden form field that traveled through proxy.ts's redirect to
// "/login?callbackUrl=..." and ultimately the URL bar, so it is
// attacker-controllable. Without this check, a crafted link like
// "thissite.com/login?callbackUrl=https://evil.example" could, after a
// real login, send the user's authenticated browser straight to a
// phishing site under a URL that started out looking legitimate.
export function sanitizeCallbackUrl(url: string | undefined): string {
  if (url && url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }
  return "/";
}
