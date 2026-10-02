export type BillBreakdownItem = {
  description: string;
  qty: number;
  unitPrice: number;
};

export const calculateBillBreakdown = (items: BillBreakdownItem[], taxTotal: number) => {
  const normalizedItems = items.map((item) => ({
    description: item.description.trim(),
    qty: Math.max(0, Number(item.qty) || 0),
    unitPrice: Math.max(0, Number(item.unitPrice) || 0),
  }));
  const subtotal = Math.round(normalizedItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0) * 100) / 100;
  const normalizedTax = Math.max(0, Number(taxTotal) || 0);
  return { items: normalizedItems, subtotal, taxTotal: normalizedTax, total: Math.round((subtotal + normalizedTax) * 100) / 100 };
};

export const billAttachmentSummary = (attachmentCount: number) =>
  attachmentCount > 0 ? `${attachmentCount} private attachment${attachmentCount === 1 ? "" : "s"} available` : "No attachment included";
