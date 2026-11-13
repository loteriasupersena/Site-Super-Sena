import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PreventPullToRefresh } from "@/components/prevent-pull-to-refresh";
import { AndroidBrowserClass } from "@/components/android-browser-class";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loteriasupersena.com.br";

const icon = "/images/brand/super-sena-icone.webp";
const appleIcon = "/images/brand/super-sena-icone.webp";
const shareImage = "/images/brand/super-sena-compartilhamento.webp";
const favicon = "/images/brand/favicon-super-sena.svg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  title: {
    default: "Super Sena | Página Inicial Oficial",
    template: "%s | Super Sena",
  },
  description: "Super Sena: jogo numérico de seis algarismos, com seis categorias de premiação. Conheça as regras e acesse sua conta.",
  applicationName: "Super Sena",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Super Sena",
  },
  icons: {
    icon: [
      { url: icon, type: "image/webp" },
      { url: favicon, type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: [{ url: favicon, type: "image/svg+xml", sizes: "any" }],
    apple: [{ url: appleIcon, type: "image/webp" }],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Super Sena",
    title: "Super Sena | Jogo Numérico",
    description: "Jogue com números de seis algarismos e concorra nas seis categorias de premiação.",
    url: siteUrl,
    images: [{ url: shareImage, alt: "Super Sena" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Super Sena",
    description: "Jogue números de seis algarismos e concorra a seis categorias de prêmios.",
    images: [shareImage],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#001584",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><AndroidBrowserClass /><PreventPullToRefresh />{children}</body>
    </html>
  );
}
