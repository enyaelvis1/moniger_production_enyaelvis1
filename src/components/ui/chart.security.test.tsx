import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartStyle } from "./chart";

describe("ChartStyle security", () => {
  it("does not allow hostile ids, keys, or colors to escape the style block", () => {
    render(
      <ChartStyle
        id={'chart"><script>alert(1)</script>'}
        config={{
          'revenue"><script>alert(2)</script>': { color: 'red;}</style><script>alert(3)</script>' },
          safe: { color: "#123456" },
        }}
      />,
    );

    const style = document.querySelector("style");
    expect(style).not.toBeNull();
    if (!style) return;
    expect(style.tagName).toBe("STYLE");
    expect(style.textContent).not.toContain("<script>");
    expect(style.textContent).toContain("--color-safe: #123456");
    expect(document.querySelectorAll("script")).toHaveLength(0);
  });
});
