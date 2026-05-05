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

const LOCK_VISIBILITY_RETRY_DELAYS_MS = [50, 100, 200, 400];

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readVisibleLock(lock: SyncLock) {
  for (const delay of [0, ...LOCK_VISIBILITY_RETRY_DELAYS_MS]) {
    if (delay > 0) {
      await sleep(delay);
    }

    const lockState = getSyncLockState(await readSyncLock());
    if (lockState.state === "active" && lockState.lock) {
      return lockState.lock;
    }
  }

  return lock;
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

  const visibleLock = await readVisibleLock(lock);
  if (visibleLock.id !== lock.id) {
    return {
      state: "active",
      lock: visibleLock
    } satisfies SyncLockAcquireResult;
  }

  return {
    state: "acquired",
    lock
  } satisfies SyncLockAcquireResult;
}

export async function releaseSyncLock(lockId: string) {
  const latestLockState = getSyncLockState(await readSyncLock());
  if (latestLockState.lock?.id === lockId) {
    await deleteSyncLock();
  }
}
