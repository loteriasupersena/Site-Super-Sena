"use client";

import { useEffect, useState } from "react";

type VerifiedNumber = { participationLineId: string; numberValue: string; resultStatus: "AGUARDANDO" | "PREMIADA" | "NAO_PREMIADA" | "AGUARDANDO_APURACAO"; prizeCents: number | null; prizePaid: boolean; paidAt?: string | null; payoutChannel?: "PLATFORM_PIX" | "CASHIER_CASH" | null; paymentRequest?: { status: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED" | "CANCELLED"; grossCents: number; administrativeFeeCents: number; transactionFeeCents: number; netCents: number; pixKeyMasked: string; batch?: { id: string; status: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED" | "CANCELLED"; grossCents: number; administrativeFeeCents: number; transactionFeeCents: number; netCents: number } | null } | null };

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
  physicalReceiptEligible?: boolean;
  rounds?: VerifiedRound[];
  message: string;
};

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

type PrizePixRequestFormProps = {
  receiptCode: string;
  participationLineId: string;
  paymentRequest?: VerifiedNumber["paymentRequest"];
  onSubmitted: () => Promise<void>;
};

function PrizePixRequestForm({ receiptCode, participationLineId, paymentRequest, onSubmitted }: PrizePixRequestFormProps) {
  const [pixKeyType, setPixKeyType] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
 
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequesting(true);
    setError("");
    try {
      const response = await fetch(`/api/public/receipt-verification/${encodeURIComponent(receiptCode.toUpperCase())}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participationLineId, pixKeyType, pixKey: pixKey.trim(), pixKeyConfirmed: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível solicitar o pagamento.");
      setPixKey("");
      await onSubmitted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível realizar a transferência neste momento. Tente novamente mais tarde.");
      // Refresh the QR receipt after a rejected Pix attempt so the released prize
      // and the retry form are visible immediately instead of leaving stale PROCESSING UI.
      try { await onSubmitted(); } catch { /* The next automatic receipt refresh can recover the view. */ }
    } finally {
      setRequesting(false);
    }
  }

  return <div style={{ margin: "8px 0" }}>
    {paymentRequest?.status === "REJECTED" && <p role="alert" style={{ color: "#92400e", fontWeight: 700 }}>A transferência anterior não foi concluída. Seu prêmio continua disponível. Informe sua chave Pix para solicitar novamente.</p>}
    {paymentRequest?.status === "PENDING" ? <p role="status" style={{ color: "#92400e", fontWeight: 700 }}>Solicitação recebida. O pagamento será realizado e confirmado pela administração.</p> : paymentRequest?.status === "PROCESSING" ? <p role="status" style={{ color: "#92400e", fontWeight: 700 }}>Pagamento em processamento. Aguarde a atualização do status antes de enviar outra solicitação.</p>
      : paymentRequest?.status === "PAID" ? <p role="status" style={{ color: "#166534", fontWeight: 700 }}>Prêmio pago com sucesso via Pix.</p>
      : paymentRequest?.status === "FAILED" || paymentRequest?.status === "CANCELLED"
        ? <p role="alert" style={{ color: "#92400e", fontWeight: 700 }}>A solicitação anterior precisa ser conferida pela administração. Após a liberação, você poderá enviar uma nova solicitação.</p>
      : <>
      <form onSubmit={submit}>
        <label style={{ display: "block", margin: "10px 0 5px", color: "#111827", fontWeight: 700 }}>Tipo da chave Pix</label>
        <select required value={pixKeyType} onChange={event => setPixKeyType(event.target.value)} style={{ boxSizing: "border-box", width: "100%", minHeight: 54, padding: 12, border: "2px solid #64748b", borderRadius: 8, fontSize: 16, fontWeight: 700, background: "#fff", color: "#111827" }}>
          <option value="" disabled>Informe o tipo de chave Pix</option><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option><option value="EMAIL">E-mail</option><option value="PHONE">Telefone</option><option value="EVP">Chave aleatória</option>
        </select>
        <label htmlFor={`prize-pix-key-${participationLineId}`} style={{ display: "block", margin: "12px 0 5px", color: "#111827", fontWeight: 700 }}>Chave Pix</label>
        <input id={`prize-pix-key-${participationLineId}`} value={pixKey} onChange={event => setPixKey(event.target.value)} maxLength={200} autoComplete="off" required placeholder="Informe sua chave Pix" style={{ boxSizing: "border-box", width: "100%", minHeight: 54, padding: 12, border: "2px solid #64748b", borderRadius: 8, fontSize: 16, fontWeight: 700, background: "#fff", color: "#111827", colorScheme: "light" }} />
        <button type="submit" disabled={pixKey.trim().length < 3 || requesting} style={{ display: "block", width: "100%", marginTop: 12, padding: 14, border: 0, borderRadius: 8, background: "#166534", color: "#fff", fontWeight: 800 }}>{requesting ? "Enviando…" : "Solicitar recebimento do prêmio"}</button>
      </form>
      </>}
    {error && <p role="alert" style={{ color: "#991b1b", fontWeight: 700 }}>{error}</p>}
  </div>;
}

export function ReceiptVerification({ receiptCode }: { receiptCode: string }) {
  const [data, setData] = useState<VerifiedReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const hasProcessingPrize = Boolean(data?.rounds?.some(round =>
    round.numbers.some(number => number.paymentRequest?.status === "PENDING" || number.paymentRequest?.status === "PROCESSING")
  ));

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
    }, hasProcessingPrize ? 15_000 : 30_000);
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
  }, [receiptCode, hasProcessingPrize]);

  if (loading) return <p role="status" style={{ color: "#111827", fontWeight: 700 }}>Consultando recibo…</p>;
  if (!data) return <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>Não foi possível consultar o recibo.</p>;

  const rounds = data.valid ? data.rounds ?? [] : [];
  const physicalReceipt = Boolean(data.physicalReceiptEligible);
  const hasAvailablePrize = physicalReceipt && rounds.some((round) => round.numbers.some((number) => number.resultStatus === "PREMIADA" && !number.prizePaid));
  const hasPaidPrize = rounds.some((round) => round.numbers.some((number) => number.prizePaid));
  const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
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
                      const status = number.resultStatus === "PREMIADA" ? (number.prizePaid ? "PRÊMIO PAGO" : "PRÊMIO DISPONÍVEL")
                        : number.resultStatus === "NAO_PREMIADA" ? "Não premiada"
                          : number.resultStatus === "AGUARDANDO_APURACAO" ? "Aguardando apuração"
                            : round.status === "RODADA_CANCELADA" ? "Rodada cancelada" : round.status === "SORTEIO_AGUARDANDO" ? "Aguardando sorteio" : "Aguardando resultado";
                      const color = number.resultStatus === "PREMIADA" ? "#166534" : number.resultStatus === "NAO_PREMIADA" ? "#991b1b" : "#1d4ed8";
                      return <div key={round.roundCode + number.numberValue + index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 10px", borderRadius: 6, background: "#f3f4f6", border: "1px solid #d1d5db" }}>
                        <strong style={{ color: "#111827", fontSize: 18, letterSpacing: "0.1em" }}>{number.numberValue}</strong>
                        <div style={{ textAlign: "right" }}><span style={{ display: "block", color, fontWeight: 800, fontSize: 14 }}>{status}</span>{number.prizePaid && number.paidAt && <span style={{ display: "block", marginTop: 2, color: "#4b5563", fontSize: 12 }}>Pago em {formatDate(number.paidAt)}</span>}</div>
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
        {(() => {
          const eligible = rounds.flatMap(round => round.numbers.filter(number => number.resultStatus === "PREMIADA" && !number.prizePaid));
          const first = eligible[0];
          if (!first) return null;
          return <PrizePixRequestForm
            key={first.participationLineId}
            receiptCode={receiptCode}
            participationLineId={first.participationLineId}
            paymentRequest={first.paymentRequest}
            onSubmitted={async () => {
              const refresh = await fetch(`/api/public/receipt-verification/${encodeURIComponent(receiptCode.toUpperCase())}`, { cache: "no-store" });
              if (refresh.ok) setData(await refresh.json() as VerifiedReceipt);
            }}
          />;
        })()}
      </div>}
      {hasPaidPrize && <details style={{ marginTop: 14, textAlign: "center" }}>
        <summary style={{ display: "inline-block", color: "#1d4ed8", fontSize: 13, fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>Saiba mais sobre pagamentos de prêmios</summary>
        <div style={{ marginTop: 9, padding: 12, border: "1px solid #d1d5db", borderRadius: 7, background: "#f9fafb", color: "#374151", textAlign: "left", fontSize: 13, lineHeight: 1.5 }}>
          <strong style={{ display: "block", marginBottom: 5, color: "#111827" }}>Sobre pagamentos de prêmios</strong>
          Quando um prêmio é pago, a plataforma registra a conclusão do pagamento, incluindo a data, o horário e o responsável pela confirmação.
          <br /><br />
          Após a conclusão, o resgate daquele prêmio é encerrado e não será aceita uma nova solicitação de pagamento para o mesmo bilhete.
          <br /><br />
          Eventuais questionamentos serão tratados nos casos em que houver obrigação legal de análise ou determinação de autoridade competente.
        </div>
      </details>}
      <p style={{ margin: "14px 0 0", color: "#6b7280", fontSize: 12, textAlign: "center" }}>Super Sena · loteriasupersena.com.br</p>
    </section>
  );
}
