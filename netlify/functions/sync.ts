import { connectLambda } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";

import {
  MANUAL_SYNC_MIN_INTERVAL_MS,
  SYNC_LOCK_TTL_MS
} from "./_shared/config";
import { jsonResponse } from "./_shared/http";
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

function getHost(event: Parameters<Handler>[0]) {
  return event.headers.host ?? event.headers.Host;
}

async function startBackgroundSync(event: Parameters<Handler>[0], lockId: string) {
  const host = getHost(event);
  if (!host) {
    throw new Error("No se pudo iniciar sync-background: falta host");
  }

  const protocol = host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const backgroundUrl = new URL(`${protocol}://${host}/.netlify/functions/sync-background`);
  backgroundUrl.searchParams.set("lockId", lockId);

  const response = await fetch(backgroundUrl, {
    method: "POST"
  });

  if (!response.ok && response.status !== 202) {
    throw new Error(`sync-background respondio ${response.status}`);
  }
}

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
    await startBackgroundSync(event, lockResult.lock.id);
    return jsonResponse(
      {
        ok: true,
        code: "sync_started",
        message: "Sincronizacion iniciada.",
        retryAfterSeconds: Math.ceil(SYNC_LOCK_TTL_MS / 1000),
        lock: {
          kind: lockResult.lock.kind,
          createdAt: lockResult.lock.createdAt,
          expiresAt: lockResult.lock.expiresAt
        }
      },
      202
    );
  } catch (error) {
    console.error("[sync] sync failed", error);
    await releaseSyncLock(lockResult.lock.id);
    return jsonResponse(
      {
        ok: false,
        code: "sync_failed",
        message: "No se pudo completar la sincronizacion."
      },
      500
    );
  }
};
