import { describe, expect, it } from "vitest";
import { hasSameOrigin } from "./same-origin";

function request(origin: string | null, host = "example.test") {
  return { headers: new Headers({ ...(origin ? { origin } : {}), host }) };
}

describe("hasSameOrigin", () => {
  it("accepts the exact HTTP or HTTPS request origin", () => {
    expect(hasSameOrigin(request("https://example.test"))).toBe(true);
    expect(hasSameOrigin(request("http://example.test"))).toBe(true);
  });

  it("rejects missing, malformed, and different origins", () => {
    expect(hasSameOrigin(request(null))).toBe(false);
    expect(hasSameOrigin(request("not a URL"))).toBe(false);
    expect(hasSameOrigin(request("https://attacker.test"))).toBe(false);
    expect(hasSameOrigin(request("ftp://example.test"))).toBe(false);
  });

  it("compares host names without case sensitivity and preserves port checks", () => {
    expect(hasSameOrigin(request("https://EXAMPLE.TEST", "example.test"))).toBe(true);
    expect(hasSameOrigin(request("https://example.test:8443", "example.test"))).toBe(false);
  });
});
