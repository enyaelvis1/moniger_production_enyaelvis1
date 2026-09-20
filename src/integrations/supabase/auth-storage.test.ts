import { describe, expect, it, vi } from "vitest";
import { createAuthStorage, type StorageLike } from "./auth-storage";

describe("createAuthStorage", () => {
  it("uses the provided storage when one is supplied", () => {
    const providedStorage: StorageLike = {
      getItem: vi.fn(() => "value"),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };

    expect(createAuthStorage(providedStorage)).toBe(providedStorage);
  });

  it("falls back to isolated in-memory storage when no browser sessionStorage exists", () => {
    const storage = createAuthStorage(null);

    expect(storage.getItem("missing")).toBeNull();

    storage.setItem("token", "abc123");
    expect(storage.getItem("token")).toBe("abc123");

    storage.removeItem("token");
    expect(storage.getItem("token")).toBeNull();
  });
});
