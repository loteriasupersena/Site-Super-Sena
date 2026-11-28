import { AreaShell } from "@/components/area-shell";
import { AdminUnpaidPrizeDashboard } from "@/components/admin/admin-unpaid-prize-dashboard";
import { AdminCashierManager } from "@/components/admin/admin-cashier-manager";
import { requireRole } from "@/lib/auth/require-role";
import { AdminPrizeRules } from "@/components/admin/admin-prize-rules";
import { AdminPaymentRequests } from "@/components/admin/admin-payment-requests";
import { AdminStoreManager } from "@/components/admin/admin-store-manager";
import { AdminBenefitsSimulator } from "@/components/admin/admin-benefits-simulator";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireRole("ADMIN");

  return (
    <AreaShell title="Administração" username={user.username} description="Configuração e supervisão da plataforma.">
      <div className="admin-page-layout">
        <AdminStoreManager />
        <AdminUnpaidPrizeDashboard />
        <div className="admin-payment-section">
          <AdminPaymentRequests />
        </div>
        <div className="admin-accordion-list">
          <details className="admin-accordion">
            <summary><span>Cadastro de cambista</span></summary>
            <div className="admin-accordion-content">
              <AdminCashierManager mode="create" />
            </div>
          </details>

          <details className="admin-accordion">
            <summary><span>Gestão de cambistas</span></summary>
            <div className="admin-accordion-content">
              <AdminCashierManager mode="manage" />
            </div>
          </details>

          <details className="admin-accordion">
            <summary><span>Multiplicadores de prêmios</span></summary>
            <div className="admin-accordion-content">
              <AdminPrizeRules />
            </div>
          </details>

          <details className="admin-accordion">
            <summary><span>Simulador econômico de cupons</span></summary>
            <div className="admin-accordion-content">
              <AdminBenefitsSimulator />
            </div>
          </details>
        </div>
      </div>
    </AreaShell>
  );
}
