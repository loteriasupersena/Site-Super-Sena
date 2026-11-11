import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { SiteHeader } from "@/components/site-header";

type Props = {
  title: string;
  username: string;
  description?: string;
  compact?: boolean;
  logoOnlyHeader?: boolean;
  logoutAtBottom?: boolean;
  children: ReactNode;
  footerContent?: ReactNode;
  appMode?: boolean;
};

export function AreaShell({ children, compact = false, footerContent, appMode = false }: Props) {
  return (
    <main className={`area-page${compact ? " area-page-compact" : ""}`} data-cashier-app={appMode ? "true" : undefined}>
      <SiteHeader linkHome={!appMode} />
      <section className={`area-content${compact ? " area-content-compact" : ""}`}>{children}</section>
      <footer
        className="area-logout-footer"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 0 32px", width: "100%" }}
      >
        {footerContent}
        <LogoutButton cashierApp={appMode} />
      </footer>
    </main>
  );
}
