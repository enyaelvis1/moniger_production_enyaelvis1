import { describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, SupabaseMutationOutcomeUnknownError } from "@/integrations/supabase/client";

describe("Supabase request timeout handling", () => {
  it("honors an already-aborted caller signal before starting fetch", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(fetchWithTimeout("https://example.test", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("marks a timed-out mutation as an unknown server outcome", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    );

    const request = fetchWithTimeout("https://example.test", { method: "POST" });
    const outcomeAssertion = expect(request).rejects.toBeInstanceOf(SupabaseMutationOutcomeUnknownError);
    await vi.advanceTimersByTimeAsync(30_000);

    await outcomeAssertion;
    fetchMock.mockRestore();
    vi.useRealTimers();
  });
});
