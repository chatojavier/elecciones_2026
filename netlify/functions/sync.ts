import { connectLambda } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";

import {
  MANUAL_SYNC_MIN_INTERVAL_MS
} from "./_shared/config";
import { jsonResponse } from "./_shared/http";
import { runSync } from "./_shared/snapshot";
import { acquireSyncLock, releaseSyncLock } from "./_shared/syncLock";
import {
  getSyncInvocationKind,
  isManualMethodAllowed,
  isManualSecretValid,
  isRecentManualSync
} from "./_shared/syncGuard";
import { readHealth } from "./_shared/storage";

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

  const lockResult = await acquireSyncLock(invocationKind);
  if (lockResult.state === "active") {
    return jsonResponse(
      {
        ok: false,
        code: "sync_in_progress",
        message: "Ya hay una actualizacion en curso.",
        retryAfterSeconds: Math.ceil(
          Math.max(0, new Date(lockResult.lock.expiresAt).getTime() - Date.now()) / 1000
        ),
        lock: {
          kind: lockResult.lock.kind,
          createdAt: lockResult.lock.createdAt,
          expiresAt: lockResult.lock.expiresAt
        }
      },
      202
    );
  }

  try {
    const { snapshot, health } = await runSync();

    return jsonResponse({
      ok: true,
      snapshot,
      health,
      lock: {
        kind: lockResult.lock.kind,
        createdAt: lockResult.lock.createdAt,
        expiresAt: lockResult.lock.expiresAt
      }
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
    await releaseSyncLock(lockResult.lock.id);
  }
};
