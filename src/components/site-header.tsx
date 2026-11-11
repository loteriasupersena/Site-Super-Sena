import Image from "next/image";
import Link from "next/link";

export function SiteHeader({ linkHome = true }: { linkHome?: boolean }) {
  const appBrand = (
    <div
      role="img"
      aria-label="Super Sena"
      style={{
        width: "100%",
        minHeight: "clamp(76px, 18vw, 144px)",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(120deg, #062a78, #123d8d)",
        color: "#ffffff",
        fontSize: "clamp(26px, 5vw, 42px)",
        fontWeight: 900,
        letterSpacing: ".14em",
      }}
    >
      SUPER SENA
    </div>
  );
  const image = (
    <Image
      className="site-header-scenery-image"
      src="/images/brand/super-quina-header.webp"
      alt="Super Sena"
      width={1536}
      height={512}
      priority
      sizes="100vw"
    />
  );
  return (
    <header className="site-header site-header-scenery" aria-label="Cabeçalho Super Sena">
      {linkHome ? (
        <Link className="site-header-home-link" href="/" aria-label="Ir para a página inicial">
          {image}
        </Link>
      ) : appBrand}
    </header>
  );
}
