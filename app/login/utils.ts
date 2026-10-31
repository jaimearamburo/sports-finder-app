// Outside actions.ts because a "use server" file may only export async Server
// Actions.

// Shared by LoginForm's check and the login action so both show the same
// message.
export const LOGIN_INVALID_INPUT_MESSAGE = "Enter a valid email and your password.";

// Only allows paths on this site. callbackUrl comes from the URL, so it's
// attacker-controlled; without this, a crafted login link could send a freshly
// signed-in user to an external phishing site.
export function sanitizeCallbackUrl(url: string | undefined): string {
  if (url && url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }
  return "/";
}
