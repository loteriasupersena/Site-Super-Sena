import { AreaShell } from "@/components/area-shell";
import { StorePixKeyManager } from "@/components/store/store-pix-key-manager";
import { StoreBillingManager } from "@/components/store/store-billing-manager";
import { StoreTerminalManager } from "@/components/store/store-terminal-manager";
import { requireRole } from "@/lib/auth/require-role";
import { authPrisma } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const user = await requireRole("STORE_ADMIN");
  const store = await authPrisma.store.findUnique({
    where: { adminUserId: user.id },
    select: {
      id: true, name: true, status: true, commissionRateBasisPoints: true, couponLimit: true,
      _count: { select: { users: true } },
    },
  });

  return (
    <AreaShell title="Loja" username={user.username} description="Administração do estabelecimento.">
      <div className="admin-page-layout">
        <section className="feature-card" aria-labelledby="store-home-heading">
          <span className="feature-label">Área do estabelecimento</span>
          <h1 id="store-home-heading">{store?.name ?? "Loja"}</h1>
          {!store ? (
            <p role="alert">Não foi possível localizar o estabelecimento vinculado a esta conta. Entre em contato com o administrador da plataforma.</p>
          ) : (
            <>
              <p>Conta administrativa: <strong>{user.username}</strong></p>
              <p>Situação: <strong>{store.status === "ACTIVE" ? "Ativa" : store.status === "BLOCKED" ? "Bloqueada" : "Pendente"}</strong></p>
              <div className="round-options">
                <article className="round-option"><strong>{(store.commissionRateBasisPoints / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong><br />Percentual da plataforma</article>
                <article className="round-option"><strong>{store.couponLimit}</strong><br />Limite de cupons por ciclo</article>
                <article className="round-option"><strong>{store._count.users}</strong><br />Acessos vinculados</article>
              </div>
              <p>O cadastro da loja e as regras comerciais são administrados pela plataforma. A gestão dos acessos operacionais e das maquininhas será disponibilizada nesta área, conforme as próximas etapas da implantação.</p>
            </>
          )}
        </section>
        {store?.status === "ACTIVE" && <StoreBillingManager />}
        {store?.status === "ACTIVE" && <StoreTerminalManager />}
        {store?.status === "ACTIVE" && <StorePixKeyManager />}
      </div>
    </AreaShell>
  );
}
