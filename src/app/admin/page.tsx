import { AreaShell } from "@/components/area-shell";
import { AdminPrizeCreditReconciliation } from "@/components/admin/admin-prize-credit-reconciliation";
import { AdminPrizePayout } from "@/components/admin/admin-prize-payout";
import { AdminWithdrawalManager } from "@/components/admin/admin-withdrawal-manager";
import { AdminCashierManager } from "@/components/admin/admin-cashier-manager";
import { requireRole } from "@/lib/auth/require-role";
import { AdminGameSimulator } from "@/components/admin/admin-game-simulator";
import { AdminPrizeRules } from "@/components/admin/admin-prize-rules";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireRole("ADMIN");

  return (
    <AreaShell title="Administração" username={user.username} description="Configuração e supervisão da plataforma.">
      <div className="admin-page-layout">
        <div className="admin-accordion-list">
          <details className="admin-accordion">
            <summary><span>Ganhadores</span></summary>
            <div className="admin-accordion-content">
              <AdminPrizePayout />
              <AdminPrizeCreditReconciliation />
            </div>
          </details>

          <details className="admin-accordion">
            <summary><span>Controle financeiro e saques</span></summary>
            <div className="admin-accordion-content">
              <AdminWithdrawalManager />
            </div>
          </details>

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
            <summary><span>Simulador de sustentabilidade</span></summary>
            <div className="admin-accordion-content">
              <AdminGameSimulator />
            </div>
          </details>
        </div>
      </div>
    </AreaShell>
  );
}
