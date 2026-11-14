"use client";

import { useEffect, useState } from "react";

type Settlement = {
  id: string;
  settledAt: string;
  cashSalesCents: number;
  pixSalesCents: number;
  totalSalesCents: number;
  salesCount: number;
  gamesCount: number;
  commissionCents: number;
  cashPrizePayoutCount: number;
  cashPrizePayoutCents: number;
  netBalanceCents: number;
  cashierOwesPlatformCents: number;
  platformOwesCashierCents: number;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function CashierSettlementHistory() {
  const [items, setItems] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/cashier/settlements?page=" + page, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Não foi possível carregar o histórico.");
        if (!controller.signal.aborted) { setItems(body.settlements as Settlement[]); setTotalPages(body.pagination.totalPages); }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Falha ao carregar o histórico.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [page]);

  return <details className="player-collapsible-section cashier-settlement-history">
    <summary>
      <span className="player-collapsible-label">Financeiro</span>
      <span className="player-collapsible-title">Histórico de acertos</span>
    </summary>
    <section className="cashier-compact-summary" aria-label="Histórico de acertos do cambista">
      {loading && <p>Carregando histórico…</p>}
      {error && <p role="alert" className="note-inline">{error}</p>}
      {!loading && !error && items.length === 0 && <p>Nenhum acerto foi registrado até o momento.</p>}
      {items.map((item) => <article className="cashier-settlement-history-item" key={item.id}>
        <h3>Acerto de {new Date(item.settledAt).toLocaleString("pt-BR")}</h3>
        <div className="cashier-summary-grid">
          <article className="cashier-summary-tile"><span>Vendas em dinheiro</span><strong>{money(item.cashSalesCents)}</strong></article>
          <article className="cashier-summary-tile"><span>Vendas em Pix</span><strong>{money(item.pixSalesCents)}</strong></article>
          <article className="cashier-summary-tile"><span>Total vendido</span><strong>{money(item.totalSalesCents)}</strong></article>
          <article className="cashier-summary-tile"><span>Comissão</span><strong>{money(item.commissionCents)}</strong></article>
          <article className="cashier-summary-tile"><span>Prêmios pagos em dinheiro ({item.cashPrizePayoutCount})</span><strong>{money(item.cashPrizePayoutCents)}</strong></article>
          <article className="cashier-summary-tile"><span>Vendas · jogos</span><strong>{item.salesCount} · {item.gamesCount}</strong></article>
        </div>
        <p><strong>Resultado do acerto:</strong> {item.cashierOwesPlatformCents > 0
          ? "Você repassou à plataforma " + money(item.cashierOwesPlatformCents) + "."
          : item.platformOwesCashierCents > 0
            ? "A plataforma pagou a você " + money(item.platformOwesCashierCents) + "."
            : "Não houve valor a repassar ou receber."}</p>
        <p className="note-inline">Período encerrado. Um novo período foi iniciado após este acerto.</p>
      </article>)}
      {totalPages > 1 && <div className="admin-cashier-pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button>
        <span>Página {page} de {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Próxima</button>
      </div>}
    </section>
  </details>;
}
