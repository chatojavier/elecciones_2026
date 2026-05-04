import { connectLambda } from "@netlify/blobs";
import type { Handler } from "@netlify/functions";

import { jsonResponse } from "./_shared/http";
import { runSync } from "./_shared/snapshot";
import { releaseSyncLock } from "./_shared/syncLock";
import { getSyncLockState } from "./_shared/syncGuard";
import { readSyncLock } from "./_shared/storage";

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

function getLockId(event: Parameters<Handler>[0]) {
  const queryLockId = event.queryStringParameters?.lockId;
  if (typeof queryLockId === "string") {
    return queryLockId;
  }

  return parseBody(event.body)?.lockId;
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

  const lockId = getLockId(event);
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
