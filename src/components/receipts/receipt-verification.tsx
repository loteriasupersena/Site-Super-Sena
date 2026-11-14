"use client";

import { useEffect, useState } from "react";

type VerifiedNumber = { numberValue: string; resultStatus: "AGUARDANDO" | "PREMIADA" | "NAO_PREMIADA" | "AGUARDANDO_APURACAO"; prizeCents: number | null; prizePaid: boolean; payoutChannel?: "PLATFORM_PIX" | "CASHIER_CASH" | null; paymentRequest?: { status: "PENDING" | "PAID" | "REJECTED"; grossCents: number; administrativeFeeCents: number; transactionFeeCents: number; netCents: number; pixKeyMasked: string } | null };

type VerifiedRound = {
  resultNumber: string | null;
  numbers: VerifiedNumber[];
  roundCode: string;
  status: "RODADA_CANCELADA" | "RESULTADO_PUBLICADO" | "SORTEIO_AGUARDANDO" | "AGUARDANDO_RESULTADO_OFICIAL";
  startsAt: string;
  resultAt: string;
};

type VerifiedReceipt = {
  valid: boolean;
  receiptCode?: string;
  status?: string;
  paymentMethod?: string;
  totalCents?: number;
  currency?: string;
  confirmedAt?: string | null;
  manualPayoutEligible?: boolean;
  rounds?: VerifiedRound[];
  message: string;
};

const prizeSupportWhatsapp = (process.env.NEXT_PUBLIC_PRIZE_SUPPORT_WHATSAPP || "5577991601217").replace(/\D/g, "");
const prizeSupportUrl = `https://wa.me/${prizeSupportWhatsapp}`;

const roundStatusLabels: Record<VerifiedRound["status"], string> = {
  SORTEIO_AGUARDANDO: "Aguardando sorteio",
  AGUARDANDO_RESULTADO_OFICIAL: "Aguardando resultado",
  RESULTADO_PUBLICADO: "Publicado",
  RODADA_CANCELADA: "Cancelada",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function ReceiptVerification({ receiptCode }: { receiptCode: string }) {
  const [data, setData] = useState<VerifiedReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [pixKey, setPixKey] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    let active = true;
    let requestController: AbortController | null = null;

    async function verify() {
      requestController?.abort();
      const controller = new AbortController();
      requestController = controller;
      try {
        const response = await fetch(
          `/api/public/receipt-verification/${encodeURIComponent(receiptCode)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json() as VerifiedReceipt;
        if (active && !controller.signal.aborted) setData(body);
      } catch {
        if (active && !controller.signal.aborted) {
          setData({ valid: false, message: "Não foi possível consultar. Tente novamente." });
        }
      } finally {
        if (active && !controller.signal.aborted) setLoading(false);
      }
    }

    void verify();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void verify();
    }, 30_000);
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void verify();
    };
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      active = false;
      requestController?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [receiptCode]);

  if (loading) return <p role="status" style={{ color: "#111827", fontWeight: 700 }}>Consultando recibo…</p>;
  if (!data) return <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>Não foi possível consultar o recibo.</p>;

  const rounds = data.valid ? data.rounds ?? [] : [];
  const physicalReceipt = Boolean(data.manualPayoutEligible);
  const hasAvailablePrize = physicalReceipt && rounds.some((round) => round.numbers.some((number) => number.resultStatus === "PREMIADA" && !number.prizePaid));
  const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  async function requestPrizePayment() {
    setRequesting(true); setRequestError(""); setRequestMessage("");
    try {
      const response = await fetch(`/api/public/receipt-verification/${encodeURIComponent(data.receiptCode ?? receiptCode.toUpperCase())}/request`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pixKey }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível solicitar o pagamento.");
      setRequestMessage("Solicitação enviada à plataforma. Aguarde a análise do administrador.");
      setPixKey("");
      const refresh = await fetch(`/api/public/receipt-verification/${encodeURIComponent(data.receiptCode ?? receiptCode.toUpperCase())}`, { cache: "no-store" });
      if (refresh.ok) setData(await refresh.json() as VerifiedReceipt);
    } catch (reason) { setRequestError(reason instanceof Error ? reason.message : "Falha ao enviar solicitação."); }
    finally { setRequesting(false); }
  }

  return (
    <section aria-live="polite" style={{ border: "2px solid #9ca3af", borderRadius: 10, padding: 16, background: "#ffffff", color: "#111827", fontSize: 16, lineHeight: 1.5 }}>
      <div style={{ padding: "13px 10px", borderRadius: 7, background: "#92400e", color: "#ffffff", textAlign: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "0.02em" }}>RESULTADOS</h2>
      </div>
      {!data.valid && <p role="alert" style={{ color: "#991b1b", fontWeight: 700 }}>{data.message}</p>}
      <p style={{ margin: "0 0 8px", fontSize: 16, color: "#111827" }}><strong>Recibo:</strong> {data.receiptCode ?? receiptCode.toUpperCase()}</p>

      {data.valid && (
        <>
          <h3 style={{ margin: "0 0 10px", fontSize: 19, color: "#111827", fontWeight: 800 }}>Resultados</h3>
          {rounds.length ? rounds.map((round) => (
            <article key={round.roundCode} style={{ border: "1px solid #9ca3af", borderRadius: 8, padding: 13, marginTop: 10, background: "#ffffff", color: "#111827" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <strong style={{ fontSize: 17, color: "#111827" }}>{round.roundCode}</strong>
                <span style={{
                  display: "inline-block",
                  borderRadius: 5,
                  padding: "3px 8px",
                  fontSize: 14,
                  fontWeight: 800,
                  color: round.status === "RESULTADO_PUBLICADO" ? "#166534" : round.status === "RODADA_CANCELADA" ? "#991b1b" : "#854d0e",
                  background: round.status === "RESULTADO_PUBLICADO" ? "#dcfce7" : round.status === "RODADA_CANCELADA" ? "#fee2e2" : "#fef3c7",
                }}>{roundStatusLabels[round.status]}</span>
              </div>
              <p style={{ margin: "0 0 10px", color: "#374151", fontSize: 14 }}><strong>Horário:</strong> {formatDate(round.resultAt)}</p>
              {round.status === "RESULTADO_PUBLICADO" && (
                <div>
                  <strong style={{ display: "block", fontSize: 13, color: "#374151", marginBottom: 4 }}>Número sorteado</strong>
                  <div style={{ padding: "12px 8px", border: "2px solid #6b7280", borderRadius: 6, textAlign: "center", fontSize: 28, letterSpacing: "0.16em", color: "#111827", fontWeight: 900, background: "#f9fafb" }}>{round.resultNumber ?? "—"}</div>
                </div>
              )}
              {round.numbers.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong style={{ display: "block", color: "#111827", marginBottom: 6 }}>Seus números</strong>
                  <div style={{ display: "grid", gap: 6 }}>
                    {round.numbers.map((number, index) => {
                      const status = number.resultStatus === "PREMIADA" ? (number.prizePaid ? number.payoutChannel === "CASHIER_CASH" ? "PRÊMIO PAGO — dinheiro pelo cambista" : number.payoutChannel === "PLATFORM_PIX" ? "PRÊMIO PAGO — Pix pela plataforma" : "Prêmio creditado na carteira" : "PRÊMIO DISPONÍVEL")
                        : number.resultStatus === "NAO_PREMIADA" ? "Não premiada"
                          : number.resultStatus === "AGUARDANDO_APURACAO" ? "Aguardando apuração"
                            : round.status === "RODADA_CANCELADA" ? "Rodada cancelada" : round.status === "SORTEIO_AGUARDANDO" ? "Aguardando sorteio" : "Aguardando resultado";
                      const color = number.resultStatus === "PREMIADA" ? "#166534" : number.resultStatus === "NAO_PREMIADA" ? "#991b1b" : "#1d4ed8";
                      return <div key={round.roundCode + number.numberValue + index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 10px", borderRadius: 6, background: "#f3f4f6", border: "1px solid #d1d5db" }}>
                        <strong style={{ color: "#111827", fontSize: 18, letterSpacing: "0.1em" }}>{number.numberValue}</strong>
                        <span style={{ color, fontWeight: 800, fontSize: 14 }}>{status}</span>
                      </div>;
                    })}
                  </div>
                </div>
              )}
            </article>
          )) : <p style={{ color: "#374151" }}>Nenhuma rodada confirmada para este recibo.</p>}
        </>
      )}
      {hasAvailablePrize && <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #d1d5db" }}>
        <h3 style={{ margin: "0 0 8px", color: "#111827", fontSize: 18 }}>Solicitar recebimento do prêmio</h3>
        <p style={{ margin: "0 0 10px", color: "#374151", fontSize: 14 }}>Informe uma chave Pix para este recibo. A solicitação será enviada à plataforma para conferência e pagamento pelo administrador.</p>
        {rounds.flatMap((round) => round.numbers.filter((number) => number.resultStatus === "PREMIADA" && !number.prizePaid).map((number) => {
          const gross = number.prizeCents ?? 0;
          const adminFee = gross >= 100000 ? Math.round(gross * 0.05) : 0;
          const bankFee = gross >= 100000 ? Math.round(gross * 0.05) : 0;
          const request = number.paymentRequest;
          return <div key={round.roundCode + number.numberValue} style={{ padding: 10, margin: "8px 0", borderRadius: 7, background: "#f3f4f6", border: "1px solid #d1d5db" }}>
            <strong style={{ color: "#111827" }}>{number.numberValue} · Prêmio bruto: {money(gross)}</strong>
            <p style={{ margin: "5px 0", color: "#374151", fontSize: 13 }}>Taxa administrativa {gross >= 100000 ? "(5%)" : "(isenta)"}: {money(adminFee)}<br />Taxa de transação bancária {gross >= 100000 ? "(5%)" : "(isenta)"}: {money(bankFee)}<br /><strong>Líquido a receber: {money(gross - adminFee - bankFee)}</strong></p>
            {request?.status === "PENDING" && <p style={{ color: "#92400e", fontWeight: 700 }}>Solicitação recebida · Em análise</p>}
            {request?.status === "REJECTED" && <p style={{ color: "#991b1b", fontWeight: 700 }}>Solicitação recusada · Você pode enviar novamente</p>}
          </div>;
        }))}
        {requestError && <p role="alert" style={{ color: "#991b1b", fontWeight: 700 }}>{requestError}</p>}
        {requestMessage && <p role="status" style={{ color: "#166534", fontWeight: 700 }}>{requestMessage}</p>}
        <label htmlFor="receipt-prize-pix-key" style={{ display: "block", margin: "10px 0 5px", color: "#111827", fontWeight: 700 }}>Sua chave Pix</label>
        <input id="receipt-prize-pix-key" value={pixKey} onChange={(event) => setPixKey(event.target.value)} maxLength={200} autoComplete="off" placeholder="CPF, telefone, e-mail ou chave aleatória" style={{ boxSizing: "border-box", width: "100%", padding: 12, border: "1px solid #9ca3af", borderRadius: 7, fontSize: 16 }} />
        <button type="button" onClick={() => void requestPrizePayment()} disabled={requesting || pixKey.trim().length < 3 || rounds.some((round) => round.numbers.some((number) => number.paymentRequest?.status === "PENDING"))} style={{ display: "block", width: "100%", marginTop: 10, padding: 13, border: 0, borderRadius: 8, background: "#166534", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>{requesting ? "Enviando solicitação…" : "Solicitar pagamento do prêmio"}</button>
      </div>}
      <p style={{ margin: "14px 0 0", color: "#6b7280", fontSize: 12, textAlign: "center" }}>Super Sena · loteriasupersena.com.br</p>
    </section>
  );
}
