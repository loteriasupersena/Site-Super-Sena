import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import {
  LOGIN_IP_MAX_ATTEMPTS,
  LOGIN_MAX_ATTEMPTS,
  clearLoginFailures,
  getLoginBlock,
  recordLoginFailure,
} from "./login-rate-limit";

const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1";
const suite = enabled ? describe : describe.skip;

suite("PostgreSQL login rate limit", () => {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (enabled && !databaseUrl) {
    throw new Error("DATABASE_URL is required when RUN_POSTGRES_INTEGRATION=1");
  }

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });
  const suffix = randomUUID();
  const usernames = [
    `it-login-concurrent-${suffix}`,
    `it-login-window-${suffix}`,
    `it-login-clear-${suffix}`,
  ];
  const ips = ["198.51.100.11", "198.51.100.12", "198.51.100.13"];
  const aggregateUsers = Array.from({ length: LOGIN_IP_MAX_ATTEMPTS }, (_, index) => `it-login-ip-${index}-${suffix}`);

  const hmacKey = (value: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "development-only-login-rate-limit-key").update(value).digest("hex");
  const accountIpKey = (username: string, ip: string) =>
    hmacKey(`login-account-ip:v2:${username.trim().toLocaleLowerCase("en-US")}:${ip}`);
  const ipKey = (ip: string) => hmacKey(`login-ip:v1:${ip}`);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.loginAttemptBucket.deleteMany({
      where: { keyHash: { in: [
        ...usernames.flatMap((username, index) => [accountIpKey(username, ips[index]!), ipKey(ips[index]!)]),
        ...aggregateUsers.map((username) => accountIpKey(username, ips[1]!)),
      ] } },
    });
    await prisma.$disconnect();
  });

  it("atomically counts concurrent failures per account and IP", async () => {
    const username = usernames[0]!;
    const ip = ips[0]!;
    const now = new Date("2035-01-01T12:00:00.000Z");

    const results = await Promise.all(
      Array.from({ length: LOGIN_MAX_ATTEMPTS }, () =>
        recordLoginFailure(prisma, username, ip, now),
      ),
    );

    expect(results.map((result) => result.attempts).sort((a, b) => a - b))
      .toEqual([1, 2, 3, 4, 5]);
    expect(results.filter((result) => result.blocked)).toHaveLength(1);
    expect(await getLoginBlock(prisma, username, ip, now)).toMatchObject({
      retryAfterSeconds: 900,
      blockedUntil: new Date(now.getTime() + 15 * 60 * 1000),
    });
    expect(await getLoginBlock(prisma, username, "198.51.100.99", now)).toBeNull();

    const bucket = await prisma.loginAttemptBucket.findUniqueOrThrow({
      where: { keyHash: accountIpKey(username, ip) },
    });
    expect(bucket.attempts).toBe(LOGIN_MAX_ATTEMPTS);
    expect(bucket.blockedUntil).toEqual(new Date(now.getTime() + 15 * 60 * 1000));
  });

  it("also limits aggregate failures from a single IP across different usernames", async () => {
    const ip = ips[1]!;
    const now = new Date("2035-01-01T12:00:00.000Z");
    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS; attempt += 1) {
      await recordLoginFailure(prisma, aggregateUsers[attempt]!, ip, now);
    }
    expect(await getLoginBlock(prisma, "some-other-user", ip, now)).not.toBeNull();
  });

  it("resets the attempt window after fifteen minutes", async () => {
    const username = usernames[1]!;
    const ip = ips[1]!;
    const now = new Date("2035-01-01T12:00:00.000Z");

    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS - 1; attempt += 1) {
      await recordLoginFailure(prisma, username, ip, now);
    }
    const reset = await recordLoginFailure(
      prisma,
      username,
      ip,
      new Date(now.getTime() + 15 * 60 * 1000 + 1),
    );

    expect(reset.attempts).toBe(1);
    expect(reset.blocked).toBe(false);
    expect(await getLoginBlock(prisma, username, ip, new Date(now.getTime() + 16 * 60 * 1000))).toBeNull();
  });

  it("clears only the account/IP bucket after successful authentication", async () => {
    const username = usernames[2]!;
    const ip = ips[2]!;
    await recordLoginFailure(prisma, username, ip, new Date("2035-01-01T12:00:00.000Z"));
    expect(await prisma.loginAttemptBucket.count({ where: { keyHash: accountIpKey(username, ip) } })).toBe(1);
    expect(await prisma.loginAttemptBucket.count({ where: { keyHash: ipKey(ip) } })).toBe(1);

    await clearLoginFailures(prisma, username, ip);

    expect(await prisma.loginAttemptBucket.count({ where: { keyHash: accountIpKey(username, ip) } })).toBe(0);
    expect(await prisma.loginAttemptBucket.count({ where: { keyHash: ipKey(ip) } })).toBe(1);
    expect(await getLoginBlock(prisma, username, ip, new Date("2035-01-01T12:01:00.000Z"))).toBeNull();
  });
});
