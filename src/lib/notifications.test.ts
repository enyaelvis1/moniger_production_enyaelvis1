import { describe, expect, it, vi } from "vitest";

const { insert } = vi.hoisted(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }),
      insert,
    }),
  },
}));

import { createNotificationSafe } from "./notifications";

describe("createNotificationSafe", () => {
  it("does not persist an external notification destination", async () => {
    await createNotificationSafe({
      body: "Review this notification",
      businessId: "business-1",
      link: "//attacker.example/phishing",
      title: "Security test",
      type: "system",
      userId: "user-1",
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ link: null }));
  });
});
