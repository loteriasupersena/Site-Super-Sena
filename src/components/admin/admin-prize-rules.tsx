"use client";

import { useEffect, useState } from "react";

type Multipliers = { tens: number; hundreds: number; milhar: number; quina: number; sena: number };
const defaults: Multipliers = { tens: 20, hundreds: 200, milhar: 2000, quina: 20000, sena: 200000 };
const fields: Array<{ key: keyof Multipliers; label: string }> = [
  { key: "tens", label: "Dezena" },
  { key: "hundreds", label: "Centena" },
  { key: "milhar", label: "Milhar (quatro números)" },
  { key: "quina", label: "Quina (cinco números)" },
  { key: "sena", label: "Sena (seis números)" },
];

export function AdminPrizeRules() {
  const [values, setValues] = useState<Multipliers>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/prize-rules", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os valores.");
        if (active) { setValues(body.multipliers); setUpdatedAt(body.updatedAt); }
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Falha ao carregar os valores."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    for (const field of fields) {
      const value = values[field.key];
      if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) {
        setError("Todos os multiplicadores devem ser números inteiros entre 0 e 1.000.000."); return;
      }
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/prize-rules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar os multiplicadores.");
      setValues(body.multipliers); setUpdatedAt(body.updatedAt);
      setNotice(body.message ?? "Multiplicadores salvos.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao salvar os multiplicadores.");
    } finally { setSaving(false); }
  }

  return <section className="feature-card" aria-labelledby="admin-prize-rules-heading">
    <span className="feature-label">Regras do jogo</span>
    <h2 id="admin-prize-rules-heading">Multiplicadores de prêmios</h2>
    <p>A aposta é dividida igualmente entre cinco categorias. Se sobrarem centavos, todo o excedente será destinado à Dezena. O sorteio continua com seis dígitos; cada aposta paga somente a maior faixa acertada.</p>
    {loading ? <p>Carregando configuração salva…</p> : <form className="admin-round-create" onSubmit={save}>
      {fields.map((field) => <label key={field.key}>{field.label} (vezes)
        <input
          type="number" inputMode="numeric" min="0" max="1000000" step="1" required
          disabled={saving || loading}
          value={String(values[field.key])}
          onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value === "" ? 0 : Number(event.target.value) }))}
        />
      </label>)}
      <div className="round-actions">
        <button type="submit" disabled={saving || loading}>{saving ? "Salvando…" : "Salvar multiplicadores"}</button>
      </div>
    </form>}
    <div className="form-feedback-slot" aria-live="polite">
      {error && <p role="alert" className="note-inline form-feedback-error">{error}</p>}
      {notice && <p role="status" className="note-inline form-feedback-success">{notice}</p>}
    </div>
    {updatedAt && <p className="note-inline">Última alteração salva: {new Date(updatedAt).toLocaleString("pt-BR")}</p>}
    <p className="note-inline">Cada aposta paga somente a maior faixa acertada. Alterações não recalculam prêmios já registrados.</p>
  </section>;
}
