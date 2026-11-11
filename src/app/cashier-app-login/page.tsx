import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Acesso do Cambista | Super Sena",
  description: "Acesso exclusivo para cambistas da Super Sena.",
  robots: { index: false, follow: false },
};

export default function CashierAppLoginPage() {
  return (
    <main className="auth-layout cashier-app-login">
      <header className="site-header site-header-scenery" aria-label="Super Sena">
        <div role="img" aria-label="Super Sena" style={{ width: "100%", minHeight: "clamp(76px, 18vw, 144px)", display: "grid", placeItems: "center", background: "linear-gradient(120deg, #062a78, #123d8d)", color: "#fff", fontSize: "clamp(26px, 5vw, 42px)", fontWeight: 900, letterSpacing: ".14em" }}>
          SUPER SENA
        </div>
      </header>
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">Aplicativo do cambista</p>
        <h1 id="login-title">Acesso exclusivo</h1>
        <p className="auth-description">Entre com sua conta de cambista para acessar vendas, financeiro e impressão de recibos.</p>
        <LoginForm allowedRole="CASHIER" cashierApp />
        <p className="security-note">Este aplicativo não permite acesso de jogadores ou administradores.</p>
      </section>
    </main>
  );
}
