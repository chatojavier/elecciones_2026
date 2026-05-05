import { randomUUID } from "node:crypto";

import { SYNC_LOCK_TTL_MS } from "./config";
import { getSyncLockState, type SyncInvocationKind } from "./syncGuard";
import {
  deleteSyncLock,
  readSyncLock,
  writeSyncLock,
  type SyncLock
} from "./storage";

export interface SyncLockAcquireResult {
  state: "acquired" | "active";
  lock: SyncLock;
}

export async function acquireSyncLock(kind: SyncInvocationKind, now = Date.now()) {
  const currentLockState = getSyncLockState(await readSyncLock(), now);

  if (currentLockState.state === "active" && currentLockState.lock) {
    return {
      state: "active",
      lock: currentLockState.lock
    } satisfies SyncLockAcquireResult;
  }

  if (currentLockState.state === "expired" || currentLockState.state === "invalid") {
    await deleteSyncLock();
  }

  const lock: SyncLock = {
    id: randomUUID(),
    kind,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SYNC_LOCK_TTL_MS).toISOString()
  };

  await writeSyncLock(lock);

  return {
    state: "acquired",
    lock
  } satisfies SyncLockAcquireResult;
}

export async function releaseSyncLock(_lockId: string) {
  await deleteSyncLock();
}
