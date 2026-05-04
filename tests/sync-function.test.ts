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

import { handler } from "../netlify/functions/sync";

function createEvent(overrides: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    httpMethod: "POST",
    headers: {},
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
    vi.clearAllMocks();
    readHealthMock.mockResolvedValue(null);
    readSyncLockMock.mockResolvedValue(null);
    writeSyncLockMock.mockResolvedValue(undefined);
    deleteSyncLockMock.mockResolvedValue(undefined);
    runSyncMock.mockResolvedValue({
      snapshot: {
        generatedAt: "2026-04-21T12:00:00.000Z"
      },
      health: createHealth()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("limpia lock expirado y sincroniza", async () => {
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
    expect(response?.statusCode).toBe(200);
    expect(deleteSyncLockMock).toHaveBeenCalled();
    expect(runSyncMock).toHaveBeenCalledTimes(1);
  });

  it("limpia lock invalido sin devolver 500", async () => {
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
    expect(response?.statusCode).toBe(200);
    expect(deleteSyncLockMock).toHaveBeenCalled();
    expect(runSyncMock).toHaveBeenCalledTimes(1);
  });

  it("escribe y libera lock en sync exitoso", async () => {
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
    expect(response?.statusCode).toBe(200);
    expect(writeSyncLockMock).toHaveBeenCalledTimes(1);
    expect(deleteSyncLockMock).toHaveBeenCalledTimes(1);
  });

  it("si runSync falla devuelve 500 generico y libera lock", async () => {
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
    runSyncMock.mockRejectedValue(new Error("ONPE timeout"));

    const response = await handler(createEvent(), {} as never, () => {});
    expect(response?.statusCode).toBe(500);
    const body = parseBody(response as { body: string });
    expect(body.code).toBe("sync_failed");
    expect(body.message).toBe("No se pudo completar la sincronizacion.");
    expect(deleteSyncLockMock).toHaveBeenCalledTimes(1);
  });
});
