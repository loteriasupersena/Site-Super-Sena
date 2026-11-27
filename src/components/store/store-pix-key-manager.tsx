"use client";

import { useCallback, useEffect, useState } from "react";

type PixKey = {
  keyMasked: string;
  keyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  validated: boolean;
  updatedAt: string;
};

const keyTypes = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone" },
  { value: "EVP", label: "Chave aleatória" },
] as const;

export function StorePixKeyManager() {
  const [saved, setSaved] = useState<PixKey | null>(null);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKey["keyType"]>("CPF");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/store/pix-key", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível consultar a chave Pix.");
      setSaved(body.pixKey as PixKey | null);
      if (body.pixKey?.keyType) setPixKeyType(body.pixKey.keyType);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao consultar a chave Pix.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch("/api/store/pix-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pixKey, pixKeyType }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar a chave Pix.");
      setSaved(body.pixKey as PixKey);
      setPixKey("");
      setNotice(body.message ?? "Chave Pix salva.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao salvar a chave Pix.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="feature-card" aria-labelledby="store-pix-key-heading">
      <span className="feature-label">Dados para recebimento</span>
      <h2 id="store-pix-key-heading">Chave Pix da loja</h2>
      <p>Cadastre a chave Pix que será usada somente para o acerto de prêmios expirados, após o prazo de resgate do consumidor.</p>
      {loading ? <p>Consultando chave cadastrada…</p> : saved ? (
        <div className="round-option">
          <strong>{saved.keyMasked}</strong>
          <p>Tipo: {keyTypes.find((item) => item.value === saved.keyType)?.label ?? saved.keyType}</p>
          <p>Situação: <strong>{saved.validated ? "Titularidade validada" : "Aguardando validação de titularidade"}</strong></p>
          <p>Atualizada em: {new Date(saved.updatedAt).toLocaleString("pt-BR")}</p>
        </div>
      ) : <p>Nenhuma chave Pix cadastrada.</p>}
      <form className="admin-round-create" onSubmit={submit}>
        <h3>{saved ? "Substituir chave Pix" : "Cadastrar chave Pix"}</h3>
        <label>Tipo da chave
          <select value={pixKeyType} onChange={(event) => setPixKeyType(event.target.value as PixKey["keyType"])}>
            {keyTypes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label>Chave Pix
          <input
            value={pixKey}
            onChange={(event) => setPixKey(event.target.value)}
            autoComplete="off"
            maxLength={200}
            placeholder={pixKeyType === "EMAIL" ? "nome@exemplo.com" : pixKeyType === "PHONE" ? "+55 DDD número" : pixKeyType === "EVP" ? "Chave aleatória" : "Digite a chave Pix"}
            required
          />
        </label>
        <p>A chave será armazenada criptografada. A validação do formato não confirma que ela pertence à loja. Enquanto a titularidade não for validada, nenhum saque para essa chave será permitido.</p>
        <div className="round-actions">
          <button type="submit" disabled={saving || loading || !pixKey.trim()}>{saving ? "Salvando…" : saved ? "Salvar nova chave" : "Cadastrar chave"}</button>
          <button type="button" disabled={saving || loading} onClick={() => void load()}>Atualizar situação</button>
        </div>
      </form>
      <div className="form-feedback-slot" aria-live="polite">
        {error && <p role="alert" className="note-inline form-feedback-error">{error}</p>}
        {notice && <p role="status" className="note-inline form-feedback-success">{notice}</p>}
      </div>
    </section>
  );
}
