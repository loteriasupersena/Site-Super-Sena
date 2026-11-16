import "server-only";
import { createHmac } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_IP_MAX_ATTEMPTS = 30;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;

function hashKey(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required to protect login rate-limit identifiers.");
  }
  return createHmac("sha256", secret ?? "development-only-login-rate-limit-key").update(value).digest("hex");
}

function accountIpKey(username: string, clientIp: string) {
  const normalized = username.trim().toLocaleLowerCase("en-US");
  return hashKey(`login-account-ip:v2:${normalized}:${clientIp}`);
}

function ipKey(clientIp: string) {
  return hashKey(`login-ip:v1:${clientIp}`);
}

async function upsertFailure(prisma: PrismaClient, keyHash: string, now: Date, maxAttempts: number) {
  const result = await prisma.$queryRaw<Array<{ attempts: number; blockedUntil: Date | null }>>`
    INSERT INTO "LoginAttemptBucket" ("keyHash", "attempts", "windowStartedAt", "blockedUntil", "updatedAt")
    VALUES (${keyHash}, 1, CAST(${now} AS TIMESTAMP), NULL, CAST(${now} AS TIMESTAMP))
    ON CONFLICT ("keyHash") DO UPDATE SET
      "attempts" = CASE
        WHEN "LoginAttemptBucket"."windowStartedAt" <= CAST(${now} AS TIMESTAMP) - INTERVAL '15 minutes' THEN 1
        ELSE "LoginAttemptBucket"."attempts" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "LoginAttemptBucket"."windowStartedAt" <= CAST(${now} AS TIMESTAMP) - INTERVAL '15 minutes' THEN CAST(${now} AS TIMESTAMP)
        ELSE "LoginAttemptBucket"."windowStartedAt"
      END,
      "blockedUntil" = CASE
        WHEN (CASE
          WHEN "LoginAttemptBucket"."windowStartedAt" <= CAST(${now} AS TIMESTAMP) - INTERVAL '15 minutes' THEN 1
          ELSE "LoginAttemptBucket"."attempts" + 1
        END) >= ${maxAttempts}
        THEN CAST(${now} AS TIMESTAMP) + INTERVAL '15 minutes'
        ELSE NULL
      END,
      "updatedAt" = CAST(${now} AS TIMESTAMP)
    RETURNING "attempts", "blockedUntil"
  `;
  return result[0]!;
}

function blockResult(buckets: Array<{ blockedUntil: Date | null }>, now: Date) {
  const blockedUntil = buckets
    .map((bucket) => bucket.blockedUntil)
    .filter((value): value is Date => value !== null && value > now)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (!blockedUntil) return null;
  return {
    blockedUntil,
    retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)),
  };
}

export async function getLoginBlock(prisma: PrismaClient, username: string, clientIp: string, now = new Date()) {
  const buckets = await prisma.loginAttemptBucket.findMany({
    where: { keyHash: { in: [accountIpKey(username, clientIp), ipKey(clientIp)] } },
    select: { blockedUntil: true },
  });
  return blockResult(buckets, now);
}

/**
 * Atomically records both per-account/per-IP and per-IP failures. A remote
 * caller can no longer lock a victim's username from a different IP address.
 * Only HMAC digests keyed with AUTH_SECRET are persisted; raw IP addresses and usernames are not.
 */
export async function recordLoginFailure(prisma: PrismaClient, username: string, clientIp: string, now = new Date()) {
  const accountIp = await upsertFailure(prisma, accountIpKey(username, clientIp), now, LOGIN_MAX_ATTEMPTS);
  const ip = await upsertFailure(prisma, ipKey(clientIp), now, LOGIN_IP_MAX_ATTEMPTS);
  const blocked = blockResult([accountIp, ip], now);
  return {
    attempts: accountIp.attempts,
    blocked: blocked !== null,
    blockedUntil: blocked?.blockedUntil ?? null,
    retryAfterSeconds: blocked?.retryAfterSeconds ?? 0,
  };
}

export async function clearLoginFailures(prisma: PrismaClient, username: string, clientIp: string) {
  // Keep the IP-wide bucket: a successful login for one account must not erase
  // failures accumulated against other accounts from the same address.
  await prisma.loginAttemptBucket.deleteMany({ where: { keyHash: accountIpKey(username, clientIp) } });
}
