import Link from "next/link";

export function SiteHeader({ linkHome = true }: { linkHome?: boolean }) {
  const brand = (
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
  return (
    <header className="site-header site-header-scenery" aria-label="Cabeçalho Super Sena">
      {linkHome ? (
        <Link className="site-header-home-link" href="/" aria-label="Ir para a página inicial">
          {brand}
        </Link>
      ) : brand}
    </header>
  );
}
