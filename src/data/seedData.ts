// Seed data for moniger.net development

export interface Vendor {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  totalPaid: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalInvoiced: number;
  outstanding: number;
}

export type InvoiceStatus = "Draft" | "Sent" | "Overdue" | "Paid" | "Cancelled";
export type BillStatus = "Unpaid" | "Scheduled" | "Paid" | "Overdue";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
  lineItems: { description: string; qty: number; unitPrice: number }[];
  taxPercent: number;
  notes: string;
}

export interface Bill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  billDate: string;
  dueDate: string;
  amount: number;
  status: BillStatus;
  category: string;
  notes: string;
}

export const vendors: Vendor[] = [
  {
    id: "v1", businessName: "Dangote Cement Ltd", contactName: "Aliko Dangote",
    email: "dangote@example.com", phone: "+234 801 234 5678",
    bankName: "GTBank", accountNumber: "0123456789", accountName: "Dangote Cement Ltd", totalPaid: 590000,
  },
  {
    id: "v2", businessName: "MTN Nigeria", contactName: "Karl Toriola",
    email: "mtn@example.com", phone: "+234 802 345 6789",
    bankName: "Zenith Bank", accountNumber: "0987654321", accountName: "MTN Nigeria Communications", totalPaid: 125500,
  },
  {
    id: "v3", businessName: "Lagos Power Solutions", contactName: "Funke Adeyemi",
    email: "lps@example.com", phone: "+234 803 456 7890",
    bankName: "Access Bank", accountNumber: "0456789123", accountName: "Lagos Power Solutions Ltd", totalPaid: 385000,
  },
];

export const customers: Customer[] = [
  { id: "c1", name: "Konga Online Shopping", email: "konga@example.com", phone: "+234 804 567 8901", totalInvoiced: 945000, outstanding: 0 },
  { id: "c2", name: "Flutterwave Technologies", email: "flutterwave@example.com", phone: "+234 805 678 9012", totalInvoiced: 4280000, outstanding: 2100000 },
  { id: "c3", name: "Access Bank Plc", email: "accessbank@example.com", phone: "+234 806 789 0123", totalInvoiced: 1300000, outstanding: 750000 },
];

export const invoices: Invoice[] = [
  { id: "i1", invoiceNumber: "INV-0001", customerId: "c1", customerName: "Konga Online Shopping", issueDate: "2026-02-15", dueDate: "2026-03-15", amount: 450000, status: "Paid", lineItems: [{ description: "Web Development", qty: 1, unitPrice: 450000 }], taxPercent: 0, notes: "" },
  { id: "i2", invoiceNumber: "INV-0002", customerId: "c2", customerName: "Flutterwave Technologies", issueDate: "2026-03-10", dueDate: "2026-04-10", amount: 1200000, status: "Sent", lineItems: [{ description: "API Integration", qty: 1, unitPrice: 1200000 }], taxPercent: 0, notes: "" },
  { id: "i3", invoiceNumber: "INV-0003", customerId: "c3", customerName: "Access Bank Plc", issueDate: "2026-02-28", dueDate: "2026-03-13", amount: 750000, status: "Overdue", lineItems: [{ description: "Consulting Services", qty: 1, unitPrice: 750000 }], taxPercent: 0, notes: "" },
  { id: "i4", invoiceNumber: "INV-0004", customerId: "c1", customerName: "Konga Online Shopping", issueDate: "2026-03-20", dueDate: "2026-04-20", amount: 320000, status: "Draft", lineItems: [{ description: "UI Design", qty: 1, unitPrice: 320000 }], taxPercent: 0, notes: "" },
  { id: "i5", invoiceNumber: "INV-0005", customerId: "c2", customerName: "Flutterwave Technologies", issueDate: "2026-01-15", dueDate: "2026-02-15", amount: 980000, status: "Paid", lineItems: [{ description: "Mobile App Dev", qty: 1, unitPrice: 980000 }], taxPercent: 0, notes: "" },
  { id: "i6", invoiceNumber: "INV-0006", customerId: "c3", customerName: "Access Bank Plc", issueDate: "2026-03-18", dueDate: "2026-04-18", amount: 550000, status: "Sent", lineItems: [{ description: "Security Audit", qty: 1, unitPrice: 550000 }], taxPercent: 0, notes: "" },
  { id: "i7", invoiceNumber: "INV-0007", customerId: "c1", customerName: "Konga Online Shopping", issueDate: "2026-03-25", dueDate: "2026-04-25", amount: 175000, status: "Draft", lineItems: [{ description: "Content Writing", qty: 1, unitPrice: 175000 }], taxPercent: 0, notes: "" },
  { id: "i8", invoiceNumber: "INV-0008", customerId: "c2", customerName: "Flutterwave Technologies", issueDate: "2026-03-22", dueDate: "2026-04-22", amount: 2100000, status: "Sent", lineItems: [{ description: "Platform Development", qty: 1, unitPrice: 2100000 }], taxPercent: 0, notes: "" },
];

export const bills: Bill[] = [
  { id: "b1", billNumber: "BILL-001", vendorId: "v1", vendorName: "Dangote Cement Ltd", billDate: "2026-02-20", dueDate: "2026-03-10", amount: 380000, status: "Overdue", category: "Supplies", notes: "" },
  { id: "b2", billNumber: "BILL-002", vendorId: "v2", vendorName: "MTN Nigeria", billDate: "2026-03-15", dueDate: "2026-03-30", amount: 125500, status: "Unpaid", category: "Services", notes: "" },
  { id: "b3", billNumber: "BILL-003", vendorId: "v3", vendorName: "Lagos Power Solutions", billDate: "2026-02-01", dueDate: "2026-02-28", amount: 385000, status: "Paid", category: "Utilities", notes: "" },
  { id: "b4", billNumber: "BILL-004", vendorId: "v1", vendorName: "Dangote Cement Ltd", billDate: "2026-03-18", dueDate: "2026-04-15", amount: 210000, status: "Scheduled", category: "Supplies", notes: "" },
];

export const nigerianBanks = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank",
  "Globus Bank",
  "Guaranty Trust Bank (GTBank)",
  "Heritage Bank",
  "Jaiz Bank",
  "Keystone Bank",
  "Kuda Bank",
  "Lotus Bank",
  "Opay",
  "Polaris Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered",
  "Sterling Bank",
  "Titan Trust Bank",
  "Union Bank",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "VFD Microfinance Bank",
  "Wema Bank",
  "Zenith Bank",
  // Common microfinance banks and lenders
  "LAPO Microfinance Bank",
  "AB Microfinance Bank",
  "Accion Microfinance Bank",
  "Fortis Microfinance Bank",
  "Mainstreet Microfinance Bank",
  "Rubies Microfinance Bank",
];

export const billCategories = ["Rent", "Utilities", "Supplies", "Services", "Other"];

export const formatNaira = (amount: number) =>
  "₦" + amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
