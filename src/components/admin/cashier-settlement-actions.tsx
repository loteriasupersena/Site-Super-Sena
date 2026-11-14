"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SettlementPreview = {
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
  periodStartAt: string | null;
  cutoffAt: string;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateTime = (value: string) => new Date(value).toLocaleString("pt-BR");

export function CashierSettlementActions({ cashierId }: { cashierId: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "finalize" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function calculate() {
    setBusy("preview"); setError(""); setNotice(""); setPreview(null);
    try {
      const response = await fetch("/api/admin/cashiers/" + encodeURIComponent(cashierId) + "/settlements", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível apurar o período.");
      setPreview(body.preview as SettlementPreview);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao apurar o período.");
    } finally {
      setBusy("");
    }
  }

  async function finalize() {
    if (!preview) return;
    const balanceText = preview.cashierOwesPlatformCents > 0
      ? "O cambista deve repassar " + money(preview.cashierOwesPlatformCents) + " à plataforma."
      : preview.platformOwesCashierCents > 0
        ? "A plataforma deve pagar " + money(preview.platformOwesCashierCents) + " ao cambista."
        : "Não há transferência financeira pendente.";
    if (!window.confirm("Confirme somente depois de conferir os valores e efetivar o repasse ou pagamento indicado.\n\n" + balanceText + "\n\nAo confirmar, o acerto será gravado no histórico e o próximo período começará. Esta ação não transfere dinheiro automaticamente.")) return;

    setBusy("finalize"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/cashiers/" + encodeURIComponent(cashierId) + "/settlements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cutoffAt: preview.cutoffAt }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível confirmar o acerto.");
      setNotice("Acerto confirmado e período encerrado. O registro ficará disponível no histórico do cambista.");
      setPreview(null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao confirmar o acerto.");
    } finally {
      setBusy("");
    }
  }

  return <section className="feature-card admin-settlement-action">
    <h2>Apuração e acerto financeiro</h2>
    <p>A apuração mostra os valores antes de encerrar o período. O Pix fica no caixa da plataforma; o dinheiro fica no caixa do cambista. Os prêmios pagos em dinheiro pelo cambista são valores a compensar pela plataforma.</p>
    <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={() => void calculate()}>
      {busy === "preview" ? "Apurando…" : "Apurar período"}
    </button>
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status" className="note-inline">{notice}</p>}

    {preview && <div className="admin-settlement-preview" aria-live="polite">
      <h3>Resultado da apuração — ainda não encerrado</h3>
      <p>Período: {preview.periodStartAt ? "após " + dateTime(preview.periodStartAt) : "desde o início"} até {dateTime(preview.cutoffAt)}.</p>
      <div className="cashier-summary-grid">
        <article className="cashier-summary-tile"><span>Vendas em dinheiro · caixa do cambista</span><strong>{money(preview.cashSalesCents)}</strong></article>
        <article className="cashier-summary-tile"><span>Vendas em Pix · caixa da plataforma</span><strong>{money(preview.pixSalesCents)}</strong></article>
        <article className="cashier-summary-tile"><span>Total vendido</span><strong>{money(preview.totalSalesCents)}</strong></article>
        <article className="cashier-summary-tile"><span>Comissão devida ao cambista</span><strong>{money(preview.commissionCents)}</strong></article>
        <article className="cashier-summary-tile"><span>Prêmios pagos em dinheiro pelo cambista ({preview.cashPrizePayoutCount})</span><strong>{money(preview.cashPrizePayoutCents)}</strong></article>
        <article className="cashier-summary-tile"><span>Vendas confirmadas · jogos</span><strong>{preview.salesCount} · {preview.gamesCount}</strong></article>
      </div>
      <div className="admin-settlement-final-balance">
        <h4>Resultado financeiro final</h4>
        {preview.cashierOwesPlatformCents > 0
          ? <p><strong>O CAMBISTA DEVE À PLATAFORMA: {money(preview.cashierOwesPlatformCents)}</strong></p>
          : preview.platformOwesCashierCents > 0
            ? <p><strong>A PLATAFORMA DEVE AO CAMBISTA: {money(preview.platformOwesCashierCents)}</strong></p>
            : <p><strong>ACERTO ZERADO: não há valor a repassar ou pagar.</strong></p>}
        <p>O cálculo considera dinheiro recebido menos comissão e prêmios pagos pelo cambista. O Pix é demonstrado separadamente porque já está no caixa da plataforma.</p>
      </div>
      <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={() => void finalize()}>
        {busy === "finalize" ? "Confirmando…" : "Confirmar liquidação e zerar período"}
      </button>
      <p className="note-inline">Só confirme depois de conferir os valores e realizar o repasse ou pagamento fora do sistema. A confirmação grava o histórico e inicia um novo período; não movimenta dinheiro automaticamente.</p>
    </div>}
  </section>;
}
