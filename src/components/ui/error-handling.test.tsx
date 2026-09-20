import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/components/ui/error-handling";

const ThrowOnRender = () => {
  throw new Error("Boundary exploded");
};

const RecoverableBoundaryHarness = () => {
  const [shouldThrow, setShouldThrow] = useState(true);

  return (
    <ErrorBoundary
      fallback={(_, reset) => (
        <div>
          <p>Recovered by custom fallback</p>
          <button
            type="button"
            onClick={() => {
              setShouldThrow(false);
              reset();
            }}
          >
            Recover
          </button>
        </div>
      )}
    >
      {shouldThrow ? <ThrowOnRender /> : <div>Recovered content</div>}
    </ErrorBoundary>
  );
};

describe("ErrorBoundary", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it("renders the default fallback when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("supports resetting through a custom fallback after an error", () => {
    render(<RecoverableBoundaryHarness />);

    expect(screen.getByText("Recovered by custom fallback")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recover" }));

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });

  it("calls the onError callback with the thrown error", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowOnRender />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0]?.[0]?.message).toBe("Boundary exploded");
  });
});
