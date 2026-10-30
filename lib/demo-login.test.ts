import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAccountEmail, demoAccountSchema, isDemoLoginEnabled } from "@/lib/demo-login";

afterEach(() => {
  vi.unstubAllEnvs();
});

function configure(enabled: string | undefined) {
  vi.stubEnv("DEMO_LOGIN_ENABLED", enabled);
  vi.stubEnv("DEMO_OWNER_EMAIL", " Owner@Example.com ");
  vi.stubEnv("DEMO_USER_EMAIL", "user@example.com");
}

describe("demo logins", () => {
  it("are off unless DEMO_LOGIN_ENABLED is exactly true", () => {
    for (const value of [undefined, "", "false", "1", "TRUE"]) {
      configure(value);
      expect(isDemoLoginEnabled()).toBe(false);
      expect(demoAccountEmail("owner")).toBeNull();
      expect(demoAccountEmail("user")).toBeNull();
    }
  });

  it("map each button to its configured account, normalised", () => {
    configure("true");
    expect(demoAccountEmail("owner")).toBe("owner@example.com");
    expect(demoAccountEmail("user")).toBe("user@example.com");
  });

  it("give nothing for an account that isn't configured", () => {
    configure("true");
    vi.stubEnv("DEMO_USER_EMAIL", "");
    expect(demoAccountEmail("user")).toBeNull();
  });

  it("accept only the two demo account names", () => {
    expect(demoAccountSchema.safeParse("owner").success).toBe(true);
    expect(demoAccountSchema.safeParse("user").success).toBe(true);
    for (const value of ["admin", "emma.owner@example.com", "", null, 1]) {
      expect(demoAccountSchema.safeParse(value).success).toBe(false);
    }
  });
});
