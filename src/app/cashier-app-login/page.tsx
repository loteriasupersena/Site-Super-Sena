import Image from "next/image";
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
        <Image
          className="site-header-scenery-image"
          src="/images/brand/super-quina-header.webp"
          alt="Super Sena"
          width={1536}
          height={512}
          priority
          sizes="100vw"
        />
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
