import { AreaShell } from "@/components/area-shell";
import { AdminPrizeCreditReconciliation } from "@/components/admin/admin-prize-credit-reconciliation";
import { AdminPrizePayout } from "@/components/admin/admin-prize-payout";
import { AdminWithdrawalManager } from "@/components/admin/admin-withdrawal-manager";
import { AdminCashierManager } from "@/components/admin/admin-cashier-manager";
import { requireRole } from "@/lib/auth/require-role";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const user = await requireRole("ADMIN");
  return <AreaShell title="Administração" username={user.username} description="Configuração e supervisão da plataforma.">
    <div className="admin-page-layout">
    <div className="admin-accordion-list">
      <details className="admin-accordion">
        <summary><span>Ganhadores</span><span className="admin-accordion-description">Todos os prêmios pendentes e o histórico de pagamentos</span></summary>
        <div className="admin-accordion-content"><AdminPrizePayout /><AdminPrizeCreditReconciliation /></div>
      </details>
      <details className="admin-accordion">
        <summary><span>Controle financeiro e saques</span><span className="admin-accordion-description">Analisar solicitações de retirada</span></summary>
        <div className="admin-accordion-content"><AdminWithdrawalManager /></div>
      </details>
      <details className="admin-accordion">
        <summary><span>Cadastro de cambista</span><span className="admin-accordion-description">Cadastrar novos cambistas e definir seus dados e comissão</span></summary>
        <div className="admin-accordion-content"><AdminCashierManager mode="create" /></div>
      </details>
      <details className="admin-accordion">
        <summary><span>Gestão de cambistas</span><span className="admin-accordion-description">Pesquisar, editar dados, acompanhar financeiro e realizar apurações</span></summary>
        <div className="admin-accordion-content"><AdminCashierManager mode="manage" /></div>
      </details>
    </div>
    </div>
  </AreaShell>;
}