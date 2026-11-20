"use client";

import { useCallback, useEffect, useState } from "react";

type PrizeGroup = {
  category: string;
  count: number;
  grossCents: number;
  dueCents: number;
  unrequestedCount: number;
  requestedCount: number;
};

type Summary = {
  count: number;
  totalGrossCents: number;
  totalDueCents: number;
  unrequestedCount: number;
  requestedCount: number;
  inconsistentCount: number;
  breakdown: PrizeGroup[];
  updatedAt: string;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(cents / 100);

export function AdminUnpaidPrizeDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/prizes/summary", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Falha ao atualizar o painel.");
      setSummary(body as Summary);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao atualizar o painel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, 10_000);
    return () => { window.clearTimeout(initial); window.clearInterval(poll); };
  }, [load]);

  return (
    <section className="feature-card admin-unpaid-prize-dashboard" aria-labelledby="admin-unpaid-prize-heading">
      <span className="feature-label">CONTROLE FINANCEIRO</span>
      <div className="admin-payment-card-heading">
        <h2 id="admin-unpaid-prize-heading">Premiações a pagar</h2>
        <span className="admin-payment-status">ATUALIZAÇÃO AUTOMÁTICA</span>
      </div>
      {error && <p role="alert" className="note-inline">{error}</p>}
      {loading && !summary ? <p>Carregando premiações…</p> : summary && <>
        <div className="admin-prize-summary-grid">
          <div className="admin-prize-summary-metric">
            <span>Prêmios não pagos</span>
            <strong>{summary.count.toLocaleString("pt-BR")}</strong>
          </div>
          <div className="admin-prize-summary-metric">
            <span>Valor total pendente</span>
            <strong>{money(summary.totalDueCents)}</strong>
          </div>
        </div>
        <div className="admin-prize-summary-meta">
          <span>Sem solicitação: <strong>{summary.unrequestedCount}</strong></span>
          <span>Com solicitação: <strong>{summary.requestedCount}</strong></span>
        </div>
        <h3>Detalhamento por premiação</h3>
        <div className="admin-prize-summary-table-wrap">
          <table className="admin-prize-summary-table">
            <thead><tr><th>Categoria</th><th>Qtd.</th><th>Valor pendente</th></tr></thead>
            <tbody>
              {summary.breakdown.length === 0
                ? <tr><td colSpan={3}>Nenhum prêmio pendente.</td></tr>
                : summary.breakdown.map((item) => (
                  <tr key={item.category}>
                    <td>{item.category}</td>
                    <td>{item.count}</td>
                    <td>{money(item.dueCents)}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot><tr><th>Total</th><th>{summary.count}</th><th>{money(summary.totalDueCents)}</th></tr></tfoot>
          </table>
        </div>
        {summary.inconsistentCount > 0 && (
          <p role="alert" className="note-inline">
            Atenção: {summary.inconsistentCount} prêmio(s) precisam de conferência do cálculo.
          </p>
        )}
        <p className="admin-prize-summary-footnote">
          O total considera prêmios apurados ainda sem baixa de pagamento ou crédito. Prêmios com solicitação continuam na conta até o pagamento ser registrado.
        </p>
      </>}
      <button type="button" className="secondary-button admin-payment-refresh" disabled={loading} onClick={() => { setLoading(true); void load(); }}>
        Atualizar agora
      </button>
    </section>
  );
}
