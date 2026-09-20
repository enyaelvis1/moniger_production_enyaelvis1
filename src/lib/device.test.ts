import { describe, expect, it } from "vitest";
import { getCurrentDeviceSnapshot } from "@/lib/device";

describe("device helpers", () => {
  it("detects a Chrome Windows session", () => {
    expect(
      getCurrentDeviceSnapshot(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "Win32",
      ),
    ).toMatchObject({
      browser: "Google Chrome",
      label: "Google Chrome on Windows",
      os: "Windows",
      platform: "Win32",
    });
  });

  it("detects a Safari macOS session", () => {
    expect(
      getCurrentDeviceSnapshot(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        "MacIntel",
      ),
    ).toMatchObject({
      browser: "Safari",
      label: "Safari on macOS",
      os: "macOS",
      platform: "MacIntel",
    });
  });
});
