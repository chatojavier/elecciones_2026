import { connectLambda } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";

import { SYNC_BACKGROUND_SECRET } from "./_shared/config";
import { jsonResponse } from "./_shared/http";
import { runSync } from "./_shared/snapshot";
import { releaseSyncLock } from "./_shared/syncLock";
import { getSyncLockState } from "./_shared/syncGuard";
import { readSyncLock } from "./_shared/storage";

function getHeader(headers: Record<string, string | undefined>, name: string) {
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
}

function parseBody(body: string | null) {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as { lockId?: unknown };
  } catch {
    return null;
  }
}

export const handler: Handler = async (event) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);

  if (event.httpMethod !== "POST") {
    return jsonResponse(
      {
        ok: false,
        code: "method_not_allowed",
        message: "Metodo no permitido."
      },
      405
    );
  }

  const providedSecret = getHeader(event.headers, "x-sync-background-secret");
  if (!SYNC_BACKGROUND_SECRET || providedSecret !== SYNC_BACKGROUND_SECRET) {
    return jsonResponse(
      {
        ok: false,
        code: "unauthorized",
        message: "No autorizado."
      },
      401
    );
  }

  const lockId = parseBody(event.body)?.lockId;
  if (typeof lockId !== "string") {
    return jsonResponse(
      {
        ok: false,
        code: "invalid_lock",
        message: "Lock invalido."
      },
      400
    );
  }

  const lockState = getSyncLockState(await readSyncLock());
  if (lockState.state !== "active" || lockState.lock?.id !== lockId) {
    return jsonResponse(
      {
        ok: false,
        code: "lock_not_owned",
        message: "La sincronizacion ya no posee el lock."
      },
      409
    );
  }

  try {
    await runSync();
  } catch (error) {
    console.error("[sync-background] sync failed", error);
  } finally {
    await releaseSyncLock(lockId);
  }

  return jsonResponse({
    ok: true
  });
};
