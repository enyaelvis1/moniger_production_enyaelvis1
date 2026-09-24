import { describe, expect, it } from "vitest";
import { resolveSelectedWorkspaceId } from "./WorkspaceSelectionContext";

describe("workspace selection", () => {
  it("keeps a valid persisted workspace selection", () => {
    expect(resolveSelectedWorkspaceId(["workspace-a", "workspace-b"], "workspace-b")).toBe("workspace-b");
  });

  it("falls back to the first authorized workspace when the persisted selection is stale", () => {
    expect(resolveSelectedWorkspaceId(["workspace-a", "workspace-b"], "workspace-missing")).toBe("workspace-a");
    expect(resolveSelectedWorkspaceId([], "workspace-missing")).toBeNull();
  });
});
