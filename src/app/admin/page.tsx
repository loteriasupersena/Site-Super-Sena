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
        <summary><span>Ganhadores</span></summary>
        <div className="admin-accordion-content"><AdminPrizePayout /><AdminPrizeCreditReconciliation /></div>
      </details>
      <details className="admin-accordion">
        <summary><span>Controle financeiro e saques</span></summary>
        <div className="admin-accordion-content"><AdminWithdrawalManager /></div>
      </details>
      <details className="admin-accordion">
        <summary><span>Cadastro de cambista</span></summary>
        <div className="admin-accordion-content"><AdminCashierManager mode="create" /></div>
      </details>
      <details className="admin-accordion">
        <summary><span>Gestão de cambistas</span></summary>
        <div className="admin-accordion-content"><AdminCashierManager mode="manage" /></div>
      </details>
    </div>
    <article className="feature-card"><span className="feature-label">Controles protegidos</span><h2>Operação administrativa</h2><p>O painel de rodadas permite acompanhar os horários e resultados. O scheduler mantém a fila móvel de 48 rodadas futuras, fecha as apostas, publica os resultados e apura os prêmios automaticamente. A central Ganhadores reúne os pagamentos manuais pendentes e o histórico. O painel de saques permite aprovar ou recusar solicitações. A aprovação não marca o saque como pago nem envia Pix: a transferência é feita manualmente fora da plataforma.</p></article>
    </div>
  </AreaShell>;
}
