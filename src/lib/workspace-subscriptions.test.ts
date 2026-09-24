import { describe, expect, it } from "vitest";
import {
  translateWorkspaceSubscriptionError,
  WorkspaceSubscriptionError,
} from "@/lib/workspace-subscriptions";

describe("workspace subscription error translation", () => {
  it.each([
    ["CHECKOUT_PENDING", true],
    ["PROVIDER_PENDING", true],
    ["CHECKOUT_MISMATCH", false],
  ])("preserves the structured %s response", async (code, retryable) => {
    const response = new Response(JSON.stringify({
      code,
      error: code === "CHECKOUT_MISMATCH"
        ? "The payment does not match the selected workspace subscription."
        : "Payment verification is still pending. Try again in a moment.",
      retryable,
    }), { headers: { "Content-Type": "application/json" }, status: 409 });

    const translated = await translateWorkspaceSubscriptionError(new Error("Edge Function returned an error"), response);

    expect(translated).toBeInstanceOf(WorkspaceSubscriptionError);
    expect(translated.code).toBe(code);
    expect(translated.retryable).toBe(retryable);
    expect(translated.status).toBe(409);
  });
});
