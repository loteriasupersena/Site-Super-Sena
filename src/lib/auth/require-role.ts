import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

type Role = "PLAYER" | "CASHIER" | "ADMIN";
const routeByRole: Record<Role, string> = { PLAYER: "/player", CASHIER: "/cashier", ADMIN: "/admin" };

export async function requireRole(role: Role, options: { cashierApp?: boolean } = {}) {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  const appSuffix = options.cashierApp ? "?app=1" : "";
  if (!user) redirect(options.cashierApp ? "/cashier-app-login" : "/login");
  if (user.mustChangePassword) redirect(options.cashierApp ? "/change-password?app=1" : "/login?reason=password-change-required");
  if (user.role !== role) redirect(routeByRole[user.role as Role] ?? (options.cashierApp ? "/cashier-app-login" : "/login"));
  return user;
}
