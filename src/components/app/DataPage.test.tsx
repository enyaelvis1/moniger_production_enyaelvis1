import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DataPage from "@/components/app/DataPage";

type Customer = { id: string; name: string; status: string };

const customers: Customer[] = [
  { id: "customer-1", name: "Ada Lovelace", status: "Active" },
  { id: "customer-2", name: "Grace Hopper", status: "Pending" },
];

describe("DataPage responsive presentation", () => {
  it("renders mobile cards with accessible field labels and keeps pagination available", () => {
    render(
      <DataPage<Customer>
        title="Customers"
        actionLabel="Add customer"
        onAction={vi.fn()}
        tabs={[{ label: "All", count: customers.length, value: "all" }]}
        activeTab="all"
        onTabChange={vi.fn()}
        columns={[
          { key: "name", header: "Name", render: (row) => row.name },
          { key: "status", header: "Status", render: (row) => row.status },
        ]}
        data={customers}
        searchValue=""
        onSearchChange={vi.fn()}
        pageSize={1}
      />,
    );

    const mobileCards = screen.getByLabelText("Customers mobile cards");
    expect(within(mobileCards).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(mobileCards).getByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to next page" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(within(mobileCards).getByText("Grace Hopper")).toBeInTheDocument();
  });
});
