import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  onCLSMock,
  onFCPMock,
  onINPMock,
  onLCPMock,
  onTTFBMock,
  trackAnalyticsEventMock,
  captureMonitoringMessageMock,
} = vi.hoisted(() => ({
  captureMonitoringMessageMock: vi.fn(),
  onCLSMock: vi.fn(),
  onFCPMock: vi.fn(),
  onINPMock: vi.fn(),
  onLCPMock: vi.fn(),
  onTTFBMock: vi.fn(),
  trackAnalyticsEventMock: vi.fn(),
}));

vi.mock("web-vitals", () => ({
  onCLS: onCLSMock,
  onFCP: onFCPMock,
  onINP: onINPMock,
  onLCP: onLCPMock,
  onTTFB: onTTFBMock,
}));

vi.mock("@/lib/analytics", () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

vi.mock("@/lib/monitoring", () => ({
  captureMonitoringMessage: captureMonitoringMessageMock,
}));

describe("web vitals instrumentation", () => {
  beforeEach(() => {
    vi.resetModules();
    onCLSMock.mockReset();
    onFCPMock.mockReset();
    onINPMock.mockReset();
    onLCPMock.mockReset();
    onTTFBMock.mockReset();
    trackAnalyticsEventMock.mockReset();
    captureMonitoringMessageMock.mockReset();
  });

  it("registers the vitals observers once", async () => {
    const { initializeWebVitals } = await import("./web-vitals");

    initializeWebVitals();
    initializeWebVitals();

    expect(onCLSMock).toHaveBeenCalledTimes(1);
    expect(onFCPMock).toHaveBeenCalledTimes(1);
    expect(onINPMock).toHaveBeenCalledTimes(1);
    expect(onLCPMock).toHaveBeenCalledTimes(1);
    expect(onTTFBMock).toHaveBeenCalledTimes(1);
  });

  it("forwards reported metrics to analytics and monitoring", async () => {
    let metricHandler: ((metric: { id: string; name: string; navigationType: string; rating: string; value: number }) => void) | undefined;
    onCLSMock.mockImplementation((callback) => {
      metricHandler = callback;
    });

    const { initializeWebVitals } = await import("./web-vitals");
    initializeWebVitals();

    metricHandler?.({
      id: "v1",
      name: "CLS",
      navigationType: "navigate",
      rating: "good",
      value: 0.02,
    });

    expect(trackAnalyticsEventMock).toHaveBeenCalledWith(
      "web_vital_recorded",
      expect.objectContaining({
        id: "v1",
        metric_name: "CLS",
        rating: "good",
      }),
    );
    expect(captureMonitoringMessageMock).toHaveBeenCalledWith(
      "Web vital recorded",
      expect.objectContaining({
        id: "v1",
        metric_name: "CLS",
      }),
    );
  });
});
