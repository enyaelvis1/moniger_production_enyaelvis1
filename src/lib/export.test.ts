import { afterEach, describe, expect, it, vi } from "vitest";
import { openPrintDocument } from "@/lib/export";

describe("openPrintDocument", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a same-origin window without noopener/noreferrer so the reference stays usable", () => {
    const focus = vi.fn();
    const print = vi.fn();
    const open = vi.fn();
    const write = vi.fn();
    const close = vi.fn();
    const mockWindow = {
      closed: false,
      document: { close, open, title: "", write },
      focus,
      onload: null as null | (() => void),
      opener: window,
      print,
    };

    vi.spyOn(window, "open").mockReturnValue(mockWindow as unknown as Window);
    const timeoutSpy = vi.spyOn(window, "setTimeout").mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === "function") {
        callback();
      }

      return 0;
    }) as typeof window.setTimeout);

    openPrintDocument({
      sections: [
        {
          rows: [{ label: "Amount", value: "NGN 10,000.00" }],
          title: "Summary",
        },
      ],
      title: "Invoice INV-001",
    });

    expect(window.open).toHaveBeenCalledWith("", "_blank");
    expect(write).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(mockWindow.opener).toBeNull();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalled();
  });

  it("keeps the blocked-popup error when no window can be opened", () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    expect(() =>
      openPrintDocument({
        sections: [],
        title: "Finance Report",
      }),
    ).toThrow("Your browser blocked the export window. Please allow popups and try again.");
  });
});
