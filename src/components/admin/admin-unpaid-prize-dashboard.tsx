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

type ReviewItem = { id: string; prizeCents: number; category: string; receiptCode: string | null };

type ExpiredItem = { id: string; prizeCents: number; receiptCode: string | null; roundCode: string; resultNumber: string | null; expiredAt: string };

type Summary = {
  count: number;
  totalGrossCents: number;
  totalDueCents: number;
  unrequestedCount: number;
  requestedCount: number;
  inconsistentCount: number;
  breakdown: PrizeGroup[];
  reviewItems: ReviewItem[];
  expiredItems: ExpiredItem[];
  updatedAt: string;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(cents / 100);

export function AdminUnpaidPrizeDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

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

  const discardPrize = async (item: ReviewItem) => {
    if (!item.receiptCode || !window.confirm(`Confirma a remoção somente do prêmio de R$ 1,00 do recibo ${item.receiptCode}? A aposta e o recibo serão preservados. Esta ação não pode ser desfeita.`)) return;
    setDiscardingId(item.id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/prizes/${encodeURIComponent(item.id)}/discard`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiptCode: item.receiptCode }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível remover o prêmio.");
      setNotice("Prêmio de teste removido. A aposta foi preservada.");
      setLoading(true);
      await load();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Não foi possível remover o prêmio.";
      setError(message);
      window.alert(message);
    } finally {
      setDiscardingId(null);
    }
  };

  const acknowledgeExpiredPrize = async (item: ExpiredItem) => {
    if (!window.confirm("Registrar a baixa administrativa do prêmio expirado do recibo " + (item.receiptCode ?? "sem código") + "? A aposta e o recibo serão preservados. Esta ação ficará no histórico de auditoria.")) return;
    setAcknowledgingId(item.id);
    setNotice("");
    try {
      const response = await fetch("/api/admin/prizes/expired/" + encodeURIComponent(item.id) + "/acknowledge", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar a baixa.");
      setNotice("Baixa administrativa registrada. A aposta e o recibo foram preservados.");
      setLoading(true);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar a baixa.");
    } finally {
      setAcknowledgingId(null);
    }
  };

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, 10_000);
    return () => { window.clearTimeout(initial); window.clearInterval(poll); };
  }, [load]);

  return (
    <section className="feature-card admin-unpaid-prize-dashboard" aria-labelledby="admin-unpaid-prize-heading">
      <h2 id="admin-unpaid-prize-heading">Premiações a pagar</h2>
      {error && <p role="alert" className="note-inline">{error}</p>}
      {notice && <p role="status" className="note-inline">{notice}</p>}
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
        {summary.expiredItems?.length > 0 && (
          <div className="admin-prize-review-tools">
            <h3>Prêmios expirados — aguardando baixa administrativa</h3>
            {summary.expiredItems.map((item) => (
              <div className="admin-prize-review-row" key={item.id}>
                <div>
                  <strong>{money(item.prizeCents)}</strong>
                  <span>Rodada {item.roundCode} · Recibo: {item.receiptCode ?? "não informado"}</span>
                  <span>Resultado: {item.resultNumber ?? "—"} · Expirado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.expiredAt))}</span>
                </div>
                <button type="button" className="secondary-button" disabled={acknowledgingId !== null || discardingId !== null} onClick={() => void acknowledgeExpiredPrize(item)}>
                  {acknowledgingId === item.id ? "Registrando…" : "Registrar baixa"}
                </button>
              </div>
            ))}
          </div>
        )}
        {summary.reviewItems?.length > 0 && (
          <div className="admin-prize-review-tools">
            <h3>Prêmio inconsistente para conferência</h3>
            {summary.reviewItems.map((item) => (
              <div className="admin-prize-review-row" key={item.id}>
                <div>
                  <strong>{money(item.prizeCents)}</strong>
                  <span>{item.category} · Recibo: {item.receiptCode ?? "não informado"}</span>
                </div>
                <button type="button" className="secondary-button" disabled={discardingId !== null} onClick={() => void discardPrize(item)}>
                  {discardingId === item.id ? "Removendo…" : "Remover prêmio de teste"}
                </button>
              </div>
            ))}
          </div>
        )}
      </>}
      <button type="button" className="secondary-button admin-payment-refresh" disabled={loading} onClick={() => { setLoading(true); void load(); }}>
        Atualizar agora
      </button>
      <style jsx>{`
        .admin-prize-summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 16px 0 10px; }
        .admin-prize-summary-metric { display: flex; flex-direction: column; gap: 6px; padding: 14px; border: 1px solid var(--border, #d7dce2); border-radius: 12px; background: #172638; color: #f4f6fb; min-width: 0; }
        .admin-prize-summary-metric span { color: #cbd5e1; font-size: 13px; opacity: 1; }
        .admin-prize-summary-metric strong { color: #ffffff; font-size: clamp(24px, 4vw, 32px); line-height: 1.15; overflow-wrap: anywhere; }
        .admin-prize-summary-meta { color: #e2e8f0; display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 8px 0 18px; font-size: 13px; }
        .admin-prize-summary-table-wrap { width: 100%; overflow-x: auto; }
        .admin-prize-summary-table { width: 100%; border-collapse: collapse; color: #f4f6fb; font-size: 14px; }
        .admin-prize-summary-table th, .admin-prize-summary-table td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #40516a; }
        .admin-prize-summary-table th:nth-child(2), .admin-prize-summary-table td:nth-child(2) { text-align: center; }
        .admin-prize-summary-table th:last-child, .admin-prize-summary-table td:last-child { text-align: right; white-space: nowrap; }
        .admin-prize-summary-table tfoot th { border-bottom: 0; font-weight: 700; }
        .admin-prize-review-tools { margin: 18px 0; padding: 14px; border: 1px solid #8a6d3b; border-radius: 12px; }
        .admin-prize-review-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 10px; }
        .admin-prize-review-row > div { display: flex; flex-direction: column; gap: 4px; color: #f4f6fb; }
        .admin-prize-review-row span { font-size: 12px; color: #cbd5e1; overflow-wrap: anywhere; }
        .admin-prize-summary-footnote { margin-top: 12px; color: #cbd5e1; font-size: 12px; opacity: 1; line-height: 1.45; }
        @media (max-width: 420px) { .admin-prize-summary-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
