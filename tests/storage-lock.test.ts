import { beforeEach, describe, expect, it, vi } from "vitest";

const { getStoreMock, randomUUIDMock } = vi.hoisted(() => ({
  getStoreMock: vi.fn(),
  randomUUIDMock: vi.fn()
}));

vi.mock("@netlify/blobs", () => ({
  getStore: getStoreMock
}));

vi.mock("node:crypto", () => ({
  randomUUID: randomUUIDMock
}));

import {
  acquireSyncLock,
  readSyncLock,
  releaseSyncLock
} from "../netlify/functions/_shared/storage";

function createLock(input: {
  key: string;
  token: string;
  trigger?: "manual" | "scheduled" | "snapshot_fallback";
  startedAt: string;
  expiresAt: string;
}) {
  return {
    trigger: "manual" as const,
    ...input
  };
}

function buildLockKey(timestamp: number, suffix: string) {
  return `sync-locks/${String(timestamp).padStart(16, "0")}-${suffix}`;
}

describe("storage sync lock election", () => {
  const blobs = new Map<string, unknown>();
  const deletedKeys: string[] = [];

  beforeEach(() => {
    blobs.clear();
    deletedKeys.length = 0;
    vi.clearAllMocks();
    getStoreMock.mockReturnValue({
      async get(key: string) {
        return blobs.get(key) ?? null;
      },
      async setJSON(key: string, value: unknown) {
        blobs.set(key, value);
      },
      async delete(key: string) {
        blobs.delete(key);
        deletedKeys.push(key);
      },
      async list({ prefix }: { prefix?: string } = {}) {
        return {
          blobs: [...blobs.keys()]
            .filter((key) => (prefix ? key.startsWith(prefix) : true))
            .sort()
            .map((key) => ({
              key,
              etag: key
            })),
          directories: []
        };
      }
    });
  });

  it("devuelve el lock activo mas antiguo y limpia locks expirados", async () => {
    const now = Date.parse("2026-04-30T01:50:00.000Z");
    const expiredLock = createLock({
      key: buildLockKey(Date.parse("2026-04-30T01:30:00.000Z"), "expired"),
      token: "expired",
      startedAt: "2026-04-30T01:30:00.000Z",
      expiresAt: "2026-04-30T01:40:00.000Z"
    });
    const winnerLock = createLock({
      key: buildLockKey(Date.parse("2026-04-30T01:45:00.000Z"), "winner"),
      token: "winner",
      startedAt: "2026-04-30T01:45:00.000Z",
      expiresAt: "2026-04-30T01:55:00.000Z"
    });
    const laterLock = createLock({
      key: buildLockKey(Date.parse("2026-04-30T01:46:00.000Z"), "later"),
      token: "later",
      startedAt: "2026-04-30T01:46:00.000Z",
      expiresAt: "2026-04-30T01:56:00.000Z"
    });
    blobs.set(expiredLock.key, expiredLock);
    blobs.set(winnerLock.key, winnerLock);
    blobs.set(laterLock.key, laterLock);

    const result = await readSyncLock(now);

    expect(result).toEqual(winnerLock);
    expect(deletedKeys).toContain(expiredLock.key);
    expect(blobs.has(expiredLock.key)).toBe(false);
  });

  it("pierde la eleccion cuando ya existe un contender activo mas antiguo", async () => {
    const now = Date.parse("2026-04-30T01:50:00.000Z");
    const existingLock = createLock({
      key: buildLockKey(Date.parse("2026-04-30T01:45:00.000Z"), "existing"),
      token: "existing",
      startedAt: "2026-04-30T01:45:00.000Z",
      expiresAt: "2026-04-30T01:55:00.000Z"
    });
    blobs.set(existingLock.key, existingLock);
    randomUUIDMock.mockReturnValue("candidate");

    const result = await acquireSyncLock("manual", 300, now);

    expect(result).toBeNull();
    expect(deletedKeys).toContain(buildLockKey(now, "candidate"));
    expect(blobs.has(existingLock.key)).toBe(true);
  });

  it("gana la eleccion cuando es el contender mas antiguo y luego libera su lock", async () => {
    const now = Date.parse("2026-04-30T01:50:00.000Z");
    randomUUIDMock.mockReturnValue("candidate");

    const lock = await acquireSyncLock("manual", 300, now);

    expect(lock).toEqual(
      createLock({
        key: buildLockKey(now, "candidate"),
        token: "candidate",
        startedAt: "2026-04-30T01:50:00.000Z",
        expiresAt: "2026-04-30T01:55:00.000Z"
      })
    );

    await releaseSyncLock("candidate");

    expect(blobs.size).toBe(0);
    expect(deletedKeys).toContain(buildLockKey(now, "candidate"));
  });
});
