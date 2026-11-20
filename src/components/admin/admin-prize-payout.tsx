"use client";

import { useCallback, useEffect, useState } from "react";

type Winner = {
  id: string;
  numberValue: string;
  prizeCents: number;
  stakeCents: number;
  prizeCategory: string | null;
  prizeCategoryLabel: string | null;
  categoryStakeCents: number | null;
  multiplier: number | null;
  calculatedPrizeCents: number | null;
  calculationConsistent: boolean;
  participationTotalCents: number;
  purchaseTotalCents: number;
  roundCode: string;
  resultNumber: string | null;
  resultAt: string;
  receiptCode: string | null;
  playerName: string;
  phone: string | null;
  cashierName: string | null;
  physicalReceiptEligible: boolean;
  paid: boolean;
  payoutChannel: "PLATFORM_PIX" | "CASHIER_CASH" | "WALLET" | null;
  paidAt: string | null;
  reference: string | null;
  paymentRequest: { id: string; status: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED" | "CANCELLED"; netCents: number; pixKey: string | null; pixKeyMasked: string; pixKeyType: string | null; grossCents: number; administrativeFeeCents: number; transactionFeeCents: number } | null;
};

const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(cents / 100);
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
}).format(new Date(value));

export function AdminPrizePayout() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [tab, setTab] = useState<"pending" | "paid">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [references, setReferences] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/prizes/pending", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os ganhadores.");
      setWinners(body.winners as Winner[]);
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

  async function confirmPaid(winner: Winner) {
    if (!winner.paymentRequest || !window.confirm(
      "Confirma que o Pix de " + money(winner.paymentRequest.netCents) +
      " já foi realizado para " + winner.playerName + " e que o comprovante foi conferido?"
    )) return;
    setBusy(winner.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/prizes/" + encodeURIComponent(winner.id) + "/payout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference: references[winner.id]?.trim() || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar o pagamento.");
      setNotice("Pix confirmado e registrado no histórico de pagamentos.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao confirmar o pagamento.");
    } finally { setBusy(""); }
  }

  async function releaseFailed(winner: Winner) {
    if (!winner.paymentRequest || !window.confirm(
      "Liberar a solicitação deste recibo para que o ganhador possa enviar uma nova solicitação? Isso não confirma pagamento."
    )) return;
    setBusy(winner.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/prize-payment-requests/" + encodeURIComponent(winner.paymentRequest.id) + "/release", {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível liberar a solicitação.");
      setNotice("Solicitação liberada. O ganhador poderá pedir o pagamento novamente.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao liberar a solicitação.");
    } finally { setBusy(""); }
  }

  const pending = winners.filter((winner) => !winner.paid);
  const paid = winners.filter((winner) => winner.paid);
  const visible = tab === "pending" ? pending : paid;
  const manualPending = pending.filter((winner) => winner.physicalReceiptEligible && ["PENDING", "PROCESSING"].includes(winner.paymentRequest?.status ?? ""));
  const totalToPayCents = manualPending.reduce((total, winner) => total + (winner.paymentRequest?.netCents ?? 0), 0);
  const allPhysicalPending = pending.filter((winner) => winner.physicalReceiptEligible);
  const totalPhysicalGrossCents = allPhysicalPending.reduce((total, winner) => total + winner.prizeCents, 0);
  const reviewPending = pending.filter((winner) => !winner.physicalReceiptEligible);
  const reviewTotalCents = reviewPending.reduce((total, winner) => total + winner.prizeCents, 0);

  return <section className="feature-card admin-prize-payout" aria-labelledby="admin-prize-payout-heading">
    <span className="feature-label">Central de pagamentos</span>
    <h2 id="admin-prize-payout-heading">Ganhadores</h2>
    <p>Acompanhe as solicitações feitas pelo QR Code do recibo. O pagamento é realizado pelo administrador fora do sistema e só é registrado como pago após a conferência da transferência.</p>

    {tab === "pending" && <div className="admin-prize-total-panel" style={{
      margin: "1rem 0", padding: "1rem 1.1rem", borderRadius: "16px",
      border: "1px solid rgba(66, 211, 242, .55)",
      background: "linear-gradient(135deg, rgba(0, 139, 190, .24), rgba(22, 35, 57, .96))",
      boxShadow: "0 8px 24px rgba(0, 0, 0, .18)",
    }}>
      <span style={{ display: "block", fontSize: ".8rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#62d8f4" }}>
        Pix aguardando pagamento manual
      </span>
      <strong style={{ display: "block", marginTop: ".2rem", fontSize: "clamp(1.7rem, 6vw, 2.2rem)", lineHeight: 1.1, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
        {money(totalToPayCents)}
      </strong>
      <span style={{ display: "block", marginTop: ".35rem", color: "#c5d2e4", fontSize: ".85rem" }}>
        {manualPending.length} {manualPending.length === 1 ? "solicitação aguardando pagamento" : "solicitações aguardando pagamento"}
      </span>
      <div style={{ marginTop: ".8rem", paddingTop: ".8rem", borderTop: "1px solid rgba(255,255,255,.16)" }}>
        <span style={{ display: "block", color: "#c5d2e4", fontSize: ".8rem" }}>Total bruto de prêmios físicos ainda não pagos</span>
        <strong style={{ display: "block", marginTop: ".2rem", fontSize: "1.25rem", color: "#fff" }}>{money(totalPhysicalGrossCents)}</strong>
        <span style={{ display: "block", color: "#c5d2e4", fontSize: ".8rem" }}>{allPhysicalPending.length} prêmios físicos pendentes, incluindo os que ainda aguardam solicitação do ganhador.</span>
      </div>
      {reviewPending.length > 0 && <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,.16)" }}>
        <strong style={{ color: "#ffd27a" }}>Em conferência: {money(reviewTotalCents)}</strong>
        <span style={{ display: "block", marginTop: ".25rem", color: "#c5d2e4" }}>
          {reviewPending.length} {reviewPending.length === 1 ? "prêmio" : "prêmios"} com crédito automático ainda não confirmado. Esses prêmios não exigem autorização de Pix físico.
        </span>
      </div>}
    </div>}

    <details className="admin-accordion admin-prize-history">
      <summary>
        <span>Histórico de premiações ({winners.length})</span>
        <span aria-hidden="true" className="admin-prize-history-count">{pending.length} a pagar · {paid.length} pagos</span>
      </summary>
      <div className="admin-accordion-content">
        <div className="round-options admin-prize-tabs" role="group" aria-label="Filtrar ganhadores">
          <button type="button" className={"admin-prize-tab" + (tab === "pending" ? " is-active" : "")} onClick={() => setTab("pending")}>
            A pagar ({pending.length})
          </button>
          <button type="button" className={"admin-prize-tab" + (tab === "paid" ? " is-active" : "")} onClick={() => setTab("paid")}>
            Já pagos ({paid.length})
          </button>
          <button type="button" className="admin-prize-refresh" disabled={loading} onClick={() => { setLoading(true); setError(""); void load(); }}>
            Atualizar
          </button>
        </div>

        {error && <p role="alert" className="note-inline">{error}</p>}
        {notice && <p role="status" className="note-inline">{notice}</p>}
        {loading ? <p>Carregando ganhadores…</p> : visible.length === 0
          ? <p>{tab === "pending" ? "Nenhum pagamento pendente." : "Nenhum prêmio pago registrado ainda."}</p>
          : <div className="admin-round-list">
            {visible.map((winner) => <article className="round-option admin-prize-card" key={winner.id}>
              <strong>{winner.playerName}</strong>
              <p><strong>Prêmio: {money(winner.prizeCents)}</strong> · Acerto: <strong>{winner.prizeCategoryLabel ?? "Não identificado"}</strong></p>
              <p>Número apostado: <strong>{winner.numberValue}</strong> · Número sorteado: <strong>{winner.resultNumber ?? "Indisponível"}</strong></p>
              <p>Rodada: {winner.roundCode} · Data e horário do sorteio: {dateTime(winner.resultAt)}</p>
              <p>Valor desta aposta: <strong>{money(winner.stakeCents)}</strong> · Total da rodada nesta compra: {money(winner.participationTotalCents)} · Total do recibo: {money(winner.purchaseTotalCents)}</p>
              <p>Valor aplicado em {winner.prizeCategoryLabel ?? "modalidade"}: {winner.categoryStakeCents === null ? "Indisponível" : money(winner.categoryStakeCents)} · Multiplicador registrado: {winner.multiplier === null ? "Indisponível" : winner.multiplier + "x"}</p>
              <p>Recibo: {winner.receiptCode ?? "—"} {winner.cashierName ? " · Cambista: " + winner.cashierName : ""}</p>

              {winner.paymentRequest && <div className="admin-prize-request-details">
                <p><strong>Solicitação Pix: {winner.paymentRequest.status === "PENDING" ? "AGUARDANDO PAGAMENTO" : winner.paymentRequest.status}</strong></p>
                <p>Chave Pix: <strong>{winner.paymentRequest.pixKey ?? winner.paymentRequest.pixKeyMasked}</strong>{winner.paymentRequest.pixKeyType ? " · " + winner.paymentRequest.pixKeyType : ""}</p>
                <p>Bruto: {money(winner.paymentRequest.grossCents)} · Taxa administrativa: {money(winner.paymentRequest.administrativeFeeCents)} · Taxa bancária: {money(winner.paymentRequest.transactionFeeCents)} · Líquido: <strong>{money(winner.paymentRequest.netCents)}</strong></p>
              </div>}
              {!winner.calculationConsistent && <p role="alert" style={{ color: "#ffb4a9", fontWeight: 700 }}>REVISÃO NECESSÁRIA: o prêmio registrado não confere com o recálculo usando o valor apostado e a regra salva. Não efetue o pagamento até investigar.</p>}
              {winner.phone && <p>Telefone: {winner.phone}</p>}
              {winner.paid
                ? <p><strong>{winner.payoutChannel === "WALLET" ? "CRÉDITO NA CARTEIRA" : "PIX PAGO"}</strong>{winner.paidAt ? " · " + dateTime(winner.paidAt) : ""}{winner.reference ? " · Ref.: " + winner.reference : ""}</p>
                : <>
                  {winner.physicalReceiptEligible && ["PENDING", "PROCESSING"].includes(winner.paymentRequest?.status ?? "") ? <>
                    <p><strong>Realize o Pix fora do sistema. Confirme somente depois de verificar no banco que a transferência foi concluída.</strong></p>
                    <label>Referência do comprovante (opcional)
                      <input value={references[winner.id] ?? ""} maxLength={300} onChange={(event) => setReferences((current) => ({ ...current, [winner.id]: event.target.value }))} placeholder="Identificador da transação Pix" />
                    </label>
                    <button type="button" disabled={Boolean(busy) || !winner.calculationConsistent} onClick={() => void confirmPaid(winner)}>
                      {busy === winner.id ? "Registrando…" : "Confirmar Pix pago"}
                    </button>
                  </> : winner.physicalReceiptEligible && ["FAILED", "CANCELLED"].includes(winner.paymentRequest?.status ?? "") ? <>
                    <p role="alert">Solicitação com falha ou cancelamento. Confira se não houve transferência bancária antes de liberar uma nova solicitação.</p>
                    <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => void releaseFailed(winner)}>
                      {busy === winner.id ? "Liberando…" : "Liberar para nova solicitação"}
                    </button>
                  </> : winner.physicalReceiptEligible ? <p>Aguardando solicitação do ganhador.</p> : <p role="alert">Crédito automático ainda não confirmado.</p>}
                </>}
            </article>)}
          </div>}
      </div>
    </details>
  </section>;
}
