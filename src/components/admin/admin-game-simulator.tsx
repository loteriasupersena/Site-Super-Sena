"use client";

import { useState, type CSSProperties } from "react";

const GAME_PRICE_CENTS = 600;
const categories = [
  { key: "sena", label: "Sena", digits: 6, prizeCents: 20_000_000 },
  { key: "quina", label: "Quina", digits: 5, prizeCents: 2_000_000 },
  { key: "milhar", label: "Milhar", digits: 4, prizeCents: 200_000 },
  { key: "centena", label: "Centena", digits: 3, prizeCents: 20_000 },
  { key: "dezena", label: "Dezena", digits: 2, prizeCents: 2_000 },
  { key: "unidade", label: "Unidade", digits: 1, prizeCents: 600 },
] as const;

type CategoryKey = (typeof categories)[number]["key"];
type CategoryResult = { hits: number; prizes: number };
type Result = {
  attempts: number;
  totalBet: number;
  totalPrizes: number;
  commission: number;
  net: number;
  hits: number;
  misses: number;
  byCategory: Record<CategoryKey, CategoryResult>;
  seed: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
const percent = (value: number) =>
  `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function seededRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyCategoryResults(): Record<CategoryKey, CategoryResult> {
  return {
    sena: { hits: 0, prizes: 0 }, quina: { hits: 0, prizes: 0 },
    milhar: { hits: 0, prizes: 0 }, centena: { hits: 0, prizes: 0 },
    dezena: { hits: 0, prizes: 0 }, unidade: { hits: 0, prizes: 0 },
  };
}

export function AdminGameSimulator() {
  const [attempts, setAttempts] = useState("10000");
  const [commission, setCommission] = useState("0");
  const [seed, setSeed] = useState("");
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function runSimulation() {
    const count = Number(attempts);
    const commissionRate = Number(commission.trim().replace(",", "."));
    if (!Number.isInteger(count) || count < 1 || count > 1_000_000) {
      setError("Informe de 1 a 1.000.000 de jogos para simular.");
      return;
    }
    if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      setError("A comissão deve ficar entre 0% e 100%.");
      return;
    }

    setError("");
    setResult(null);
    setProgress(0);
    setRunning(true);

    const byCategory = emptyCategoryResults();
    const random = seed.trim() ? seededRandom(seed.trim()) : Math.random;
    let totalPrizes = 0;
    let hits = 0;
    let processed = 0;

    await new Promise<void>((resolve) => {
      const batch = () => {
        const stop = Math.min(processed + 5000, count);
        for (; processed < stop; processed++) {
          const drawn = String(Math.floor(random() * 1_000_000)).padStart(6, "0");
          const bet = String(Math.floor(random() * 1_000_000)).padStart(6, "0");
          const winner = categories.find((category) =>
            bet.slice(-category.digits) === drawn.slice(-category.digits)
          );
          if (winner) {
            hits++;
            byCategory[winner.key].hits++;
            byCategory[winner.key].prizes += winner.prizeCents;
            totalPrizes += winner.prizeCents;
          }
        }
        setProgress((processed / count) * 100);
        if (processed < count) setTimeout(batch, 0);
        else resolve();
      };
      batch();
    });

    const totalBet = count * GAME_PRICE_CENTS;
    const commissionCents = Math.round(totalBet * commissionRate / 100);
    setResult({
      attempts: count, totalBet, totalPrizes, commission: commissionCents,
      net: totalBet - totalPrizes - commissionCents, hits, misses: count - hits,
      byCategory, seed: seed.trim(),
    });
    setRunning(false);
  }

  const inputStyle: CSSProperties = {
    width: "100%", minHeight: 48, boxSizing: "border-box", borderRadius: 14,
    border: "1px solid var(--border, #334155)", background: "var(--input, #0b1421)",
    color: "var(--foreground, #f1f5f9)", padding: "10px 12px", fontSize: 16,
  };
  const cardStyle: CSSProperties = {
    border: "1px solid var(--border, #334155)", borderRadius: 20,
    background: "var(--card, #172233)", padding: 14, marginTop: 12,
  };
  const labelStyle: CSSProperties = {
    display: "grid", gap: 9, color: "var(--muted-foreground, #b8c5d6)",
    fontWeight: 600, fontSize: 15,
  };
  const gridStyle: CSSProperties = {
    display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12,
  };

  return (
    <section aria-labelledby="game-simulator-title" style={{ width: "100%", minWidth: 0 }}>
      <div style={{ display: "inline-flex", border: "1px solid var(--border, #334155)", borderRadius: 999, padding: "8px 14px", color: "var(--muted-foreground, #b8c5d6)", marginBottom: 4 }}>
        Simulação · Sem dinheiro real
      </div>

      <div style={cardStyle}>
        <h2 id="game-simulator-title" style={{ marginTop: 0, marginBottom: 18 }}>Parâmetros</h2>
        <p style={{ lineHeight: 1.6, marginTop: 0 }}>
          Cada jogo custa R$ 6,00, com R$ 1,00 destinado a cada categoria. Os valores dos prêmios são fixos.
        </p>
        <div style={gridStyle}>
          <label style={labelStyle}>
            Quantidade de jogos
            <input style={inputStyle} type="number" min="1" max="1000000" value={attempts} disabled={running} onChange={(event) => setAttempts(event.target.value)} />
          </label>
          <label style={labelStyle}>
            Comissão simulada (%)
            <input style={inputStyle} inputMode="decimal" value={commission} disabled={running} onChange={(event) => setCommission(event.target.value)} />
          </label>
          <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
            Semente opcional
            <input style={inputStyle} value={seed} disabled={running} placeholder="Aleatória a cada execução" onChange={(event) => setSeed(event.target.value)} />
          </label>
        </div>
        <div style={{ marginTop: 14, lineHeight: 1.55, color: "var(--muted-foreground, #94a3b8)" }}>
          <strong>Valores fixos dos prêmios:</strong>
          <div>{[...categories].reverse().map((category) => (
            <div key={category.key}>{category.label}: {money(category.prizeCents)}</div>
          ))}</div>
        </div>
        <button type="button" className="primary-button" disabled={running} onClick={() => void runSimulation()}>
          {running ? "Executando simulação…" : "Iniciar simulação"}
        </button>
        {running && (
          <div style={{ marginTop: 16 }}>
            <p style={{ marginBottom: 8 }}>Processando: {progress.toFixed(0)}%</p>
            <progress value={progress} max="100" style={{ width: "100%", height: 12 }} />
          </div>
        )}
        {error && <p role="alert" className="form-error" style={{ marginTop: 14 }}>{error}</p>}
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 14 }}>Resultado financeiro</h2>
        {!result ? (
          <p style={{ color: "var(--muted-foreground, #94a3b8)" }}>Informe a quantidade de jogos e inicie a simulação.</p>
        ) : (
          <>
            <div style={gridStyle}>
              {[
                ["Total apostado", money(result.totalBet), result.attempts.toLocaleString("pt-BR") + " jogos"],
                ["Total bruto de prêmios", money(result.totalPrizes), "Valor pago aos jogadores"],
                ["Retorno aos jogadores", percent(result.totalBet ? result.totalPrizes / result.totalBet * 100 : 0), money(result.totalPrizes) + " em prêmios"],
                ["Comissão", money(result.commission), percent(result.totalBet ? result.commission / result.totalBet * 100 : 0) + " do total apostado"],
                ["Saldo da banca", money(result.net), percent(result.totalBet ? result.net / result.totalBet * 100 : 0) + " antes de impostos e despesas"],
              ].map(([label, value, note]) => (
                <article key={label} style={{ border: "1px solid var(--border, #334155)", borderRadius: 14, background: "var(--background, #0d1725)", padding: 12, minWidth: 0 }}>
                  <div style={{ color: "var(--muted-foreground, #94a3b8)", marginBottom: 8 }}>{label}</div>
                  <strong style={{ display: "block", fontSize: "clamp(17px, 3.5vw, 25px)", lineHeight: 1.2, overflowWrap: "anywhere" }}>{value}</strong>
                  <div style={{ color: "var(--muted-foreground, #94a3b8)", marginTop: 6, lineHeight: 1.35, fontSize: 13 }}>{note}</div>
                </article>
              ))}
            </div>
            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 0, tableLayout: "fixed" }}>
                <thead><tr>
                  {["Categoria", "Acertos", "Prob. observada", "Prêmio bruto"].map((heading) => (
                    <th key={heading} style={{ textAlign: heading === "Categoria" ? "left" : "right", padding: "8px 5px", fontSize: 12, borderBottom: "1px solid var(--border, #334155)", color: "var(--muted-foreground, #94a3b8)" }}>{heading}</th>
                  ))}
                </tr></thead>
                <tbody>{[...categories].reverse().map((category) => {
                  const data = result.byCategory[category.key];
                  return <tr key={category.key}>
                    <td style={{ padding: "8px 5px", fontSize: 12, borderBottom: "1px solid var(--border, #334155)" }}>{category.label}</td>
                    <td style={{ textAlign: "right", padding: 12, borderBottom: "1px solid var(--border, #334155)" }}>{data.hits.toLocaleString("pt-BR")}</td>
                    <td style={{ textAlign: "right", padding: 12, borderBottom: "1px solid var(--border, #334155)" }}>{percent(data.hits / result.attempts * 100)}</td>
                    <td style={{ textAlign: "right", padding: 12, borderBottom: "1px solid var(--border, #334155)" }}>{money(data.prizes)}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 14 }}>Auditoria da simulação</h2>
        {!result ? (
          <p style={{ color: "var(--muted-foreground, #94a3b8)" }}>Ainda não há simulação executada.</p>
        ) : (
          <>
            <p style={{ color: "var(--muted-foreground, #94a3b8)" }}>
              {result.seed ? `Execução reproduzível · semente: ${result.seed}` : "Execução aleatória · sem semente definida"}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 340 }}>
                <tbody>{[
                  ["Acertos em pelo menos uma modalidade", result.hits.toLocaleString("pt-BR")],
                  ["Jogos sem nenhum acerto", result.misses.toLocaleString("pt-BR")],
                  ["Média de prêmio por jogo", money(Math.round(result.totalPrizes / result.attempts))],
                  ["Saldo médio por jogo", money(Math.round(result.net / result.attempts))],
                ].map(([label, value]) => <tr key={label}>
                  <td style={{ padding: 13, borderBottom: "1px solid var(--border, #334155)" }}>{label}</td>
                  <td style={{ padding: 13, borderBottom: "1px solid var(--border, #334155)", textAlign: "right", fontWeight: 600 }}>{value}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </>
        )}
        <p style={{ color: "var(--muted-foreground, #7f91a8)", lineHeight: 1.6, marginBottom: 0, marginTop: 20 }}>
          Este simulador matemático não cria apostas reais nem movimenta pagamentos. A comissão é uma hipótese e os resultados variam conforme os números sorteados.
        </p>
      </div>
    </section>
  );
}
