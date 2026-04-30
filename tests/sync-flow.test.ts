import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  runSyncMock,
  readHealthMock,
  readSyncLockMock,
  acquireSyncLockMock,
  releaseSyncLockMock
} = vi.hoisted(() => ({
  runSyncMock: vi.fn(),
  readHealthMock: vi.fn(),
  readSyncLockMock: vi.fn(),
  acquireSyncLockMock: vi.fn(),
  releaseSyncLockMock: vi.fn()
}));

vi.mock("../netlify/functions/_shared/snapshot", () => ({
  runSync: runSyncMock
}));

vi.mock("../netlify/functions/_shared/storage", () => ({
  readHealth: readHealthMock,
  readSyncLock: readSyncLockMock,
  acquireSyncLock: acquireSyncLockMock,
  releaseSyncLock: releaseSyncLockMock
}));

import { runSyncFlow } from "../netlify/functions/_shared/sync";

function createSnapshot() {
  return {
    generatedAt: "2026-04-21T12:01:00.000Z"
  };
}

function createHealth(lastSuccessAt = "2026-04-21T12:01:00.000Z") {
  return {
    status: "healthy",
    source: "onpe",
    lastSyncAt: lastSuccessAt,
    lastSuccessAt,
    staleMinutes: 0,
    lastError: null
  };
}

describe("runSyncFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSyncLockMock.mockResolvedValue(null);
    readHealthMock.mockResolvedValue(null);
    acquireSyncLockMock.mockResolvedValue({
      token: "lock-1",
      trigger: "manual",
      startedAt: "2026-04-21T12:03:00.000Z",
      expiresAt: "2026-04-21T12:08:00.000Z"
    });
  });

  it("devuelve in_progress si ya existe un lock activo", async () => {
    readSyncLockMock.mockResolvedValue({
      token: "lock-1",
      trigger: "manual",
      startedAt: "2026-04-21T12:03:00.000Z",
      expiresAt: "2026-04-21T12:08:00.000Z"
    });

    const result = await runSyncFlow("manual", Date.parse("2026-04-21T12:03:30.000Z"));

    expect(result).toEqual({
      state: "in_progress",
      statusCode: 202
    });
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  it("devuelve recent para sync manual dentro de la ventana minima", async () => {
    readHealthMock.mockResolvedValue(createHealth("2026-04-21T12:02:30.000Z"));

    const result = await runSyncFlow("manual", Date.parse("2026-04-21T12:03:30.000Z"));

    expect(result).toEqual({
      state: "recent",
      statusCode: 429,
      retryAfterSeconds: 120
    });
    expect(readHealthMock).toHaveBeenCalledWith("strong");
    expect(acquireSyncLockMock).not.toHaveBeenCalled();
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  it("permite sync programado aunque exista un exito reciente", async () => {
    const snapshot = createSnapshot();
    const health = createHealth();
    const now = Date.parse("2026-04-21T12:03:30.000Z");
    readHealthMock.mockResolvedValue(createHealth("2026-04-21T12:02:30.000Z"));
    runSyncMock.mockResolvedValue({ snapshot, health });

    const result = await runSyncFlow("scheduled", now);

    expect(result).toEqual({
      state: "synced",
      statusCode: 200,
      snapshot,
      health
    });
    expect(acquireSyncLockMock).toHaveBeenCalledWith("scheduled", 300, now);
    expect(releaseSyncLockMock).toHaveBeenCalledWith("lock-1");
  });

  it("libera el lock si runSync falla", async () => {
    runSyncMock.mockRejectedValue(new Error("timeout"));

    await expect(
      runSyncFlow("manual", Date.parse("2026-04-21T12:10:00.000Z"))
    ).rejects.toThrow("timeout");

    expect(releaseSyncLockMock).toHaveBeenCalledWith("lock-1");
  });
});
