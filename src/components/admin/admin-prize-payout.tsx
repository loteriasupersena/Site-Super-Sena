"use client";

import { useCallback, useEffect, useState } from "react";

type Winner = {
  id: string;
  prizeCents: number;
  prizeCategoryLabel: string | null;
  calculationConsistent: boolean;
  roundCode: string;
  receiptCode: string | null;
  playerName: string;
  paid: boolean;
  paymentRequest: {
    status: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED" | "CANCELLED";
    netCents: number;
    pixKey: string | null;
    pixKeyMasked: string;
    pixKeyType: string | null;
  } | null;
};
type Withdrawal = {
  id: string;
  username: string;
  amountCents: number;
  status: "PENDING" | "APPROVED" | "PROCESSING" | "FAILED";
  pixKey: string | null;
  pixKeyType: string | null;
  pixKeyMasked: string;
};
type RequestItem =
  | { kind: "receipt"; id: string; amountCents: number; name: string; status: string; pixKey: string | null; pixKeyMasked: string; receiptCode: string | null; consistent: boolean; source: Winner }
  | { kind: "wallet"; id: string; amountCents: number; name: string; status: string; pixKey: string | null; pixKeyMasked: string; receiptCode: null; consistent: true; source: Withdrawal };

const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(cents / 100);

export function AdminPrizePayout() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [prizesResponse, withdrawalsResponse] = await Promise.all([
        fetch("/api/admin/prizes/pending", { cache: "no-store" }),
        fetch("/api/admin/withdrawals", { cache: "no-store" }),
      ]);
      const [prizesBody, withdrawalsBody] = await Promise.all([
        prizesResponse.json(), withdrawalsResponse.json(),
      ]);
      if (!prizesResponse.ok) throw new Error(prizesBody.error ?? "Falha ao carregar prêmios.");
      if (!withdrawalsResponse.ok) throw new Error(withdrawalsBody.error ?? "Falha ao carregar solicitações da carteira.");
      setWinners(prizesBody.winners as Winner[]);
      setWithdrawals(withdrawalsBody.items as Withdrawal[]);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar solicitações de pagamento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, 10_000);
    return () => { window.clearTimeout(timer); window.clearInterval(poll); };
  }, [load]);

  const requests: RequestItem[] = [
    ...winners.filter(w => !w.paid && w.paymentRequest !== null && ["PENDING", "PROCESSING"].includes(w.paymentRequest.status)).map(w => ({
      kind: "receipt" as const, id: "receipt:" + w.id, amountCents: w.paymentRequest!.netCents,
      name: w.playerName, status: w.paymentRequest!.status, pixKey: w.paymentRequest!.pixKey,
      pixKeyMasked: w.paymentRequest!.pixKeyMasked, receiptCode: w.receiptCode,
      consistent: w.calculationConsistent, source: w,
    })),
    ...withdrawals.map(w => ({
      kind: "wallet" as const, id: "wallet:" + w.id, amountCents: w.amountCents,
      name: w.username, status: w.status, pixKey: w.pixKey, pixKeyMasked: w.pixKeyMasked,
      receiptCode: null, consistent: true as const, source: w,
    })),
  ];

  async function copyPixKey(item: RequestItem) {
    if (!item.pixKey) return;
    try {
      await navigator.clipboard.writeText(item.pixKey);
      setCopied(item.id);
      window.setTimeout(() => setCopied(current => current === item.id ? null : current), 1800);
    } catch {
      setError("Não foi possível copiar a chave Pix.");
    }
  }

  async function confirmPaid(item: RequestItem) {
    if (!window.confirm("Confirma que o Pix de " + money(item.amountCents) + " foi transferido e conferido no banco?")) return;
    setBusy(item.id);
    setError("");
    try {
      const url = item.kind === "receipt"
        ? "/api/admin/prizes/" + encodeURIComponent(item.source.id) + "/payout"
        : "/api/admin/withdrawals/" + encodeURIComponent(item.source.id) + "/transfer";
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar o pagamento.");
      if (item.kind === "receipt") setWinners(current => current.filter(w => w.id !== item.source.id));
      else setWithdrawals(current => current.filter(w => w.id !== item.source.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao confirmar pagamento.");
    } finally {
      setBusy(null);
    }
  }

  return <section className="feature-card admin-prize-payout" aria-labelledby="admin-prize-payout-heading">
    <h2 id="admin-prize-payout-heading">Solicitações de pagamento ({requests.length})</h2>
    {error && <p role="alert" className="note-inline">{error}</p>}
    {loading ? <p>Carregando…</p> : requests.length === 0
      ? <p>Nenhuma solicitação de pagamento pendente.</p>
      : <div className="admin-round-list">
        {requests.map(item => <article className="round-option admin-prize-card" key={item.id}>
          <div className="admin-payment-card-heading">
            <strong>{item.name}</strong>
            <strong>{money(item.amountCents)}</strong>
          </div>
          <p><span className="admin-payment-status">{item.status === "PROCESSING" ? "EM PROCESSAMENTO" : item.status === "FAILED" ? "FALHA NA TRANSFERÊNCIA" : item.status === "APPROVED" ? "APROVADO" : "AGUARDANDO"}</span>
            {" · "}{item.kind === "receipt" ? "Prêmio de recibo" : "Saldo da carteira"}
            {item.receiptCode && <> · {item.receiptCode}</>}
          </p>
          <p className="admin-payment-pix">Pix: <strong>{item.pixKey ?? item.pixKeyMasked}</strong></p>
          {!item.consistent && <p role="alert">Conferência necessária. Pagamento bloqueado.</p>}
          <div className="admin-payment-actions">
            <button type="button" className="secondary-button" disabled={!item.pixKey} onClick={() => void copyPixKey(item)}>
              {copied === item.id ? "Copiado" : "Copiar"}
            </button>
            <button type="button" disabled={busy !== null || !item.consistent} onClick={() => void confirmPaid(item)}>
              {busy === item.id ? "Salvando…" : "Confirmar"}
            </button>
          </div>
        </article>)}
      </div>}
    <button type="button" className="secondary-button admin-payment-refresh" disabled={loading || busy !== null} onClick={() => { setLoading(true); void load(); }}>Atualizar</button>
  </section>;
}
