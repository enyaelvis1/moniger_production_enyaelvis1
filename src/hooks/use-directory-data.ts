import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Enums, Tables } from "@/integrations/supabase/types";
import { logAuditEventSafe } from "@/lib/audit";
import { directoryQueryOptions } from "@/lib/query";
import { supabase } from "@/lib/supabase";

type CustomerRow = Tables<"customers">;
type VendorRow = Tables<"vendors"> & { bank_id?: string | null };
type InvoiceRow = Pick<
  Tables<"invoices">,
  "balance_due" | "customer_id" | "due_date" | "id" | "invoice_number" | "issue_date" | "status" | "total_amount"
>;
type BillRow = Pick<
  Tables<"bills">,
  "amount_paid" | "bill_date" | "bill_number" | "due_date" | "id" | "status" | "total_amount" | "vendor_id"
>;
type BankRow = Tables<"banks">;

export type CustomerHistoryItem = {
  amount: number;
  dueDate: string | null;
  id: string;
  invoiceNumber: string;
  issueDate: string;
  status: Enums<"invoice_status">;
};

export type CustomerDirectoryItem = {
  billingAddress: string | null;
  businessName: string | null;
  cityState: string | null;
  email: string | null;
  id: string;
  invoices: CustomerHistoryItem[];
  name: string;
  notes: string | null;
  outstanding: number;
  phone: string | null;
  streetAddress: string | null;
  totalInvoiced: number;
};

export type VendorHistoryItem = {
  amount: number;
  billDate: string;
  billNumber: string;
  dueDate: string | null;
  id: string;
  status: Enums<"bill_status">;
};

export type VendorDirectoryItem = {
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  bankId: string | null;
  bills: VendorHistoryItem[];
  businessName: string;
  contactName: string | null;
  email: string | null;
  id: string;
  notes: string | null;
  phone: string | null;
  totalPaid: number;
};

export type CustomerInput = {
  billing_address?: string | null;
  business_name?: string | null;
  city_state?: string | null;
  email?: string | null;
  name: string;
  notes?: string | null;
  phone?: string | null;
  street_address?: string | null;
};

const buildBillingAddress = (streetAddress: string | null | undefined, cityState: string | null | undefined) =>
  [streetAddress?.trim(), cityState?.trim()].filter(Boolean).join(", ") || null;

export type VendorInput = {
  account_name?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  bank_id?: string | null;
  business_name: string;
  contact_name?: string | null;
  email?: string | null;
  notes?: string | null;
  phone?: string | null;
};

const customersQueryKey = (businessId: string) => ["customers", businessId] as const;
const vendorsQueryKey = (businessId: string) => ["vendors", businessId] as const;

const fetchCustomers = async (businessId: string): Promise<CustomerDirectoryItem[]> => {
  const [{ data: customerRows, error: customerError }, { data: invoiceRows, error: invoiceError }] = await Promise.all([
    supabase.from("customers").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, customer_id, invoice_number, issue_date, due_date, status, total_amount, balance_due")
      .eq("business_id", businessId)
      .order("issue_date", { ascending: false }),
  ]);

  if (customerError) {
    throw customerError;
  }

  if (invoiceError) {
    throw invoiceError;
  }

  const invoicesByCustomer = new Map<string, CustomerHistoryItem[]>();
  const invoiceTotals = new Map<string, { outstanding: number; totalInvoiced: number }>();

  for (const invoice of (invoiceRows ?? []) as InvoiceRow[]) {
    const historyItem: CustomerHistoryItem = {
      amount: Number(invoice.total_amount ?? 0),
      dueDate: invoice.due_date,
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      issueDate: invoice.issue_date,
      status: invoice.status,
    };

    const currentHistory = invoicesByCustomer.get(invoice.customer_id) ?? [];
    currentHistory.push(historyItem);
    invoicesByCustomer.set(invoice.customer_id, currentHistory);

    const currentTotals = invoiceTotals.get(invoice.customer_id) ?? { outstanding: 0, totalInvoiced: 0 };
    currentTotals.totalInvoiced += Number(invoice.total_amount ?? 0);
    currentTotals.outstanding += Number(invoice.balance_due ?? 0);
    invoiceTotals.set(invoice.customer_id, currentTotals);
  }

  return ((customerRows ?? []) as CustomerRow[]).map((customer) => {
    const totals = invoiceTotals.get(customer.id) ?? { outstanding: 0, totalInvoiced: 0 };

    return {
      billingAddress: buildBillingAddress(customer.street_address, customer.city_state) ?? customer.billing_address,
      businessName: customer.business_name,
      cityState: customer.city_state,
      email: customer.email,
      id: customer.id,
      invoices: invoicesByCustomer.get(customer.id) ?? [],
      name: customer.name,
      notes: customer.notes,
      outstanding: totals.outstanding,
      phone: customer.phone,
      streetAddress: customer.street_address,
      totalInvoiced: totals.totalInvoiced,
    };
  });
};

const fetchVendors = async (businessId: string): Promise<VendorDirectoryItem[]> => {
  const vendorResponse = await supabase
    .from("vendors")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  const billResponse = await supabase
    .from("bills")
    .select("id, vendor_id, bill_number, bill_date, due_date, status, total_amount, amount_paid")
    .eq("business_id", businessId)
    .order("bill_date", { ascending: false });
  const bankResponse = await supabase.from("banks").select("id, name");
  const { data: vendorRows, error: vendorError } = vendorResponse;
  const { data: billRows, error: billError } = billResponse;
  const { data: bankRows, error: bankError } = bankResponse;

  if (vendorError) {
    throw vendorError;
  }

  if (billError) {
    throw billError;
  }

  const billsByVendor = new Map<string, VendorHistoryItem[]>();
  const vendorTotals = new Map<string, number>();

  for (const bill of (billRows ?? []) as BillRow[]) {
    const historyItem: VendorHistoryItem = {
      amount: Number(bill.total_amount ?? 0),
      billDate: bill.bill_date,
      billNumber: bill.bill_number,
      dueDate: bill.due_date,
      id: bill.id,
      status: bill.status,
    };

    const currentHistory = billsByVendor.get(bill.vendor_id) ?? [];
    currentHistory.push(historyItem);
    billsByVendor.set(bill.vendor_id, currentHistory);

    const amountPaid = Number(bill.amount_paid ?? 0);
    const paidTotal = bill.status === "paid" ? Math.max(amountPaid, Number(bill.total_amount ?? 0)) : amountPaid;
    vendorTotals.set(bill.vendor_id, (vendorTotals.get(bill.vendor_id) ?? 0) + paidTotal);
  }

  return ((vendorRows ?? []) as VendorRow[]).map((vendor) => ({
    accountName: vendor.account_name,
    accountNumber: vendor.account_number,
    bankName: (() => {
      // Prefer bank lookup by id, fallback to stored bank_name
      const bankFromId = (bankRows ?? []).find((b: Pick<BankRow, "id" | "name">) => b.id === vendor.bank_id);
      return bankFromId ? bankFromId.name : vendor.bank_name;
    })(),
    bankId: vendor.bank_id ?? null,
    bills: billsByVendor.get(vendor.id) ?? [],
    businessName: vendor.business_name,
    contactName: vendor.contact_name,
    email: vendor.email,
    id: vendor.id,
    notes: vendor.notes,
    phone: vendor.phone,
    totalPaid: vendorTotals.get(vendor.id) ?? 0,
  }));
};

const insertCustomer = async (businessId: string, userId: string, values: CustomerInput) => {
  const billingAddress = buildBillingAddress(values.street_address, values.city_state);
  const { data, error } = await supabase
    .from("customers")
    .insert({
      billing_address: billingAddress ?? values.billing_address ?? null,
      business_name: values.business_name ?? null,
      business_id: businessId,
      city_state: values.city_state ?? null,
      created_by: userId,
      email: values.email ?? null,
      name: values.name,
      notes: values.notes ?? null,
      phone: values.phone ?? null,
      street_address: values.street_address ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await logAuditEventSafe({
    action: "customer.created",
    actorUserId: userId,
    businessId,
    detail: {
      customer_name: values.name,
      description: values.email ? `${values.name} • ${values.email}` : values.name,
      email: values.email ?? null,
    },
    entityId: data.id,
    entityType: "customer",
    summary: `Customer ${values.name} added`,
  });
};

const updateCustomer = async (businessId: string, customerId: string, userId: string, values: CustomerInput) => {
  const billingAddress = buildBillingAddress(values.street_address, values.city_state);
  const { error } = await supabase
    .from("customers")
    .update({
      billing_address: billingAddress ?? values.billing_address ?? null,
      business_name: values.business_name ?? null,
      city_state: values.city_state ?? null,
      email: values.email ?? null,
      name: values.name,
      notes: values.notes ?? null,
      phone: values.phone ?? null,
      street_address: values.street_address ?? null,
    })
    .eq("id", customerId);

  if (error) {
    throw error;
  }

  await logAuditEventSafe({
    action: "customer.updated",
    actorUserId: userId,
    businessId,
    detail: {
      customer_name: values.name,
      description: `Customer details updated for ${values.name}`,
      email: values.email ?? null,
    },
    entityId: customerId,
    entityType: "customer",
    summary: `Customer ${values.name} updated`,
  });
};

const removeCustomer = async (businessId: string, customerId: string, userId: string, customerName?: string) => {
  const { error } = await supabase.rpc("delete_customer_with_guard", {
    p_business_id: businessId,
    p_customer_id: customerId,
  });

  if (error) {
    throw error;
  }

  await logAuditEventSafe({
    action: "customer.deleted",
    actorUserId: userId,
    businessId,
    detail: {
      customer_name: customerName ?? "Customer record",
      description: `Customer ${customerName ?? "record"} removed`,
    },
    entityId: customerId,
    entityType: "customer",
    summary: `Customer ${customerName ?? "record"} deleted`,
  });
};

const insertVendor = async (businessId: string, userId: string, values: VendorInput) => {
  const { data, error } = await supabase
    .from("vendors")
    .insert({
      account_name: values.account_name ?? null,
      account_number: values.account_number ?? null,
      bank_name: values.bank_name ?? null,
      bank_id: values.bank_id ?? null,
    business_id: businessId,
    business_name: values.business_name,
    contact_name: values.contact_name ?? null,
    created_by: userId,
      email: values.email ?? null,
      notes: values.notes ?? null,
      phone: values.phone ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await logAuditEventSafe({
    action: "vendor.created",
    actorUserId: userId,
    businessId,
    detail: {
      description: values.email ? `${values.business_name} • ${values.email}` : values.business_name,
      vendor_name: values.business_name,
    },
    entityId: data.id,
    entityType: "vendor",
    summary: `Vendor ${values.business_name} added`,
  });
};

const updateVendor = async (businessId: string, userId: string, vendorId: string, values: VendorInput) => {
  const { error } = await supabase
    .from("vendors")
    .update({
      account_name: values.account_name ?? null,
      account_number: values.account_number ?? null,
      bank_name: values.bank_name ?? null,
      bank_id: values.bank_id ?? null,
      business_name: values.business_name,
      contact_name: values.contact_name ?? null,
      email: values.email ?? null,
      notes: values.notes ?? null,
      phone: values.phone ?? null,
    })
    .eq("id", vendorId);

  if (error) {
    throw error;
  }

  await logAuditEventSafe({
    action: "vendor.updated",
    actorUserId: userId,
    businessId,
    detail: {
      description: `Vendor details updated for ${values.business_name}`,
      vendor_name: values.business_name,
    },
    entityId: vendorId,
    entityType: "vendor",
    summary: `Vendor ${values.business_name} updated`,
  });
};

const removeVendor = async (businessId: string, userId: string, vendorId: string, vendorName?: string) => {
  const { error } = await supabase.from("vendors").delete().eq("id", vendorId);

  if (error) {
    throw error;
  }

  await logAuditEventSafe({
    action: "vendor.deleted",
    actorUserId: userId,
    businessId,
    detail: {
      description: `Vendor ${vendorName ?? "record"} removed`,
      vendor_name: vendorName ?? "Vendor record",
    },
    entityId: vendorId,
    entityType: "vendor",
    summary: `Vendor ${vendorName ?? "record"} deleted`,
  });
};

export const useCustomersDirectory = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? customersQueryKey(businessId) : ["customers", "missing-business"],
    queryFn: () => fetchCustomers(businessId!),
    enabled: Boolean(businessId),
    ...directoryQueryOptions,
  });

export const useVendorsDirectory = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? vendorsQueryKey(businessId) : ["vendors", "missing-business"],
    queryFn: () => fetchVendors(businessId!),
    enabled: Boolean(businessId),
    ...directoryQueryOptions,
  });

const banksQueryKey = () => ["banks"] as const;

const fetchBanks = async (): Promise<Pick<BankRow, "id" | "name" | "bank_code" | "country_code" | "is_active" | "created_at">[]> => {
  const { data, error } = await supabase
    .from("banks")
    .select("id, name, bank_code, country_code, is_active, created_at")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Pick<BankRow, "id" | "name" | "bank_code" | "country_code" | "is_active" | "created_at">[];
};

export const useBanksList = () =>
  useQuery({
    queryKey: banksQueryKey(),
    queryFn: () => fetchBanks(),
    ...directoryQueryOptions,
  });

export const useCustomerMutations = (businessId?: string, userId?: string) => {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    if (!businessId) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: customersQueryKey(businessId) }),
      queryClient.invalidateQueries({ queryKey: ["operations", businessId] }),
    ]);
  };

  return {
    createCustomer: useMutation({
      mutationFn: (values: CustomerInput) => {
        if (!businessId || !userId) {
          throw new Error("A business workspace is required before you can add customers.");
        }

        return insertCustomer(businessId, userId, values);
      },
      onSuccess: invalidate,
    }),
    deleteCustomer: useMutation({
      mutationFn: ({ customerId, customerName }: { customerId: string; customerName?: string }) => {
        if (!businessId || !userId) {
          throw new Error("A business workspace is required before you can delete customers.");
        }

        return removeCustomer(businessId, customerId, userId, customerName);
      },
      onSuccess: invalidate,
    }),
    updateCustomer: useMutation({
      mutationFn: ({ customerId, values }: { customerId: string; values: CustomerInput }) => {
        if (!businessId || !userId) {
          throw new Error("A business workspace is required before you can update customers.");
        }

        return updateCustomer(businessId, customerId, userId, values);
      },
      onSuccess: invalidate,
    }),
  };
};

export const useVendorMutations = (businessId?: string, userId?: string) => {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    if (!businessId) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: vendorsQueryKey(businessId) }),
      queryClient.invalidateQueries({ queryKey: ["operations", businessId] }),
    ]);
  };

  return {
    createVendor: useMutation({
      mutationFn: (values: VendorInput) => {
        if (!businessId || !userId) {
          throw new Error("A business workspace is required before you can add vendors.");
        }

        return insertVendor(businessId, userId, values);
      },
      onSuccess: invalidate,
    }),
    deleteVendor: useMutation({
      mutationFn: ({ vendorId, vendorName }: { vendorId: string; vendorName?: string }) => {
        if (!businessId || !userId) {
          throw new Error("A business workspace is required before you can delete vendors.");
        }

        return removeVendor(businessId, userId, vendorId, vendorName);
      },
      onSuccess: invalidate,
    }),
    updateVendor: useMutation({
      mutationFn: ({ values, vendorId }: { values: VendorInput; vendorId: string }) => {
        if (!businessId || !userId) {
          throw new Error("A business workspace is required before you can update vendors.");
        }

        return updateVendor(businessId, userId, vendorId, values);
      },
      onSuccess: invalidate,
    }),
  };
};

const insertBank = async (
  businessId: string | undefined,
  userId: string | undefined,
  values: { bankCode?: string | null; countryCode?: string | null; name: string },
) => {
  const { data, error } = await supabase
    .from("banks")
    .insert({
      bank_code: values.bankCode ?? null,
      country_code: values.countryCode?.trim().toUpperCase() || "NG",
      created_by: userId ?? null,
      name: values.name,
    })
    .select("id, name, bank_code, country_code, is_active")
    .single();

  if (error) {
    throw error;
  }

  if (businessId) {
    await logAuditEventSafe({
      action: "bank.created",
      actorUserId: userId ?? null,
      businessId,
      detail: { bank_code: values.bankCode ?? null, bank_country_code: values.countryCode ?? "NG", bank_name: values.name },
      entityId: data.id,
      entityType: "bank",
      summary: `Bank ${values.name} added`,
    });
  }

  return data;
};

const updateBank = async (
  businessId: string | undefined,
  userId: string | undefined,
  bankId: string,
  values: { bank_code?: string | null; country_code?: string | null; name?: string | null; is_active?: boolean },
) => {
  const { data, error } = await supabase
    .from("banks")
    .update({
      ...(values.bank_code === undefined ? {} : { bank_code: values.bank_code }),
      ...(values.country_code === undefined
        ? {}
        : { country_code: values.country_code.trim().toUpperCase() || "NG" }),
      ...(values.is_active === undefined ? {} : { is_active: values.is_active }),
      ...(values.name === undefined ? {} : { name: values.name }),
    })
    .eq("id", bankId)
    .select("id, name, bank_code, country_code, is_active")
    .single();

  if (error) {
    throw error;
  }

  if (businessId) {
    await logAuditEventSafe({
      action: "bank.updated",
      actorUserId: userId ?? null,
      businessId,
      detail: values,
      entityId: data.id,
      entityType: "bank",
      summary: `Bank ${data.name} updated`,
    });
  }

  return data;
};

export const useBankMutations = (businessId?: string, userId?: string) => {
  const queryClient = useQueryClient();

  return {
    createBank: useMutation({
      mutationFn: (input: string | { bankCode?: string | null; countryCode?: string | null; name: string }) => {
        const values =
          typeof input === "string"
            ? { name: input.trim(), bankCode: null, countryCode: "NG" }
            : { ...input, name: input.name.trim() };

        if (!values.name) {
          throw new Error("Bank name is required.");
        }

        return insertBank(businessId, userId, values);
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: banksQueryKey() });
      },
    }),
    updateBank: useMutation({
      mutationFn: ({
        id,
        values,
      }: {
        id: string;
        values: { bank_code?: string | null; country_code?: string | null; name?: string | null; is_active?: boolean };
      }) => {
        if (!id) {
          throw new Error("Bank id is required.");
        }

        return updateBank(businessId, userId, id, values);
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: banksQueryKey() });
      },
    }),
  };
};
