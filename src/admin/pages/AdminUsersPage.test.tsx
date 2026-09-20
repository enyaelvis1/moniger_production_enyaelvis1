import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsersPage from "@/admin/pages/AdminUsersPage";

const {
  invokeAdminConsoleMock,
  refetchMock,
  toastMock,
  useAdminConsoleQueryMock,
  useIsMobileMock,
} = vi.hoisted(() => ({
  invokeAdminConsoleMock: vi.fn(),
  refetchMock: vi.fn(),
  toastMock: vi.fn(),
  useAdminConsoleQueryMock: vi.fn(),
  useIsMobileMock: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: useIsMobileMock,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    className,
    onClick,
  }: {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/admin/lib/admin-console", () => ({
  invokeAdminConsole: invokeAdminConsoleMock,
  useAdminConsoleQuery: useAdminConsoleQueryMock,
}));

const userRow = {
  email: "ada@example.com",
  fullName: "Ada Lovelace",
  lastActive: "2026-04-20T10:00:00.000Z",
  mfaEnabled: true,
  role: "owner",
  status: "active" as const,
  userId: "user-1",
  workspaces: ["Acme HQ", "Acme West"],
};

describe("AdminUsersPage", () => {
  beforeEach(() => {
    invokeAdminConsoleMock.mockReset();
    invokeAdminConsoleMock.mockResolvedValue({ message: "Delete completed." });
    refetchMock.mockReset();
    refetchMock.mockResolvedValue(undefined);
    toastMock.mockReset();
    useIsMobileMock.mockReturnValue(false);
    useAdminConsoleQueryMock.mockReturnValue({
      data: {
        rows: [userRow],
        total: 1,
      },
      error: null,
      refetch: refetchMock,
    });
  });

  it("asks for confirmation before deleting a user", async () => {
    render(<AdminUsersPage />);

    fireEvent.click(screen.getByRole("button", { name: "Delete user" }));

    expect(screen.getByText("Delete this user?")).toBeInTheDocument();
    expect(within(screen.getByRole("alertdialog")).getByText(/ada@example\.com/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("Delete this user?")).not.toBeInTheDocument();
    });

    expect(invokeAdminConsoleMock).not.toHaveBeenCalled();
  });

  it("deletes the selected user only after confirmation", async () => {
    useIsMobileMock.mockReturnValue(true);

    render(<AdminUsersPage />);

    expect(screen.getByText("Workspace: Acme HQ +1 more")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete user" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete user" }));

    await waitFor(() => {
      expect(invokeAdminConsoleMock).toHaveBeenCalledWith("users.action", {
        type: "delete",
        userId: "user-1",
      });
    });

    expect(refetchMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "User deleted" }));
  });
});
