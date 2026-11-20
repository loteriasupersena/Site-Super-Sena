"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Item = {
  id: string;
  username: string;
  amountCents: number;
  status: "PENDING" | "APPROVED" | "PROCESSING" | "FAILED";
  pixKey: string | null;
  pixKeyType: string | null;
  pixKeyMasked: string;
};
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function AdminWithdrawalManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const loadController = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setError("");
    try {
      const response = await fetch("/api/admin/withdrawals", { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Falha ao carregar saques.");
      if (!controller.signal.aborted) setItems(body.items);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Falha ao carregar saques.");
    } finally {
      if (loadController.current === controller) {
        loadController.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, 10_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      loadController.current?.abort();
    };
  }, [load, loadVersion]);

  async function copyPixKey(item: Item) {
    if (!item.pixKey) return;
    try {
      await navigator.clipboard.writeText(item.pixKey);
      setCopied(item.id);
      window.setTimeout(() => setCopied((current) => current === item.id ? null : current), 1800);
    } catch {
      setError("Não foi possível copiar a chave Pix.");
    }
  }

  async function confirmPaid(item: Item) {
    if (!window.confirm("Confirma que o Pix de " + money(item.amountCents) + " foi transferido e conferido no banco?")) return;
    setBusy(item.id);
    setError("");
    try {
      const response = await fetch("/api/admin/withdrawals/" + encodeURIComponent(item.id) + "/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar o saque.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao confirmar saque.");
    } finally {
      setBusy(null);
    }
  }

  return <section className="feature-card admin-withdrawal-manager" aria-labelledby="admin-withdrawals-heading">
    <span className="feature-label">CARTEIRA DIGITAL</span>
    <h2 id="admin-withdrawals-heading">Saques ({items.length})</h2>
    {error && <p role="alert" className="note-inline">{error}</p>}
    {loading ? <p>Carregando…</p> : items.length === 0
      ? <p>Nenhum saque pendente.</p>
      : <div className="admin-round-list">
        {items.map((item) => <article className="round-option admin-prize-card" key={item.id}>
          <div className="admin-payment-card-heading">
            <strong>{item.username}</strong>
            <strong>{money(item.amountCents)}</strong>
          </div>
          <p>SAQUE DA CARTEIRA</p>
          <p className="admin-payment-pix">Pix: <strong>{item.pixKey ?? item.pixKeyMasked}</strong></p>
          <div className="admin-payment-actions">
            <button type="button" className="secondary-button" disabled={!item.pixKey} onClick={() => void copyPixKey(item)}>
              {copied === item.id ? "Copiado" : "Copiar Pix"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => void confirmPaid(item)}>
              {busy === item.id ? "Salvando…" : "Confirmar pago"}
            </button>
          </div>
        </article>)}
      </div>}
    <button type="button" className="secondary-button admin-payment-refresh" disabled={loading || busy !== null} onClick={() => { setLoading(true); setLoadVersion((v) => v + 1); }}>Atualizar</button>
  </section>;
}
