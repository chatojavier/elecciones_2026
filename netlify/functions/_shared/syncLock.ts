import { randomUUID } from "node:crypto";

import {
  HEALTH_KEY,
  SNAPSHOT_KEY,
  SYNC_LOCK_KEY,
  SYNC_LOCK_TTL_MS,
  type RoundStorageConfig
} from "./config";
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

export async function acquireSyncLock(
  kind: SyncInvocationKind,
  storageConfig: RoundStorageConfig = {
    round: "first",
    snapshotKey: SNAPSHOT_KEY,
    healthKey: HEALTH_KEY,
    syncLockKey: SYNC_LOCK_KEY
  },
  now = Date.now()
) {
  const currentLockState = getSyncLockState(await readSyncLock(storageConfig), now);

  if (currentLockState.state === "active" && currentLockState.lock) {
    return {
      state: "active",
      lock: currentLockState.lock
    } satisfies SyncLockAcquireResult;
  }

  if (currentLockState.state === "expired" || currentLockState.state === "invalid") {
    await deleteSyncLock(storageConfig);
  }

  const lock: SyncLock = {
    id: randomUUID(),
    kind,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SYNC_LOCK_TTL_MS).toISOString()
  };

  await writeSyncLock(lock, storageConfig);

  const visibleLock = await readVisibleLockWithConfig(lock, storageConfig);
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

async function readVisibleLockWithConfig(lock: SyncLock, storageConfig: RoundStorageConfig) {
  for (const delay of [0, ...LOCK_VISIBILITY_RETRY_DELAYS_MS]) {
    if (delay > 0) {
      await sleep(delay);
    }

    const lockState = getSyncLockState(await readSyncLock(storageConfig));
    if (lockState.state === "active" && lockState.lock) {
      return lockState.lock;
    }
  }

  return lock;
}

export async function releaseSyncLock(
  lock: SyncLock,
  storageConfig: RoundStorageConfig = {
    round: "first",
    snapshotKey: SNAPSHOT_KEY,
    healthKey: HEALTH_KEY,
    syncLockKey: SYNC_LOCK_KEY
  },
  now = Date.now()
) {
  if (now < new Date(lock.expiresAt).getTime()) {
    await deleteSyncLock(storageConfig);
  }
}
