import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  amplitudeInitMock,
  amplitudeTrackMock,
  amplitudeSetOptOutMock,
  amplitudeSetUserIdMock,
  amplitudeIdentifyMock,
} = vi.hoisted(() => ({
  amplitudeIdentifyMock: vi.fn(),
  amplitudeInitMock: vi.fn(),
  amplitudeSetOptOutMock: vi.fn(),
  amplitudeSetUserIdMock: vi.fn(),
  amplitudeTrackMock: vi.fn(),
}));

vi.mock("@amplitude/analytics-browser", () => ({
  Identify: class {
    set = vi.fn().mockReturnThis();
  },
  Types: {
    LogLevel: {
      Error: "error",
      Warn: "warn",
    },
  },
  identify: amplitudeIdentifyMock,
  init: amplitudeInitMock,
  setOptOut: amplitudeSetOptOutMock,
  setUserId: amplitudeSetUserIdMock,
  track: amplitudeTrackMock,
}));

describe("analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    amplitudeInitMock.mockReset();
    amplitudeTrackMock.mockReset();
    amplitudeSetOptOutMock.mockReset();
    amplitudeSetUserIdMock.mockReset();
    amplitudeIdentifyMock.mockReset();
  });

  it("initializes analytics only once", async () => {
    vi.stubEnv("VITE_AMPLITUDE_API_KEY", "test-key");
    const { initializeAnalytics } = await import("./analytics");

    initializeAnalytics();
    initializeAnalytics();

    expect(amplitudeInitMock).toHaveBeenCalledTimes(1);
  });

  it("sanitizes tracked event properties", async () => {
    vi.stubEnv("VITE_AMPLITUDE_API_KEY", "test-key");
    const { initializeAnalytics, trackAnalyticsEvent } = await import("./analytics");

    initializeAnalytics();
    trackAnalyticsEvent("payment_started", {
      amount: 1500,
      references: ["INV-001", "INV-002"],
      success: true,
    });
    trackAnalyticsEvent("payment_started", {
      nested: { ignored: true } as never,
    });

    expect(amplitudeTrackMock).toHaveBeenCalledWith(
      "payment_started",
      expect.objectContaining({
        amount: 1500,
        references: ["INV-001", "INV-002"],
        success: true,
      }),
    );
    expect(amplitudeTrackMock.mock.calls[1]?.[1]).not.toHaveProperty("nested");
  });

  it("updates consent opt-out state", async () => {
    vi.stubEnv("VITE_AMPLITUDE_API_KEY", "test-key");
    const { setAnalyticsConsent } = await import("./analytics");

    setAnalyticsConsent(true);
    setAnalyticsConsent(false);

    expect(amplitudeSetOptOutMock).toHaveBeenNthCalledWith(1, false);
    expect(amplitudeSetOptOutMock).toHaveBeenNthCalledWith(2, true);
  });
});
