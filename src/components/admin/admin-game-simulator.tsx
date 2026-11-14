"use client";

import { useState } from "react";

const categories = [
  { key: "sena", label: "Sena", digits: 6, initial: "300000" },
  { key: "quina", label: "Quina", digits: 5, initial: "30000" },
  { key: "quadra", label: "Quadra", digits: 4, initial: "3000" },
  { key: "centena", label: "Centena", digits: 3, initial: "300" },
  { key: "dezena", label: "Dezena", digits: 2, initial: "30" },
  { key: "unidade", label: "Unidade", digits: 1, initial: "3" },
] as const;

type CategoryKey = (typeof categories)[number]["key"];
type CategoryResult = { hits: number; prizes: number };
type Result = {
  attempts: number;
  stakeCents: number;
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

function parseDecimal(value: string): number {
  return Number(value.trim().replace(",", "."));
}

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
    sena: { hits: 0, prizes: 0 },
    quina: { hits: 0, prizes: 0 },
    quadra: { hits: 0, prizes: 0 },
    centena: { hits: 0, prizes: 0 },
    dezena: { hits: 0, prizes: 0 },
    unidade: { hits: 0, prizes: 0 },
  };
}

export function AdminGameSimulator() {
  const [attempts, setAttempts] = useState("10000");
  const [stake, setStake] = useState("1,00");
  const [multipliers, setMultipliers] = useState<Record<CategoryKey, string>>({
    sena: "300000",
    quina: "30000",
    quadra: "3000",
    centena: "300",
    dezena: "30",
    unidade: "3",
  });
  const [commission, setCommission] = useState("0");
  const [seed, setSeed] = useState("");
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function runSimulation() {
    const count = Number(attempts);
    const stakeValue = parseDecimal(stake);
    const commissionRate = parseDecimal(commission);
    const multiplierValues = Object.fromEntries(
      categories.map((category) => [category.key, Number(multipliers[category.key])])
    ) as Record<CategoryKey, number>;

    if (!Number.isInteger(count) || count < 1 || count > 1000000) {
      setError("Informe de 1 a 1.000.000 de sorteios.");
      return;
    }
    if (!Number.isFinite(stakeValue) || stakeValue < 1 || stakeValue > 10000) {
      setError("O valor apostado deve ser entre R$ 1,00 e R$ 10.000,00.");
      return;
    }
    if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      setError("A comissão deve ficar entre 0% e 100%.");
      return;
    }
    if (categories.some((category) =>
      !Number.isSafeInteger(multiplierValues[category.key]) ||
      multiplierValues[category.key] < 0 ||
      multiplierValues[category.key] > 1000000
    )) {
      setError("Informe multiplicadores inteiros entre 0 e 1.000.000.");
      return;
    }

    setError("");
    setResult(null);
    setProgress(0);
    setRunning(true);

    const stakeCents = Math.round(stakeValue * 100);
    const baseShare = Math.floor(stakeCents / 6);
    const shares: Record<CategoryKey, number> = {
      unidade: baseShare + (stakeCents - baseShare * 6),
      dezena: baseShare,
      centena: baseShare,
      quadra: baseShare,
      quina: baseShare,
      sena: baseShare,
    };
    const byCategory = emptyCategoryResults();
    const random = seed.trim() ? seededRandom(seed.trim()) : Math.random;
    let totalPrizes = 0;
    let hits = 0;
    let processed = 0;

    await new Promise<void>((resolve) => {
      const batch = () => {
        const stop = Math.min(processed + 5000, count);
        for (; processed < stop; processed++) {
          const drawn = String(Math.floor(random() * 1000000)).padStart(6, "0");
          const bet = String(Math.floor(random() * 1000000)).padStart(6, "0");
          const winner = categories.find((category) =>
            bet.slice(-category.digits) === drawn.slice(-category.digits)
          );
          if (winner) {
            hits++;
            const key = winner.key;
            const prize = shares[key] * multiplierValues[key];
            byCategory[key].hits++;
            byCategory[key].prizes += prize;
            totalPrizes += prize;
          }
        }
        setProgress((processed / count) * 100);
        if (processed < count) {
          setTimeout(batch, 0);
        } else {
          resolve();
        }
      };
      batch();
    });

    const totalBet = count * stakeCents;
    const commissionCents = Math.round(totalBet * commissionRate / 100);
    setResult({
      attempts: count,
      stakeCents,
      totalBet,
      totalPrizes,
      commission: commissionCents,
      net: totalBet - totalPrizes - commissionCents,
      hits,
      misses: count - hits,
      byCategory,
      seed: seed.trim(),
    });
    setRunning(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 58,
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid var(--border, #334155)",
    background: "var(--input, #0b1421)",
    color: "var(--foreground, #f1f5f9)",
    padding: "14px 16px",
    fontSize: 18,
  };
  const cardStyle: React.CSSProperties = {
    border: "1px solid var(--border, #334155)",
    borderRadius: 20,
    background: "var(--card, #172233)",
    padding: 20,
    marginTop: 18,
  };
  const labelStyle: React.CSSProperties = {
    display: "grid",
    gap: 9,
    color: "var(--muted-foreground, #b8c5d6)",
    fontWeight: 600,
    fontSize: 15,
  };
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 16,
  };

  return (
    <section aria-labelledby="game-simulator-title" style={{ width: "100%", minWidth: 0 }}>
      <div style={{ display: "inline-flex", border: "1px solid var(--border, #334155)", borderRadius: 999, padding: "8px 14px", color: "var(--muted-foreground, #b8c5d6)", marginBottom: 4 }}>
        Simulação · Sem dinheiro real
      </div>

      <div style={cardStyle}>
        <h2 id="game-simulator-title" style={{ marginTop: 0, marginBottom: 22 }}>Parâmetros</h2>
        <div style={gridStyle}>
          <label style={labelStyle}>
            Quantidade de sorteios
            <input style={inputStyle} type="number" min="1" max="1000000" value={attempts} disabled={running} onChange={(event) => setAttempts(event.target.value)} />
          </label>
          <label style={labelStyle}>
            Valor apostado por número (R$)
            <input style={inputStyle} inputMode="decimal" value={stake} disabled={running} onChange={(event) => setStake(event.target.value)} />
          </label>
          {categories.map((category) => (
            <label key={category.key} style={labelStyle}>
              Multiplicador {category.label}
              <input style={inputStyle} type="number" min="0" max="1000000" step="1" value={multipliers[category.key]} disabled={running} onChange={(event) => setMultipliers((current) => ({ ...current, [category.key]: event.target.value }))} />
            </label>
          ))}
          <label style={labelStyle}>
            Comissão do cambista (%)
            <input style={inputStyle} inputMode="decimal" value={commission} disabled={running} onChange={(event) => setCommission(event.target.value)} />
          </label>
          <label style={labelStyle}>
            Semente opcional
            <input style={inputStyle} value={seed} disabled={running} placeholder="Aleatória a cada execução" onChange={(event) => setSeed(event.target.value)} />
          </label>
        </div>
        <p style={{ color: "var(--muted-foreground, #94a3b8)", lineHeight: 1.6, marginTop: 18 }}>
          Cada tentativa gera um número apostado e um sorteado, ambos com seis algarismos. O valor é dividido entre as seis categorias; a sobra de centavos vai para Unidade. Só é pago o prêmio da categoria de maior precisão acertada. A comissão é uma hipótese aplicada sobre o total apostado, não uma apuração das comissões reais dos cambistas.
        </p>
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
        <h2 style={{ marginTop: 0, marginBottom: 22 }}>Resultado financeiro</h2>
        {!result ? (
          <p style={{ color: "var(--muted-foreground, #94a3b8)" }}>Preencha os parâmetros e inicie a simulação para visualizar os resultados.</p>
        ) : (
          <>
            <div style={gridStyle}>
              {[
                ["Total apostado", money(result.totalBet), result.attempts.toLocaleString("pt-BR") + " tentativas"],
                ["Total bruto de prêmios", money(result.totalPrizes), "Valor pago aos jogadores"],
                ["RTP observado", percent(result.totalBet ? result.totalPrizes / result.totalBet * 100 : 0), money(result.totalPrizes) + " em prêmios"],
                ["Comissão do cambista", money(result.commission), percent(result.totalBet ? result.commission / result.totalBet * 100 : 0) + " do total apostado"],
                ["Lucro da banca", money(result.net), percent(result.totalBet ? result.net / result.totalBet * 100 : 0) + " do total apostado, antes de impostos e despesas"],
              ].map(([label, value, note]) => (
                <article key={label} style={{ border: "1px solid var(--border, #334155)", borderRadius: 16, background: "var(--background, #0d1725)", padding: 16, minWidth: 0 }}>
                  <div style={{ color: "var(--muted-foreground, #94a3b8)", marginBottom: 12 }}>{label}</div>
                  <strong style={{ display: "block", fontSize: "clamp(21px, 4vw, 30px)", lineHeight: 1.2, overflowWrap: "anywhere" }}>{value}</strong>
                  <div style={{ color: "var(--muted-foreground, #94a3b8)", marginTop: 10, lineHeight: 1.5 }}>{note}</div>
                </article>
              ))}
            </div>

            <div style={{ overflowX: "auto", marginTop: 22 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr>
                    {["Categoria", "Acertos", "Prob. observada", "Prêmio bruto"].map((heading) => (
                      <th key={heading} style={{ textAlign: heading === "Categoria" ? "left" : "right", padding: 12, borderBottom: "1px solid var(--border, #334155)", color: "var(--muted-foreground, #94a3b8)" }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...categories].reverse().map((category) => {
                    const data = result.byCategory[category.key];
                    return (
                      <tr key={category.key}>
                        <td style={{ padding: 12, borderBottom: "1px solid var(--border, #334155)" }}>{category.label}</td>
                        <td style={{ textAlign: "right", padding: 12, borderBottom: "1px solid var(--border, #334155)" }}>{data.hits.toLocaleString("pt-BR")}</td>
                        <td style={{ textAlign: "right", padding: 12, borderBottom: "1px solid var(--border, #334155)" }}>{percent(data.hits / result.attempts * 100)}</td>
                        <td style={{ textAlign: "right", padding: 12, borderBottom: "1px solid var(--border, #334155)" }}>{money(data.prizes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ color: "var(--muted-foreground, #94a3b8)", lineHeight: 1.6, marginBottom: 0 }}>
              Referência teórica para números uniformes e independentes: Unidade 1 em 10; Dezena 1 em 100; Centena 1 em 1.000; Quadra 1 em 10.000; Quina 1 em 100.000; Sena 1 em 1.000.000. As frequências observadas variam e não são garantias.
            </p>
          </>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 22 }}>Auditoria da simulação</h2>
        {!result ? (
          <p style={{ color: "var(--muted-foreground, #94a3b8)" }}>Ainda não há simulação executada.</p>
        ) : (
          <>
            <p style={{ color: "var(--muted-foreground, #94a3b8)" }}>
              {result.seed ? `Execução reproduzível · semente: ${result.seed}` : "Execução aleatória · sem semente definida"}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 340 }}>
                <tbody>
                  {[
                    ["Acertos em pelo menos uma modalidade", result.hits.toLocaleString("pt-BR")],
                    ["Tentativas sem nenhum acerto", result.misses.toLocaleString("pt-BR")],
                    ["Média de prêmio por tentativa", money(Math.round(result.totalPrizes / result.attempts))],
                    ["Resultado líquido por tentativa", money(Math.round(result.net / result.attempts))],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td style={{ padding: 13, borderBottom: "1px solid var(--border, #334155)" }}>{label}</td>
                      <td style={{ padding: 13, borderBottom: "1px solid var(--border, #334155)", textAlign: "right", fontWeight: 600 }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p style={{ color: "var(--muted-foreground, #7f91a8)", lineHeight: 1.6, marginBottom: 0, marginTop: 20 }}>
          Este é um simulador matemático local. Não cria apostas reais, não chama o servidor de produção e não movimenta pagamentos. Os resultados variam entre execuções quando a semente fica vazia.
        </p>
      </div>
    </section>
  );
}
