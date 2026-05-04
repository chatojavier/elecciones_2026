import type { HandlerEvent } from "@netlify/functions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HealthStatus } from "../src/lib/types";
import type { SyncLock } from "../netlify/functions/_shared/storage";

const connectLambdaMock = vi.hoisted(() => vi.fn());
const runSyncMock = vi.hoisted(() => vi.fn());
const readHealthMock = vi.hoisted(() => vi.fn());
const readSyncLockMock = vi.hoisted(() => vi.fn());
const writeSyncLockMock = vi.hoisted(() => vi.fn());
const deleteSyncLockMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@netlify/blobs", () => ({
  connectLambda: connectLambdaMock
}));

vi.mock("../netlify/functions/_shared/snapshot", () => ({
  runSync: runSyncMock
}));

vi.mock("../netlify/functions/_shared/storage", () => ({
  readHealth: readHealthMock,
  readSyncLock: readSyncLockMock,
  writeSyncLock: writeSyncLockMock,
  deleteSyncLock: deleteSyncLockMock
}));

vi.mock("../netlify/functions/_shared/config", () => ({
  HEALTH_KEY: "health",
  MANUAL_SYNC_MIN_INTERVAL_MS: 5 * 60 * 1000,
  SNAPSHOT_KEY: "snapshot",
  STORAGE_NAME: "onpe-results",
  SYNC_LOCK_KEY: "sync-lock",
  SYNC_LOCK_TTL_MS: 10 * 60 * 1000,
  SYNC_MANUAL_SECRET: ""
}));

import { handler } from "../netlify/functions/sync";
import { handler as backgroundHandler } from "../netlify/functions/sync-background";

function createEvent(overrides: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    httpMethod: "POST",
    headers: {
      host: "localhost:8888"
    },
    multiValueHeaders: {},
    body: null,
    rawUrl: "http://localhost/.netlify/functions/sync",
    rawQuery: "",
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    path: "/.netlify/functions/sync",
    isBase64Encoded: false,
    ...overrides
  } as HandlerEvent;
}

function createHealth(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return {
    status: "healthy",
    source: "onpe",
    lastSyncAt: "2026-04-21T12:01:00.000Z",
    lastSuccessAt: "2026-04-21T12:01:00.000Z",
    staleMinutes: 0,
    lastError: null,
    ...overrides
  };
}

function parseBody(response: { body: string }) {
  return JSON.parse(response.body) as Record<string, unknown>;
}

describe("sync function guards", () => {
  beforeEach(() => {
    connectLambdaMock.mockReset();
    runSyncMock.mockReset();
    readHealthMock.mockReset();
    readSyncLockMock.mockReset();
    writeSyncLockMock.mockReset();
    deleteSyncLockMock.mockReset();
    fetchMock.mockReset();
    readHealthMock.mockResolvedValue(null);
    readSyncLockMock.mockResolvedValue(null);
    writeSyncLockMock.mockResolvedValue(undefined);
    deleteSyncLockMock.mockResolvedValue(undefined);
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    runSyncMock.mockResolvedValue({
      snapshot: {
        generatedAt: "2026-04-21T12:00:00.000Z"
      },
      health: createHealth()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retorna 405 para metodo manual invalido", async () => {
    const response = await handler(createEvent({ httpMethod: "GET" }), {} as never, () => {});
    expect(response?.statusCode).toBe(405);
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  it("retorna 429 cuando hubo sync manual reciente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:05:00.000Z"));
    readHealthMock.mockResolvedValue(
      createHealth({ lastSuccessAt: "2026-04-21T12:03:00.000Z" })
    );

    const response = await handler(createEvent(), {} as never, () => {});
    expect(response?.statusCode).toBe(429);
    expect(parseBody(response as { body: string }).code).toBe("sync_too_recent");
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  it("retorna 202 con lock activo", async () => {
    readSyncLockMock.mockResolvedValue({
      id: "lock-1",
      kind: "manual",
      createdAt: "2026-04-21T12:00:00.000Z",
      expiresAt: "3026-04-21T12:10:00.000Z"
    } satisfies SyncLock);

    const response = await handler(createEvent(), {} as never, () => {});
    expect(response?.statusCode).toBe(202);
    expect(parseBody(response as { body: string }).code).toBe("sync_in_progress");
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  it("limpia lock expirado e inicia sync en background", async () => {
    readSyncLockMock
      .mockResolvedValueOnce({
        id: "lock-expired",
        kind: "manual",
        createdAt: "2020-01-01T00:00:00.000Z",
        expiresAt: "2020-01-01T00:10:00.000Z"
      })
      .mockImplementationOnce(async () => {
        const firstWrite = writeSyncLockMock.mock.calls[0]?.[0] as SyncLock;
        return firstWrite ?? null;
      })
      .mockResolvedValueOnce(null);

    const response = await handler(createEvent(), {} as never, () => {});
    expect(response?.statusCode).toBe(202);
    expect(parseBody(response as { body: string }).code).toBe("sync_started");
    expect(deleteSyncLockMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  it("limpia lock invalido e inicia sync en background", async () => {
    readSyncLockMock
      .mockResolvedValueOnce({
        bogus: true
      })
      .mockImplementationOnce(async () => {
        const firstWrite = writeSyncLockMock.mock.calls[0]?.[0] as SyncLock;
        return firstWrite ?? null;
      })
      .mockResolvedValueOnce(null);

    const response = await handler(createEvent(), {} as never, () => {});
    expect(response?.statusCode).toBe(202);
    expect(parseBody(response as { body: string }).code).toBe("sync_started");
    expect(deleteSyncLockMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runSyncMock).not.toHaveBeenCalled();
  });

  it("escribe lock e inicia sync en background", async () => {
    readSyncLockMock
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async () => {
        const firstWrite = writeSyncLockMock.mock.calls[0]?.[0] as SyncLock;
        return firstWrite ?? null;
      })
      .mockImplementationOnce(async () => {
        const firstWrite = writeSyncLockMock.mock.calls[0]?.[0] as SyncLock;
        return firstWrite ?? null;
      });

    const response = await handler(createEvent(), {} as never, () => {});
    expect(response?.statusCode).toBe(202);
    expect(parseBody(response as { body: string }).code).toBe("sync_started");
    expect(writeSyncLockMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(deleteSyncLockMock).not.toHaveBeenCalled();
  });

  it("si no puede iniciar background devuelve 500 generico y libera lock", async () => {
    readSyncLockMock
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async () => {
        const firstWrite = writeSyncLockMock.mock.calls[0]?.[0] as SyncLock;
        return firstWrite ?? null;
      })
      .mockImplementationOnce(async () => {
        const firstWrite = writeSyncLockMock.mock.calls[0]?.[0] as SyncLock;
        return firstWrite ?? null;
      });
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    const response = await handler(createEvent(), {} as never, () => {});
    expect(response?.statusCode).toBe(500);
    const body = parseBody(response as { body: string });
    expect(body.code).toBe("sync_failed");
    expect(body.message).toBe("No se pudo completar la sincronizacion.");
    expect(deleteSyncLockMock).toHaveBeenCalledTimes(1);
  });

  it("background ejecuta runSync y libera su lock", async () => {
    readSyncLockMock.mockResolvedValue({
      id: "lock-background",
      kind: "manual",
      createdAt: "2026-04-21T12:00:00.000Z",
      expiresAt: "3026-04-21T12:10:00.000Z"
    } satisfies SyncLock);

    const response = await backgroundHandler(
      createEvent({
        queryStringParameters: {
          lockId: "lock-background"
        }
      }),
      {} as never,
      () => {}
    );

    expect(response?.statusCode).toBe(200);
    expect(runSyncMock).toHaveBeenCalledTimes(1);
    expect(deleteSyncLockMock).toHaveBeenCalledTimes(1);
  });

  it("background relanza errores de runSync y conserva lock para retry", async () => {
    readSyncLockMock.mockResolvedValue({
      id: "lock-background",
      kind: "manual",
      createdAt: "2026-04-21T12:00:00.000Z",
      expiresAt: "3026-04-21T12:10:00.000Z"
    } satisfies SyncLock);
    runSyncMock.mockRejectedValue(new Error("ONPE timeout"));

    await expect(
      backgroundHandler(
        createEvent({
          queryStringParameters: {
            lockId: "lock-background"
          }
        }),
        {} as never,
        () => {}
      )
    ).rejects.toThrow("ONPE timeout");

    expect(deleteSyncLockMock).not.toHaveBeenCalled();
  });
});
