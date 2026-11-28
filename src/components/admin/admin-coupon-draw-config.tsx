"use client";

import { useEffect, useState } from "react";

type Config = { batchSize: number; winnersPerBatch: number; version: number; updatedAt: string };
type ActiveBatch = { sequenceNumber: number; batchSize: number; winnersPerBatch: number; ruleVersion: number; issuedCoupons: number };

export function AdminCouponDrawConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [activeBatch, setActiveBatch] = useState<ActiveBatch | null>(null);
  const [batchSize, setBatchSize] = useState("100");
  const [winnersPerBatch, setWinnersPerBatch] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/admin/coupon-draw-config", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar a regra.");
    setConfig(body.config);
    setActiveBatch(body.activeBatch);
    setBatchSize(String(body.config.batchSize));
    setWinnersPerBatch(String(body.config.winnersPerBatch));
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/coupon-draw-config", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar a regra.");
        if (active) {
          setConfig(body.config);
          setActiveBatch(body.activeBatch);
          setBatchSize(String(body.config.batchSize));
          setWinnersPerBatch(String(body.config.winnersPerBatch));
        }
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Falha ao carregar a regra."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const size = Number(batchSize);
    const winners = Number(winnersPerBatch);
    if (!Number.isSafeInteger(size) || !Number.isSafeInteger(winners) || size < 1 || size > 100000 || winners < 1 || winners > size) {
      setError("Use números inteiros: lotes de 1 a 100.000 cupons e ganhadores de 1 até o tamanho do lote.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/coupon-draw-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchSize: size, winnersPerBatch: winners }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar a regra.");
      setConfig(body.config);
      setNotice(body.message ?? "Regra salva.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao salvar a regra.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="feature-card" aria-labelledby="admin-coupon-draw-heading">
    <span className="feature-label">Promoção de cupons</span>
    <h2 id="admin-coupon-draw-heading">Regras dos lotes e ganhadores</h2>
    <p>Defina quantos cupons completam cada lote e quantos ganhadores serão sorteados. Os ganhadores são distintos e escolhidos sem repetição.</p>
    {loading ? <p>Carregando configuração…</p> : <form className="admin-round-create" onSubmit={save}>
      <label>Cupons por lote
        <input type="number" min="1" max="100000" step="1" required value={batchSize} disabled={saving} onChange={(event) => setBatchSize(event.target.value)} />
      </label>
      <label>Ganhadores por lote
        <input type="number" min="1" max="100000" step="1" required value={winnersPerBatch} disabled={saving} onChange={(event) => setWinnersPerBatch(event.target.value)} />
      </label>
      <div className="round-actions">
        <button type="submit" disabled={saving || loading}>{saving ? "Salvando…" : "Salvar regra para o próximo lote"}</button>
      </div>
    </form>}
    {activeBatch && <p className="note-inline">Lote atual #{activeBatch.sequenceNumber}: {activeBatch.issuedCoupons}/{activeBatch.batchSize} cupons. Regra em vigor: {activeBatch.winnersPerBatch} ganhador(es), versão {activeBatch.ruleVersion}.</p>}
    {config && <p className="note-inline">Configuração preparada: {config.batchSize} cupons / {config.winnersPerBatch} ganhador(es), versão {config.version}. Alterada em {new Date(config.updatedAt).toLocaleString("pt-BR")}.</p>}
    <div className="form-feedback-slot" aria-live="polite">
      {error && <p role="alert" className="note-inline form-feedback-error">{error}</p>}
      {notice && <p role="status" className="note-inline form-feedback-success">{notice}</p>}
    </div>
    <p className="note-inline">Alterações não modificam o lote que já está aberto. A nova regra entra em vigor quando o próximo lote for criado.</p>
  </section>;
}
