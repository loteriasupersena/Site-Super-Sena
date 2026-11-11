import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PreventPullToRefresh } from "@/components/prevent-pull-to-refresh";
import { AndroidBrowserClass } from "@/components/android-browser-class";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://loteriasupersena.com.br";

const icon = "/images/brand/super-sena-icon.svg";
const favicon = icon;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  title: {
    default: "Super Sena | Página Inicial Oficial",
    template: "%s | Super Sena",
  },
  description: "Página inicial oficial da Super Sena. Conheça como funciona o jogo, veja as informações e acesse sua conta quando desejar.",
  applicationName: "Super Sena",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Super Sena",
  },
  icons: {
    icon: [{ url: favicon, type: "image/svg+xml", sizes: "any" }],
    shortcut: [{ url: favicon, type: "image/svg+xml", sizes: "any" }],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Super Sena",
    title: "Super Sena | Jogo Numérico",
    description: "Seja um ponto credenciado Super Sena. Solicite seu kit gratuito.",
    url: siteUrl,
    images: [{ url: icon, alt: "Super Sena" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Super Sena",
    description: "Jogue cinco números e concorra a cinco categorias de prêmios.",
    images: [icon],
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
