import { z } from "zod";

export const numberInputSchema = z.string().trim().regex(/^\d{6}$/, "Informe exatamente seis algarismos, de 000000 a 999999.");

export function normalizeNumber(input: string): string {
  return numberInputSchema.parse(input);
}
