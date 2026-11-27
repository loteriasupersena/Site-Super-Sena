"use client";

import { useCallback, useEffect, useState } from "react";

type Store = {
  id: string;
  name: string;
  status: "ACTIVE" | "BLOCKED" | "PENDING";
  commissionRateBasisPoints: number;
  commissionPercent: number;
  couponLimit: number;
  createdAt: string;
  adminUser: { id: string; username: string; fullName: string | null; whatsapp: string | null; status: string };
  _count: { users: number };
};

const emptyForm = {
  name: "", adminFullName: "", username: "", password: "", whatsapp: "",
  commissionPercent: "5", couponLimit: "100",
};

const moneyPercent = (value: number) => (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

export function AdminStoreManager() {
  const [stores, setStores] = useState<Store[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editingPercent, setEditingPercent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/stores", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar as lojas.");
      setStores(body.stores as Store[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar as lojas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveStorePercent(storeId: string) {
    setError(""); setNotice("");
    const percent = Number(editingPercent.replace(",", "."));
    const basisPoints = Math.round(percent * 100);
    if (!Number.isFinite(percent) || percent < 0 || !Number.isSafeInteger(basisPoints) || basisPoints > 2147483647 || Math.abs(percent * 100 - basisPoints) > 0.000001) {
      setError("Informe um percentual válido, não negativo e com até duas casas decimais."); return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/stores/${storeId}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ commissionRateBasisPoints: basisPoints }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível atualizar o percentual.");
      setEditingStoreId(null); setEditingPercent("");
      setNotice("Percentual atualizado. A nova taxa será aplicada somente aos próximos cupons.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao atualizar o percentual.");
    } finally { setSaving(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice("");
    const percent = Number(form.commissionPercent.replace(",", "."));
    const limit = Number(form.couponLimit);
    if (!Number.isFinite(percent) || percent < 0 || !Number.isSafeInteger(Math.round(percent * 100)) || Math.round(percent * 100) > 2147483647 || Math.abs(percent * 100 - Math.round(percent * 100)) > 0.000001) {
      setError("Informe um percentual válido, não negativo e com até duas casas decimais."); return;
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000) {
      setError("Informe um limite válido de cupons."); return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name, adminFullName: form.adminFullName, username: form.username,
          password: form.password, whatsapp: form.whatsapp,
          commissionRateBasisPoints: Math.round(percent * 100), couponLimit: limit,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível cadastrar a loja.");
      setForm(emptyForm);
      setNotice("Loja e administrador cadastrados. O administrador deverá trocar a senha no primeiro acesso.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao cadastrar a loja.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="feature-card" aria-labelledby="admin-stores-heading">
    <span className="feature-label">Estabelecimentos</span>
    <h2 id="admin-stores-heading">Lojas e administradores</h2>
    <p>Cadastre a loja e seu administrador. O administrador da loja será responsável por criar os acessos operacionais das maquininhas.</p>
    <form className="admin-round-create" onSubmit={submit}>
      <h3>Cadastrar loja</h3>
      <label>Nome do estabelecimento
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} maxLength={160} required />
      </label>
      <label>Nome completo do administrador
        <input value={form.adminFullName} onChange={(event) => setForm({ ...form, adminFullName: event.target.value })} minLength={3} maxLength={120} required />
      </label>
      <label>Usuário de acesso
        <input autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} minLength={3} maxLength={24} pattern="[A-Za-z0-9_.-]+" required />
      </label>
      <label>Senha inicial
        <input type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} maxLength={1024} required />
      </label>
      <label>WhatsApp do administrador
        <input type="tel" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} minLength={10} maxLength={24} required />
      </label>
      <label>Percentual devido à plataforma (%)
        <input type="number" inputMode="decimal" min="0" step="0.01" value={form.commissionPercent} onChange={(event) => setForm({ ...form, commissionPercent: event.target.value })} required />
      </label>
      <label>Limite de cupons por ciclo de cobrança
        <input type="number" inputMode="numeric" min="1" max="100000" step="1" value={form.couponLimit} onChange={(event) => setForm({ ...form, couponLimit: event.target.value })} required />
      </label>
      <div className="round-actions">
        <button type="submit" disabled={saving}>{saving ? "Cadastrando…" : "Criar loja e administrador"}</button>
      </div>
    </form>
    <div className="form-feedback-slot" aria-live="polite">
      {error && <p role="alert" className="note-inline form-feedback-error">{error}</p>}
      {notice && <p role="status" className="note-inline form-feedback-success">{notice}</p>}
    </div>
    <h3>Lojas cadastradas</h3>
    {loading ? <p>Carregando lojas…</p> : stores.length === 0 ? <p>Nenhuma loja cadastrada.</p> : <div className="admin-round-list">
      {stores.map((store) => <article className="round-option" key={store.id}>
        <strong>{store.name}</strong>
        <p>Administrador: {store.adminUser.fullName || store.adminUser.username} · Usuário: {store.adminUser.username}</p>
        <p>Percentual: <strong>{moneyPercent(store.commissionRateBasisPoints)}</strong> · Limite por ciclo: <strong>{store.couponLimit} cupons</strong></p>
        {editingStoreId === store.id ? <div className="round-actions">
          <label>Novo percentual (%) <input type="number" inputMode="decimal" min="0" step="0.01" value={editingPercent} onChange={(event) => setEditingPercent(event.target.value)} /></label>
          <button type="button" disabled={saving} onClick={() => void saveStorePercent(store.id)}>{saving ? "Salvando…" : "Salvar percentual"}</button>
          <button type="button" disabled={saving} onClick={() => { setEditingStoreId(null); setEditingPercent(""); }}>Cancelar</button>
        </div> : <div className="round-actions"><button type="button" onClick={() => { setEditingStoreId(store.id); setEditingPercent((store.commissionRateBasisPoints / 100).toFixed(2)); }}>Alterar percentual</button></div> }
        <p>Status da loja: {store.status === "ACTIVE" ? "Ativa" : store.status === "BLOCKED" ? "Bloqueada" : "Pendente"} · Acessos vinculados: {store._count.users}</p>
      </article>)}
    </div>}
  </section>;
}
