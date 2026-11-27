import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Acesso da Maquininha | MEU VALE PIX",
  description: "Acesso operacional das maquininhas do MEU VALE PIX.",
  robots: { index: false, follow: false },
};

export default function CashierAppLoginPage() {
  return (
    <main className="auth-layout cashier-app-login">
      <SiteHeader linkHome={false} />
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">MEU VALE PIX</p>
        <h1 id="login-title">Acesso exclusivo</h1>
        <p className="auth-description">Entre com o acesso desta maquininha para registrar compras, emitir cupons e imprimir recibos.</p>
        <LoginForm allowedRole="CASHIER" cashierApp />
        <p className="security-note">Este aplicativo não permite acesso de jogadores ou administradores.</p>
      </section>
    </main>
  );
}
