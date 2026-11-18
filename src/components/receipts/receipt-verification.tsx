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
  manualPayoutEligible?: boolean;
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
  numberValue: string;
  grossCents: number;
  paymentRequest?: VerifiedNumber["paymentRequest"];
  onSubmitted: () => Promise<void>;
};

function PrizePixRequestForm({ receiptCode, participationLineId, numberValue, grossCents, paymentRequest, onSubmitted }: PrizePixRequestFormProps) {
  const [holderName, setHolderName] = useState("");
  const [holderCpf, setHolderCpf] = useState("");
  const [pixKeyType, setPixKeyType] = useState("CPF");
  const [holderConfirmed, setHolderConfirmed] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyConfirmation, setPixKeyConfirmation] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const batch = paymentRequest?.batch ?? null;
  const displayedGross = batch?.grossCents ?? grossCents;
  const adminFee = batch?.administrativeFeeCents ?? (grossCents >= 100000 ? Math.round(grossCents * 0.05) : 0);
  const bankFee = batch?.transactionFeeCents ?? (grossCents >= 100000 ? Math.round(grossCents * 0.05) : 0);
  const displayedNet = batch?.netCents ?? (grossCents - adminFee - bankFee);
  const canSubmit = holderName.trim().length >= 5 && holderCpf.replace(/\D/g, "").length === 11 && pixKey.trim().length >= 3 && pixKey.trim() === pixKeyConfirmation.trim();

  async function submit() {
    setRequesting(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/public/receipt-verification/${encodeURIComponent(receiptCode.toUpperCase())}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participationLineId, holderName, holderCpf, pixKeyType, holderConfirmed, pixKey, pixKeyConfirmation, pixKeyConfirmed: confirmed }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível solicitar o pagamento.");
      setHolderName(""); setHolderCpf(""); setPixKey(""); setPixKeyConfirmation(""); setShowReview(false); setConfirmed(false); setHolderConfirmed(false);
      setMessage(body.status === "PROCESSING"
        ? "Solicitação enviada à Asaas. Aguarde a confirmação do Pix."
        : "Solicitação recebida e encaminhada automaticamente à Asaas. Aguarde a confirmação do Pix.");
      await onSubmitted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao enviar solicitação.");
    } finally { setRequesting(false); }
  }

  return <div style={{ padding: 12, margin: "10px 0", borderRadius: 8, background: "#f3f4f6", border: "1px solid #d1d5db" }}>
    <strong style={{ color: "#111827" }}>{batch ? "Todos os prêmios deste recibo" : numberValue} · Prêmio bruto: {money(displayedGross)}</strong>
    <p style={{ margin: "5px 0", color: "#374151", fontSize: 13 }}>Taxa administrativa {grossCents >= 100000 ? "(5%)" : "(isenta)"}: {money(adminFee)}<br />Taxa de transação bancária {grossCents >= 100000 ? "(5%)" : "(isenta)"}: {money(bankFee)}<br /><strong>Líquido a receber: {money(displayedNet)}</strong></p>
    {grossCents >= 100000 && <p style={{ margin: "8px 0", color: "#92400e", fontWeight: 700 }}>Todos os prêmios físicos elegíveis são enviados automaticamente para pagamento via Pix pela plataforma.</p>}
    {paymentRequest?.status === "REJECTED" && <p style={{ color: "#92400e", fontWeight: 700 }}>Valor liberado pela administração. Você pode solicitar novamente este prêmio.</p>}
    {paymentRequest?.status === "PENDING" ? <p style={{ color: "#92400e", fontWeight: 700 }}>Solicitação recebida · Aguardando processamento automático pela Asaas</p>
      : paymentRequest?.status === "PROCESSING" ? <p style={{ color: "#92400e", fontWeight: 700 }}>Transferência Pix em processamento pela Asaas. Aguarde a confirmação.</p>
      : paymentRequest?.status === "PAID" ? <p style={{ color: "#166534", fontWeight: 700 }}>Prêmio pago via Pix.</p>

      : paymentRequest?.status === "FAILED" || paymentRequest?.status === "CANCELLED" ? <p style={{ color: "#991b1b", fontWeight: 700 }}>A transferência não foi concluída. Entre em contato com o suporte para conferência; não envie outra solicitação enquanto o status não for reconciliado.</p>
      : <form onSubmit={(event) => { event.preventDefault(); setShowReview(true); setConfirmed(false); }}>
        <div style={{ padding: 12, marginBottom: 12, border: "2px solid #b45309", borderRadius: 8, background: "#fffbeb", color: "#78350f" }}><strong>ATENÇÃO: DADOS DO TITULAR DO PIX</strong><p style={{ margin: "6px 0 0", fontWeight: 700 }}>Informe o nome COMPLETO exatamente como aparece no cadastro do CPF e na conta Pix. Não abrevie, não omita sobrenomes e não use dados de outra pessoa. O CPF e a chave Pix devem pertencer ao mesmo titular.</p></div>
        <label style={{ display: "block", margin: "10px 0 5px", color: "#111827", fontWeight: 700 }}>Nome completo do titular (igual ao CPF e ao Pix)</label><input value={holderName} onChange={e => {setHolderName(e.target.value);setShowReview(false);setHolderConfirmed(false);}} maxLength={160} autoComplete="name" required placeholder="Nome completo, sem abreviações" style={{ boxSizing: "border-box", width: "100%", padding: 12, border: "1px solid #9ca3af", borderRadius: 7, fontSize: 16 }} />
        <label style={{ display: "block", margin: "12px 0 5px", color: "#111827", fontWeight: 700 }}>CPF do titular</label><input value={holderCpf} onChange={e => {setHolderCpf(e.target.value);setShowReview(false);setHolderConfirmed(false);}} maxLength={14} inputMode="numeric" autoComplete="off" required placeholder="000.000.000-00" style={{ boxSizing: "border-box", width: "100%", padding: 12, border: "1px solid #9ca3af", borderRadius: 7, fontSize: 16 }} />
        <label style={{ display: "block", margin: "12px 0 5px", color: "#111827", fontWeight: 700 }}>Tipo da chave Pix</label><select value={pixKeyType} onChange={e => {setPixKeyType(e.target.value);setShowReview(false);}} style={{ boxSizing: "border-box", width: "100%", padding: 12, border: "1px solid #9ca3af", borderRadius: 7, fontSize: 16 }}><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option><option value="EMAIL">E-mail</option><option value="PHONE">Telefone</option><option value="EVP">Chave aleatória</option></select>
        <label htmlFor={`pix-key-${participationLineId}`} style={{ display: "block", margin: "10px 0 5px", color: "#111827", fontWeight: 700 }}>Chave Pix do mesmo titular informado acima</label>
        <input id={`pix-key-${participationLineId}`} value={pixKey} onChange={(event) => { setPixKey(event.target.value); setShowReview(false); setConfirmed(false); }} maxLength={200} autoComplete="off" placeholder="CPF, telefone, e-mail ou chave aleatória" style={{ boxSizing: "border-box", width: "100%", padding: 12, border: "1px solid #9ca3af", borderRadius: 7, fontSize: 16 }} />
        <label htmlFor={`pix-key-confirm-${participationLineId}`} style={{ display: "block", margin: "12px 0 5px", color: "#111827", fontWeight: 700 }}>Confirme a chave Pix</label>
        <input id={`pix-key-confirm-${participationLineId}`} value={pixKeyConfirmation} onChange={(event) => { setPixKeyConfirmation(event.target.value); setShowReview(false); setConfirmed(false); }} maxLength={200} autoComplete="off" placeholder="Digite novamente a mesma chave" style={{ boxSizing: "border-box", width: "100%", padding: 12, border: "1px solid #9ca3af", borderRadius: 7, fontSize: 16 }} />
        {pixKeyConfirmation.length > 0 && pixKey.trim() !== pixKeyConfirmation.trim() && <p role="alert" style={{ color: "#991b1b", fontWeight: 700, fontSize: 13 }}>As chaves Pix não coincidem.</p>}
        {!showReview ? <button type="submit" disabled={!canSubmit || requesting} style={{ display: "block", width: "100%", marginTop: 10, padding: 12, border: 0, borderRadius: 8, background: "#166534", color: "#fff", fontWeight: 800 }}>Revisar chave Pix deste prêmio</button>
          : <div style={{ marginTop: 12, padding: 12, border: "2px solid #b45309", borderRadius: 8, background: "#fffbeb" }}>
            <strong style={{ display: "block", color: "#92400e", marginBottom: 8 }}>CONFIRME OS DADOS DO TITULAR E O DESTINO DO PRÊMIO</strong>
            <p style={{color:"#111827"}}><strong>{holderName}</strong><br/>CPF: {holderCpf}<br/>Tipo de chave: {pixKeyType}</p>
            <p style={{ margin: "0 0 8px", color: "#111827", fontWeight: 800, overflowWrap: "anywhere" }}>{pixKey.trim()}</p>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "#111827", fontSize: 13, marginBottom: 12 }}><input type="checkbox" checked={holderConfirmed} onChange={(event) => setHolderConfirmed(event.target.checked)} style={{ marginTop: 2 }} /> Confirmo que o nome está completo e idêntico ao cadastro do CPF e da conta Pix, e que CPF e chave pertencem ao mesmo titular.</label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "#111827", fontSize: 13, marginBottom: 12 }}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} style={{ marginTop: 2 }} /> Confirmo que esta é a chave Pix correta para receber este prêmio.</label>
            <button type="button" onClick={() => void submit()} disabled={!confirmed || !holderConfirmed || requesting} style={{ display: "block", width: "100%", padding: 12, border: 0, borderRadius: 8, background: "#166534", color: "#fff", fontWeight: 800 }}>{requesting ? "Enviando…" : "CONFIRMAR E ENVIAR ESTA SOLICITAÇÃO"}</button>
            <button type="button" onClick={() => { setShowReview(false); setConfirmed(false); }} disabled={requesting} style={{ display: "block", width: "100%", marginTop: 8, padding: 10, border: "1px solid #6b7280", borderRadius: 8, background: "#fff", color: "#111827", fontWeight: 700 }}>Voltar e corrigir</button>
          </div>}
      </form>}
    {error && <p role="alert" style={{ color: "#991b1b", fontWeight: 700 }}>{error}</p>}
    {message && <p role="status" style={{ color: "#166534", fontWeight: 700 }}>{message}</p>}
  </div>;
}

export function ReceiptVerification({ receiptCode }: { receiptCode: string }) {
  const [data, setData] = useState<VerifiedReceipt | null>(null);
  const [loading, setLoading] = useState(true);

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
        <h3 style={{ margin: "0 0 8px", color: "#111827", fontSize: 18 }}>Solicitar recebimento do prêmio</h3>
        <p style={{ margin: "0 0 10px", color: "#374151", fontSize: 14 }}>O recibo gera uma única solicitação Pix com todos os prêmios elegíveis somados. As taxas são calculadas sobre o total do recibo.</p>
        {(() => {
          const eligible = rounds.flatMap(round => round.numbers.filter(number => number.resultStatus === "PREMIADA" && !number.prizePaid));
          const first = eligible[0];
          const batchRequest = eligible.map(number => number.paymentRequest).find(item => item?.batch)?.batch ?? null;
          if (!first) return null;
          return <PrizePixRequestForm
            key={first.participationLineId}
            receiptCode={receiptCode}
            participationLineId={first.participationLineId}
            numberValue={eligible.length + " prêmio(s) agrupado(s)"}
            grossCents={batchRequest?.grossCents ?? eligible.reduce((sum, number) => sum + (number.prizeCents ?? 0), 0)}
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
