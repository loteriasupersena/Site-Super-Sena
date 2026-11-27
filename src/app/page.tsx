import type { Metadata } from "next";
import Image from "next/image";
import { HomeAccess } from "@/components/home-access";

export const metadata: Metadata = {
  title: "MEU VALE PIX | Promoções para consumidores e lojas",
  description: "Plataforma de cupons promocionais com QR Code para estabelecimentos comerciais.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return (
    <div className="home-page home-page-compact">
      <HomeAccess />
      <main className="home-entry">
        <figure className="home-how-infographic numeric-game-infographic">
          <Image
            src="/images/brand/super-sena-inicio.webp"
            alt="Como funciona o jogo Super Sena"
            className="home-how-infographic-image"
            width={1200}
            height={1200}
            priority
            sizes="(max-width: 768px) 100vw, 1100px"
          />
          <a
            className="home-kit-whatsapp-link"
            href="https://wa.me/5577991601217?text=Quero%20ser%20um%20cambista%20credenciado%20da%20Super%20Sena."
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Solicitar o kit gratuito da Super Sena pelo WhatsApp"
          />
        </figure>
      </main>
    </div>
  );
}
