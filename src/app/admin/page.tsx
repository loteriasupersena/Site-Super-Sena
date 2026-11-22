import { AreaShell } from "@/components/area-shell";
import { AdminPrizePayout } from "@/components/admin/admin-prize-payout";
import { AdminUnpaidPrizeDashboard } from "@/components/admin/admin-unpaid-prize-dashboard";
import { AdminPrizeCreditReconciliation } from "@/components/admin/admin-prize-credit-reconciliation";
import { AdminWithdrawalManager } from "@/components/admin/admin-withdrawal-manager";
import { AdminCashierManager } from "@/components/admin/admin-cashier-manager";
import { AdminTestWalletCredit } from "@/components/admin/admin-test-wallet-credit";
import { requireRole } from "@/lib/auth/require-role";
import { AdminGameSimulator } from "@/components/admin/admin-game-simulator";
import { AdminPrizeRules } from "@/components/admin/admin-prize-rules";
import "./admin-dashboard.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireRole("ADMIN");

  return (
    <AreaShell
      title="Administração"
      username={user.username}
      description="Configuração e supervisão da plataforma."
    >
      <div className="admin-dashboard">
        <header className="admin-dashboard-intro">
          <div>
            <span className="admin-dashboard-eyebrow">Central de controle</span>
            <h2>Painel administrativo</h2>
            <p>Gerencie premiações, cambistas e parâmetros financeiros em um só lugar.</p>
          </div>
          <div className="admin-dashboard-status" aria-label="Área administrativa">
            <span className="admin-dashboard-status-dot" />
            Ambiente administrativo
          </div>
        </header>

        <section className="admin-dashboard-section admin-dashboard-prizes" aria-labelledby="admin-prizes-title">
          <div className="admin-dashboard-section-heading">
            <div className="admin-dashboard-section-number">01</div>
            <div>
              <span className="admin-dashboard-kicker">Financeiro</span>
              <h3 id="admin-prizes-title">Prêmios e resgates</h3>
              <p>Acompanhe pagamentos pendentes, saques e conciliação de créditos.</p>
            </div>
          </div>
          <div className="admin-dashboard-grid admin-dashboard-grid-prizes">
            <article className="admin-dashboard-card admin-dashboard-card-wide">
              <div className="admin-dashboard-card-heading">
                <h4>Prêmios não pagos</h4>
                <span>Monitoramento</span>
              </div>
              <AdminUnpaidPrizeDashboard />
            </article>
            <article className="admin-dashboard-card">
              <div className="admin-dashboard-card-heading">
                <h4>Pagamento de prêmios</h4>
                <span>Operação</span>
              </div>
              <AdminPrizePayout />
            </article>
            <article className="admin-dashboard-card">
              <div className="admin-dashboard-card-heading">
                <h4>Saques</h4>
                <span>Solicitações</span>
              </div>
              <AdminWithdrawalManager />
            </article>
            <article className="admin-dashboard-card">
              <div className="admin-dashboard-card-heading">
                <h4>Conciliação de créditos</h4>
                <span>Conferência</span>
              </div>
              <AdminPrizeCreditReconciliation />
            </article>
            <article className="admin-dashboard-card">
              <div className="admin-dashboard-card-heading">
                <h4>Crédito de teste</h4>
                <span>Ferramenta administrativa</span>
              </div>
              <AdminTestWalletCredit />
            </article>
          </div>
        </section>

        <section className="admin-dashboard-section" aria-labelledby="admin-cashiers-title">
          <div className="admin-dashboard-section-heading">
            <div className="admin-dashboard-section-number">02</div>
            <div>
              <span className="admin-dashboard-kicker">Rede de vendas</span>
              <h3 id="admin-cashiers-title">Gestão de cambistas</h3>
              <p>Cadastre novos parceiros e administre os cadastros existentes.</p>
            </div>
          </div>
          <div className="admin-dashboard-grid admin-dashboard-grid-two">
            <article className="admin-dashboard-card">
              <div className="admin-dashboard-card-heading">
                <h4>Cadastro de cambista</h4>
                <span>Novo cadastro</span>
              </div>
              <AdminCashierManager mode="create" />
            </article>
            <article className="admin-dashboard-card">
              <div className="admin-dashboard-card-heading">
                <h4>Gerenciar cambistas</h4>
                <span>Cadastros e gestão</span>
              </div>
              <AdminCashierManager mode="manage" />
            </article>
          </div>
        </section>

        <section className="admin-dashboard-section" aria-labelledby="admin-settings-title">
          <div className="admin-dashboard-section-heading">
            <div className="admin-dashboard-section-number">03</div>
            <div>
              <span className="admin-dashboard-kicker">Parâmetros do jogo</span>
              <h3 id="admin-settings-title">Multiplicadores e simulador</h3>
              <p>Configure os multiplicadores e avalie a sustentabilidade financeira.</p>
            </div>
          </div>
          <div className="admin-dashboard-grid admin-dashboard-grid-two">
            <article className="admin-dashboard-card">
              <div className="admin-dashboard-card-heading">
                <h4>Configuração de multiplicadores</h4>
                <span>Regras de premiação</span>
              </div>
              <AdminPrizeRules />
            </article>
            <article className="admin-dashboard-card">
              <div className="admin-dashboard-card-heading">
                <h4>Simulador financeiro</h4>
                <span>Análise em tempo real</span>
              </div>
              <AdminGameSimulator />
            </article>
          </div>
        </section>
      </div>
    </AreaShell>
  );
}
