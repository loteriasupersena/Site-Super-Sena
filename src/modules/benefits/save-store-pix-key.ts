import "server-only";
import { authPrisma } from "@/lib/auth/session";
import { encryptStorePixKey } from "@/lib/wallet/store-pix-key";
import { maskPixKey, parsePixKeyInput } from "@/lib/wallet/pix-key";

/**
 * Stores a store administrator's Pix key encrypted and unvalidated.
 * Format validation is not proof of key ownership; validatedAt stays null until
 * an independently verified ownership process is implemented.
 */
export async function saveStorePixKey(input: {
  storeId: string;
  actorId: string;
  pixKey: string;
  pixKeyType: string;
}) {
  const parsed = parsePixKeyInput({ pixKey: input.pixKey, pixKeyType: input.pixKeyType });
  if (!parsed) throw new Error("STORE_PIX_KEY_INVALID");

  const ciphertext = encryptStorePixKey(parsed.pixKey);
  const masked = maskPixKey(parsed.pixKey);

  return authPrisma.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({
      where: { id: input.actorId },
      select: {
        id: true, role: true, status: true, storeId: true,
        administeredStore: { select: { id: true, status: true } },
      },
    });
    if (!actor || actor.status !== "ACTIVE" || actor.role !== "STORE_ADMIN"
      || actor.administeredStore?.id !== input.storeId
      || actor.administeredStore.status !== "ACTIVE") {
      throw new Error("STORE_PIX_KEY_ACTOR_FORBIDDEN");
    }

    const saved = await tx.storePixKey.upsert({
      where: { storeId: input.storeId },
      create: {
        storeId: input.storeId,
        keyCiphertext: ciphertext,
        keyMasked: masked,
        keyType: parsed.pixKeyType,
        validatedAt: null,
      },
      update: {
        keyCiphertext: ciphertext,
        keyMasked: masked,
        keyType: parsed.pixKeyType,
        validatedAt: null,
      },
      select: { id: true, keyMasked: true, keyType: true, validatedAt: true, updatedAt: true },
    });

    await tx.auditEvent.create({
      data: {
        action: "STORE_PIX_KEY_SAVED_UNVERIFIED",
        entityType: "StorePixKey",
        entityId: saved.id,
        metadata: {
          storeId: input.storeId,
          actorId: actor.id,
          keyMasked: saved.keyMasked,
          keyType: saved.keyType,
          ownershipVerified: false,
        },
      },
    });
    return saved;
  }, { isolationLevel: "Serializable" });
}
