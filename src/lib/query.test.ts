import { describe, expect, it } from "vitest";
import {
  defaultQueryClientOptions,
  directoryQueryOptions,
  financeQueryOptions,
  globalSearchQueryOptions,
  notificationsFeedQueryOptions,
  operationsQueryOptions,
  settingsQueryOptions,
} from "./query";

describe("query tuning profiles", () => {
  it("uses conservative global defaults", () => {
    expect(defaultQueryClientOptions.queries.staleTime).toBe(30_000);
    expect(defaultQueryClientOptions.queries.gcTime).toBe(600_000);
    expect(defaultQueryClientOptions.queries.refetchOnWindowFocus).toBe(false);
    expect(defaultQueryClientOptions.queries.retry).toBe(1);
    expect(defaultQueryClientOptions.mutations.retry).toBe(0);
  });

  it("keeps heavier business data fresh for longer than the global default", () => {
    expect(directoryQueryOptions.staleTime).toBeGreaterThan(defaultQueryClientOptions.queries.staleTime);
    expect(financeQueryOptions.staleTime).toBeGreaterThan(defaultQueryClientOptions.queries.staleTime);
    expect(operationsQueryOptions.staleTime).toBeGreaterThan(defaultQueryClientOptions.queries.staleTime);
    expect(settingsQueryOptions.staleTime).toBeGreaterThan(financeQueryOptions.staleTime);
  });

  it("treats notifications as fresher than settings, and search as cheap non-retrying work", () => {
    expect(notificationsFeedQueryOptions.staleTime).toBeLessThan(settingsQueryOptions.staleTime);
    expect(globalSearchQueryOptions.retry).toBe(0);
    expect(globalSearchQueryOptions.gcTime).toBeLessThan(settingsQueryOptions.gcTime);
  });
});
