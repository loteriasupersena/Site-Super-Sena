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
  manualEligible: boolean;
  paid: boolean;
  payoutChannel: "PLATFORM_PIX" | "CASHIER_CASH" | "WALLET" | null;
  paidAt: string | null;
  reference: string | null;
  paymentRequest: { id: string; status: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED" | "CANCELLED"; pixKeyMasked: string; pixKey: string | null; pixKeyType: string | null; holderName: string | null; holderCpf: string | null; holderCpfMasked: string | null; asaasTransferId: string | null; asaasTransferStatus: string | null; asaasTransferReceiptUrl: string | null; asaasTransferFailureReason: string | null; grossCents: number; administrativeFeeCents: number; transactionFeeCents: number; netCents: number; requestedAt: string; paymentReference: string | null } | null;
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
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
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

  async function sendAsaasPix(winner: Winner) {
    if (!winner.paymentRequest || !window.confirm(
      "Autorizar envio de " + money(winner.paymentRequest.netCents) +
      " via Asaas para " + (winner.paymentRequest.holderName ?? winner.playerName) +
      "? O prêmio só será marcado como pago após a confirmação da Asaas."
    )) return;

    setBusy(winner.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/prize-payment-requests/" + encodeURIComponent(winner.paymentRequest.id) + "/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok && response.status !== 202) throw new Error(body.error ?? "Não foi possível iniciar a transferência.");
      setWinners((current) => current.map((item) => item.id === winner.id && item.paymentRequest
        ? { ...item, paymentRequest: { ...item.paymentRequest, status: "PROCESSING", pixKey: null, holderName: null, holderCpf: null, asaasTransferStatus: "PROCESSING" } }
        : item));
      setNotice(body.message ?? body.error ?? "Transferência enviada para conciliação. Aguarde o webhook da Asaas.");
      void load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao iniciar transferência Asaas.");
    } finally {
      setBusy("");
    }
  }

  async function releaseRequest(winner: Winner) {
    if (!winner.paymentRequest || !window.confirm("Liberar o valor reservado deste prêmio? O ganhador poderá solicitar novamente quando desejar.")) return;
    setBusy(winner.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/prize-payment-requests/" + encodeURIComponent(winner.paymentRequest.id) + "/release", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível liberar o valor.");
      setWinners((current) => current.map((item) => item.id === winner.id && item.paymentRequest
        ? { ...item, paymentRequest: { ...item.paymentRequest, status: "REJECTED", pixKey: null } }
        : item));
      setNotice("Valor liberado. O ganhador poderá enviar uma nova solicitação.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao liberar valor."); }
    finally { setBusy(""); }
  }

  const pending = winners.filter((winner) => !winner.paid);
  const paid = winners.filter((winner) => winner.paid);
  const visible = tab === "pending" ? pending : paid;
  // Only physical cashier prizes with a pending request require an outgoing Pix from the administrator.
  const manualPending = pending.filter((winner) => winner.manualEligible && ["PENDING", "FAILED", "CANCELLED"].includes(winner.paymentRequest?.status ?? ""));
  const totalToPayCents = manualPending.reduce((total, winner) => total + (winner.paymentRequest?.netCents ?? 0), 0);
  const allPhysicalPending = pending.filter((winner) => winner.manualEligible);
  const totalPhysicalGrossCents = allPhysicalPending.reduce((total, winner) => total + winner.prizeCents, 0);
  const reviewPending = pending.filter((winner) => !winner.manualEligible);
  const reviewTotalCents = reviewPending.reduce((total, winner) => total + winner.prizeCents, 0);

  return <section className="feature-card admin-prize-payout" aria-labelledby="admin-prize-payout-heading">
    <span className="feature-label">Central de pagamentos</span>
    <h2 id="admin-prize-payout-heading">Ganhadores</h2>
    <p>Acompanhe todos os prêmios e processe somente solicitações enviadas pelo ganhador na consulta do QR Code do recibo. A confirmação deve ocorrer depois que o Pix estiver concluído.</p>

    {tab === "pending" && <div className="admin-prize-total-panel" style={{
      margin: "1rem 0", padding: "1rem 1.1rem", borderRadius: "16px",
      border: "1px solid rgba(66, 211, 242, .55)",
      background: "linear-gradient(135deg, rgba(0, 139, 190, .24), rgba(22, 35, 57, .96))",
      boxShadow: "0 8px 24px rgba(0, 0, 0, .18)",
    }}>
      <span style={{ display: "block", fontSize: ".8rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#62d8f4" }}>
        Pix físicos aguardando autorização
      </span>
      <strong style={{ display: "block", marginTop: ".2rem", fontSize: "clamp(1.7rem, 6vw, 2.2rem)", lineHeight: 1.1, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
        {money(totalToPayCents)}
      </strong>
      <span style={{ display: "block", marginTop: ".35rem", color: "#c5d2e4", fontSize: ".85rem" }}>
        {manualPending.length} {manualPending.length === 1 ? "solicitação aguardando autorização" : "solicitações aguardando autorização"}
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
          {winner.paymentRequest && <div className="admin-prize-request-details"><p><strong>Solicitação Pix: {winner.paymentRequest.status === "PENDING" ? "AGUARDANDO ANÁLISE" : winner.paymentRequest.status === "PROCESSING" ? "TRANSFERÊNCIA EM PROCESSAMENTO" : winner.paymentRequest.status === "PAID" ? "PAGA" : winner.paymentRequest.status === "FAILED" ? "FALHA NA TRANSFERÊNCIA" : winner.paymentRequest.status === "CANCELLED" ? "TRANSFERÊNCIA CANCELADA" : "VALOR LIBERADO"}</strong></p><p>Beneficiário: <strong>{winner.paymentRequest.holderName ?? "—"}</strong> · CPF: <strong>{winner.paymentRequest.holderCpf ?? winner.paymentRequest.holderCpfMasked ?? "—"}</strong></p><p>Tipo da chave: <strong>{winner.paymentRequest.pixKeyType ?? "—"}</strong> · Chave Pix: <strong>{winner.paymentRequest.pixKey ?? winner.paymentRequest.pixKeyMasked}</strong> <button type="button" className="admin-prize-refresh" disabled={!winner.paymentRequest.pixKey} onClick={() => { if (winner.paymentRequest?.pixKey) void navigator.clipboard.writeText(winner.paymentRequest.pixKey); }}>Copiar chave Pix</button> · Solicitada: {dateTime(winner.paymentRequest.requestedAt)}</p>{winner.paymentRequest.asaasTransferId && <p>Transferência Asaas: <strong>{winner.paymentRequest.asaasTransferId}</strong> · {winner.paymentRequest.asaasTransferStatus ?? ""}</p>}{winner.paymentRequest.asaasTransferFailureReason && <p role="alert">Motivo informado: {winner.paymentRequest.asaasTransferFailureReason}</p>}{winner.paymentRequest.asaasTransferReceiptUrl && <p><a href={winner.paymentRequest.asaasTransferReceiptUrl} target="_blank" rel="noreferrer">Abrir comprovante Asaas</a></p>}<p>Prêmio bruto: {money(winner.paymentRequest.grossCents)}</p><p>Taxa administrativa: {money(winner.paymentRequest.administrativeFeeCents)} · Taxa bancária: {money(winner.paymentRequest.transactionFeeCents)}</p><p style={{ fontSize: "1.1rem", fontWeight: 800 }}>TOTAL LÍQUIDO A PAGAR: {money(winner.paymentRequest.netCents)}</p></div>}
          {!winner.calculationConsistent && <p role="alert" style={{ color: "#ffb4a9", fontWeight: 700 }}>REVISÃO NECESSÁRIA: o prêmio registrado não confere com o recálculo usando o valor apostado e a regra salva. Não efetue o pagamento até investigar.</p>}
          {winner.phone && <p>Telefone: {winner.phone}</p>}
          {winner.paid
            ? <p><strong>{winner.payoutChannel === "WALLET" ? "CRÉDITO NA CARTEIRA" : "PIX PAGO"}</strong>{winner.paidAt ? " · " + dateTime(winner.paidAt) : ""}{winner.reference ? " · Ref.: " + winner.reference : ""}</p>
            : <>
              {winner.manualEligible && winner.paymentRequest?.status === "PENDING" ? <>
                <div className="admin-prize-confirm-actions">
                  <button className="admin-prize-confirm" type="button" disabled={Boolean(busy) || !winner.calculationConsistent} onClick={() => void sendAsaasPix(winner)}>
                    {busy === winner.id ? "Enviando à Asaas…" : winner.calculationConsistent ? "Autorizar Pix pela Asaas" : "Pagamento bloqueado — conferir cálculo"}
                  </button>
                  <button type="button" className="admin-prize-refresh" disabled={Boolean(busy)} onClick={() => void releaseRequest(winner)}>Liberar valor</button>
                </div>
              </> : winner.manualEligible && winner.paymentRequest?.status === "PROCESSING" ? <p><strong>Transferência em processamento na Asaas.</strong> O prêmio ainda não está marcado como pago. Aguarde a confirmação do webhook.</p> : winner.manualEligible && ["FAILED", "CANCELLED"].includes(winner.paymentRequest?.status ?? "") ? <div><p role="alert">A transferência não foi concluída. Libere o valor para permitir que o ganhador cadastre novamente os dados Pix.</p><button type="button" className="admin-prize-refresh" disabled={Boolean(busy)} onClick={() => void releaseRequest(winner)}>Liberar valor e permitir nova solicitação</button></div> : winner.manualEligible ? <p>A autorização para envio à Asaas ficará disponível após o ganhador solicitar o Pix pelo recibo.</p> : <p role="alert">Crédito automático ainda não confirmado. Conferir este prêmio.</p>}
            </>}
        </article>)}
      </div>}
  </section>;
}
