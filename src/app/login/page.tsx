import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Entrar | Super Sena", description: "Acesse sua área segura da Super Sena." };

export default function LoginPage() {
  return (
    <main className="auth-layout">
      <SiteHeader />
      <section className="auth-card" aria-label="Entrar na Super Sena">
        <LoginForm />
        <p className="security-note">Ainda não tem uma conta? <Link href="/cadastro">Criar conta</Link></p>
      </section>
    </main>
  );
}
