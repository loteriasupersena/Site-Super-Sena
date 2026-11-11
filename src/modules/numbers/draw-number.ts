import { randomInt } from "node:crypto";

export type RandomInteger = (maxExclusive: number) => number;

/** Draws one uniformly distributed six-digit value, preserving leading zeroes. */
export function drawNumber(nextInt: RandomInteger = randomInt): string {
  return nextInt(1_000_000).toString().padStart(6, "0");
}
