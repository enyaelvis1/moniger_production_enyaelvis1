import { describe, expect, it } from "vitest";
import { getSafeInternalPath } from "./safe-navigation";

describe("getSafeInternalPath", () => {
  it("keeps valid internal paths and queries", () => {
    expect(getSafeInternalPath("/pricing?subscribe=growth")).toBe("/pricing?subscribe=growth");
  });

  it.each(["//attacker.example", "/\\\\attacker.example", "https://attacker.example", "javascript:alert(1)", "%2F%2Fattacker.example"]) (
    "rejects external path %s",
    (candidate) => {
      expect(getSafeInternalPath(candidate)).toBe("/dashboard");
    },
  );

  it("rejects repeatedly encoded external paths", () => {
    expect(getSafeInternalPath("%252F%252Fattacker.example")).toBe("/dashboard");
  });

  it("supports an empty fallback for optional continuation paths", () => {
    expect(getSafeInternalPath(null, "")).toBe("");
  });
});
