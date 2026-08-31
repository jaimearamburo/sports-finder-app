// Split out from actions.ts because a "use server" file requires every
// export to be an async Server Action — this is a plain synchronous helper,
// which Next.js's build rejects if it lives alongside them.

// Only ever redirect somewhere on our own site. `callbackUrl` arrives as a
// hidden form field that traveled through proxy.ts (see proxy.ts's redirect
// to "/login?callbackUrl=...") and ultimately the URL bar — so it's
// attacker-controllable. Without this check, someone could send a link like
// "oursite.com/login?callbackUrl=https://evil.example" and, after a real
// login, we'd hand the user's authenticated browser straight to a phishing
// site under a URL that started out looking like ours.
export function sanitizeCallbackUrl(url: string | undefined): string {
  if (url && url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }
  return "/";
}
