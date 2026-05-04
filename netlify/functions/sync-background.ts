import { runSync } from "./_shared/snapshot";
import { releaseSyncLock } from "./_shared/syncLock";
import { getSyncLockState } from "./_shared/syncGuard";
import { readSyncLock } from "./_shared/storage";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function parseBody(request: Request) {
  const text = await request.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as { lockId?: unknown };
  } catch {
    return null;
  }
}

async function getLockId(request: Request) {
  const queryLockId = new URL(request.url).searchParams.get("lockId");
  if (typeof queryLockId === "string") {
    return queryLockId;
  }

  return (await parseBody(request))?.lockId;
}

export default async (request: Request) => {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        code: "method_not_allowed",
        message: "Metodo no permitido."
      },
      405
    );
  }

  const lockId = await getLockId(request);
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
    await releaseSyncLock(lockId);
  } catch (error) {
    console.error("[sync-background] sync failed", error);
    throw error;
  }

  return jsonResponse({
    ok: true
  });
};
