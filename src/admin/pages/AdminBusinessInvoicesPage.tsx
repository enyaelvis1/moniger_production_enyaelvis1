import { useParams } from "react-router-dom";
import { useAdminConsoleQuery, type AdminBusinessInvoicesResponse } from "@/admin/lib/admin-console";
import {
  AdminPageHeader,
  AdminSectionCard,
  AdminTableHead,
  AdminTableWrapper,
  formatAdminCurrency,
  formatAdminDate,
} from "@/admin/components/AdminUi";

const AdminBusinessInvoicesPage = () => {
  const { businessId = "" } = useParams();
  const invoicesQuery = useAdminConsoleQuery<AdminBusinessInvoicesResponse>("businesses.invoices", { businessId }, Boolean(businessId));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Business Invoices"
        subtitle={invoicesQuery.data ? `${invoicesQuery.data.businessName} · Full invoice list` : "Loading business invoices..."}
      />

      <AdminSectionCard title="Invoices">
        <AdminTableWrapper>
          <table className="min-w-full text-left text-sm text-white/72">
            <AdminTableHead>
              <tr>
                <th className="px-5 py-3">Number</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Issued</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </AdminTableHead>
            <tbody>
              {(invoicesQuery.data?.invoices ?? []).map((invoice) => (
                <tr key={invoice.invoiceId} className="border-b border-white/5">
                  <td className="px-5 py-4 font-medium text-[#F1F5F9]">{invoice.invoiceNumber}</td>
                  <td className="px-5 py-4">{invoice.customerName}</td>
                  <td className="px-5 py-4 text-white/45">{formatAdminDate(invoice.issueDate)}</td>
                  <td className="px-5 py-4 text-white/45">{formatAdminDate(invoice.dueDate)}</td>
                  <td className="px-5 py-4 [font-variant-numeric:tabular-nums]">{formatAdminCurrency(invoice.amount)}</td>
                  <td className="px-5 py-4 capitalize">{invoice.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableWrapper>
      </AdminSectionCard>
    </div>
  );
};

export default AdminBusinessInvoicesPage;
