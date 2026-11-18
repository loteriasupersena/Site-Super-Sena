"use client";

import { useCallback, useEffect, useState } from "react";

type Winner = {
  id: string;
  numberValue: string;
  prizeCents: number;
  stakeCents: number;
  prizeCategoryLabel: string | null;
  categoryStakeCents: number | null;
  multiplier: number | null;
  participationTotalCents: number;
  purchaseTotalCents: number;
  roundCode: string;
  resultNumber: string | null;
  resultAt: string;
  receiptCode: string | null;
  playerName: string;
  cashierName: string | null;
  manualEligible: boolean;
  paid: boolean;
  payoutChannel: "PLATFORM_PIX" | "CASHIER_CASH" | "WALLET" | null;
  paidAt: string | null;
  reference: string | null;
  paymentRequest: {
    status: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED" | "CANCELLED";
    pixKeyMasked: string;
    asaasTransferStatus: string | null;
    grossCents: number;
    administrativeFeeCents: number;
    transactionFeeCents: number;
    netCents: number;
    requestedAt: string;
  } | null;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(cents / 100);
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
}).format(new Date(value));

type PaymentRequestStatus = NonNullable<Winner["paymentRequest"]>["status"];

const requestStatus = (status: PaymentRequestStatus) => ({
  PENDING: "Aguardando análise",
  PROCESSING: "Transferência em processamento",
  PAID: "Pago",
  REJECTED: "Solicitação encerrada",
  FAILED: "Falha na transferência",
  CANCELLED: "Transferência cancelada",
}[status] ?? "Sem solicitação");

export function AdminPrizePayout() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [tab, setTab] = useState<"pending" | "paid">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/prizes/pending", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os ganhadores.");
      setWinners(body.winners as Winner[]);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar os ganhadores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, 10_000);
    return () => { window.clearTimeout(timer); window.clearInterval(poll); };
  }, [load]);

  const pending = winners.filter((winner) => !winner.paid);
  const paid = winners.filter((winner) => winner.paid);
  const visible = tab === "pending" ? pending : paid;
  const physicalPending = pending.filter((winner) => winner.manualEligible);
  const physicalAwaitingPix = physicalPending.filter((winner) =>
    ["PENDING", "FAILED", "CANCELLED"].includes(winner.paymentRequest?.status ?? ""));
  const totalAwaitingAuthorization = physicalAwaitingPix.reduce(
    (total, winner) => total + (winner.paymentRequest?.netCents ?? 0), 0);
  const totalPhysicalPending = physicalPending.reduce((total, winner) => total + winner.prizeCents, 0);
  const totalPending = pending.reduce((total, winner) => total + winner.prizeCents, 0);
  const totalPaid = paid.reduce((total, winner) => total + winner.prizeCents, 0);
  const reviewPending = pending.filter((winner) => !winner.manualEligible);

  return <section className="feature-card admin-prize-payout" aria-labelledby="admin-prize-payout-heading">
    <span className="feature-label">Painel de acompanhamento</span>
    <h2 id="admin-prize-payout-heading">Movimentação de prêmios</h2>
    <p>Painel exclusivamente informativo. Acompanhe os prêmios gerados, as solicitações feitas pelos ganhadores e os pagamentos confirmados. Esta tela não autoriza, libera nem realiza pagamentos.</p>

    <div className="admin-prize-total-panel" style={{
      margin: "1rem 0", padding: "1rem 1.1rem", borderRadius: "16px",
      border: "1px solid rgba(66, 211, 242, .55)",
      background: "linear-gradient(135deg, rgba(0, 139, 190, .24), rgba(22, 35, 57, .96))",
      boxShadow: "0 8px 24px rgba(0, 0, 0, .18)",
    }}>
      <span style={{ display: "block", fontSize: ".8rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#62d8f4" }}>Prêmios físicos aguardando solicitação ou pagamento</span>
      <strong style={{ display: "block", marginTop: ".2rem", fontSize: "clamp(1.7rem, 6vw, 2.2rem)", lineHeight: 1.1, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{money(totalPhysicalPending)}</strong>
      <span style={{ display: "block", marginTop: ".35rem", color: "#c5d2e4", fontSize: ".85rem" }}>{physicalPending.length} prêmios físicos ainda não pagos</span>
      <div style={{ marginTop: ".8rem", paddingTop: ".8rem", borderTop: "1px solid rgba(255,255,255,.16)" }}>
        <span style={{ display: "block", color: "#c5d2e4", fontSize: ".8rem" }}>Solicitações Pix aguardando análise</span>
        <strong style={{ display: "block", marginTop: ".2rem", fontSize: "1.25rem", color: "#fff" }}>{money(totalAwaitingAuthorization)}</strong>
        <span style={{ display: "block", color: "#c5d2e4", fontSize: ".8rem" }}>{physicalAwaitingPix.length} solicitações registradas</span>
      </div>
      <div style={{ marginTop: ".8rem", paddingTop: ".8rem", borderTop: "1px solid rgba(255,255,255,.16)" }}>
        <span style={{ display: "block", color: "#c5d2e4", fontSize: ".8rem" }}>Total de todos os prêmios ainda não pagos</span>
        <strong style={{ display: "block", marginTop: ".2rem", fontSize: "1.25rem", color: "#fff" }}>{money(totalPending)}</strong>
        <span style={{ display: "block", color: "#c5d2e4", fontSize: ".8rem" }}>{pending.length} prêmios pendentes; {reviewPending.length} com crédito automático em conferência</span>
      </div>
      <div style={{ marginTop: ".8rem", paddingTop: ".8rem", borderTop: "1px solid rgba(255,255,255,.16)" }}>
        <span style={{ display: "block", color: "#c5d2e4", fontSize: ".8rem" }}>Total de prêmios já pagos</span>
        <strong style={{ display: "block", marginTop: ".2rem", fontSize: "1.25rem", color: "#fff" }}>{money(totalPaid)}</strong>
        <span style={{ display: "block", color: "#c5d2e4", fontSize: ".8rem" }}>{paid.length} prêmios confirmados como pagos</span>
      </div>
    </div>

    <div className="round-options admin-prize-tabs" role="group" aria-label="Filtrar ganhadores">
      <button type="button" className={"admin-prize-tab" + (tab === "pending" ? " is-active" : "")} onClick={() => setTab("pending")}>Pendentes ({pending.length})</button>
      <button type="button" className={"admin-prize-tab" + (tab === "paid" ? " is-active" : "")} onClick={() => setTab("paid")}>Pagos ({paid.length})</button>
      <button type="button" className="admin-prize-refresh" disabled={loading} onClick={() => { setLoading(true); void load(); }}>Atualizar</button>
    </div>

    {error && <p role="alert" className="note-inline">{error}</p>}
    {loading ? <p>Carregando movimentação…</p> : visible.length === 0
      ? <p>{tab === "pending" ? "Nenhum prêmio pendente." : "Nenhum prêmio pago registrado ainda."}</p>
      : <div className="admin-round-list">
        {visible.map((winner) => <article className="round-option admin-prize-card" key={winner.id}>
          <strong>{winner.playerName}</strong>
          <p><strong>Prêmio: {money(winner.prizeCents)}</strong> · Acerto: <strong>{winner.prizeCategoryLabel ?? "Não identificado"}</strong></p>
          <p>Número apostado: <strong>{winner.numberValue}</strong> · Número sorteado: <strong>{winner.resultNumber ?? "Indisponível"}</strong></p>
          <p>Rodada: {winner.roundCode} · Data do sorteio: {dateTime(winner.resultAt)}</p>
          <p>Aposta: <strong>{money(winner.stakeCents)}</strong> · Total da rodada nesta compra: {money(winner.participationTotalCents)} · Total do recibo: {money(winner.purchaseTotalCents)}</p>
          <p>Valor aplicado na modalidade: {winner.categoryStakeCents === null ? "Indisponível" : money(winner.categoryStakeCents)} · Multiplicador: {winner.multiplier === null ? "Indisponível" : winner.multiplier + "x"}</p>
          <p>Recibo: {winner.receiptCode ?? "—"}{winner.cashierName ? " · Cambista: " + winner.cashierName : ""}</p>
          {winner.paymentRequest && <div className="admin-prize-request-details">
            <p><strong>Status da solicitação: {requestStatus(winner.paymentRequest.status)}</strong></p>
            <p>Chave Pix cadastrada: <strong>{winner.paymentRequest.pixKeyMasked}</strong> · Solicitação: {dateTime(winner.paymentRequest.requestedAt)}</p>
            <p>Prêmio bruto: {money(winner.paymentRequest.grossCents)} · Taxa administrativa: {money(winner.paymentRequest.administrativeFeeCents)} · Taxa bancária: {money(winner.paymentRequest.transactionFeeCents)}</p>
            <p><strong>Valor líquido solicitado: {money(winner.paymentRequest.netCents)}</strong></p>
            {winner.paymentRequest.asaasTransferStatus && <p>Status informado pela Asaas: <strong>{winner.paymentRequest.asaasTransferStatus}</strong></p>}
          </div>}
          {winner.paid
            ? <p><strong>{winner.payoutChannel === "WALLET" ? "Crédito na carteira" : winner.payoutChannel === "CASHIER_CASH" ? "Pago em dinheiro pelo cambista" : "Pix pago"}</strong>{winner.paidAt ? " · " + dateTime(winner.paidAt) : ""}{winner.reference ? " · Referência: " + winner.reference : ""}</p>
            : <p><strong>{winner.paymentRequest ? requestStatus(winner.paymentRequest.status) : winner.manualEligible ? "Aguardando solicitação do ganhador" : "Crédito automático em conferência"}</strong></p>}
        </article>)}
      </div>}
  </section>;
}
