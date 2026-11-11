import { z } from "zod";

// Use an explicit ASCII digit range so the six-digit rule is identical in
// browsers, Node.js, validation and persisted values.
export const numberInputSchema = z.string().trim().regex(/^[0-9]{6}$/, "Informe exatamente seis algarismos, de 000000 a 999999.");

export function normalizeNumber(input: string): string {
  return numberInputSchema.parse(input);
}
