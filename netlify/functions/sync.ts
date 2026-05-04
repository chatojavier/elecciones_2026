import { connectLambda } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";
import { randomUUID } from "node:crypto";

import {
  MANUAL_SYNC_MIN_INTERVAL_MS,
  SYNC_LOCK_TTL_MS
} from "./_shared/config";
import { jsonResponse } from "./_shared/http";
import { runSync } from "./_shared/snapshot";
import {
  getSyncInvocationKind,
  getSyncLockState,
  isManualMethodAllowed,
  isManualSecretValid,
  isRecentManualSync
} from "./_shared/syncGuard";
import {
  deleteSyncLock,
  readHealth,
  readSyncLock,
  writeSyncLock
} from "./_shared/storage";

export const config = {
  schedule: "*/15 * * * *"
};

export const handler: Handler = async (event) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);

  const invocationKind = getSyncInvocationKind(event);
  const isManual = invocationKind === "manual";

  if (isManual && !isManualMethodAllowed(event)) {
    return jsonResponse(
      {
        ok: false,
        code: "method_not_allowed",
        message: "Metodo no permitido."
      },
      405
    );
  }

  if (isManual && !isManualSecretValid(event)) {
    return jsonResponse(
      {
        ok: false,
        code: "unauthorized",
        message: "No autorizado."
      },
      401
    );
  }

  if (isManual) {
    const health = await readHealth();
    if (isRecentManualSync(health)) {
      return jsonResponse(
        {
          ok: false,
          code: "sync_too_recent",
          message: "La app ya tiene un corte reciente.",
          retryAfterSeconds: Math.ceil(MANUAL_SYNC_MIN_INTERVAL_MS / 1000),
          health
        },
        429
      );
    }
  }

  const now = Date.now();
  const currentLockState = getSyncLockState(await readSyncLock(), now);
  if (currentLockState.state === "active") {
    return jsonResponse(
      {
        ok: false,
        code: "sync_in_progress",
        message: "Ya hay una actualizacion en curso.",
        retryAfterSeconds: Math.ceil(SYNC_LOCK_TTL_MS / 1000)
      },
      202
    );
  }

  if (currentLockState.state === "expired" || currentLockState.state === "invalid") {
    await deleteSyncLock();
  }

  const lockId = randomUUID();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + SYNC_LOCK_TTL_MS).toISOString();
  await writeSyncLock({
    id: lockId,
    kind: invocationKind,
    createdAt,
    expiresAt
  });

  const acquiredLockState = getSyncLockState(await readSyncLock());
  if (acquiredLockState.state !== "active" || acquiredLockState.lock?.id !== lockId) {
    return jsonResponse(
      {
        ok: false,
        code: "sync_in_progress",
        message: "Ya hay una actualizacion en curso.",
        retryAfterSeconds: Math.ceil(SYNC_LOCK_TTL_MS / 1000)
      },
      202
    );
  }

  try {
    const { snapshot, health } = await runSync();

    return jsonResponse({
      ok: true,
      snapshot,
      health
    });
  } catch (error) {
    console.error("[sync] sync failed", error);
    return jsonResponse(
      {
        ok: false,
        code: "sync_failed",
        message: "No se pudo completar la sincronizacion."
      },
      500
    );
  } finally {
    const latestLockState = getSyncLockState(await readSyncLock());
    if (latestLockState.lock?.id === lockId) {
      await deleteSyncLock();
    }
  }
};
