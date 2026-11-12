import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptVerification } from "@/components/receipts/receipt-verification";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Consulta do recibo | Super Sena",
  description: "Consulte o resultado oficial do recibo na Super Sena.",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ receiptCode: string }> };

export default async function VerifyReceiptPage({ params }: PageProps) {
  const { receiptCode } = await params;
  return (
    <main
      className="home-page"
      style={{
        minHeight: "100vh",
        padding: "calc(var(--site-header-height, 100px) + 36px) 16px 32px",
      }}
    >
      <SiteHeader />
      <section style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <ReceiptVerification receiptCode={receiptCode} />
        <p style={{ marginTop: 20, textAlign: "center" }}>
          <Link href="/">Página inicial</Link>
        </p>
      </section>
    </main>
  );
}
