import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("production security headers", () => {
  it("allows the regional Sentry ingest hosts used by the browser SDK", () => {
    const vercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as {
      headers?: Array<{ headers?: Array<{ key?: string; value?: string }> }>;
    };
    const contentSecurityPolicy = vercelConfig.headers
      ?.flatMap((header) => header.headers ?? [])
      .find((header) => header.key === "Content-Security-Policy")?.value;

    expect(contentSecurityPolicy).toContain("https://*.ingest.sentry.io");
    expect(contentSecurityPolicy).toContain("https://*.ingest.us.sentry.io");
    expect(contentSecurityPolicy).toContain("https://*.ingest.eu.sentry.io");
  });
});
